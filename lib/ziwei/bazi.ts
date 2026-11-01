/**
 * lib/ziwei/bazi —— 八字事实层（确定性，不含任何模型输出）
 *
 * 与紫微侧的关系：
 *   紫微看的是「组织形态与职能位置」（在什么性质的单位里、做什么性质的事），
 *   八字看的是「五行喜忌与十神组合」（什么行业属性有利、什么功能路线顺）。
 *   两者是正交维度，合参才有乘数效应，所以这里只负责把八字一侧的事实算干净。
 *
 * 规则来源（与 mingli skill 的 bazi harness 逐条对齐，改动前先看那边）：
 *   - 十神、藏干、旺衰、从格：子平通书口径
 *   - 扶抑取用 + 用神过旺反转红线：skill bazi/references/phase3-harness.md §3.1
 *   - 调候取用：《穷通宝鉴》十天干调候口诀（skill bazi/prompt.md）
 *   - 十神组合 → 职业方向：skill bazi/references/phase6-harness.md §6.1 步骤 5
 *
 * 多派系说明：skill 的原则是「争议判定点并列输出，不单选一派」。本文件把
 * 扶抑 / 调候两条取用路线都算出来并保留分歧，标签层再决定采信哪一路。
 */
import { Solar } from 'lunar-javascript';
import { STEMS, BRANCHES } from './constants';
import type { ZiweiChart } from './types';

export type WuXing = '木' | '火' | '土' | '金' | '水';

export type ShiShen =
  | '比肩' | '劫财' | '食神' | '伤官'
  | '偏财' | '正财'
  | '七杀' | '正官'
  | '偏印' | '正印';

export const SHI_SHEN_LIST: ShiShen[] = [
  '比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印',
];

export const WU_XING_LIST: WuXing[] = ['木', '火', '土', '金', '水'];

// ─── 基础表 ──────────────────────────────────────────────────

export const GAN_ELEMENT: Record<string, WuXing> = {
  甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土',
  己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
};

export const GAN_YIN_YANG: Record<string, '阳' | '阴'> = {
  甲: '阳', 乙: '阴', 丙: '阳', 丁: '阴', 戊: '阳',
  己: '阴', 庚: '阳', 辛: '阴', 壬: '阳', 癸: '阴',
};

/** 五行相生：木→火→土→金→水→木 */
export const SHENG: Record<WuXing, WuXing> = {
  木: '火', 火: '土', 土: '金', 金: '水', 水: '木',
};

/** 五行相克：木克土，土克水，水克火，火克金，金克木 */
export const KE: Record<WuXing, WuXing> = {
  木: '土', 土: '水', 水: '火', 火: '金', 金: '木',
};

/** 地支藏干（本气 / 中气 / 余气） */
export const HIDE_GAN: Record<string, string[]> = {
  子: ['癸'], 丑: ['己', '癸', '辛'], 寅: ['甲', '丙', '戊'], 卯: ['乙'],
  辰: ['戊', '乙', '癸'], 巳: ['丙', '庚', '戊'], 午: ['丁', '己'],
  未: ['己', '丁', '乙'], 申: ['庚', '壬', '戊'], 酉: ['辛'],
  戌: ['戊', '辛', '丁'], 亥: ['壬', '甲'],
};

/** 藏干力量权重（本气 / 中气 / 余气） */
export const HIDE_WEIGHT = [1, 0.5, 0.3];

/** 十二长生十二宫 */
const CHANG_SHENG_12 = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];

/** 五行的长生宫（地支索引）；阳干顺行、阴干逆行 */
const CHANG_SHENG_ZHI: Record<WuXing, number> = { 木: 11, 火: 2, 土: 2, 金: 5, 水: 8 };

