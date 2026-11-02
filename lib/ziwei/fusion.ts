/**
 * lib/ziwei/fusion —— 八字 × 紫微的合参层（属性叉乘 + 交叉约束）
 *
 * 合参的机制不是「结论投票」，也不是「分工路由」（问事业走紫微、问行业走八字），
 * 而是**正交维度的叉乘**：紫微给「组织形态 / 职能位置」，
 * 八字给「组织形态 / 职能位置 / 行业五行」，两侧落在同一组轴上，
 * 于是可以：
 *   ① 叉乘：把两边的取值做笛卡尔积，得到比单边细得多的落点
 *      （紫微「统筹规划」× 八字「喜水」→ 水属性行业里的统筹岗）
 *   ② 交叉约束：同轴两侧互斥、或跨轴组合本身不成立时，该组合被排除 —— 解空间被缩小
 *      （紫微「公家单位」× 八字「自由职业」→ 两条同时成立的话必有一层是假的）
 *   ③ 信号分级：强 / 中 / 弱 / 矛盾，对应 skill 模式 B 的交叉验证矩阵
 *
 * 关键设计：**矛盾轴不丢整轴**。两侧在「组织形态」上打架时，正确做法不是把这一轴
 * 整个删掉（那样候选集直接空了，什么都讲不出来），也不是随便挑一个当答案
 * （那是投票）。而是**并列成两个分支**继续叉乘，再让**跨轴约束**去筛：
 * 若两侧在「职能位置」上同时指向「军警执法」，那军警执法只能落在公家序列，
 * 于是「自由职业」这一支被约束排除——这才是 skill 说的「解空间被缩小」。
 *
 * **行业五行这一轴只由八字一侧给出**（用神／喜神五行）。
 * 紫微的星曜五行（紫微属土、贪狼属木水……）是**星性**，不是行业标签，
 * 拿它跟用神五行对打没有依据，所以紫微侧不参与这一轴的交叉。
 *
 * 本层是**确定性**的：只做集合运算与打分，不生成任何自然语言断语。
 * 要讲给人听是表达层的事（模型），它拿到的是这里算好的结论。
 */
import type { ZiweiLabel, OrgLabel, FuncLabel, FieldLabel, SignalStrength, NiQuote } from './ziwei-labels';
import type { BaziLabel } from './bazi-labels';
import { WU_XING_CAREER } from './bazi-labels';

export type Axis = 'org' | 'func' | 'field';

export const AXIS_NAME: Record<Axis, string> = {
  org: '组织形态', func: '职能位置', field: '行业五行',
};

/**
 * 每一轴由谁给出。
 * 「组织形态」「职能位置」两轴两侧都能给，所以能交叉、能出矛盾；
 * 「行业五行」只有八字能给，紫微不参与——这一轴不是「紫微缺了一条」，
 * 而是本来就该由八字说了算。
 */
export const AXIS_SOURCE: Record<Axis, '两侧' | '八字'> = {
  org: '两侧', func: '两侧', field: '八字',
};

/** 权重：强 3 / 中 2 / 弱 1 */
const W: Record<SignalStrength, number> = { 强: 3, 中: 2, 弱: 1 };

// ─── 组织形态的互斥关系 ──────────────────────────────────────

/**
 * 同一轴上的互斥取值。公家单位与军警武职不互斥（军警本来就是公家单位的一种），
 * 但公家单位与私人企业、公家单位与自由职业、私人企业与自由职业是真正互斥的。
 */
const ORG_CONFLICT: [string, string][] = [
  ['公家单位', '私人企业'],
  ['公家单位', '自由职业'],
  ['私人企业', '自由职业'],
  ['私人企业', '军警武职'],
  ['自由职业', '军警武职'],
];

/** 职能位置上的互斥（同一时间只能占一个主位） */
const FUNC_CONFLICT: [string, string][] = [
  ['统筹掌权', '参谋顾问'],
  ['统筹掌权', '行政执行'],
  ['军警执法', '文化艺术'],
  ['经商老板', '行政执行'],
  ['教育传道', '军警执法'],
];

