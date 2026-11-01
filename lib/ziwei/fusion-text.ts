/**
 * lib/ziwei/fusion-text —— 八字 × 紫微合参的**事实文本**层
 *
 * 这一层只做一件事：把 fusion.ts 算出来的结论排成一段**可核查**的文本，
 * 交给表达层（模型）去讲。它自己不下断语，也不生成任何判断。
 *
 * 输出的小节结构（标题独占一行，客户端按 ^\*\*【(.+?)】\*\*$ 匹配）：
 *   【八字排盘】       —— 四柱、旺衰、五行力量、十神组合、用神喜忌、大运流年
 *   【合参总纲】       —— 三轴合起来的落点
 *   【交叉验证矩阵】   —— 强/中/弱/矛盾四档
 *   【两术各自的依据】 —— 紫微侧带倪师原话与出处，八字侧带 skill 规则出处
 *   【职业落点候选】   —— 叉乘后的可选落点，按融合权重排序
 *   【冲突与待复核】   —— 互斥、被排除的组合、单侧孤证
 *
 * 口径提醒：紫微侧只看**本命盘**（本应用的算法是倪师体系，不排流年盘），
 * 运限层由八字的大运流年承担——这正是两术侧重点不同带来的互补。
 */
import type { ZiweiChart } from './types';
import { liuNianGanZhi, type BaziChart } from './bazi';
import { buildFusionData, currentDaYun, ganZhiTone } from './fusion-data';
import { type ZiweiLabel } from './ziwei-labels';
import { type BaziLabel } from './bazi-labels';
import { toMatrix, AXIS_NAME, type Axis, type FusionResult } from './fusion';
import { WU_XING_CAREER } from './bazi-labels';
import { corpusInstalled, niForPalaces, type NiHit } from './ni-corpus';

export interface FusionFacts {
  /** 可核查的事实文本 */
  text: string;
  /** 合参结果（给调用方做结构化渲染用） */
  result: FusionResult;
  /** 八字盘（算不出来时为 null） */
  bazi: BaziChart | null;
  /** 紫微侧标签 */
  ziweiLabels: ZiweiLabel[];
  /** 八字侧标签 */
  baziLabels: BaziLabel[];
  /** 按本盘星曜检索到的倪师原话 */
  quotes: NiHit[];
}

const WU_XING_ORDER = ['木', '火', '土', '金', '水'] as const;

/** 八字盘那一段 */
function baziSection(b: BaziChart, year: number): string {
  const L: string[] = [];
  const pillars = b.pillars.map((p, i) => `${b.pillarNames[i]} ${p.gan}${p.zhi}`).join('　');
  L.push(`四柱：${pillars}`);
  L.push(`日主：${b.dayGan}${b.dayWuXing}　月令：${b.monthZhi}　与月令关系：${b.monthRelation}`);
  L.push(`旺衰：${b.strength}${b.congGe ? `（${b.congGe.type}）` : ''}`);
  const power = WU_XING_ORDER
    .map((e) => `${e} ${b.wuXingPower[e].toFixed(2)}`)
    .join('　');
  L.push(`五行力量：${power}`);
  if (b.combos.length) {
    L.push(`十神组合：${b.combos.join('、')}`);
  }
  if (b.useGod) {
    L.push(`用神：${b.useGod.element}（${b.useGod.shiShen}）——${b.useGod.note}`);
  }
  if (b.xiShen) L.push(`喜神：${b.xiShen}　忌神：${b.jiShen ?? '—'}　仇神：${b.chouShen ?? '—'}`);
  if (b.useGodConflict) L.push(`取用分歧：${b.useGodConflict}`);
  if (b.fuYiUse && b.tiaoHouUse && b.fuYiUse.element !== b.tiaoHouUse.element) {
    L.push(
      `扶抑一路取${b.fuYiUse.element}、调候一路取${b.tiaoHouUse.element}`
      + `（${b.tiaoHouUse.note}）——此盘采信${b.useGod?.method ?? '—'}。`,
    );
  }
  const dy = currentDaYun(b, year);
  if (dy) {
    L.push(`当前大运：${dy.ganZhi}（${dy.startAge}–${dy.endAge} 岁，${dy.startYear} 年起）`);
  } else if (b.startYun) {
    L.push(`起运：${b.startYun.solar}，${b.startYun.forward ? '顺行' : '逆行'}`);
  }
  const ln = liuNianGanZhi(year);
  L.push(`${year} 流年：${ln}——${ganZhiTone(b, ln)}`);
  return L.join('\n');
}