/** 纳音（六十甲子的 30 组） */
const NAYIN_30 = [
  '海中金', '炉中火', '大林木', '路旁土', '剑锋金', '山头火', '涧下水', '城头土',
  '白蜡金', '杨柳木', '泉中水', '屋上土', '霹雳火', '松柏木', '长流水', '沙中金',
  '山下火', '平地木', '壁上土', '金箔金', '覆灯火', '天河水', '大驿土', '钗钏金',
  '桑柘木', '大溪水', '沙中土', '天上火', '石榴木', '大海水',
];

/** 旬空：六十甲子每一旬所空的两支 */
const XUN_KONG: Record<number, string[]> = {
  0: ['戌', '亥'], 1: ['申', '酉'], 2: ['午', '未'], 3: ['辰', '巳'], 4: ['寅', '卯'],
  5: ['子', '丑'], 6: ['戌', '亥'], 7: ['申', '酉'], 8: ['午', '未'], 9: ['辰', '巳'],
};

/** 天干调候口诀（skill bazi/prompt.md「十天干调候口诀」）；season 用 '冬'|'夏'|'春'|'秋'|'全年' */
const TIAOHOU: Record<string, { season: string; gan: string }[]> = {
  甲: [{ season: '冬', gan: '丁' }, { season: '春', gan: '丙' }, { season: '秋', gan: '庚' }],
  乙: [{ season: '夏', gan: '癸' }, { season: '冬', gan: '丙' }],
  丙: [{ season: '全年', gan: '壬' }],
  丁: [{ season: '全年', gan: '甲' }],
  戊: [{ season: '全年', gan: '丙' }],
  己: [{ season: '冬', gan: '丙' }, { season: '夏', gan: '癸' }],
  庚: [{ season: '全年', gan: '丁' }],
  辛: [{ season: '冬', gan: '丙' }, { season: '夏', gan: '壬' }],
  壬: [{ season: '全年', gan: '戊' }, { season: '冬', gan: '丙' }],
  癸: [{ season: '全年', gan: '辛' }, { season: '冬', gan: '丙' }],
};

/** 十神组合 → 职业方向（skill bazi/references/phase6-harness.md §6.1 步骤 5 原文表） */
export const SHI_SHEN_COMBO: Record<string, { label: string; career: string }> = {
  杀印相生: { label: '杀印相生', career: '军警执法/技术权威/管理层' },
  伤官伤尽: { label: '伤官伤尽', career: '军警执法/竞技/对抗性行业' },
  官印相生: { label: '官印相生', career: '公务员/教师/行政管理' },
  食伤生财: { label: '食伤生财', career: '工商贸易/创业/技术变现' },
  财官双美: { label: '财官双美', career: '财政理财/企业管理' },
  伤官佩印: { label: '伤官佩印', career: '学术教育/研究/写作' },
};

// ─── 类型 ────────────────────────────────────────────────────

export interface Pillar {
  gan: string;
  zhi: string;
  /** 天干十神（以日干为参照） */
  ganShiShen: ShiShen;
  /** 地支本气十神 */
  zhiShiShen: ShiShen;
  /** 藏干 */
  hideGan: string[];
  /** 藏干十神 */
  hideShiShen: ShiShen[];
  /** 纳音 */
  naYin: string;
  /** 旬空两支 */
  xunKong: string[];
  /** 十二长生状态 */
  diShi: string;
}

export type Strength =
  | '极强' | '偏强' | '中和偏强' | '中和偏弱' | '偏弱' | '极弱' | '从格';

export type CongGe = '从财' | '从官' | '从儿' | '从强';

export interface UseGod {
  element: WuXing;
  /** 对应十神 */
  shiShen: ShiShen;
  /** 取用路线 */
  method: '扶抑' | '调候' | '格局' | '通关' | '从格';
  /** 一句话依据 */
  note: string;
}

export interface DaYunItem {
  ganZhi: string;
  startAge: number;
  endAge: number;
  /** 该步大运的起始公历年（虚岁 startAge 对应的年份） */
  startYear: number;
}

