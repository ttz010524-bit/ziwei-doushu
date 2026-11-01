/**
 * app/api/interpret —— 本地解读接口
 *
 * 开源版原本没有这个路由（客户端会收到 404 并提示「开源版不含 AI 解读接口」）。
 * 这里分两层实现：
 *
 *   事实层：本地解读数据集（v4.0）查表 + 排盘引擎现算的大限/流年四化，
 *           产出可核查的断语文本（lib/ziwei/interpret.ts 的 buildAnswer）。
 *   表达层：大模型（lib/ziwei/model.ts）把事实讲给命主听，按客户端要的
 *           小节结构组织。全程本地查表可独立工作，没配模型也能跑。
 *
 * 没有任何 API Key 时自动走纯本地查表；模型调用失败也会降级回查表结果。
 */
import type { NextRequest } from 'next/server';
import { DATASET_RANGE, datasetInstalled, lookupReading } from '@/lib/ziwei/dataset';
import { buildAnswer, type AnswerContext, type LuckContext } from '@/lib/ziwei/interpret';
import { chartDigest, modelEnabled, streamAnswer } from '@/lib/ziwei/model';
import { sseModel, sseText } from '@/lib/ziwei/sse';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';

interface ChartPayload {
  birthInfo?: {
    year: number;
    month: number;
    day: number;
    hour: number;
    gender: 'male' | 'female';
  };
}

interface MessagePayload {
  role: string;
  content: string;
}

export async function POST(request: NextRequest) {
  if (!datasetInstalled()) {
    // 没装数据集 -> 404，客户端会显示原本的「开源版不含该接口」提示
    return new Response('dataset not installed', { status: 404 });
  }

  let body: { chart?: ChartPayload & Partial<ZiweiChart>; messages?: MessagePayload[]; luck?: LuckContext };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 });
  }

  const info = body.chart?.birthInfo;
  if (!info) return Response.json({ error: 'missing chart.birthInfo' }, { status: 400 });

  const userMessages = (body.messages ?? []).filter((m) => m.role === 'user');
  const prompt = userMessages.pop()?.content ?? '';

  if (info.year < DATASET_RANGE.first || info.year > DATASET_RANGE.last) {
    return sseText(
      `解读数据集只覆盖 ${DATASET_RANGE.first}–${DATASET_RANGE.last} 年，` +
      `${info.year} 年暂无解读内容。排盘结果不受影响。`,
    );
  }

  const reading = await lookupReading({
    year: info.year,
    month: info.month,
    day: info.day,
    hour: info.hour,
    gender: info.gender,
  });
  if (!reading) {
    return sseText('未在解读数据集中找到这张命盘，请核对出生日期与时辰。');
  }

  // 命盘本身带进来：数据集只有本命断语，大限/流年四化与落宫关系要靠命盘现算
  const chart = body.chart && Array.isArray(body.chart.palaces) && Array.isArray(body.chart.daXians)
    ? (body.chart as unknown as ZiweiChart)
    : undefined;
  const ctx: AnswerContext = { chart, luck: body.luck };

  // 事实层：模型和本地查表共用同一份，模型挂了就是拿它兜底
  const facts = buildAnswer(prompt, reading, ctx);

  if (!modelEnabled() || !facts.trim()) {
    return sseText(facts);
  }

  // 自由追问时把上一轮问题带上，模型才知道「那今年呢」问的是什么
  const prevQuestion = userMessages.length
    ? userMessages[userMessages.length - 1].content.slice(0, 300)
    : undefined;

  return sseModel(
    async (emit) => {
      for await (const chunk of streamAnswer({
        question: prompt,
        prevQuestion,
        facts,
        digest: chart ? chartDigest(chart) : undefined,
      })) {
        emit(chunk);
      }
    },
    facts,
  );
}
