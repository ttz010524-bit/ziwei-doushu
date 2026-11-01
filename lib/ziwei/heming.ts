/**
 * lib/ziwei/heming —— 合盘事实层
 *
 * 与解读的 buildAnswer 同理：先用排盘引擎算出「可核查的事实」，
 * 再交给模型组织成给用户看的合盘分析。
 *
 * 方法论直接用仓库里已有的 HEMING_METHODOLOGY（倪海厦双宫联参 + 五步法 +
 * 十四主星在夫妻宫的断语），它就是现成的系统提示词，不用另写一套。
 *
 * 本文件算出来的东西全是确定性的：命宫主星、夫妻宫主星与四化、
 * 天作之合的双向对应、四化互参的落宫、大限与流年。判断留给模型。
 */
import type { Palace, SiHua, Star, ZiweiChart } from './types';
import { BRANCHES } from './constants';
import { getLiuNianSiHua, getSiHuaByStem } from './sihua';
import { SIHUA_IN_FUQI_GU, STAR_IN_FUQI_GU } from './heming-knowledge';

const SH: SiHua[] = ['禄', '权', '科', '忌'];

function palaceOf(chart: ZiweiChart, name: string): Palace | undefined {
  return chart.palaces.find((p) => p.name === name);
}

function majorStars(p?: Palace): Star[] {
  return p ? p.stars.filter((s) => s.type === 'major') : [];
}

function starLabel(s: Star): string {
  const b = s.brightnessRaw ? `(${s.brightnessRaw})` : '';
  const h = s.siHua ? `化${s.siHua}` : '';
  return `${s.name}${b}${h}`;
}

/** 该宫的主星；空宫则说明借哪一宫 */
function mainStarsText(p?: Palace): string {
  if (!p) return '—';
  const m = majorStars(p);
  if (m.length) return m.map(starLabel).join('、');
  if (p.borrowedStars?.length) {
    return `空宫，借${p.borrowedFromName ?? '对宫'}：${p.borrowedStars.join('、')}`;
  }
  return '空宫';
}

/** 宫内的本命四化 */
function siHuaInPalace(p?: Palace): string {
  if (!p) return '无';
  const list = p.stars.filter((s) => s.siHua);
  return list.length ? list.map((s) => `${s.name}化${s.siHua}`).join('、') : '无';
}

/** 某星在本盘的落宫 */
function landPalace(chart: ZiweiChart, star: string): Palace | undefined {
  return chart.palaces.find((p) => p.stars.some((s) => s.name === star));
}

function personLabel(chart: ZiweiChart, tag: string): string {
  const b = chart.birthInfo;
  const gender = b.gender === 'male' ? '男' : '女';
  return `${tag}（${gender}命，公历${b.year}年${b.month}月${b.day}日${BRANCHES[b.hour]}时）`;
}

function shenGongName(chart: ZiweiChart): string {
  return chart.palaces.find((p) => p.branch === chart.shenGongBranch)?.name ?? '—';
}

/** 夫妻宫主星的断语（来自仓库已有的合盘知识库） */
function fuqiProfile(p?: Palace): string {
  const m = majorStars(p);
  if (!m.length) return '夫妻宫无主星，须借对宫论之。';
  const s = m[0];
  const prof = STAR_IN_FUQI_GU[s.name];
  if (!prof) return `${s.name}在夫妻宫（本库未收录该星的夫妻宫断语）。`;
  const lines = [
    `断语：${prof.summary}`,
    `吉象：${prof.good}`,
    `凶象：${prof.bad}`,
    `配偶性状：${prof.spouse_traits}`,
    `婚期：${prof.timing}`,
  ];
  if (prof.ni_quote) lines.push(`倪师原话：「${prof.ni_quote}」`);
  const gloss = m
    .filter((x) => x.siHua)
    .map((x) => `　${x.name}化${x.siHua}：${x.siHua ? (SIHUA_IN_FUQI_GU[`化${x.siHua}`] ?? '') : ''}`)
    .join('\n');
  if (gloss) lines.push(gloss);
  return lines.join('\n');
}