export interface BaziChart {
  pillars: [Pillar, Pillar, Pillar, Pillar];
  pillarNames: ['年柱', '月柱', '日柱', '时柱'];
  dayGan: string;
  dayZhi: string;
  dayWuXing: WuXing;
  /** 月令（地支） */
  monthZhi: string;
  /** 月令对日主的关系 */
  monthRelation: '得令' | '得生' | '失令' | '受克';
  strength: Strength;
  /** 身强（含从强） */
  isStrong: boolean;
  congGe?: { type: CongGe; element: WuXing };
  /** 五行力量（含藏干权重） */
  wuXingPower: Record<WuXing, number>;
  /** 五行力量归一化（0–1） */
  wuXingRatio: Record<WuXing, number>;
  /** 同党（印 + 比劫）占比 */
  sameRatio: number;
  /** 十神力量 */
  shiShenPower: Record<ShiShen, number>;
  /** 出现的十神集合 */
  shiShenSet: Set<ShiShen>;
  /** 命局中的十神组合 */
  combos: string[];
  /** 扶抑取用结果 */
  fuYiUse?: UseGod;
  /** 调候取用结果 */
  tiaoHouUse?: UseGod;
  /** 最终采信的用神 */
  useGod?: UseGod;
  /** 用神分歧说明（多派系模式） */
  useGodConflict?: string;
  /** 喜神（生助用神者） */
  xiShen?: WuXing;
  /** 忌神（用神所克者） */
  jiShen?: WuXing;
  /** 仇神（生助忌神者） */
  chouShen?: WuXing;
  /** 大运 */
  daYun: DaYunItem[];
  /** 起运信息 */
  startYun?: { year: number; month: number; day: number; solar: string; forward: boolean };
}

// ─── 十神 ────────────────────────────────────────────────────

/** 以日干为参照，求另一个天干的十神 */
export function shiShenOf(dayGan: string, targetGan: string): ShiShen {
  const dayEl = GAN_ELEMENT[dayGan];
  const tgtEl = GAN_ELEMENT[targetGan];
  const same = GAN_YIN_YANG[dayGan] === GAN_YIN_YANG[targetGan];
  if (tgtEl === dayEl) return same ? '比肩' : '劫财';
  if (SHENG[dayEl] === tgtEl) return same ? '食神' : '伤官';   // 我生
  if (KE[dayEl] === tgtEl) return same ? '偏财' : '正财';       // 我克
  if (KE[tgtEl] === dayEl) return same ? '七杀' : '正官';       // 克我
  return same ? '偏印' : '正印';                                 // 生我
}

/** 某十神在给定日干下对应的五行 */
export function shiShenElementOf(dayGan: string, ss: ShiShen): WuXing {
  const dayEl = GAN_ELEMENT[dayGan];
  switch (ss) {
    case '比肩': case '劫财': return dayEl;
    case '食神': case '伤官': return SHENG[dayEl];
    case '偏财': case '正财': return KE[dayEl];
    case '七杀': case '正官': return keMeElement(dayEl);
    case '偏印': case '正印': return shengMeElement(dayEl);
  }
}

// ─── 柱构造 ──────────────────────────────────────────────────

/** 六十甲子索引（0–59），用于纳音与旬空 */
function jiaZiIndex(gan: string, zhi: string): number {
  const g = STEMS.indexOf(gan);
  const z = BRANCHES.indexOf(zhi);
  if (g < 0 || z < 0) return -1;
  for (let i = 0; i < 60; i++) {
    if (i % 10 === g && i % 12 === z) return i;
  }
  return -1;
}

/** 十二长生：日干在目标地支的状态 */
export function changShengState(dayGan: string, zhi: string): string {
  const el = GAN_ELEMENT[dayGan];
  const start = CHANG_SHENG_ZHI[el];
  const zi = BRANCHES.indexOf(zhi);
  if (zi < 0) return '';
  const forward = GAN_YIN_YANG[dayGan] === '阳';
  const offset = forward ? (zi - start + 12) % 12 : (start - zi + 12) % 12;
  return CHANG_SHENG_12[offset];
}