function conflictsOf(axis: Axis, a: string, b: string): boolean {
  if (a === b) return false;
  const table = axis === 'org' ? ORG_CONFLICT : axis === 'func' ? FUNC_CONFLICT : [];
  return table.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}

// ─── 跨轴约束（交叉约束的真正用武之地） ──────────────────────

export interface CrossConstraint {
  /** 职能位置 */
  func: string;
  /** 组织形态 */
  org: string;
  /** 排除该组合（true）；否则保留但改写措辞 */
  exclude?: boolean;
  /** 改写后的职能措辞 */
  rewrite?: string;
  /** 为什么 */
  reason: string;
}

/**
 * 职能位置 × 组织形态 的跨轴约束。
 * 这些约束是**缩小解空间**的主力：同轴两侧互斥时，往往靠另一轴就能定下来。
 */
export const CROSS_CONSTRAINTS: CrossConstraint[] = [
  // —— 自由职业身位：不是排除，是把通用说法落成自由身的样子 ——
  {
    func: '统筹掌权', org: '自由职业',
    rewrite: '统筹掌权（自由业身位＝自己当老板）',
    reason: '自由职业里的统筹位，等于自己做主、自己是老板',
  },
  {
    func: '经商老板', org: '自由职业',
    rewrite: '经商老板（自由业身位＝一人公司/独立工作室）',
    reason: '自由职业里的老板位，等于自己开铺子',
  },
  {
    func: '专业技术专长', org: '自由职业',
    rewrite: '专业技术专长（自由业身位＝执业/顾问）',
    reason: '自由职业里的专业位＝靠本事吃饭',
  },
  // —— 硬互斥：这类组合本身不成立，直接排除 ——
  {
    func: '军警执法', org: '私人企业', exclude: true,
    reason: '军警执法属公家序列，不与私人企业并立',
  },
  {
    func: '军警执法', org: '自由职业', exclude: true,
    reason: '军警执法有编制归属，不与自由职业并立',
  },
  {
    func: '经商老板', org: '公家单位', exclude: true,
    reason: '经商老板与公家单位身份不并立',
  },
  {
    func: '行政执行', org: '自由职业', exclude: true,
    reason: '行政执行需要雇主层级，自由职业无所属单位',
  },
];

/**
 * 取所有命中的跨轴约束。
 * 一侧可能是复合取值（如「统筹掌权·军警执法」），所以要按组成项逐个匹配；
 * 而且多条约束可能同时命中——只要有一条是排除性的，候选就得排除。
 */
function findCross(funcParts: string[], orgParts: string[]): CrossConstraint[] {
  return CROSS_CONSTRAINTS.filter(
    (c) => funcParts.includes(c.func) && orgParts.includes(c.org),
  );
}

// ─── 单侧聚合 ────────────────────────────────────────────────

export interface SideValue {
  value: string;
  /** 累计权重 */
  weight: number;
  /** 该侧最直接的依据 */
  basis: string;
  /** 该侧判定时的强度 */
  strength: SignalStrength;
  /** 倪师原话（紫微侧才有） */
  quote?: NiQuote;
}

export interface SideAggregate {
  side: '紫微' | '八字';
  /** 每个轴上的取值排序 */
  axes: Record<Axis, SideValue[]>;
}

/** 把一侧的标签聚合到轴上（同值合并，权重累加） */
export function aggregateSide(
  side: '紫微' | '八字',
  labels: (ZiweiLabel | BaziLabel)[],
): SideAggregate {
  const axes: Record<Axis, SideValue[]> = { org: [], func: [], field: [] };
  for (const l of labels) {
    const bucket = axes[l.axis];
    const hit = bucket.find((v) => v.value === l.value);
    if (hit) {
      hit.weight += W[l.strength];
      // 强度取两侧里更强的那个
      if (W[l.strength] > W[hit.strength]) {
        hit.strength = l.strength;
        hit.basis = l.basis;
      }
    } else {
      bucket.push({
        value: l.value,
        weight: W[l.strength],
        strength: l.strength,
        basis: l.basis,
        quote: (l as ZiweiLabel).quote,
      });
    }
  }
  for (const a of ['org', 'func', 'field'] as Axis[]) {
    axes[a].sort((x, y) => y.weight - x.weight);
  }
  return { side, axes };
}