/** 候选那一段 */
function candidateSection(result: FusionResult): string {
  if (!result.candidates.length) return '（两侧信号不足以叉乘出一个落点。）';
  return result.candidates.slice(0, 6).map((c, i) => {
    const fieldHint = c.field && c.field !== '未定' && WU_XING_CAREER[c.field as keyof typeof WU_XING_CAREER]
      ? `（宜${WU_XING_CAREER[c.field as keyof typeof WU_XING_CAREER]}）` : '';
    const disputed = c.disputed && Object.keys(c.disputed).length
      ? `〔${Object.keys(c.disputed).map((k) => AXIS_NAME[k as Axis]).join('、')}有争议〕` : '';
    const forced = c.forced ? `〔⚠ 与交叉约束冲突：${c.forced}〕` : '';
    return `${i + 1}. ${c.org} × ${c.func} × ${c.field}${fieldHint}〔${c.score} 分〕${disputed}${forced}`;
  }).join('\n');
}

/** 依据那一段 */
function basisSection(ziweiLabels: ZiweiLabel[], baziLabels: BaziLabel[]): string {
  const L: string[] = [];
  L.push('紫微侧（依据本命盘；引文为倪师《天纪》原话）：');
  if (!ziweiLabels.length) L.push('（本盘未触发任何紫微侧职业属性规则。）');
  for (const l of ziweiLabels) {
    L.push(`- [${AXIS_NAME[l.axis]}/${l.strength}] ${l.value}——${l.basis}`);
    if (l.quote) {
      L.push(`  倪师原话：「${l.quote.text}」（${l.quote.h2} ${l.quote.t_hms} 第${l.quote.part}讲）`);
    }
  }
  L.push('八字侧（依据节气四柱；规则出处为 mingli skill 的 bazi harness）：');
  if (!baziLabels.length) L.push('（本盘未触发任何八字侧职业属性规则。）');
  for (const l of baziLabels) {
    L.push(`- [${AXIS_NAME[l.axis]}/${l.strength}] ${l.value}——${l.basis}`);
    L.push(`  规则出处：${l.source}`);
  }
  return L.join('\n');
}

/** 冲突那一段 */
function conflictSection(result: FusionResult): string {
  const L: string[] = [];
  if (result.conflicts.length) {
    L.push('同轴互斥（必有一层是假的）：');
    for (const c of result.conflicts) L.push(`- ${c}`);
  }
  if (result.excluded.length) {
    L.push('被跨轴约束排除的组合：');
    for (const e of result.excluded) L.push(`- ${e}`);
  }
  for (const ax of result.axes) {
    if (ax.intraSideConflict) L.push(`单侧不自洽：${ax.intraSideConflict}`);
  }
  if (!L.length) L.push('（两侧在三个轴上都没有互斥。）');
  return L.join('\n');
}

/**
 * 合参简报：塞进「解读」事实层用。
 *
 * 与 buildFusionFacts 的差别是**减法**。解读流程里，数据集已经给了本命断语、
 * 大限流年四化、三方四正，不该再铺一遍；真正多出来的只有**两术交叉之后**的东西——
 *   八字侧的四柱与规则依据（解读层原本完全没有八字）、
 *   三轴的交叉验证矩阵、职业落点候选、以及互相打架的地方。
 * 所以这一版只保留「跨系统增量」，篇幅约为完整事实的一半。
 *
 * 紫微侧的引文在这里是**新信息**（官禄/财帛宫的定性原话数据集里没有），
 * 八字侧的规则出处也保留——模型要引用就得有出处。
 */