function buildPillar(gan: string, zhi: string, dayGan: string): Pillar {
  const hide = HIDE_GAN[zhi] ?? [];
  const idx = jiaZiIndex(gan, zhi);
  return {
    gan,
    zhi,
    ganShiShen: shiShenOf(dayGan, gan),
    zhiShiShen: hide.length ? shiShenOf(dayGan, hide[0]) : shiShenOf(dayGan, gan),
    hideGan: hide,
    hideShiShen: hide.map((g) => shiShenOf(dayGan, g)),
    naYin: idx >= 0 ? NAYIN_30[Math.floor(idx / 2)] : '',
    xunKong: idx >= 0 ? XUN_KONG[Math.floor(idx / 10)] : [],
    diShi: changShengState(dayGan, zhi),
  };
}

// ─── 五行力量 ────────────────────────────────────────────────

function emptyPower<T extends string>(keys: T[]): Record<T, number> {
  const o = {} as Record<T, number>;
  for (const k of keys) o[k] = 0;
  return o;
}

/**
 * 统计八字五行力量。
 * 天干 1.0；地支藏干按本气/中气/余气 1.0/0.5/0.3；月令藏干额外 ×1.5（当令者最重）。
 */
function wuXingPower(pillars: Pillar[]): Record<WuXing, number> {
  const power = emptyPower(WU_XING_LIST);
  pillars.forEach((p, i) => {
    const monthBoost = i === 1 ? 1.5 : 1;
    power[GAN_ELEMENT[p.gan]] += 1;
    p.hideGan.forEach((g, j) => {
      power[GAN_ELEMENT[g]] += HIDE_WEIGHT[j] * monthBoost;
    });
  });
  return power;
}

// ─── 旺衰 ────────────────────────────────────────────────────

/** 月令与日主的关系 */
export function monthRelation(dayGan: string, monthZhi: string): '得令' | '得生' | '失令' | '受克' {
  const dayEl = GAN_ELEMENT[dayGan];
  const main = HIDE_GAN[monthZhi]?.[0];
  if (!main) return '失令';
  const mEl = GAN_ELEMENT[main];
  if (mEl === dayEl) return '得令';
  if (SHENG[mEl] === dayEl) return '得生';
  if (KE[mEl] === dayEl) return '受克';
  return '失令';
}

/** 月支所属季节 */
export function monthSeason(monthZhi: string): '春' | '夏' | '秋' | '冬' {
  const z = BRANCHES.indexOf(monthZhi);
  if (z === 2 || z === 3) return '春';
  if (z >= 4 && z <= 6) return '夏';
  if (z >= 7 && z <= 9) return '秋';
  return '冬';
}

/** 克日主的那个五行（官杀所属） */
function keMeElement(dayEl: WuXing): WuXing {
  return (Object.keys(KE) as WuXing[]).find((e) => KE[e] === dayEl)!;
}

/** 生日主的那个五行（印星所属） */
function shengMeElement(dayEl: WuXing): WuXing {
  return (Object.keys(SHENG) as WuXing[]).find((e) => SHENG[e] === dayEl)!;
}

// ─── 主计算 ──────────────────────────────────────────────────

/**
 * 由紫微命盘算出八字事实。
 * 四柱直接取命盘里已经算好的节气四柱（`chart.lunarInfo.fourPillars`），
 * 保证与本应用的排盘口径一致（立春换年、节气换月、子时换日）。
 */