// ─── 交叉验证 ────────────────────────────────────────────────

export type Verdict = '一致' | '单边' | '矛盾' | '兼容';

/** 某一轴上融合后保留下来的一个取值 */
export interface AxisValue {
  value: string;
  /** 融合权重 */
  weight: number;
  /** 支持这个取值的各侧依据 */
  sources: { side: '紫微' | '八字'; strength: SignalStrength; basis: string }[];
  /** 倪师原话（紫微侧） */
  quote?: NiQuote;
  /** 是否为争议分支（两侧互斥时并列保留下来的） */
  disputed?: boolean;
  /** 兼容时合并进来的组成项 */
  parts?: string[];
}

export interface FusionSignal {
  axis: Axis;
  /** 融合后的取值 */
  value: string;
  verdict: Verdict;
  /** 融合后的信号强度 */
  strength: SignalStrength;
  /** 紫微侧依据 */
  ziweiBasis?: string;
  /** 八字侧依据 */
  baziBasis?: string;
  /** 倪师原话 */
  quote?: NiQuote;
  /** 一句话说明 */
  note: string;
}

export interface AxisFusion {
  axis: Axis;
  verdict: Verdict;
  /** 保留下来的取值（按融合权重排序） */
  values: AxisValue[];
  note: string;
  /** 同一侧自身就不自洽时的说明 */
  intraSideConflict?: string;
}

export interface FusionCandidate {
  org: string;
  func: string;
  field: string;
  score: number;
  note: string;
  /** 该候选用到的争议分支（轴 → 取值） */
  disputed?: Partial<Record<Axis, string>>;
  /** 与交叉约束相冲但因无替代而保留 */
  forced?: string;
}

export interface FusionBranch {
  axis: Axis;
  value: string;
  from: '紫微' | '八字';
  basis: string;
}

export interface FusionResult {
  axes: AxisFusion[];
  signals: FusionSignal[];
  candidates: FusionCandidate[];
  /** 一句话总纲（确定性拼装，不含断语） */
  headline: string;
  /** 冲突说明：需要人去看的地方 */
  conflicts: string[];
  /** 各轴的备选分支（争议时并列） */
  branches: FusionBranch[];
  /** 被跨轴约束排除掉的组合 */
  excluded: string[];
}

// ─── 主函数 ──────────────────────────────────────────────────

