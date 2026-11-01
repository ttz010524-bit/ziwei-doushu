/**
 * lib/ziwei/bazi-labels —— 八字侧的「属性标签体系」
 *
 * 八字给的是**行业五行属性**与**功能路线**：
 *   「喜什么五行（所以适合什么属性的行业）」、
 *   「身强身弱（所以适合体制内还是自由发展）」、
 *   「十神组合（所以走哪条功能路线）」。
 *
 * 规则来源全部对齐 mingli skill 的 bazi harness：
 *   - 日主强弱 → 适合方向：bazi/references/phase6-harness.md §6.1 步骤 1
 *   - 官杀/印/食伤 → 事业取向：§6.1 步骤 2–4
 *   - 十神组合 → 职业方向：§6.1 步骤 5（含「五行职业方向速查」表）
 *   - 十神心性关键词：§6.6 步骤 2
 *   - 五神（用神/喜神/忌神/仇神）关系链：bazi/prompt.md
 *
 * 「行业五行表不另录」：行业归五行直接用 skill 自带的五行职业方向速查表（5 行），
 * 不做行业→五行的穷举 —— 行业太多，做不完也没必要；真正需要的是**五行这个属性**，
 * 具体行业由命主自己在属性里对号入座。
 */
import type { BaziChart, ShiShen, WuXing } from './bazi';
import { SHI_SHEN_COMBO, SHI_SHEN_LIST } from './bazi';
import type { OrgLabel, FuncLabel, FieldLabel, SignalStrength } from './ziwei-labels';

/** 用神五行 → 适合行业（skill phase6-harness.md §6.1「五行职业方向速查」原文表） */
export const WU_XING_CAREER: Record<WuXing, string> = {
  金: '金融/医疗/律师/执法/机械/IT硬件',
  木: '教育/文化/艺术/出版/服装/家具',
  水: '贸易/旅游/咨询/物流/传媒/酒水',
  火: '能源/餐饮/演艺/科技/电子/照明',
  土: '建筑/地产/管理/农业/矿业/陶瓷',
};

/** 最旺十神 → 心性关键词（skill phase6-harness.md §6.6 步骤 2 原文表） */
export const SHI_SHEN_MIND: Record<ShiShen, string> = {
  正官: '自律守规、责任感强、保守谨慎',
  七杀: '魄力胆识、果断激进、好胜心强',
  正印: '温和好学、善良包容、略显保守',
  偏印: '孤独独特、思维深邃、兴趣偏冷门',
  正财: '勤俭务实、保守稳重、重视家庭',
  偏财: '豪爽大方、善交际、不拘小节',
  食神: '温和享受、知足常乐、有口福',
  伤官: '叛逆才华、追求完美、锋芒毕露',
  比肩: '独立自主、坚持己见、不善妥协',
  劫财: '好胜争强、冲动果敢、不服输',
};

/** 日主五行 → 性格基调（skill phase6-harness.md §6.6 步骤 1 原文表） */
export const DAY_ELEMENT_TEMPER: Record<WuXing, string> = {
  木: '仁（正直）', 火: '礼（热情）', 土: '信（厚重）', 金: '义（果断）', 水: '智（聪明）',
};

export interface BaziLabel {
  axis: 'org' | 'func' | 'field';
  value: OrgLabel | FuncLabel | FieldLabel;
  strength: SignalStrength;
  /** 判定依据（人话） */
  basis: string;
  /** 规则出处（skill 文件 + 步骤） */
  source: string;
}

// ─── 组合强度 ────────────────────────────────────────────────

/**
 * 十神组合的信号强度：两个十神越贴近、越透干，信号越强。
 * 强 = 都透天干且紧贴相邻柱；中 = 一个透干一个坐本气；弱 = 只在藏干里。
 */
export function comboStrength(b: BaziChart, ss: ShiShen[]): SignalStrength {
  const posOf = (ss: ShiShen): { gan: number[]; zhi: number[] } => {
    const gan: number[] = [];
    const zhi: number[] = [];
    b.pillars.forEach((p, i) => {
      if (p.ganShiShen === ss) gan.push(i);
      if (p.zhiShiShen === ss) zhi.push(i);
    });
    return { gan, zhi };
  };
  const a = posOf(ss[0]);
  const c = posOf(ss[1]);
  if (!a.gan.length && !a.zhi.length) return '弱';
  if (!c.gan.length && !c.zhi.length) return '弱';

  const all = [...a.gan, ...a.zhi, ...c.gan, ...c.zhi].sort((x, y) => x - y);
  const adjacent = a.gan.length && c.gan.length
    && a.gan.some((i) => c.gan.some((j) => Math.abs(i - j) === 1));
  if (adjacent) return '强';
  if ((a.gan.length && c.zhi.length) || (a.zhi.length && c.gan.length)) {
    const near = a.gan.some((i) => c.zhi.some((j) => Math.abs(i - j) <= 1))
      || a.zhi.some((i) => c.gan.some((j) => Math.abs(i - j) <= 1));
    if (near) return '中';
    return '弱';
  }
  if (all.length && Math.abs(all[0] - all[all.length - 1]) <= 1) return '中';
  return '弱';
}