/** 配偶星（女命看太阳、男命看太阴）的庙旺落陷 */
function spouseStarText(chart: ZiweiChart, tag: string): string {
  const isFemale = chart.birthInfo.gender === 'female';
  const name = isFemale ? '太阳' : '太阴';
  const p = landPalace(chart, name);
  const s = p?.stars.find((x) => x.name === name);
  if (!p || !s) return `${tag}盘不见${name}星。`;
  const b = s.brightnessRaw ? `${s.brightnessRaw}` : '亮度未标';
  const h = s.siHua ? `，且受化${s.siHua}` : '';
  return `${tag}为${isFemale ? '女' : '男'}命，${name}为配偶星：${b}${h}，坐${p.name}宫。`;
}

export interface HemingSection {
  title: string;
  body: string;
}

export interface HemingFacts {
  /** 分节文本，可直接作为事实层喂给模型 */
  text: string;
  /** 各节标题与正文 */
  sections: HemingSection[];
}

/**
 * 算出合盘的事实层。
 * @param year 用于算当年流年四化的落宫，默认当前公历年
 */
export function buildHemingFacts(
  chartA: ZiweiChart,
  chartB: ZiweiChart,
  year: number = new Date().getFullYear(),
): HemingFacts {
  const sections: HemingSection[] = [];
  const push = (title: string, body: string) => {
    const b = body.trim();
    if (b) sections.push({ title, body: b });
  };

  const mingA = palaceOf(chartA, '命宫');
  const mingB = palaceOf(chartB, '命宫');
  const fuqiA = palaceOf(chartA, '夫妻');
  const fuqiB = palaceOf(chartB, '夫妻');
  const fuDeA = palaceOf(chartA, '福德');
  const fuDeB = palaceOf(chartB, '福德');

  // ── 1. 双方命格 ──
  push('双方命格', [
    `${personLabel(chartA, '甲方')}：命宫 ${mainStarsText(mingA)}，身宫 ${shenGongName(chartA)}，${chartA.wuxingJuName}。`,
    `${personLabel(chartB, '乙方')}：命宫 ${mainStarsText(mingB)}，身宫 ${shenGongName(chartB)}，${chartB.wuxingJuName}。`,
  ].join('\n'));

  // ── 2. 夫妻宫互参 ──
  push('夫妻宫互参', [
    `甲方夫妻宫（${fuqiA ? BRANCHES[fuqiA.branch] : '—'}）：${mainStarsText(fuqiA)}；宫内本命四化：${siHuaInPalace(fuqiA)}。`,
    fuqiProfile(fuqiA),
    `乙方夫妻宫（${fuqiB ? BRANCHES[fuqiB.branch] : '—'}）：${mainStarsText(fuqiB)}；宫内本命四化：${siHuaInPalace(fuqiB)}。`,
    fuqiProfile(fuqiB),
  ].join('\n'));

  // ── 3. 福德宫（倪师铁律：看婚姻必须同时看福德宫） ──
  push('福德宫（婚姻根基）', [
    '倪师断法：看婚姻光看夫妻宫是大错特错，一定要同时看福德宫。',
    `甲方福德宫：${mainStarsText(fuDeA)}；宫内本命四化：${siHuaInPalace(fuDeA)}。`,
    `乙方福德宫：${mainStarsText(fuDeB)}；宫内本命四化：${siHuaInPalace(fuDeB)}。`,
  ].join('\n'));

  // ── 4. 天作之合判定（确定性计算） ──
  const aFuqiNames = majorStars(fuqiA).map((s) => s.name);
  const bFuqiNames = majorStars(fuqiB).map((s) => s.name);
  const aMingNames = majorStars(mingA).map((s) => s.name);
  const bMingNames = majorStars(mingB).map((s) => s.name);
  const aToB = aFuqiNames.filter((n) => bMingNames.includes(n));
  const bToA = bFuqiNames.filter((n) => aMingNames.includes(n));
  let verdict: string;
  if (aToB.length && bToA.length) {
    verdict =
      `天作之合（双向对应）：甲方夫妻宫 ${aToB.join('、')} 正是乙方命宫主星；` +
      `乙方夫妻宫 ${bToA.join('、')} 正是甲方命宫主星。`;
  } else if (aToB.length || bToA.length) {
    const one = aToB.length
      ? `甲方夫妻宫 ${aToB.join('、')} 正是乙方命宫主星`
      : `乙方夫妻宫 ${bToA.join('、')} 正是甲方命宫主星`;
    verdict = `单向对应：${one}，属次级良配（一方夫妻宫对应对方命宫）。`;
  } else {
    verdict = '双方夫妻宫主星与对方命宫主星均无对应，不是天作之合。';
  }
  push('天作之合判定', verdict);

  // ── 5. 四化飞化互参 ──
  const aSh = getSiHuaByStem(chartA.lunarInfo.yearStem);
  const bSh = getSiHuaByStem(chartB.lunarInfo.yearStem);
  const cross = (sh: Record<SiHua, string>, to: ZiweiChart, tag: string) =>
    SH.map((k) => {
      const star = sh[k];
      if (!star) return '';
      const land = landPalace(to, star);
      return `- ${tag}${star}化${k}，在对方盘中落于${land ? land.name : '不见此星'}`;
    }).filter(Boolean);
  const crossA = cross(aSh, chartB, '甲方');
  const crossB = cross(bSh, chartA, '乙方');
  const jiAlarm: string[] = [];
  for (const [from, to, tag] of [[chartA, chartB, '甲方'], [chartB, chartA, '乙方']] as const) {
    const sh = getSiHuaByStem(from.lunarInfo.yearStem);
    const jiStar = sh['忌'];
    if (!jiStar) continue;
    const land = landPalace(to, jiStar);
    if (!land) continue;
    if (land.name === '命宫' || land.name === '夫妻') {
      jiAlarm.push(`${tag}化忌星${jiStar}落入对方${land.name}宫，为合盘凶兆。`);
    }
  }
  push('四化飞化互参', [
    ...crossA,
    ...crossB,
    ...jiAlarm,
    ...(jiAlarm.length ? [] : ['双方本命化忌均未直接冲对方命宫或夫妻宫。']),
  ].join('\n'));

  // ── 6. 大限同步 ──
  const dxA = chartA.daXians[chartA.currentDaXianIndex];
  const dxB = chartB.daXians[chartB.currentDaXianIndex];
  const dxPalaceA = dxA ? chartA.palaces.find((p) => p.branch === dxA.palaceBranch) : undefined;
  const dxPalaceB = dxB ? chartB.palaces.find((p) => p.branch === dxB.palaceBranch) : undefined;
  push('大限同步', [
    dxA
      ? `甲方当前大限：${dxA.startAge}–${dxA.endAge} 岁，行${dxA.palaceName}（${mainStarsText(dxPalaceA)}）。`
      : '甲方当前大限：无。',
    dxB
      ? `乙方当前大限：${dxB.startAge}–${dxB.endAge} 岁，行${dxB.palaceName}（${mainStarsText(dxPalaceB)}）。`
      : '乙方当前大限：无。',
  ].join('\n'));

  // ── 7. 当年流年四化落宫 ──
  const ln = getLiuNianSiHua(year);
  const lnStars = SH.map((k) => ln.transforms[k]).filter(Boolean);
  const lnLine = (chart: ZiweiChart, tag: string) =>
    lnStars
      .map((star) => {
        const land = landPalace(chart, star);
        return `${star}→${land ? land.name : '不见'}`;
      })
      .join('，');
  push(`${year} 年流年四化落宫`, [
    `${year} 年流年（${ln.stemName}干）四化：${lnStars.join('、')}。`,
    `甲方：${lnLine(chartA, '甲')}。`,
    `乙方：${lnLine(chartB, '乙')}。`,
  ].join('\n'));

  // ── 8. 太阳太阴（配偶星） ──
  push('太阳太阴（配偶星）', [
    spouseStarText(chartA, '甲方'),
    spouseStarText(chartB, '乙方'),
  ].join('\n'));

  const text = sections.map((s) => `**【${s.title}】**\n\n${s.body}`).join('\n\n');
  return { text, sections };
}