export function fuse(ziwei: ZiweiLabel[], bazi: BaziLabel[]): FusionResult {
  const z = aggregateSide('紫微', ziwei);
  const g = aggregateSide('八字', bazi);

  const axes: AxisFusion[] = [];
  const signals: FusionSignal[] = [];
  const conflicts: string[] = [];
  const branches: FusionBranch[] = [];
  const excluded: string[] = [];

  for (const axis of ['org', 'func', 'field'] as Axis[]) {
    const zAll = z.axes[axis];
    const gAll = g.axes[axis];
    const zv = zAll[0];
    const gv = gAll[0];

    // 同一侧内部就不自洽（例如八字自己既说自由职业又说公家单位）
    const intra = intraSideConflict(axis, zAll, gAll);

    if (zv && gv) {
      if (zv.value === gv.value) {
        const merged: AxisValue = {
          value: zv.value,
          weight: zv.weight + gv.weight,
          sources: [
            { side: '紫微', strength: zv.strength, basis: zv.basis },
            { side: '八字', strength: gv.strength, basis: gv.basis },
          ],
          quote: zv.quote,
          parts: [zv.value],
        };
        axes.push({
          axis, verdict: '一致', values: [merged], intraSideConflict: intra,
          note: `两侧同指「${zv.value}」：紫微——${zv.basis}；八字——${gv.basis}`,
        });
        signals.push({
          axis, value: zv.value, verdict: '一致',
          strength: Math.min(zv.weight, gv.weight) >= 3 ? '强' : '中',
          ziweiBasis: zv.basis, baziBasis: gv.basis, quote: zv.quote,
          note: `紫微与八字同指「${zv.value}」`,
        });
      } else if (conflictsOf(axis, zv.value, gv.value)) {
        // 矛盾：**并列成两个分支**，不丢整轴；由跨轴约束去筛
        const zBackedByG = gAll.slice(1).some((v) => v.value === zv.value);
        const gBackedByZ = zAll.slice(1).some((v) => v.value === gv.value);
        const zBranch: AxisValue = {
          value: zv.value,
          weight: zv.weight + (zBackedByG ? 1 : 0),
          sources: [{ side: '紫微', strength: zv.strength, basis: zv.basis }],
          quote: zv.quote,
          disputed: true,
          parts: [zv.value],
        };
        const gBranch: AxisValue = {
          value: gv.value,
          weight: gv.weight + (gBackedByZ ? 1 : 0),
          sources: [{ side: '八字', strength: gv.strength, basis: gv.basis }],
          disputed: true,
          parts: [gv.value],
        };
        axes.push({
          axis, verdict: '矛盾', values: [zBranch, gBranch], intraSideConflict: intra,
          note: `紫微主「${zv.value}」，八字主「${gv.value}」，两者互斥`
            + (zBackedByG ? `；八字次选也指向「${zv.value}」，则「${gv.value}」为单侧孤证` : '')
            + (gBackedByZ ? `；紫微次选也指向「${gv.value}」，则「${zv.value}」为单侧孤证` : ''),
        });
        signals.push({
          axis, value: `${zv.value} / ${gv.value}`, verdict: '矛盾',
          strength: '强',
          ziweiBasis: zv.basis, baziBasis: gv.basis, quote: zv.quote,
          note: `${AXIS_NAME[axis]}上两侧互斥，此轴取信需人工复核`,
        });
        conflicts.push(
          `${AXIS_NAME[axis]}互斥：紫微「${zv.value}」（${zv.basis}）`
          + ` vs 八字「${gv.value}」（${gv.basis}）`
          + '——两条同时成立的话必有一层是假的',
        );
        branches.push(
          { axis, value: zv.value, from: '紫微', basis: zv.basis },
          { axis, value: gv.value, from: '八字', basis: gv.basis },
        );
      } else {
        // 不互斥 → 兼容，可以并存（例如公家单位 × 军警武职）
        // 组织形态与职能位置是**角色**，天然可复合（「公家单位里的军警武职」、
        // 「掌权且传道」），所以合并成一个取值。
        // （行业五行这一轴紫微不参与，走下面的「八字单边」分支。）
        const merged: AxisValue = {
          value: `${zv.value}·${gv.value}`,
          weight: zv.weight + gv.weight,
          sources: [
            { side: '紫微', strength: zv.strength, basis: zv.basis },
            { side: '八字', strength: gv.strength, basis: gv.basis },
          ],
          quote: zv.quote,
          parts: [zv.value, gv.value],
        };
        axes.push({
          axis, verdict: '兼容', values: [merged], intraSideConflict: intra,
          note: `紫微主「${zv.value}」，八字主「${gv.value}」，两者不互斥，可并存`,
        });
        signals.push({
          axis, value: merged.value, verdict: '兼容',
          strength: '中',
          ziweiBasis: zv.basis, baziBasis: gv.basis, quote: zv.quote,
          note: `紫微「${zv.value}」与八字「${gv.value}」并存`,
        });
      }
    } else if (zv) {
      // 单边：紫微一侧。保留前两个取值，让叉乘仍有可选空间
      const values: AxisValue[] = zAll.slice(0, 2).map((v) => ({
        value: v.value, weight: v.weight,
        sources: [{ side: '紫微', strength: v.strength, basis: v.basis }],
        quote: v.quote, parts: [v.value],
      }));
      axes.push({
        axis, verdict: '单边', values, intraSideConflict: intra,
        note: `只有紫微一侧给出「${zv.value}」（${zv.basis}）`,
      });
      signals.push({
        axis, value: zv.value, verdict: '单边', strength: zv.weight >= 3 ? '强' : '中',
        ziweiBasis: zv.basis, quote: zv.quote,
        note: `仅紫微一侧：${zv.value}`,
      });
    } else if (gv) {
      const values: AxisValue[] = gAll.slice(0, 2).map((v) => ({
        value: v.value, weight: v.weight,
        sources: [{ side: '八字', strength: v.strength, basis: v.basis }],
        parts: [v.value],
      }));
      axes.push({
        axis, verdict: '单边', values, intraSideConflict: intra,
        note: axis === 'field'
          ? `行业五行只由八字给出「${gv.value}」（${gv.basis}）——`
            + '紫微的星曜五行是星性、不是行业标签，这一轴不与紫微交叉'
          : `只有八字一侧给出「${gv.value}」（${gv.basis}）`,
      });
      signals.push({
        axis, value: gv.value, verdict: '单边', strength: gv.weight >= 3 ? '强' : '中',
        baziBasis: gv.basis,
        note: axis === 'field'
          ? `行业五行由八字定：${gv.value}`
          : `仅八字一侧：${gv.value}`,
      });
    } else {
      axes.push({ axis, verdict: '单边', values: [], note: '两侧都没有给出这一轴的信号' });
    }
  }

  // ── 叉乘：把每轴保留下来的取值做笛卡尔积 ──────────────
  const orgs = pickValues(axes, 'org');
  const funcs = pickValues(axes, 'func');
  const fields = pickValues(axes, 'field');

  const raw: FusionCandidate[] = [];
  const blocked: { cand: FusionCandidate; reason: string }[] = [];
  for (const o of orgs) {
    for (const f of funcs) {
      for (const d of fields) {
        const funcParts = f.parts?.length ? f.parts : [f.value];
        const orgParts = o.parts?.length ? o.parts : [o.value];
        const crosses = findCross(funcParts, orgParts);
        // 只要有一条约束是排除性的，整个候选就出局
        const blocker = crosses.find((c) => c.exclude);
        const rewriter = crosses.find((c) => c.rewrite);
        const funcText = rewriter?.rewrite ? rewriter.rewrite : f.value;
        const note = rewriter?.rewrite
          ? rewriter.reason
          : `${AXIS_NAME.org}「${o.value}」× ${AXIS_NAME.func}「${funcText}」× ${AXIS_NAME.field}「${d.value || '未定'}」`;
        const cand: FusionCandidate = {
          org: o.value,
          func: funcText,
          field: d.value || '未定',
          score: o.weight + f.weight + d.weight,
          note,
        };
        const disputed: Partial<Record<Axis, string>> = {};
        for (const [ax, v] of [['org', o], ['func', f], ['field', d]] as [Axis, AxisValue][]) {
          if (v.disputed) disputed[ax] = v.value;
        }
        if (Object.keys(disputed).length) cand.disputed = disputed;

        if (blocker) {
          blocked.push({ cand, reason: `${o.value} × ${funcText}：${blocker.reason}` });
        } else {
          raw.push(cand);
        }
      }
    }
  }

  // 被约束全部排除时，退回被排除的组合但明确标注（宁可给出有冲突的落点，也不要空）
  let candidates = raw;
  if (!candidates.length && blocked.length) {
    candidates = blocked.map((b) => ({
      ...b.cand,
      forced: b.reason,
      note: `${b.cand.note}｜⚠ 与交叉约束冲突：${b.reason}`,
    }));
    for (const b of blocked) excluded.push(b.reason);
  } else {
    for (const b of blocked) excluded.push(b.reason);
  }
  candidates.sort((a, b) => b.score - a.score);

  // ── 矛盾是否被另一轴解掉了 ──────────────────────────────
  // 同轴两侧互斥时，若某一支被跨轴约束彻底排除（例如两侧都说「军警执法」，
  // 而军警执法只能落在公家序列），那么这一轴其实已经定了——把它记下来，
  // 别再让人以为这里还悬着。
  for (const ax of axes) {
    if (ax.verdict !== '矛盾' || ax.values.length < 2) continue;
    const alive = ax.values
      .filter((v) => candidates.some((c) => c.org.includes(v.value) || c.func.includes(v.value) || c.field.includes(v.value)))
      .map((v) => v.value);
    if (alive.length === 1) {
      const dead = ax.values.find((v) => v.value !== alive[0]);
      if (dead) {
        ax.values = ax.values.filter((v) => v.value === alive[0]);
        ax.note += `；但「${dead.value}」这一支与另一轴的结论不相容，已被排除——`
          + `此轴实定为「${alive[0]}」`;
        const idx = conflicts.findIndex((c) => c.startsWith(`${AXIS_NAME[ax.axis]}互斥`));
        if (idx >= 0) {
          conflicts[idx] = `${AXIS_NAME[ax.axis]}原互斥（紫微「${alive[0]}」vs 八字「${dead.value}」），`
            + `但「${dead.value}」与另一轴不相容，已排除 → 此轴定为「${alive[0]}」`;
        }
      }
    }
  }

  const headline = buildHeadline(axes, candidates[0], candidates);

  return { axes, signals, candidates, headline, conflicts, branches, excluded };
}