// ─── 力量分级 ────────────────────────────────────────────────

/** 全局十神力量合计（作为占比的分母） */
export function totalShiShenPower(b: BaziChart): number {
  return SHI_SHEN_LIST.reduce((s, k) => s + b.shiShenPower[k], 0) || 1;
}

/**
 * 十神力量 → 旺/中/弱。
 * skill §6.1 步骤 2–4 的模板里每个十神都要标「力量[旺/中/弱]」，
 * 这里用该十神占全局十神力量的比例来分档。
 */
export function shiShenLevel(power: number, total: number): '旺' | '中' | '弱' {
  const r = total > 0 ? power / total : 0;
  if (r >= 0.20) return '旺';
  if (r >= 0.10) return '中';
  return '弱';
}

// ─── 主函数 ──────────────────────────────────────────────────

/** 八字侧职业属性标签 */
export function deriveBaziLabels(b: BaziChart): BaziLabel[] {
  const out: BaziLabel[] = [];
  const add = (l: BaziLabel) => out.push(l);

  // ── 步骤 1：日主强弱 → 组织形态 ────────────────────────
  if (b.congGe) {
    if (b.congGe.type === '从官') {
      add({
        axis: 'org', value: '公家单位', strength: '强',
        basis: `从${b.congGe.element}格（${b.congGe.type}），顺从官星之势`,
        source: 'phase6 §6.1 步骤 1（日主状态→适合方向）',
      });
    } else if (b.congGe.type === '从财') {
      add({
        axis: 'org', value: '私人企业', strength: '强',
        basis: `从${b.congGe.element}格（${b.congGe.type}），顺从财星之势，宜商业`,
        source: 'phase6 §6.1 步骤 1（日主状态→适合方向）',
      });
      add({
        axis: 'func', value: '经商老板', strength: '中',
        basis: '从财格宜商业',
        source: 'phase6 §6.1 步骤 1（日主状态→适合方向）',
      });
    } else if (b.congGe.type === '从儿') {
      add({
        axis: 'org', value: '自由职业', strength: '强',
        basis: `从${b.congGe.element}格（${b.congGe.type}），宜技术创意`,
        source: 'phase6 §6.1 步骤 1（日主状态→适合方向）',
      });
      add({
        axis: 'func', value: '专业技术专长', strength: '中',
        basis: '从儿格宜技术创意',
        source: 'phase6 §6.1 步骤 1（日主状态→适合方向）',
      });
    } else {
      add({
        axis: 'org', value: '私人企业', strength: '中',
        basis: '从强格不喜官杀制身',
        source: 'phase6 §6.1 步骤 1（日主状态→适合方向）',
      });
    }
  } else if (b.strength === '极强' || b.strength === '偏强' || b.strength === '中和偏强') {
    add({
      axis: 'org', value: '公家单位', strength: b.strength === '极强' ? '强' : '中',
      basis: `日主${b.dayGan}${b.dayWuXing}${b.strength}（${b.monthRelation}），喜官杀制身，宜体制内/受管理/大企业/公务`,
      source: 'phase6 §6.1 步骤 1（日主状态→适合方向）',
    });
  } else {
    add({
      axis: 'org', value: '自由职业', strength: b.strength === '极弱' ? '强' : '中',
      basis: `日主${b.dayGan}${b.dayWuXing}${b.strength}（${b.monthRelation}），忌官杀克身，宜自由职业/创业/技术/艺术`,
      source: 'phase6 §6.1 步骤 1（日主状态→适合方向）',
    });
  }

  const total = totalShiShenPower(b);

  // ── 步骤 2：看官杀星状态 ──────────────────────────────
  // skill 模板：官杀为用且旺逢生 → 事业好、有官职；为用但弱 → 事业平淡；
  // 为忌且衰受制 → 受制越大官越大（逆用之喜）；为忌且旺无制 → 事业压力大。
  const guanStrength = b.shiShenPower['正官'] + b.shiShenPower['七杀'];
  if (guanStrength > 0) {
    const guanLevel = shiShenLevel(guanStrength, total);
    const guanIsUse = b.useGod && (b.useGod.shiShen === '正官' || b.useGod.shiShen === '七杀');
    const shiShangPower = b.shiShenPower['食神'] + b.shiShenPower['伤官'];
    if (guanIsUse) {
      add({
        axis: 'func', value: '行政执行',
        strength: guanLevel === '旺' ? '强' : guanLevel === '中' ? '中' : '弱',
        basis: guanLevel === '旺'
          ? `官杀为用且旺（${b.useGod!.element}），事业好、有官职`
          : `官杀为用但力量${guanLevel}（${b.useGod!.element}），事业平淡`,
        source: 'phase6 §6.1 步骤 2（看官杀星状态）',
      });
    } else if (shiShangPower > 0 && guanLevel !== '旺') {
      add({
        axis: 'func', value: '行政执行', strength: '中',
        basis: '官杀为忌而受制，逆用之喜（受制越大官越大）',
        source: 'phase6 §6.1 步骤 2（看官杀星状态）',
      });
    } else {
      add({
        axis: 'func', value: '行政执行', strength: '弱',
        basis: '官杀为忌且旺无制 → 事业压力大，官职机会有限',
        source: 'phase6 §6.1 步骤 2（看官杀星状态）',
      });
    }
  }

  // ── 步骤 3：看印星状态 ────────────────────────────────
  // skill 模板：印星为用旺相 → 有实权，单位大，受领导器重；印星被财星破 → 有名无权或单位不稳。
  // 注意「单位大」说的是规模不是所有制，所以这里只落到「统筹掌权」，
  // 不落到「公家单位」——后者是步骤 1 身强身弱那一路的判断，重复落标签会制造假冲突。
  const yinStrength = b.shiShenPower['正印'] + b.shiShenPower['偏印'];
  const yinIsUse = b.useGod && (b.useGod.shiShen === '正印' || b.useGod.shiShen === '偏印');
  const caiStrength = b.shiShenPower['正财'] + b.shiShenPower['偏财'];
  if (yinStrength > 0 && yinIsUse) {
    const yinLevel = shiShenLevel(yinStrength, total);
    const yinBroken = caiStrength > yinStrength;
    if (yinBroken) {
      add({
        axis: 'func', value: '参谋顾问', strength: '弱',
        basis: `印星被财星破（财${caiStrength.toFixed(1)} > 印${yinStrength.toFixed(1)}）→ 有名无权或单位不稳`,
        source: 'phase6 §6.1 步骤 3（看印星状态）',
      });
    } else {
      add({
        axis: 'func', value: '统筹掌权',
        strength: yinLevel === '旺' ? '强' : yinLevel === '中' ? '中' : '弱',
        basis: yinLevel === '旺'
          ? `印星为用旺相（${b.useGod!.element}）→ 有实权，单位大，受领导器重`
          : `印星为用但力量${yinLevel}（${b.useGod!.element}），实权有限`,
        source: 'phase6 §6.1 步骤 3（看印星状态）',
      });
    }
  }

  // ── 步骤 4：看食伤星状态 ──────────────────────────────
  const shiShang = b.shiShenPower['食神'] + b.shiShenPower['伤官'];
  const shiShangIsUse = b.useGod && (b.useGod.shiShen === '食神' || b.useGod.shiShen === '伤官');
  if (shiShang > 0 && shiShangIsUse) {
    const level = shiShenLevel(shiShang, total);
    add({
      axis: 'func', value: '专业技术专长',
      strength: level === '旺' ? '中' : '弱',
      basis: `食伤为用（${b.useGod!.element}）→ 适合技术/创意/表达`,
      source: 'phase6 §6.1 步骤 4（看食伤星状态）',
    });
    add({
      axis: 'func', value: '教育传道',
      strength: level === '旺' ? '中' : '弱',
      basis: '食伤为用 → 适合表达与传授',
      source: 'phase6 §6.1 步骤 4（看食伤星状态）',
    });
  }
  // 伤官过旺 → 不服管束，适合自由发展
  if (shiShenLevel(b.shiShenPower['伤官'], total) === '旺') {
    add({
      axis: 'org', value: '自由职业', strength: '中',
      basis: '伤官过旺，不服管束，适合自由发展',
      source: 'phase6 §6.1 步骤 4（看食伤星状态）',
    });
  }
  // 食伤制杀 → 武职或执法
  if (shiShang > 0 && b.shiShenPower['七杀'] > 0) {
    add({
      axis: 'func', value: '军警执法', strength: '弱',
      basis: '命中有食伤制杀之象，主武职或执法',
      source: 'phase6 §6.1 步骤 4（看食伤星状态）',
    });
  }

  // ── 步骤 5：十神组合 → 职业方向 ────────────────────────
  for (const combo of b.combos) {
    const meta = SHI_SHEN_COMBO[combo];
    if (!meta) continue;
    const s = comboStrength(b, comboShiShen(combo));
    switch (combo) {
      case '杀印相生':
        add({
          axis: 'func', value: '军警执法', strength: s,
          basis: `杀印相生（${meta.career}）`,
          source: 'phase6 §6.1 步骤 5（十神组合定职业方向）',
        });
        add({
          axis: 'func', value: '统筹掌权', strength: s,
          basis: `杀印相生（${meta.career}）`,
          source: 'phase6 §6.1 步骤 5（十神组合定职业方向）',
        });
        break;
      case '伤官伤尽':
        add({
          axis: 'func', value: '军警执法', strength: s,
          basis: `伤官伤尽（${meta.career}）`,
          source: 'phase6 §6.1 步骤 5（十神组合定职业方向）',
        });
        break;
      case '官印相生':
        add({
          axis: 'org', value: '公家单位', strength: s,
          basis: `官印相生（${meta.career}）`,
          source: 'phase6 §6.1 步骤 5（十神组合定职业方向）',
        });
        add({
          axis: 'func', value: '教育传道', strength: s,
          basis: `官印相生（${meta.career}）`,
          source: 'phase6 §6.1 步骤 5（十神组合定职业方向）',
        });
        break;
      case '食伤生财':
        add({
          axis: 'org', value: '私人企业', strength: s,
          basis: `食伤生财（${meta.career}）`,
          source: 'phase6 §6.1 步骤 5（十神组合定职业方向）',
        });
        add({
          axis: 'func', value: '经商老板', strength: s,
          basis: `食伤生财（${meta.career}）`,
          source: 'phase6 §6.1 步骤 5（十神组合定职业方向）',
        });
        break;
      case '财官双美':
        add({
          axis: 'func', value: '理财守成', strength: s,
          basis: `财官双美（${meta.career}）`,
          source: 'phase6 §6.1 步骤 5（十神组合定职业方向）',
        });
        add({
          axis: 'func', value: '统筹掌权', strength: s,
          basis: `财官双美（${meta.career}）`,
          source: 'phase6 §6.1 步骤 5（十神组合定职业方向）',
        });
        break;
      case '伤官佩印':
        add({
          axis: 'func', value: '教育传道', strength: s,
          basis: `伤官佩印（${meta.career}）`,
          source: 'phase6 §6.1 步骤 5（十神组合定职业方向）',
        });
        add({
          axis: 'func', value: '专业技术专长', strength: s,
          basis: `伤官佩印（${meta.career}）`,
          source: 'phase6 §6.1 步骤 5（十神组合定职业方向）',
        });
        break;
    }
  }

  // ── 领域五行：用神五行 ────────────────────────────────
  if (b.useGod) {
    add({
      axis: 'field', value: b.useGod.element, strength: '强',
      basis: `用神为${b.useGod.element}（${b.useGod.method}取用）——`
        + `宜${WU_XING_CAREER[b.useGod.element]}`,
      source: 'phase6 §6.1 步骤 5（五行职业方向速查：用神五行→适合行业）',
    });
  }
  // 喜神五行次一级
  if (b.xiShen) {
    add({
      axis: 'field', value: b.xiShen, strength: '弱',
      basis: `喜神${b.xiShen}——次宜${WU_XING_CAREER[b.xiShen]}`,
      source: 'bazi/prompt.md（五神定义：喜神生助用神）',
    });
  }

  return out;
}