export function buildFusionBrief(chart: ZiweiChart, year?: number): string {
  const y = year ?? new Date().getFullYear();
  const { bazi, ziweiLabels, baziLabels, result } = buildFusionData(chart, y);

  const L: string[] = [];

  // —— 八字侧：解读层原本没有这一套 ——
  if (bazi) {
    const pillars = bazi.pillars.map((p, i) => `${bazi.pillarNames[i]}${p.gan}${p.zhi}`).join(' ');
    const use = bazi.useGod
      ? `，用神${bazi.useGod.element}（${bazi.useGod.shiShen}·${bazi.useGod.method}取用）`
      : '';
    L.push(
      `八字四柱：${pillars}｜日主${bazi.dayGan}${bazi.dayWuXing}｜月令${bazi.monthZhi}`
      + `（${bazi.monthRelation}）｜旺衰${bazi.strength}${bazi.congGe ? `（${bazi.congGe.type}）` : ''}${use}`,
    );
    const dy = currentDaYun(bazi, y);
    if (dy) {
      L.push(`当前大运：${dy.ganZhi}（${dy.startAge}–${dy.endAge} 岁）`);
    }
    const ln = liuNianGanZhi(y);
    L.push(`${y} 流年：${ln}——${ganZhiTone(bazi, ln)}`);
  } else {
    L.push('（本盘取不到节气四柱，八字一侧不参与合参。）');
  }

  // —— 两侧的依据 ——
  L.push('紫微侧依据（本命盘；引文为倪师《天纪》原话）：');
  if (!ziweiLabels.length) L.push('- （未触发任何紫微侧规则。）');
  for (const l of ziweiLabels) {
    const q = l.quote ? `｜倪师原话：「${l.quote.text}」（${l.quote.h2} ${l.quote.t_hms} 第${l.quote.part}讲）` : '';
    L.push(`- [${AXIS_NAME[l.axis]}/${l.strength}] ${l.value}——${l.basis}${q}`);
  }
  L.push('八字侧依据（规则出处为 mingli skill 的 bazi harness）：');
  if (!baziLabels.length) L.push('- （未触发任何八字侧规则。）');
  for (const l of baziLabels) {
    L.push(`- [${AXIS_NAME[l.axis]}/${l.strength}] ${l.value}——${l.basis}（${l.source}）`);
  }

  // —— 交叉之后的结果 ——
  L.push(`合参总纲：${result.headline}`);
  const matrix = toMatrix(result);
  L.push(`交叉验证矩阵：${matrix.length ? matrix.join('；') : '（两侧都没给出信号。）'}`);
  L.push(`职业落点候选：${candidateSection(result).replace(/\n/g, '；')}`);
  L.push(`冲突与待复核：${conflictSection(result).replace(/\n/g, '；')}`);

  // —— 语录：解读层原本只能引那几条手挑的，这里按盘面实时取 ——
  const qLines = quotesSection(niQuotesForChart(chart, 4));
  if (qLines.length) {
    L.push(qLines.join('\n'));
  }

  return L.join('\n');
}

/**
 * 按本盘实际坐的星曜检索倪师原话。
 *
 * 事业相关的原话集中在官禄宫 / 财帛宫 / 命宫三节，所以取这三处最贴题；
 * 命中的是**倪师原话**，不是本应用自己写的断语——出处与时间码都随行。
 * 语料库没装（开源分发可能不带）时返回空数组，不影响合参其余部分。
 */
export function niQuotesForChart(chart: ZiweiChart, limit = 6): NiHit[] {
  try {
    if (!corpusInstalled()) return [];
    return niForPalaces(chart, ['官禄', '财帛', '命'], limit);
  } catch {
    return [];
  }
}

/** 语录那一段的文字。著作权归原权利人，只限非商用引用，这里把话说明白。 */
function quotesSection(hits: NiHit[]): string[] {
  if (!hits.length) return [];
  const L: string[] = [
    '倪师《天纪》原话（按本盘官禄／财帛／命宫实际坐的星曜检索；著作权归原权利人，仅限非商用引用）：',
    '（引用规则：逐条原样引用，不得改写或合并；每条后面必须保留括号里的出处与〔考据〕标注——'
      + '原话脱离出处就成了二手引述。模型讲解时也请把出处一起带出来。）',
  ];
  for (const h of hits) {
    const note = h.note ? `〔${h.note}〕` : '';
    L.push(`- 「${h.quote}」${note}（${h.citation}）`);
  }
  return L;
}

/**
 * 合参事实文本。
 * chart 是必需的（紫微侧标签与八字四柱都从它来）。
 */
export function buildFusionFacts(chart: ZiweiChart, year?: number): FusionFacts {
  const y = year ?? new Date().getFullYear();
  const { bazi, ziweiLabels, baziLabels, result } = buildFusionData(chart, y);
  const quotes = niQuotesForChart(chart, 6);

  const sections: string[] = [];

  if (bazi) {
    sections.push(`**【八字排盘】**\n\n${baziSection(bazi, y)}`);
  } else {
    sections.push('**【八字排盘】**\n\n（本盘取不到节气四柱，八字一侧不参与合参。）');
  }

  sections.push(`**【合参总纲】**\n\n${result.headline}`);

  const matrix = toMatrix(result);
  sections.push(
    `**【交叉验证矩阵】**\n\n${matrix.length ? matrix.join('\n') : '（两侧都没给出信号。）'}`,
  );

  sections.push(`**【两术各自的依据】**\n\n${basisSection(ziweiLabels, baziLabels)}`);

  const qLines = quotesSection(quotes);
  if (qLines.length) {
    sections.push(`**【倪师语录】**\n\n${qLines.join('\n')}`);
  }

  sections.push(`**【职业落点候选】**\n\n${candidateSection(result)}`);
  sections.push(`**【冲突与待复核】**\n\n${conflictSection(result)}`);

  return { text: sections.join('\n\n'), result, bazi, ziweiLabels, baziLabels, quotes };
}
