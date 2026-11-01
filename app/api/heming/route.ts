/**
 * app/api/heming —— 合盘分析接口
 *
 * 开源版原本没有这个路由（app/heming/page.tsx 里已经写好了 fetch 与 SSE 解析，
 * 只是拿不到数据）。这里补上服务端：
 *
 *   事实层：lib/ziwei/heming.ts 的 buildHemingFacts —— 用排盘引擎算出
 *           双方命宫/夫妻宫/福德宫主星与四化、天作之合的双向对应、
 *           四化互参的落宫、大限与当年流年，全是确定性的。
 *   表达层：大模型用仓库里已有的 HEMING_METHODOLOGY（倪海厦双宫联参 +
 *           五步法 + 十四主星夫妻宫断语）把事实写成给用户看的合盘报告。
 *
 * 与 /api/interpret 不同：合盘不依赖本地解读数据集，只要有两张命盘就能跑。
 */
import type { NextRequest } from 'next/server';
import { buildHemingFacts } from '@/lib/ziwei/heming';
import { HEMING_METHODOLOGY } from '@/lib/ziwei/heming-knowledge';
import { chartDigest, modelEnabled, streamAnswer } from '@/lib/ziwei/model';
import { sseModel, sseText } from '@/lib/ziwei/sse';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';

interface Body {
  chartA?: Partial<ZiweiChart>;
  chartB?: Partial<ZiweiChart>;
  question?: string;
  /** 上一轮追问的内容，模型才知道「那明年呢」问的是什么 */
  prevQuestion?: string;
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

  if (!isChart(body.chartA) || !isChart(body.chartB)) {
    return Response.json({ error: 'missing chartA/chartB' }, { status: 400 });
  }

  const chartA = body.chartA;
  const chartB = body.chartB;
  const year = body.year ?? new Date().getFullYear();

  // 事实层
  const facts = buildHemingFacts(chartA, chartB, year);

  if (!modelEnabled()) {
    return sseText(facts.text);
  }

  const question = (body.question ?? '').trim();
  const ask = question
    ? `请针对「${question}」这一问，在完整合盘分析的基础上重点作答。`
    : '请给出完整的双盘合盘分析。';

  return sseModel(
    async (emit) => {
      for await (const chunk of streamAnswer({
        question: ask,
        prevQuestion: body.prevQuestion?.slice(0, 300),
        facts: facts.text,
        digest: [
          `甲方${chartDigest(chartA)}`,
          `乙方${chartDigest(chartB)}`,
        ].join('\n\n'),
        system: HEMING_METHODOLOGY,
        effort: 'medium',
      })) {
        emit(chunk);
      }
    },
    facts.text,
  );
}
