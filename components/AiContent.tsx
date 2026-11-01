'use client';

/**
 * components/AiContent —— 事实层文本的渲染器
 *
 * 事实层吐的是纯文本（带 `**【小节名】**` 的小节标题、`**粗体**`），
 * 这里负责把它渲染成界面。客户端**不解析**小节名——它只按行看，
 * 遇到 `**【…】**` 就画一个金色小标题。所以服务端往正文里多加一个小节，
 * 客户端不用改代码就能显示出来。
 */

/** 把 `**【…】**` 行拆成小节，其余按行渲染，`**粗体**` 解析成 strong */
export default function AiContent({ text, streaming }: { text: string; streaming?: boolean }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        const sectionMatch = line.match(/^\*\*【(.+?)】\*\*$/);
        if (sectionMatch) {
          return (
            <div
              key={i}
              className="pt-4 pb-1 pl-2.5 first:pt-0 border-l-2"
              style={{ borderColor: 'var(--t-gold)' }}
            >
              <span className="text-[14px] font-semibold tracking-wide" style={{ color: 'var(--t-gold)' }}>
                【{sectionMatch[1]}】
              </span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1.5" />;
        const parts = line.split(/\*\*(.+?)\*\*/);
        return (
          <div key={i} className="text-[13.5px] leading-[1.85]" style={{ color: 'var(--t-text1)' }}>
            {parts.map((part, j) =>
              j % 2 === 0
                ? part
                : <strong key={j} className="font-medium" style={{ color: 'var(--t-text)' }}>{part}</strong>
            )}
          </div>
        );
      })}
      {streaming && (
        <span
          className="inline-block w-1.5 h-3 ml-0.5 animate-pulse rounded-sm align-middle"
          style={{ background: 'var(--t-gold)', opacity: 0.6 }}
        />
      )}
    </div>
  );
}