export function computeBazi(chart: ZiweiChart): BaziChart | null {
  const raw = chart.lunarInfo.fourPillars;
  if (!raw || raw.length !== 4) return null;

  const pillars = raw.map((gz) => buildPillar(gz[0], gz[1], raw[2][0])) as
    [Pillar, Pillar, Pillar, Pillar];

  const dayGan = raw[2][0];
  const dayZhi = raw[2][1];
  const dayEl = GAN_ELEMENT[dayGan];
  const monthZhi = raw[1][1];
  const rel = monthRelation(dayGan, monthZhi);

  // 五行力量
  const power = wuXingPower(pillars);
  const total = WU_XING_LIST.reduce((s, e) => s + power[e], 0) || 1;
  const ratio = emptyPower(WU_XING_LIST);
  for (const e of WU_XING_LIST) ratio[e] = power[e] / total;

  // 同党 = 比劫 + 印；异党 = 食伤 + 财 + 官杀
  const sameEl = WU_XING_LIST.filter((e) => e === dayEl || SHENG[e] === dayEl);
  const oppEl = WU_XING_LIST.filter((e) => !sameEl.includes(e));
  const same = sameEl.reduce((s, e) => s + power[e], 0);
  const opp = oppEl.reduce((s, e) => s + power[e], 0);

  // 月令加权
  let score = same / (same + opp);
  const monthMain = HIDE_GAN[monthZhi]?.[0];
  if (monthMain) {
    const mEl = GAN_ELEMENT[monthMain];
    const boost = 0.12;
    if (mEl === dayEl) score += boost;
    else if (SHENG[mEl] === dayEl) score += boost / 2;
    else if (KE[mEl] === dayEl) score -= boost;
    else if (SHENG[dayEl] === mEl) score -= boost / 2;
  }
  score = Math.max(0, Math.min(1, score));

  // 从格：同党几近于无，且某异党五行独大
  const topOpp = oppEl.slice().sort((a, b) => power[b] - power[a])[0];
  const congGe = ((): { type: CongGe; element: WuXing } | undefined => {
    if (score >= 0.22) return undefined;
    if (power[topOpp] / total < 0.55) return undefined;
    let type: CongGe;
    if (topOpp === KE[dayEl]) type = '从财';
    else if (topOpp === keMeElement(dayEl)) type = '从官';
    else if (topOpp === SHENG[dayEl]) type = '从儿';
    else return undefined;
    return { type, element: topOpp };
  })();

  let strength: Strength;
  if (congGe) strength = '从格';
  else if (score >= 0.72) strength = '极强';
  else if (score >= 0.58) strength = '偏强';
  else if (score > 0.50) strength = '中和偏强';
  else if (score >= 0.42) strength = '中和偏弱';
  else if (score > 0.28) strength = '偏弱';
  else strength = '极弱';

  const isStrong = congGe ? congGe.type === '从强' : score >= 0.5;

  // 十神力量
  const shiShenPower = emptyPower(SHI_SHEN_LIST);
  pillars.forEach((p, i) => {
    const monthBoost = i === 1 ? 1.5 : 1;
    shiShenPower[p.ganShiShen] += 1;
    p.hideGan.forEach((_, j) => {
      shiShenPower[p.hideShiShen[j]] += HIDE_WEIGHT[j] * monthBoost;
    });
  });
  const shiShenSet = new Set<ShiShen>(SHI_SHEN_LIST.filter((s) => shiShenPower[s] > 0));

  // 「有力」的十神：天干透出，或坐地支本气。组合判定用这一层，
  // 否则藏干里的余气也会被算成组合，命局里会同时出现五六个组合，失去分辨力。
  const strongSet = new Set<ShiShen>([
    ...pillars.map((p) => p.ganShiShen),
    ...pillars.map((p) => p.zhiShiShen),
  ]);

  // 十神组合（skill phase6 §6.1 步骤 5）
  const has = (s: ShiShen) => shiShenSet.has(s);
  const strong = (s: ShiShen) => strongSet.has(s);
  const combos: string[] = [];
  if (strong('七杀') && strong('正印')) combos.push('杀印相生');
  if (strong('伤官') && !has('正官')) combos.push('伤官伤尽');
  if (strong('正官') && strong('正印')) combos.push('官印相生');
  if (strong('食神') || strong('伤官')) {
    if (strong('正财') || strong('偏财')) combos.push('食伤生财');
  }
  if (strong('正财') || strong('偏财')) {
    if (strong('正官') || strong('七杀')) combos.push('财官双美');
  }
  if (strong('伤官') && strong('正印')) combos.push('伤官佩印');

  // 扶抑取用
  const fuYiUse = ((): UseGod | undefined => {
    if (congGe) {
      const map: Record<CongGe, ShiShen> = { 从财: '正财', 从官: '正官', 从儿: '食神', 从强: '比肩' };
      const ss = map[congGe.type];
      return {
        element: congGe.element,
        shiShen: ss,
        method: '从格' as const,
        note: `日主无依，从${congGe.element}格，顺${congGe.type}之势。`,
      };
    }
    const order: [ShiShen, ShiShen][] = isStrong
      ? [['正官', '七杀'], ['正财', '偏财'], ['食神', '伤官']]
      : [['正印', '偏印'], ['比肩', '劫财']];
    for (const group of order) {
      for (const ss of group) {
        if (shiShenPower[ss] > 0) {
          const el = shiShenElementOf(dayGan, ss);
          return {
            element: el,
            shiShen: ss,
            method: '扶抑' as const,
            note: isStrong
              ? `身${strength}，喜克泄耗，取${ss}（${el}）为用。`
              : `身${strength}，喜生扶，取${ss}（${el}）为用。`,
          };
        }
      }
    }
    return undefined;
  })();

  // 调候取用
  const tiaoHouUse = ((): UseGod | undefined => {
    const season = monthSeason(monthZhi);
    const rows = TIAOHOU[dayGan] ?? [];
    let gan: string | undefined;
    for (const r of rows) {
      if (r.season === '全年' || r.season === season) { gan = r.gan; break; }
    }
    if (!gan && (season === '冬' || season === '夏')) gan = season === '冬' ? '丙' : '壬';
    if (!gan) return undefined;
    const el = GAN_ELEMENT[gan];
    return {
      element: el,
      shiShen: shiShenOf(dayGan, gan),
      method: '调候' as const,
      note: `${season}月生，${dayGan}日主调候取${gan}（${el}）。`,
    };
  })();

  // 用神过旺反转（skill phase3 §3.1 f-pre 红线）
  let useGod: UseGod | undefined = fuYiUse;
  let useGodConflict: string | undefined;

  if (fuYiUse && !congGe) {
    const el = fuYiUse.element;
    const ganCount = pillars.filter((p) => GAN_ELEMENT[p.gan] === el).length;
    const zhiCount = pillars.filter((p) =>
      p.hideGan.some((g) => GAN_ELEMENT[g] === el && HIDE_WEIGHT[HIDE_GAN[p.zhi].indexOf(g)] >= 0.5)).length;
    const tooMany = ganCount + zhiCount >= 4;
    const dominates = ratio[el] >= 0.45 && ganCount >= 2;
    if (tooMany || dominates) {
      const alt = tiaoHouUse ?? (isStrong ? leakAlternative(dayGan, shiShenPower) : undefined);
      useGod = alt ?? tiaoHouUse;
      useGodConflict = `扶抑取${el}，但${el}在命局已过旺（${dominates ? '得月令且透干' : '出现次数过多'}），`
        + `改以${useGod?.method ?? '调候'}取${useGod?.element ?? '—'}。`;
    }
  }

  if (!useGod && tiaoHouUse) {
    useGod = tiaoHouUse;
    useGodConflict = '扶抑一路取不出用神，改以调候取用。';
  }
  if (
    useGod && fuYiUse && tiaoHouUse
    && fuYiUse.element !== tiaoHouUse.element
    && useGod.method !== '调候' && !congGe && !useGodConflict
  ) {
    useGodConflict = `扶抑取${fuYiUse.element}、调候取${tiaoHouUse.element}，两派分歧（此盘采信扶抑）。`;
  }

  const xiShen = useGod ? SHENG[useGod.element] : undefined;
  const jiShen = useGod ? KE[useGod.element] : undefined;
  const chouShen = jiShen ? SHENG[jiShen] : undefined;

  const { daYun, startYun } = computeDaYun(chart);

  return {
    pillars,
    pillarNames: ['年柱', '月柱', '日柱', '时柱'],
    dayGan,
    dayZhi,
    dayWuXing: dayEl,
    monthZhi,
    monthRelation: rel,
    strength,
    isStrong,
    congGe,
    wuXingPower: power,
    wuXingRatio: ratio,
    sameRatio: score,
    shiShenPower,
    shiShenSet,
    combos,
    fuYiUse,
    tiaoHouUse,
    useGod,
    useGodConflict,
    xiShen,
    jiShen,
    chouShen,
    daYun,
    startYun,
  };
}

