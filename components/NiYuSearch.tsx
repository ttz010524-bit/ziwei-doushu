'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * components/NiYuSearch —— 倪师原话检索（client component）
 *
 * 语料在服务端（app/api/niyu），这里只发查询、渲染结果。
 * 741 KB 的语料不进浏览器包。
 *
 * 每条命中都给三样东西：
 *   原话（一字不改）、考据标注（错字裁决）、出处（节 + 时间码 + 第几讲 + B 站那一秒）。
 * 少了出处就等于让读者没法核对——那是二手引述，不是原话。
 */

export interface NiHitView {
  quote: string;
  note: string;
  book: string;
  bookLabel: string;
  h2: string;
  h3: string;
  t_hms: string;
  part: number;
  bvid: string;
  url: string;
  citation: string;
  score: number;
  stars: string[];
  palaces: string[];
  siHua: string[];
}

interface Props {
  stars: string[];
  /** 14 主星——落地页的入口卡片 */
  mainStars: string[];
  palaces: string[];
  books: { id: string; label: string }[];
}

interface ApiResp {
  installed: boolean;
  total: number;
  hits: NiHitView[];
  message?: string;
}

const SI_HUA = ['禄', '权', '科', '忌'];

export default function NiYuSearch({ stars, mainStars, palaces, books }: Props) {
  const [q, setQ] = useState('');
  const [star, setStar] = useState<string[]>([]);
  const [palace, setPalace] = useState<string[]>([]);
  const [siHua, setSiHua] = useState<string[]>([]);
  const [book, setBook] = useState<string[]>([]);
  const [resp, setResp] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => {
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  };

  const run = useCallback(async (signal?: AbortSignal) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set('q', q.trim());
    if (star.length) sp.set('stars', star.join(','));
    if (palace.length) sp.set('palaces', palace.join(','));
    if (siHua.length) sp.set('siHua', siHua.join(','));
    if (book.length) sp.set('books', book.join(','));
    sp.set('limit', '40');

    // 什么都没选就不查：1848 条按语料顺序倒出来，头几条多半是阳宅相法，
    // 对「找一句关于紫微的话」这件事毫无帮助。不如把入口摆出来。
    if (!sp.has('q') && !sp.has('stars') && !sp.has('palaces') && !sp.has('siHua') && !sp.has('books')) {
      setResp(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/niyu?${sp.toString()}`, { signal });
      const data = (await res.json()) as ApiResp;
      setResp(data);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setResp({ installed: true, total: 0, hits: [], message: '检索失败，请稍后重试。' });
      }
    } finally {
      setLoading(false);
    }
  }, [q, star, palace, siHua, book]);

  // 输入停顿后再查，避免每敲一个字就打一次
  useEffect(() => {
    const t = setTimeout(() => { void run(); }, 220);
    return () => clearTimeout(t);
  }, [run]);

  const hits = resp?.hits ?? [];
  const hasFilter = !!q.trim() || star.length || palace.length || siHua.length || book.length;

  const chip = (active: boolean) => ({
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '11.5px',
    lineHeight: 1.5,
    border: `1px solid ${active ? 'var(--ac)' : 'var(--bdr-med)'}`,
    background: active ? 'var(--ac-bg)' : 'transparent',
    color: active ? 'var(--ac)' : 'var(--tx-2)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div>
      {/* 搜索框 */}
      <div style={{
        display: 'flex', gap: '8px', padding: '6px',
        background: 'var(--bg-card)',
        border: '1px solid rgba(184,146,42,0.3)',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(184,146,42,0.08)',
      }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜原话，如：武官 / 官禄 / 化忌 / 横祸"
          style={{
            flex: 1, padding: '10px 14px', border: 'none', outline: 'none',
            fontSize: '14px', color: 'var(--tx-0)', background: 'transparent',
          }}
        />
        <button
          onClick={() => void run()}
          disabled={loading}
          style={{
            padding: '10px 22px', borderRadius: '8px', border: 'none',
            background: 'linear-gradient(135deg, #d4a948 0%, #b8922a 100%)',
            color: 'white', fontSize: '13px', fontWeight: 600, letterSpacing: '0.15em',
            cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '…' : '搜索'}
        </button>
      </div>

      {/* 过滤维度 */}
      <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <FilterRow label="星曜">
          {stars.map((s) => (
            <button key={s} style={chip(star.includes(s))} onClick={() => toggle(star, setStar, s)}>
              {s}
            </button>
          ))}
        </FilterRow>
        <FilterRow label="宫位">
          {palaces.map((p) => (
            <button key={p} style={chip(palace.includes(p))} onClick={() => toggle(palace, setPalace, p)}>
              {p}
            </button>
          ))}
        </FilterRow>
        <FilterRow label="四化">
          {SI_HUA.map((h) => (
            <button key={h} style={chip(siHua.includes(h))} onClick={() => toggle(siHua, setSiHua, h)}>
              化{h}
            </button>
          ))}
        </FilterRow>
        <FilterRow label="分册">
          {books.map((b) => (
            <button key={b.id} style={chip(book.includes(b.id))} onClick={() => toggle(book, setBook, b.id)}>
              {b.label}
            </button>
          ))}
        </FilterRow>
      </div>

      {/* 结果 */}
      <div style={{ marginTop: '18px' }}>
        {!hasFilter && !resp ? (
          /* 落地：还没选任何条件——摆出 14 主星当入口 */
          <div>
            <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginBottom: '10px', letterSpacing: '0.1em' }}>
              从 14 主星开始
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '8px' }}>
              {mainStars.map((s) => (
                <button
                  key={s}
                  onClick={() => setStar([s])}
                  style={{
                    padding: '12px 6px', borderRadius: '10px',
                    background: 'var(--bg-card)',
                    border: '1px solid rgba(184,146,42,0.2)',
                    color: 'var(--tx-0)', fontSize: '14px', fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--tx-3)', marginTop: '14px', lineHeight: 1.8 }}>
              点一颗主星，或在上面的标签里选宫位 / 四化 / 分册。
              <br />
              关键词按字检索，多个词用空格分开，需要全部命中。
            </p>
          </div>
        ) : !resp ? (
          <div style={{ fontSize: '13px', color: 'var(--tx-3)', textAlign: 'center', padding: '30px 0' }}>
            正在检索…
          </div>
        ) : !resp.installed ? (
          <EmptyBox title="语料库未安装">
            {resp.message ?? '找不到 docs/tianji-ziwei/entries.jsonl。'}
          </EmptyBox>
        ) : hits.length === 0 ? (
          <EmptyBox title="没有命中的原话">
            换个说法试试，或去掉几个筛选条件。
          </EmptyBox>
        ) : (
          <>
            <div style={{ fontSize: '12px', color: 'var(--tx-3)', marginBottom: '12px' }}>
              命中 <strong style={{ color: 'var(--ac)' }}>{hits.length}</strong> 条
              {resp.total > 0 && <span>（语料共 {resp.total} 条）</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {hits.map((h, i) => (
                <article
                  key={i}
                  style={{
                    background: 'var(--bg-card)',
                    padding: '16px 20px',
                    borderRadius: '10px',
                    border: '1px solid rgba(184,146,42,0.18)',
                  }}
                >
                  {/* 出处 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                    fontSize: '11px', color: 'var(--tx-3)', marginBottom: '9px', letterSpacing: '0.05em',
                  }}>
                    <span style={{ color: 'var(--ac)', fontWeight: 600 }}>{h.bookLabel}</span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span>{h.h2}</span>
                    {h.h3 && (
                      <>
                        <span style={{ opacity: 0.5 }}>·</span>
                        <span>{h.h3}</span>
                      </>
                    )}
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{h.t_hms}</span>
                    <span style={{ opacity: 0.5 }}>·</span>
                    <span>第{h.part}讲</span>
                  </div>

                  {/* 原话 */}
                  <div style={{ fontSize: '14.5px', color: 'var(--tx-0)', lineHeight: 1.95, letterSpacing: '0.02em' }}>
                    「{h.quote}」
                  </div>

                  {/* 考据标注 */}
                  {h.note && (
                    <div style={{
                      marginTop: '8px', fontSize: '11.5px', color: 'var(--ac-dim)',
                      background: 'var(--ac-bg)', borderRadius: '6px', padding: '5px 9px',
                      display: 'inline-block',
                    }}>
                      考据：{h.note}
                    </div>
                  )}

                  {/* 命中标签 + 链接 */}
                  <div style={{
                    marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
                  }}>
                    {[...h.stars, ...h.palaces, ...h.siHua.map((x) => `化${x}`)].map((t) => (
                      <span key={t} style={{
                        fontSize: '10.5px', color: 'var(--tx-3)',
                        border: '1px solid var(--bdr-med)', borderRadius: '4px', padding: '1px 6px',
                      }}>
                        {t}
                      </span>
                    ))}
                    <a
                      href={h.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      style={{
                        marginLeft: 'auto', fontSize: '11.5px', color: 'var(--ac)',
                        textDecoration: 'none', letterSpacing: '0.1em',
                      }}
                    >
                      听原话 ↗
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{
        fontSize: '11px', color: 'var(--tx-3)', letterSpacing: '0.15em',
        minWidth: '32px', flexShrink: 0, paddingTop: '3px',
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{children}</div>
    </div>
  );
}

function EmptyBox({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--bg-card)', padding: '40px 20px', borderRadius: '12px',
      textAlign: 'center', color: 'var(--tx-2)', border: '1px solid rgba(184,146,42,0.15)',
    }}>
      <div style={{ fontSize: '14px', marginBottom: '6px' }}>{title}</div>
      <div style={{ fontSize: '11.5px', color: 'var(--tx-3)', lineHeight: 1.7 }}>{children}</div>
    </div>
  );
}
