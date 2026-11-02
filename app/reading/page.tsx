'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ChartNav from '@/components/ChartNav';
import FusionPanel from '@/components/FusionPanel';
import InsightPanel from '@/components/InsightPanel';
import { generateChart } from '@/lib/ziwei/algorithm';
import { BRANCHES, SHICHEN } from '@/lib/ziwei/constants';
import { loadChartSession, type ChartSession } from '@/lib/ziwei/chart-session';
import type { Palace, ZiweiChart } from '@/lib/ziwei/types';

/**
 * 解读页 —— 命盘的解读与八字合参
 *
 * 命盘单独在 /chart。这一页只管「读」：
 *   左边（宽栏）= 命格总览、十三主题解读、自由追问、点宫位／点四化的展开；
 *   右边（窄栏）= 八字 × 紫微合参的三轴交叉、落点候选、冲突、倪师原话。
 *
 * 盘从哪来：sessionStorage 里的出生信息（见 lib/ziwei/chart-session.ts）。
 * 用同一份输入重排，得到的就是同一张盘——所以跨页不需要传整张命盘 JSON。
 * 命盘上选中的宫位／四化也一起带过来，进来就直接展开对应的解读。
 */
export default function ReadingPage() {
  const [session, setSession] = useState<ChartSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [selectedSiHua, setSelectedSiHua] = useState<{
    starName: string; siHua: string; view: 'mingpan' | 'daxian' | 'liunian'; liunianYear: number;
  } | null>(null);

  // 读会话 → 重排命盘 → 还原命盘上的选择
  useEffect(() => {
    const s = loadChartSession();
    setSession(s);
    setLoaded(true);
    if (!s) return;
    const c = generateChart(s.birthInfo);
    setChart(c);
    if (typeof s.selectedBranch === 'number') {
      setSelectedPalace(c.palaces.find((p) => p.branch === s.selectedBranch) ?? null);
    }
    if (s.selectedSiHua) {
      setSelectedSiHua({
        starName: s.selectedSiHua.starName,
        siHua: s.selectedSiHua.siHua,
        view: s.selectedSiHua.view,
        liunianYear: s.selectedSiHua.liunianYear,
      });
    }
  }, []);

  // ── 还没起盘 ──
  if (loaded && !chart) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 48px' }}>
        <ChartNav />
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '28px 0 10px' }}>解读与合参</h1>
        <p style={{ color: 'var(--t-text2)', fontSize: 14, lineHeight: 1.8, marginBottom: 24 }}>
          还没有盘。先去命盘页输入出生信息排一张盘，再回来看解读。
        </p>
        <Link
          href="/chart"
          className="inline-block text-[13px] font-medium px-4 py-2 rounded-lg"
          style={{
            background: 'var(--ac-bg)', color: 'var(--t-gold)',
            border: '1px solid var(--ac-bdr)', textDecoration: 'none',
          }}
        >
          去命盘页起盘 →
        </Link>
      </main>
    );
  }

  if (!chart) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>
        <ChartNav />
        <p className="mt-8 text-[13px]" style={{ color: 'var(--t-faint)' }}>正在读取命盘…</p>
      </main>
    );
  }

  const b = chart.birthInfo;
  const dx = chart.daXians[chart.currentDaXianIndex];

  return (
    <main style={{ maxWidth: 1560, margin: '0 auto', padding: '24px 16px 48px' }}>
      <ChartNav />

      <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: 'var(--t-text)' }}>
            解读与合参
          </h1>
          <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--t-text2)' }}>
            {b.year} 年 {b.month} 月 {b.day} 日 · {SHICHEN[b.hour]?.name ?? `第${b.hour}时辰`}
            {'　·　'}
            {b.gender === 'female' ? '女' : '男'}
            {'　·　'}
            命宫在{BRANCHES[chart.mingGongBranch]}
            {'　·　'}
            {chart.wuxingJuName}
            {dx && `　·　当前大限 ${dx.startAge}–${dx.endAge} 岁`}
          </p>
        </div>
        <Link
          href="/chart"
          className="text-[12.5px] px-3 py-1.5 rounded-lg shrink-0"
          style={{
            border: '1px solid var(--t-border)', color: 'var(--t-text2)',
            background: 'transparent', textDecoration: 'none',
          }}
        >
          ← 回到命盘
        </Link>
      </div>

      {/* 宽栏：解读；窄栏：合参 */}
      <div className="mt-4 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)] gap-5 items-start">
        <InsightPanel
          chart={chart}
          selectedPalace={selectedPalace}
          selectedSiHua={selectedSiHua}
        />

        {/*
          合参栏钉在右侧，读长解读时三轴一直在视野里。
          但这一栏比视口高（倪师原话那一段很长），钉住之后下半截会够不着 ——
          所以给它自己的滚动区：外层跟着页面走，内层自己滚。
        */}
        <div className="space-y-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-32px)] xl:overflow-y-auto">
          <FusionPanel chart={chart} />

          {(selectedPalace || selectedSiHua) && (
            <section className="rounded-xl px-4 py-3 card-glass">
              <div className="text-[11px] mb-1.5" style={{ color: 'var(--t-faint)' }}>从命盘带过来的选择</div>
              <div className="text-[12.5px] leading-relaxed" style={{ color: 'var(--t-text1)' }}>
                {selectedPalace && <div>宫位：{selectedPalace.name}</div>}
                {selectedSiHua && (
                  <div>
                    四化：{selectedSiHua.starName}化{selectedSiHua.siHua}
                    <span style={{ color: 'var(--t-faint)' }}>
                      （{selectedSiHua.view === 'daxian' ? '大限' : selectedSiHua.view === 'liunian' ? `流年 ${selectedSiHua.liunianYear}` : '本命'}）
                    </span>
                  </div>
                )}
              </div>
              <p className="mt-2 text-[10.5px] leading-relaxed" style={{ color: 'var(--t-faint)' }}>
                已在上面的解读里展开。换别的宫位或四化，回命盘页点一下再过来。
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
