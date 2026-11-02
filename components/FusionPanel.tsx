'use client';
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ZiweiChart } from '@/lib/ziwei/types';
import { buildFusionData, currentDaYun } from '@/lib/ziwei/fusion-data';
import { AXIS_NAME, AXIS_SOURCE, type Axis, type Verdict } from '@/lib/ziwei/fusion';
import { WU_XING_CAREER } from '@/lib/ziwei/bazi-labels';
import AiContent from './AiContent';

/** 一条命中的原话（/api/niyu 返回的结构） */
interface NiHit {
  quote: string;
  note: string;
  bookLabel: string;
  h2: string;
  h3: string;
  t_hms: string;
  part: number;
  url: string;
  citation: string;
}

/**
 * components/FusionPanel —— 「八字 × 紫微合参」面板
 *
 * 面板把合参的**确定性结果**直接摆在界面上，不经模型：
 *   八字四柱 / 旺衰 / 用神 → 三个轴上两侧各自的判断 → 叉乘后的落点候选 → 冲突。
 *
 * 三个轴里，**「行业五行」只由八字一侧给出**（用神／喜神五行）；
 * 紫微的星曜五行论的是星性，不是行业标签，所以那一格如实写「不参与」，
 * 不拿它去和用神五行凑一个对照。
 *
 * 为什么不让模型去算：三轴的叉乘与跨轴约束是集合运算，结果必须可复核；
 * 模型只负责把已经算好的结论讲成人话（「展开模型解读」按钮走 /api/fusion）。
 *
 * 计算全部在浏览器里跑（lib/ziwei/fusion-data.ts 是纯函数），
 * 所以改一个字、换一年，立刻重算，不等服务端。
 */

/** 判定的语义色：一致=金、单边=中性、兼容=金、矛盾=警示 */
const VERDICT_STYLE: Record<Verdict, { bg: string; fg: string; label: string }> = {
  一致: { bg: 'rgba(184,146,42,0.14)', fg: 'var(--t-gold)', label: '一致' },
  单边: { bg: 'var(--bg-2)', fg: 'var(--t-text2)', label: '单边' },
  兼容: { bg: 'rgba(184,146,42,0.09)', fg: 'var(--t-gold)', label: '兼容' },
  矛盾: { bg: 'rgba(168,50,40,0.13)', fg: 'var(--ji)', label: '矛盾' },
};

const AXIS_ORDER: Axis[] = ['org', 'func', 'field'];

interface FusionPanelProps {
  chart: ZiweiChart;
}

