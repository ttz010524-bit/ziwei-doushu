/**
 * /niyu —— 倪师《天纪·紫微斗数》原话检索
 *
 * 语料是姊妹仓库 nihai-tianji-corpus 的 1848 条原话，一字不改，
 * 考据标注（错字裁决）随行，每条都能跳回 B 站原视频的那一秒。
 *
 * 著作权归原权利人，CC BY-NC-SA 4.0，**不许商用**。
 */

import Link from 'next/link';
import NiYuSearch from '@/components/NiYuSearch';
import { ALL_STARS, MAIN_STARS, PALACE_KEYS, BOOK_LIST, corpusInstalled, loadCorpus } from '@/lib/ziwei/ni-corpus';

export const metadata = {
  title: '倪师原话检索 · 天纪·紫微斗数 1848 条',
  description:
    '倪海厦《天纪·紫微斗数》原话全文检索：按星曜、宫位、四化、分册查找 1848 条原话，每条带考据标注、时间码与 B 站原视频链接。',
};

export default function NiYuPage() {
  const installed = corpusInstalled();
  const total = installed ? loadCorpus().length : 0;

  return (
    <div style={{ background: 'var(--bg-page)', minHeight: '100vh' }}>
      {/* 顶栏 */}
      <div className="px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(184,146,42,0.15)', background: 'var(--bg-page)' }}>
        <Link href="/" style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.3em', textDecoration: 'none' }}>
          ← 返回首页
        </Link>
        <div style={{ fontSize: '12px', color: 'var(--tx-3)', letterSpacing: '0.2em' }}>
          倪师原话 · TIANJI
        </div>
        <Link href="/chart" style={{ fontSize: '12px', color: 'var(--ac)', letterSpacing: '0.2em', textDecoration: 'none' }}>
          起盘 →
        </Link>
      </div>

      {/* Hero */}
      <div className="text-center px-6 py-14">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div style={{ height: '1px', width: '48px', background: 'linear-gradient(to right, transparent, rgba(184,146,42,0.4))' }} />
          <span style={{ fontSize: '11px', color: 'var(--ac)', letterSpacing: '0.4em' }}>NI HAI · ORIGINAL WORDS</span>
          <div style={{ height: '1px', width: '48px', background: 'linear-gradient(to left, transparent, rgba(184,146,42,0.4))' }} />
        </div>
        <h1 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 700, color: 'var(--tx-0)', letterSpacing: '0.12em', marginBottom: '12px' }}>
          倪师《天纪》原话检索
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--tx-2)', letterSpacing: '0.08em', maxWidth: '640px', margin: '0 auto', lineHeight: 1.8 }}>
          正课 14 讲 + 2 段补充，共 <strong style={{ color: 'var(--ac)' }}>{total || 1848}</strong> 条原话
          <br />
          一字不改 · 考据标注随行 · 每条可回原视频的那一秒
        </p>
      </div>

      {/* 检索 */}
      <div className="max-w-3xl mx-auto px-6 pb-16">
        <NiYuSearch stars={ALL_STARS} mainStars={MAIN_STARS} palaces={PALACE_KEYS} books={BOOK_LIST} />

        {/* 版权说明 */}
        <div style={{
          marginTop: '48px', padding: '20px 24px',
          background: 'rgba(184,146,42,0.05)', borderRadius: '10px',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--ac-dim)', fontWeight: 600, letterSpacing: '0.15em', marginBottom: '8px' }}>
            关于本库
          </div>
          <div style={{ fontSize: '12px', color: 'var(--tx-2)', lineHeight: 1.9 }}>
            语料取自姊妹仓库 <strong style={{ color: 'var(--tx-1)' }}>nihai-tianji-corpus</strong>，以语料库为准。
            方括号里的「考据」是语料库对字幕错字的人工裁决与勘误，随原话一起给出——
            少了它就等于私自改了倪师的话。
            <br />
            著作权归原权利人，本页内容单独采用 <strong style={{ color: 'var(--tx-1)' }}>CC BY-NC-SA 4.0</strong>：
            可以引用、转载、注明出处，<strong style={{ color: 'var(--ji)' }}>不许商用</strong>。
          </div>
        </div>
      </div>
    </div>
  );
}