/** 同一侧在该轴上自相矛盾（top-2 互斥） */
function intraSideConflict(axis: Axis, zAll: SideValue[], gAll: SideValue[]): string | undefined {
  for (const [side, arr] of [['紫微', zAll], ['八字', gAll]] as const) {
    if (arr.length >= 2 && conflictsOf(axis, arr[0].value, arr[1].value)) {
      return `${side}一侧自身就给出互斥的${AXIS_NAME[axis]}（${arr[0].value} vs ${arr[1].value}），`
        + '说明这一侧的判轻/判重需要复核';
    }
  }
  return undefined;
}

/** 取某轴上保留下来的取值（矛盾轴返回并列的两个分支） */
function pickValues(axes: AxisFusion[], axis: Axis): AxisValue[] {
  const a = axes.find((x) => x.axis === axis);
  if (!a) return [];
  return a.values.slice(0, 2);
}

/** 一句话总纲：确定性拼装 */
function buildHeadline(
  axes: AxisFusion[],
  top?: FusionCandidate,
  all: FusionCandidate[] = [],
): string {
  const parts: string[] = [];
  for (const a of axes) {
    if (a.verdict === '矛盾') {
      parts.push(`${AXIS_NAME[a.axis]}两侧打架（${a.values.map((v) => v.value).join(' / ')}）`);
    } else if (a.values.length) {
      parts.push(`${AXIS_NAME[a.axis]}：${a.values[0].value}`);
    }
  }
  const base = parts.join('；');
  if (!top) return base;
  const fieldText = top.field && top.field !== '未定'
    ? `${top.field}属性行业` : '行业不限';
  const alt = all
    .filter((c) => c !== top && c.score === top.score)
    .slice(0, 1)
    .map((c) => `${c.org}型${c.func}`);
  const tail = alt.length ? `（同分并列：${alt[0]}）` : '';
  const disputedNote = top.disputed && Object.keys(top.disputed).length
    ? `｜该落点在${Object.keys(top.disputed).map((k) => AXIS_NAME[k as Axis]).join('、')}上有争议`
    : '';
  return `${base}。落到具体落点：**${fieldText}里的${top.org}型${top.func}岗位**${tail}${disputedNote}。`;
}

/** 交叉验证矩阵（skill 模式 B 的「强/中/弱/矛盾」四档） */
export function toMatrix(result: FusionResult): string[] {
  return result.signals.map((s) => {
    const tag = s.verdict === '矛盾' ? '矛盾' : s.strength;
    return `[${tag}] ${AXIS_NAME[s.axis]}｜${s.value}｜${s.note}`;
  });
}
