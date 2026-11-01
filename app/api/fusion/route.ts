/**
 * app/api/fusion —— 八字 × 紫微合参接口
 *
 * 与 /api/interpret 的分工：
 *   /api/interpret  解的是「这个盘怎么样」（本命断语 + 大限流年四化）
 *   /api/fusion     解的是「命主该做什么行业、在什么性质的单位里做什么性质的事」
 *                   ——把两套体系落在同一组轴上的判断相乘，再让跨轴约束筛掉不成立的组合。
 *
 *   事实层：lib/ziwei/fusion-text.ts 的 buildFusionFacts —— 纯确定性，
 *           八字四柱用排盘引擎算好的节气四柱，不另起炉灶，口径与命盘一致。
 *   表达层：大模型用 FUSION_METHODOLOGY 把事实讲给命主听。
 *
 * 与 /api/heming 一样**不依赖本地解读数据集**：只要有一张命盘就能跑，
 * 所以合参在没装数据集的机器上也能用。
 */
import type { NextRequest } from 'next/server';
import { buildFusionFacts } from '@/lib/ziwei/fusion-text';
import { FUSION_METHODOLOGY } from '@/lib/ziwei/fusion-knowledge';
import { chartDigest, modelEnabled, streamAnswer } from '@/lib/ziwei/model';
import { sseModel, sseText } from '@/lib/ziwei/sse';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';

interface Body {
  chart?: Partial<ZiweiChart>;
  /** 追问 */
  question?: string;
  /** 上一次追问的内容 */
  prevQuestion?: string;
  /** 运限年份，默认今年 */
  year?: number;
}

function isChart(c: unknown): c is ZiweiChart {
  const x = c as Partial<ZiweiChart> | null;
  return !!x && Array.isArray(x.palaces) && x.palaces.length > 0 && Array.isArray(x.daXians);
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 });
  }

  if (!isChart(body.chart)) {
    return Response.json({ error: 'missing chart' }, { status: 400 });
  }

  const chart = body.chart;
  const year = body.year ?? new Date().getFullYear();

  // 事实层
  const facts = buildFusionFacts(chart, year);

  if (!modelEnabled()) {
    return sseText(facts.text);
  }

  const question = (body.question ?? '').trim();
  const ask = question
    ? `请针对「${question}」这一问，在完整合参分析的基础上重点作答。`
    : '请给出完整的八字×紫微合参分析：命主适合做什么行业、在什么性质的单位里做什么性质的事。';

  return sseModel(
    async (emit) => {
      for await (const chunk of streamAnswer({
        question: ask,
        prevQuestion: body.prevQuestion?.slice(0, 300),
        facts: facts.text,
        digest: chartDigest(chart),
        system: FUSION_METHODOLOGY,
        effort: 'medium',
      })) {
        emit(chunk);
      }
    },
    facts.text,
  );
}