/** 身强时的泄耗备选（食伤优先于财） */
function leakAlternative(dayGan: string, power: Record<ShiShen, number>): UseGod | undefined {
  const order: ShiShen[] = ['食神', '伤官', '正财', '偏财'];
  for (const ss of order) {
    if (power[ss] > 0) {
      const el = shiShenElementOf(dayGan, ss);
      return {
        element: el,
        shiShen: ss,
        method: '扶抑',
        note: `改取${ss}（${el}）泄耗。`,
      };
    }
  }
  return undefined;
}

// ─── 大运 / 流年 ─────────────────────────────────────────────

/** 大运与起运（用 lunar-javascript 精确到节气） */
function computeDaYun(chart: ZiweiChart): {
  daYun: DaYunItem[];
  startYun?: BaziChart['startYun'];
} {
  const b = chart.birthInfo;
  try {
    const effHour = b.hour >= 0 && b.hour <= 11 ? b.hour * 2 : 0;
    // lunar-javascript 的 fromYmdHms / getEightChar / getYun 未在 .d.ts 中声明，沿用仓库既有做法用 any 绕过
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const solar = (Solar as any).fromYmdHms(b.year, b.month, b.day, effHour, 0, 0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lunar = solar.getLunar();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const yun = lunar.getEightChar().getYun(b.gender === 'male' ? 1 : 0, 1);
    const list = yun.getDaYun() ?? [];
    const startSolar = yun.getStartSolar();
    const daYun: DaYunItem[] = [];
    for (const d of list) {
      const gz = d.getGanZhi();
      if (!gz) continue;   // 童限占位
      const startAge = d.getStartAge();
      // 起始年用 lunar-javascript 自己的 getStartYear()。
      // 它按「出生年 + 起运虚岁 - 1」换算；早前这里写的是
      // 「起运公历年 + (起运岁数 - 1)」，把整张大运表整体挪后了「起运岁数」年——
      // 九岁起运的命盘能差出九年，「当前大运」直接选错一步。
      const startYear = typeof d.getStartYear === 'function'
        ? d.getStartYear()
        : b.year + startAge - 1;
      daYun.push({ ganZhi: gz, startAge, endAge: d.getEndAge(), startYear });
    }
    return {
      daYun,
      startYun: {
        year: yun.getStartYear(),
        month: yun.getStartMonth(),
        day: yun.getStartDay(),
        solar: startSolar.toYmd(),
        forward: yun.isForward(),
      },
    };
  } catch {
    return { daYun: [] };
  }
}

/** 流年干支（公历年） */
export function liuNianGanZhi(year: number): string {
  const g = ((year - 4) % 10 + 10) % 10;
  const z = ((year - 4) % 12 + 12) % 12;
  return `${STEMS[g]}${BRANCHES[z]}`;
}

/** 大运 / 流年干支的十神（以日干为参照） */
export function ganZhiShiShen(dayGan: string, ganZhi: string): { gan: ShiShen; zhi: ShiShen } {
  const gan = ganZhi[0];
  const zhi = ganZhi[1];
  const hide = HIDE_GAN[zhi] ?? [];
  return {
    gan: shiShenOf(dayGan, gan),
    zhi: hide.length ? shiShenOf(dayGan, hide[0]) : shiShenOf(dayGan, gan),
  };
}