/** 组合名 → 参与的两个十神 */
export function comboShiShen(combo: string): [ShiShen, ShiShen] {
  switch (combo) {
    case '杀印相生': return ['七杀', '正印'];
    case '伤官伤尽': return ['伤官', '正官'];
    case '官印相生': return ['正官', '正印'];
    case '食伤生财': return ['食神', '正财'];
    case '财官双美': return ['正财', '正官'];
    case '伤官佩印': return ['伤官', '正印'];
    default: return ['正官', '正印'];
  }
}

/** 取某一轴上的标签 */
export function baziLabelsOnAxis(labels: BaziLabel[], axis: 'org' | 'func' | 'field'): BaziLabel[] {
  return labels.filter((l) => l.axis === axis);
}

/** 标签摘要（给融合层与模型用） */
export function summarizeBaziLabels(labels: BaziLabel[]): string {
  if (!labels.length) return '';
  const names: Record<string, string> = { org: '组织形态', func: '职能位置', field: '领域五行' };
  const order = ['org', 'func', 'field'];
  const parts: string[] = [];
  for (const axis of order) {
    const arr = labels.filter((l) => l.axis === axis);
    if (!arr.length) continue;
    const seen = new Set<string>();
    const vals: string[] = [];
    for (const l of arr) {
      if (seen.has(l.value)) continue;
      seen.add(l.value);
      vals.push(`${l.value}（${l.strength}）`);
    }
    parts.push(`${names[axis]}：${vals.join('、')}`);
  }
  return parts.join('；');
}
