/**
 * app/api/interpret —— 本地解读接口
 *
 * 开源版原本没有这个路由（客户端会收到 404 并提示「开源版不含 AI 解读接口」）。
 * 这里用本地解读数据集把它补上：查表拿到该命盘 13 维解读中与提问相关的一维，
 * 按客户端请求的小节结构返回，全程本地计算，不需要任何 API Key、不产生任何出网请求。
 */
import type { NextRequest } from 'next/server';
import { DATASET_RANGE, datasetInstalled, lookupReading } from '@/lib/ziwei/dataset';
import { buildAnswer } from '@/lib/ziwei/interpret';

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

function sse(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // 按空行分段，模拟流式输出。分隔符必须一起发出去：客户端是把各段原文
      // 顺次拼接的，丢掉 \n\n 的话整篇会挤成一行，**【小节名】** 也就不再独占一行，
      // 渲染端的分节逻辑会全部失效。
      const re = /\n\n+/g;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const part = text.slice(last, m.index);
        last = m.index + m[0].length;
        if (!part.trim()) continue;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text: part + '\n\n' } })}\n\n`));
        await new Promise((r) => setTimeout(r, 12));
      }
      const rest = text.slice(last);
      if (rest.trim()) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: { text: rest } })}\n\n`));
        await new Promise((r) => setTimeout(r, 12));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

export async function POST(request: NextRequest) {
  if (!datasetInstalled()) {
    // 没装数据集 -> 404，客户端会显示原本的「开源版不含该接口」提示
    return new Response('dataset not installed', { status: 404 });
  }

  let body: { chart?: ChartPayload; messages?: MessagePayload[] };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 });
  }

  const info = body.chart?.birthInfo;
  if (!info) return Response.json({ error: 'missing chart.birthInfo' }, { status: 400 });

  const prompt = (body.messages ?? []).filter((m) => m.role === 'user').pop()?.content ?? '';

  if (info.year < DATASET_RANGE.first || info.year > DATASET_RANGE.last) {
    return sse(
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
    return sse('未在解读数据集中找到这张命盘，请核对出生日期与时辰。');
  }

  return sse(buildAnswer(prompt, reading));
}
