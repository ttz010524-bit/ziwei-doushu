'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * components/ChartNav —— 命盘 / 解读 两页之间的切换条
 *
 * 命盘单独占一页、解读与合参另占一页之后，两页之间必须有一条明显的路，
 * 否则用户在「我想看盘」和「我想看解读」之间来回找。
 */

const TABS = [
  { href: '/chart', label: '命盘' },
  { href: '/reading', label: '解读 · 合参' },
];

export default function ChartNav() {
  const path = usePathname();
  return (
    <nav className="flex items-center justify-between gap-3 flex-wrap">
      <div className="text-[11px] tracking-[0.3em]" style={{ color: 'var(--t-gold)' }}>
        紫微命盘
      </div>
      <div className="flex items-center gap-1.5">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="text-[12px] px-3 py-1.5 rounded-full transition-colors"
              style={{
                border: `1px solid ${active ? 'var(--ac-bdr)' : 'var(--t-border)'}`,
                background: active ? 'var(--ac-bg)' : 'transparent',
                color: active ? 'var(--t-gold)' : 'var(--t-text2)',
                textDecoration: 'none',
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