export default function FusionPanel({ chart }: FusionPanelProps) {
  const year = new Date().getFullYear();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState('');
  const [quotes, setQuotes] = useState<NiHit[]>([]);

  /**
   * 倪师原话：按本盘官禄／财帛／命宫实际坐的星曜现取。
   * 走服务端是因为「空宫借对宫」是倪师体系的规矩，浏览器那份数据算不出来；
   * 也因为语料不该进浏览器包。
   *
   * 这里把原话和它的出处一起摆出来——原话脱离了出处就是二手引述。
   */
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch('/api/niyu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chart, limit: 6 }),
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && Array.isArray(data.hits)) setQuotes(data.hits);
      } catch { /* 语料库没装就算了，不影响合参其余部分 */ }
    })();
    return () => { alive = false; ctrl.abort(); };
  }, [chart]);

  // 纯计算：改盘 / 换年都会重算
  const data = useMemo(() => {
    try {
      return buildFusionData(chart, year);
    } catch {
      return null;
    }
  }, [chart, year]);

  if (!data || !data.bazi) {
    return (
      <section className="rounded-xl overflow-hidden card-glass p-4">
        <h2 className="text-[14px] font-semibold" style={{ color: 'var(--t-text)' }}>八字 × 紫微合参</h2>
        <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: 'var(--t-faint)' }}>
          本盘取不到节气四柱，八字一侧不参与合参。
        </p>
      </section>
    );
  }

  const { bazi, result } = data;
  const dy = currentDaYun(bazi, year);

  const expand = async () => {
    if (loading) return;
    if (narrative) { setOpen(true); return; }
    setLoading(true);
    setOpen(true);
    try {
      const res = await fetch('/api/fusion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chart, year }),
      });
      if (!res.ok || !res.body) throw new Error('bad response');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            text += JSON.parse(data).delta?.text ?? '';
            setNarrative(text);
          } catch { /* 忽略坏帧 */ }
        }
      }
    } catch {
      setNarrative('模型解读失败。合参结论（上面的三轴、候选、冲突）是本地算的，不受影响。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl overflow-hidden card-glass">
      {/* ── 标题 ── */}
      <div className="px-4 pt-3.5 pb-2" style={{ borderBottom: '1px solid var(--t-border)' }}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[14px] font-semibold tracking-wide" style={{ color: 'var(--t-text)' }}>
            八字 × 紫微合参
          </h2>
          <span className="text-[10.5px]" style={{ color: 'var(--t-faint)' }}>本命盘 × 节气四柱</span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>
          {bazi.pillars.map((p, i) => `${bazi.pillarNames[i]}${p.gan}${p.zhi}`).join('　')}
          <span style={{ color: 'var(--t-faint)' }}>　·　</span>
          日主 {bazi.dayGan}{bazi.dayWuXing}
          <span style={{ color: 'var(--t-faint)' }}>　·　</span>
          {bazi.strength}{bazi.congGe ? `（${bazi.congGe.type}）` : ''}
          {bazi.useGod && (
            <>
              <span style={{ color: 'var(--t-faint)' }}>　·　</span>
              用神 {bazi.useGod.element}
              <span style={{ color: 'var(--t-faint)' }}>（{bazi.useGod.shiShen}）</span>
            </>
          )}
        </p>
        {dy && (
          <p className="mt-1 text-[11.5px]" style={{ color: 'var(--t-faint)' }}>
            当前大运 {dy.ganZhi}（{dy.startAge}–{dy.endAge} 岁）　·　{year} 流年
          </p>
        )}
      </div>

      {/* ── 三轴交叉 ── */}
      <div className="px-4 py-3 space-y-2.5">
        {AXIS_ORDER.map((axis) => {
          const f = result.axes.find((a) => a.axis === axis);
          if (!f) return null;
          const st = VERDICT_STYLE[f.verdict];
          const ziweiSide = f.values.find((v) => v.sources.some((s) => s.side === '紫微'));
          const baziSide = f.values.find((v) => v.sources.some((s) => s.side === '八字'));
          // 行业五行这一轴只有八字给得出，紫微的星曜五行是星性、不是行业标签，
          // 所以这一格如实写「不参与」，而不是拿星曜五行去凑一个对照。
          const baziOnly = AXIS_SOURCE[axis] === '八字';
          return (
            <div key={axis} className="rounded-lg px-3 py-2.5 card-inner">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[12.5px] font-medium" style={{ color: 'var(--t-text1)' }}>
                  {AXIS_NAME[axis]}
                  {baziOnly && (
                    <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--t-faint)' }}>
                      （八字定）
                    </span>
                  )}
                </span>
                <span
                  className="text-[10.5px] px-1.5 py-0.5 rounded"
                  style={{ background: st.bg, color: st.fg }}
                >
                  {st.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11.5px] leading-[1.6]">
                <div>
                  <div style={{ color: 'var(--t-faint)' }}>紫微</div>
                  <div style={{ color: baziOnly ? 'var(--t-faint)' : 'var(--t-text1)' }}>
                    {ziweiSide?.value ?? (baziOnly ? '不参与' : '—')}
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--t-faint)' }}>八字</div>
                  <div style={{ color: 'var(--t-text1)' }}>
                    {baziSide?.value ?? '—'}
                  </div>
                </div>
              </div>
              {baziOnly && (
                <p className="mt-1.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--t-faint)' }}>
                  行业五行只取八字的用神／喜神；紫微的星曜五行论的是星性，不用来定行业。
                </p>
              )}
              {f.intraSideConflict && (
                <p className="mt-1.5 text-[10.5px]" style={{ color: 'var(--ji)' }}>
                  ⚠ {f.intraSideConflict}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── 落点候选 ── */}
      <div className="px-4 pb-3">
        <div className="text-[11px] mb-1.5" style={{ color: 'var(--t-faint)' }}>职业落点候选</div>
        {result.candidates.length ? (
          <ol className="space-y-1">
            {result.candidates.slice(0, 3).map((c, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[12.5px] leading-[1.6]">
                <span style={{ color: 'var(--t-gold)' }}>{i + 1}.</span>
                <span style={{ color: 'var(--t-text1)' }}>
                  {c.org} × {c.func} × {c.field}
                  {c.field !== '未定' && WU_XING_CAREER[c.field as keyof typeof WU_XING_CAREER] && (
                    <span style={{ color: 'var(--t-faint)' }}>
                      （宜{WU_XING_CAREER[c.field as keyof typeof WU_XING_CAREER]}）
                    </span>
                  )}
                </span>
                {c.disputed && Object.keys(c.disputed).length > 0 && (
                  <span className="text-[10px] shrink-0" style={{ color: 'var(--ji)' }}>
                    有争议
                  </span>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[12px]" style={{ color: 'var(--t-faint)' }}>
            两侧信号不足以叉乘出一个落点。
          </p>
        )}
      </div>

      {/* ── 冲突 ── */}
      {result.conflicts.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[11px] mb-1.5" style={{ color: 'var(--t-faint)' }}>冲突与待复核</div>
          <ul className="space-y-1">
            {result.conflicts.map((c, i) => (
              <li key={i} className="text-[11.5px] leading-[1.6]" style={{ color: 'var(--ji)' }}>
                · {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 倪师原话（按本盘坐的星曜现取，出处随行） ── */}
      {quotes.length > 0 && (
        <div className="px-4 pb-3">
          <div className="text-[11px] mb-1.5" style={{ color: 'var(--t-faint)' }}>
            倪师《天纪》原话（按本盘官禄／财帛／命宫坐的星曜检索）
          </div>
          <ul className="space-y-2">
            {quotes.map((h, i) => (
              <li key={i} className="rounded-lg px-3 py-2 card-inner">
                <div className="text-[12.5px] leading-[1.75]" style={{ color: 'var(--t-text1)' }}>
                  「{h.quote}」
                </div>
                {h.note && (
                  <div className="mt-1 text-[10.5px]" style={{ color: 'var(--t-gold)' }}>
                    考据：{h.note}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--t-faint)' }}>
                  <span>{h.bookLabel} · {h.h2}{h.h3 ? ` · ${h.h3}` : ''}</span>
                  <span>·</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{h.t_hms}</span>
                  <span>·</span>
                  <span>第{h.part}讲</span>
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ml-auto shrink-0"
                    style={{ color: 'var(--t-gold)', textDecoration: 'none' }}
                  >
                    听原话 ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] leading-relaxed" style={{ color: 'var(--t-faint)' }}>
            原话著作权归原权利人，本页内容 CC BY-NC-SA 4.0，仅限非商用引用。
          </p>
        </div>
      )}

      {/* ── 展开模型解读 ── */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={expand}
          disabled={loading}
          className="w-full py-2 rounded-lg text-[12.5px] font-medium transition-colors disabled:opacity-50"
          style={{
            background: 'var(--ac-bg)',
            color: 'var(--t-gold)',
            border: '1px solid var(--ac-bdr)',
            cursor: loading ? 'default' : 'pointer',
          }}
        >
          {loading ? '解读中…' : narrative ? '查看模型解读' : '展开模型解读'}
        </button>
        <p className="mt-1.5 text-[10.5px] leading-relaxed" style={{ color: 'var(--t-faint)' }}>
          上面三轴、候选、冲突是本地算的（不配模型也有）；模型只负责把结论讲成人话。
        </p>
      </div>

      <AnimatePresence>
        {open && narrative && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden', borderTop: '1px solid var(--t-border)' }}
          >
            <div className="px-4 py-3">
              <AiContent text={narrative} streaming={loading} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
