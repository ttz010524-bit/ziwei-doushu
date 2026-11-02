'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BirthForm from '@/components/BirthForm';
import ChartBoard from '@/components/ChartBoard';
import ChartSummary from '@/components/ChartSummary';
import ChartNav from '@/components/ChartNav';
import type { TimeView } from '@/components/TimeNav';
import { generateChart } from '@/lib/ziwei/algorithm';
import { loadChartSession, saveChartSession, type SessionTimeView } from '@/lib/ziwei/chart-session';
import type { BirthInfo, ZiweiChart, Palace } from '@/lib/ziwei/types';

/**
 * 命盘页 —— 开源版「排盘引擎 Demo」
 *
 * 这一页**只放命盘**：排盘、十二宫、三方四正、格局摘要。
 * 解读与合参另开一页（/reading）——早先把解读挤在命盘右边 420px 的窄栏里，
 * 长篇断语被压成一堵字墙，命盘反倒占了整屏；拆开之后，
 * 命盘这一页可以按盘面该有的比例铺开，解读那一页也终于有整屏的宽度。
 *
 * 两页之间靠 sessionStorage 传「出生信息 + 命盘上选中的宫位／四化」，
 * 解读页用出生信息重排同一张盘（见 lib/ziwei/chart-session.ts）。
 */
export default function ChartPage() {
  const router = useRouter();
  const [chart, setChart] = useState<ZiweiChart | null>(null);
  const [birthInfo, setBirthInfo] = useState<BirthInfo | null>(null);
  const [selectedPalace, setSelectedPalace] = useState<Palace | null>(null);
  const [selectedSiHua, setSelectedSiHua] = useState<{ starName: string; siHua: string; view: TimeView; liunianYear: number } | null>(null);

  /**
   * 回读会话：解读页点「← 回到命盘」回来时，把刚才那张盘直接摆出来。
   * 早前这一页只认本页状态，从解读页回来会看到一张空表单——用户刚看完的盘没了，
   * 像是被清空了。命盘由出生信息唯一确定，重排一次即可（与解读页同一口径）。
   */
  useEffect(() => {
    const s = loadChartSession();
    if (!s) return;
    const c = generateChart(s.birthInfo);
    setBirthInfo(s.birthInfo);
    setChart(c);
    if (typeof s.selectedBranch === 'number') {
      setSelectedPalace(c.palaces.find((p) => p.branch === s.selectedBranch) ?? null);
    }
    if (s.selectedSiHua) setSelectedSiHua(s.selectedSiHua);
  }, []);

  /** 起盘：算完立刻把输入存进会话，解读页据此重排同一张盘 */
  const handleSubmit = (info: BirthInfo) => {
    const c = generateChart(info);
    setChart(c);
    setBirthInfo(info);
    setSelectedPalace(null);
    setSelectedSiHua(null);
    saveChartSession({ birthInfo: info, selectedBranch: null, selectedSiHua: null });
  };

  /** 点宫位：记下来，解读页会带着这个宫位展开 */
  const handlePalaceSelect = (palace: Palace) => {
    setSelectedPalace(palace);
    if (!birthInfo) return;
    saveChartSession({
      birthInfo,
      selectedBranch: palace.branch,
      selectedSiHua: selectedSiHua
        ? { ...selectedSiHua, view: selectedSiHua.view as SessionTimeView }
        : null,
    });
  };

  /** 点四化：同样记进会话（解读页要按运限层算，运限层也得一起带过去） */
  const handleSiHuaClick = (starName: string, siHua: string, view: TimeView, liunianYear: number) => {
    const next = { starName, siHua, view, liunianYear };
    setSelectedSiHua(next);
    if (!birthInfo) return;
    saveChartSession({
      birthInfo,
      selectedBranch: selectedPalace?.branch ?? null,
      selectedSiHua: { ...next, view: view as SessionTimeView },
    });
  };

  // ── 未起盘：展示出生信息表单 ──
  if (!chart) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px 48px' }}>
        <ChartNav />
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '28px 0 8px' }}>紫微斗数排盘</h1>
        <p style={{ color: 'var(--t-text2)', marginBottom: 32, fontSize: 14, lineHeight: 1.7 }}>
          输入出生年月日时，开源排盘引擎即时生成命盘。
          <br />
          排好之后可以另开一页看解读与八字合参。
        </p>
        <BirthForm onSubmit={handleSubmit} />
      </main>
    );
  }

  // ── 已起盘：整页就是命盘 ──
  return (
    <main style={{ maxWidth: 1120, margin: '0 auto', padding: '24px 16px 48px' }}>
      <ChartNav />

      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => { setChart(null); setBirthInfo(null); setSelectedPalace(null); setSelectedSiHua(null); }}
          className="text-[12.5px] px-3 py-1.5 rounded-lg"
          style={{
            border: '1px solid var(--t-border)', color: 'var(--t-text2)',
            background: 'transparent', cursor: 'pointer',
          }}
        >
          ← 重新起盘
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          {(selectedPalace || selectedSiHua) && (
            <span className="text-[12px]" style={{ color: 'var(--t-faint)' }}>
              {selectedPalace && <>已选 {selectedPalace.name}宫</>}
              {selectedPalace && selectedSiHua && '　·　'}
              {selectedSiHua && <>{selectedSiHua.starName}化{selectedSiHua.siHua}</>}
            </span>
          )}
          <button
            type="button"
            onClick={() => router.push('/reading')}
            className="text-[13px] font-medium px-4 py-2 rounded-lg"
            style={{
              background: 'var(--ac-bg)', color: 'var(--t-gold)',
              border: '1px solid var(--ac-bdr)', cursor: 'pointer',
            }}
          >
            看解读与合参 →
          </button>
        </div>
      </div>

      <div className="mt-4">
        <ChartBoard
          chart={chart}
          onPalaceSelect={handlePalaceSelect}
          onSiHuaClick={handleSiHuaClick}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <ChartSummary chart={chart} />
      </div>

      <p className="mt-6 text-[11.5px] leading-relaxed" style={{ color: 'var(--t-faint)' }}>
        点宫位看三方四正，点四化看它的落宫与来路；
        选好之后点「看解读与合参」，解读页会带着这个宫位／四化一起展开。
      </p>
    </main>
  );
}
