/**
 * lib/ziwei/sse —— 解读接口的 SSE 帧格式
 *
 * 三个客户端（components/InsightPanel.tsx / components/ChatPanel.tsx /
 * app/heming/page.tsx）统一按这个方言解析：
 *   data: {"delta":{"text":"…"}}\n\n   一段文本增量
 *   data: [DONE]\n\n                结束
 *
 * 客户端把各帧的 text 顺次拼接后再按行拆小节（正则 ^\*\*【(.+?)】\*\*$），
 * 所以增量必须原样送达，换行不能吞 —— 否则整篇挤成一行，小节渲染全失效。
 */

export function sseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  };
}

/** 一段文本增量的帧 */
export function deltaFrame(text: string): string {
  return `data: ${JSON.stringify({ delta: { text } })}\n\n`;
}

/** 结束帧 */
export const DONE_FRAME = 'data: [DONE]\n\n';

/**
 * 纯文本响应：本地查表结果走这条。
 * 按空行分段慢慢吐，界面上有「逐段生成」的观感。
 */
export function sseText(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const re = /\n\n+/g;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const part = text.slice(last, m.index);
        last = m.index + m[0].length;
        if (!part.trim()) continue;
        controller.enqueue(encoder.encode(deltaFrame(part + '\n\n')));
        await new Promise((r) => setTimeout(r, 12));
      }
      const rest = text.slice(last);
      if (rest.trim()) {
        controller.enqueue(encoder.encode(deltaFrame(rest)));
        await new Promise((r) => setTimeout(r, 12));
      }
      controller.enqueue(encoder.encode(DONE_FRAME));
      controller.close();
    },
  });
  return new Response(stream, { headers: sseHeaders() });
}

/**
 * 模型流：边收边转发。
 *
 * 失败时的兜底分两种，因为响应头已经发出去了，改不了状态码：
 *   - 一个字都没吐出来 → 整篇换成兜底正文（用户看不出断过）
 *   - 已经吐了一半 → 保留已出的内容，只补一句提示
 */
export function sseModel(
  run: (emit: (text: string) => void) => Promise<void>,
  fallback: string,
): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      async start(controller) {
        let emitted = 0;
        const emit = (t: string) => {
          if (!t) return;
          emitted++;
          controller.enqueue(encoder.encode(deltaFrame(t)));
        };
        try {
          await run(emit);
        } catch (err) {
          console.error('[sse] 模型流失败:', err);
          if (emitted === 0) {
            emit(fallback || '模型调用失败，且本地解读数据集没有可用内容。');
          } else {
            // 已经吐出来的多半是模型的半截正文，别说是「数据集的结果」
            emit('\n\n（模型调用中断，以上内容可能不完整。）');
          }
        } finally {
          controller.enqueue(encoder.encode(DONE_FRAME));
          controller.close();
        }
      },
    }),
    { headers: sseHeaders() },
  );
}
