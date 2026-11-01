/**
 * lib/ziwei/ziwei-labels —— 紫微侧的「属性标签体系」
 *
 * 为什么要做标签：紫微斗数能给出的是**组织形态**与**职能位置**——
 *   「在什么性质的单位里（公家单位 / 私人企业 / 自由职业 / 军警武职），
 *     做什么性质的事（掌权 / 专业专长 / 经商 / 军警执法 / 教育…）」，
 *   再说得精确一点，是「一颗什么星、坐什么宫、化什么气」。
 * 这些在合参里的价值不在于「结论」，而在于它能给八字那一侧**加上约束**：
 *   八字说「喜水、适合水属性行业」，紫微说「你是统筹管理的命，不适合单干」，
 *   两条一交叉，解空间就被缩小了。
 *
 * 每条标签都带倪师原话与出处（《天纪·紫微斗数》讲次 + 时间码）。
 * 原话著作权归原权利人，此处为引用与转述，非商用授权。
 *
 * 口径提醒：本文件只看**本命盘**（生年四化 + 宫位星曜）。
 * 大限宫干四化与流年年干四化属于运限层，由 interpret.ts 的 luckText 单独处理，
 * 不要混进本命的职业定性里。
 */
import type { ZiweiChart, Palace, SiHua } from './types';
import { STAR_DESCRIPTIONS } from './constants';

// ─── 标签轴（三套数术共用，才能交叉） ─────────────────────────

/** 组织形态：雇主性质 */
export type OrgLabel = '公家单位' | '私人企业' | '自由职业' | '军警武职';
/** 职能位置：做事性质 */
export type FuncLabel =
  | '统筹掌权' | '参谋顾问' | '专业技术专长' | '行政执行'
  | '经商老板' | '军警执法' | '教育传道' | '文化艺术' | '理财守成';
/** 领域指向：行业五行属性 */
export type FieldLabel = '木' | '火' | '土' | '金' | '水';

export type SignalStrength = '强' | '中' | '弱';

export interface NiQuote {
  /** 原话 */
  text: string;
  /** 讲次/小节 */
  h2: string;
  /** 时间码（B 站原视频那一秒） */
  t_hms: string;
  /** 第几讲 */
  part: number;
}

export interface ZiweiLabel {
  axis: 'org' | 'func' | 'field';
  value: OrgLabel | FuncLabel | FieldLabel;
  strength: SignalStrength;
  /** 判定依据（人话） */
  basis: string;
  /** 倪师原话 */
  quote?: NiQuote;
}

// ─── 倪师体系里的星曜分类 ────────────────────────────────────

/**
 * 文官带：主公家单位、公务人员、教员。
 * 出处：01-stars 紫微/天机/天府/太阴各节。
 *   「紫微星主的是官，官带。」
 *   「天机星也是个官带星，但是天机星是文官带。」
 *   「天府星的人它是个文官星。也是一个教星。」
 *   「太阴星这个人文官带…当公务人员来帮人家做领固定的薪水。」
 */
export const WEN_GUAN_XING = ['紫微', '天机', '天府', '太阴'];

/**
 * 武官带：军警司法、外交、竞争性行业。
 *   「太阳星是武官…军人、警察、法官、外交官，都是属于武官带。」
 *   「武曲星…第一个它代表的是武官。」
 *   「廉贞星…也代表武官带，武官星。」
 *   「贪狼破军七杀，这三个…全部主的是武官。」
 */
export const WU_GUAN_XING = ['太阳', '武曲', '廉贞', '七杀', '破军', '贪狼'];

/** 财星：武曲为财星之王，禄存等同于化禄 */
export const CAI_XING = ['武曲', '禄存'];

/** 科甲星（天魁天钺） */
export const KE_JIA_XING = ['天魁', '天钺'];

/** 14 主星的五行（领域指向用；出自 STAR_DESCRIPTIONS） */
export function starElement(name: string): FieldLabel | null {
  const e = STAR_DESCRIPTIONS[name]?.element;
  return e === '木' || e === '火' || e === '土' || e === '金' || e === '水' ? e : null;
}

// ─── 取盘要素 ────────────────────────────────────────────────

/**
 * 按宫名取宫。两侧都去掉尾字「宫」再比，
 * 这样「官禄」与「官禄宫」都能命中（iztro 只有命宫带「宫」字）。
 */
function palaceOf(chart: ZiweiChart, name: string): Palace | undefined {
  const key = name.replace(/宫$/, '');
  return chart.palaces.find((p) => p.name.replace(/宫$/, '') === key);
}

/** 宫里带某四化的星 */
function siHuaStars(palace: Palace | undefined, sh: SiHua): string[] {
  if (!palace) return [];
  return palace.stars.filter((s) => s.siHua === sh).map((s) => s.name);
}

/** 宫里的主星（不含辅星） */
function majorStars(palace: Palace | undefined): string[] {
  if (!palace) return [];
  return palace.stars.filter((s) => s.type === 'major').map((s) => s.name);
}

/** 宫里全部星名 */
function allStars(palace: Palace | undefined): string[] {
  return palace ? palace.stars.map((s) => s.name) : [];
}

/**
 * 取宫位判断时实际要看的那一宫。
 *
 * 倪师体系：空宫借对宫，借来的对宫就是这一宫——主星、辅星、四化都要按它算。
 * 「官禄宫是空的…没有官带…她不会去当官」这句话的前提正是「没有官带」，
 * 所以判断官禄/财帛性质必须看借来的星，否则会把空宫一律判成不当官，
 * 而借来一颗紫微（文官带）的人其实正是官带。
 */
function effectivePalace(chart: ZiweiChart, palace: Palace | undefined): Palace | undefined {
  if (!palace) return undefined;
  const own = palace.stars.filter((s) => s.type === 'major');
  if (own.length) return palace;
  const opp = chart.palaces.find((p) => p.branch === (palace.branch + 6) % 12);
  return opp ?? palace;
}

// ─── 规则判定 ────────────────────────────────────────────────

/**
 * 紫微侧职业属性标签。
 * 规则全部来自倪师《天纪》紫微斗数部分的原话，见每条 label 的 quote。
 */
export function deriveZiweiLabels(chart: ZiweiChart): ZiweiLabel[] {
  const out: ZiweiLabel[] = [];
  const add = (l: ZiweiLabel) => out.push(l);

  // 注意：iztro 口径下只有命宫带「宫」字，其余宫名是「官禄」「财帛」「仆役」……
  // 写成「官禄宫」会永远匹配不到，所有官禄/财帛规则都会静默失效。
  const guanOwn = palaceOf(chart, '官禄');
  const caiOwn = palaceOf(chart, '财帛');
  // 空宫借对宫：借来的对宫就是这一宫，主星、辅星、四化都要按它算
  const guan = effectivePalace(chart, guanOwn);
  const cai = effectivePalace(chart, caiOwn);
  const guanStars = majorStars(guan);
  const caiStars = majorStars(cai);
  const guanAll = allStars(guan);
  const caiAll = allStars(cai);
  /** 生效主星的来处：空宫借星时要说清楚借自哪一宫、哪几颗星 */
  const guanBorrowedFrom = guanOwn?.borrowedFromName ? `${guanOwn.borrowedFromName}宫` : '对宫';
  const caiBorrowedFrom = caiOwn?.borrowedFromName ? `${caiOwn.borrowedFromName}宫` : '对宫';
  const guanWhere = guanOwn && guan !== guanOwn
    ? `官禄宫空宫借${guanBorrowedFrom}（${guanStars.join('、')}）`
    : `官禄宫坐${guanStars.join('、')}`;
  const caiWhere = caiOwn && cai !== caiOwn
    ? `财帛宫空宫借${caiBorrowedFrom}（${caiStars.join('、')}）`
    : `财帛宫坐${caiStars.join('、')}`;

  const guanWen = guanStars.filter((s) => WEN_GUAN_XING.includes(s));
  const guanWu = guanStars.filter((s) => WU_GUAN_XING.includes(s));
  const guanKe = guanAll.filter((s) => KE_JIA_XING.includes(s));
  const guanQuan = siHuaStars(guan, '权');
  const guanKeHua = siHuaStars(guan, '科');
  const guanLu = siHuaStars(guan, '禄');
  const guanJi = siHuaStars(guan, '忌');

  const caiQuan = siHuaStars(cai, '权');
  const caiKeHua = siHuaStars(cai, '科');
  const caiLu = siHuaStars(cai, '禄');
  const caiJi = siHuaStars(cai, '忌');

  // ── 官禄宫 ──────────────────────────────────────────────
  if (guanWen.length) {
    add({
      axis: 'org', value: '公家单位', strength: '强',
      basis: `${guanWhere}，${guanWen.join('、')}为文官带，官星得正位`,
      quote: {
        text: '官禄，你到公家单位去领固定的薪水。',
        h2: '官禄宫', t_hms: '00:15:10', part: 3,
      },
    });
    add({
      axis: 'org', value: '教育传道', strength: '弱',
      basis: `${guanWhere}，文官带兼教星之象`,
      quote: {
        text: '官星一定要进入官禄宫最好…叫做适得其所，叫做正位。',
        h2: '官禄宫', t_hms: '00:31:27', part: 5,
      },
    });
  }
  if (guanWu.length) {
    add({
      axis: 'org', value: '军警武职', strength: '中',
      basis: `${guanWhere}，${guanWu.join('、')}为武官带`,
      quote: {
        text: '太阳星是武官，武官带。那现在的武官来说的话就是所谓的军人。军人、警察、法官、外交官，都是属于武官带。',
        h2: '太阳（武官带）', t_hms: '00:36:17', part: 5,
      },
    });
  }
  // 空宫且借来的主星里也没有官带 → 才真的不会去当官
  const guanIsEmpty = !!guanOwn && guanOwn.stars.filter((s) => s.type === 'major').length === 0;
  if (guanIsEmpty && !guanWen.length && !guanWu.length) {
    add({
      axis: 'org', value: '私人企业', strength: '中',
      basis: guan !== guanOwn
        ? `官禄宫空宫借${guanBorrowedFrom}，借来主星无官带，不会去当官`
        : '官禄宫空宫，无官星入垣',
      quote: {
        text: '那这个官禄宫是空的…没有官带…她不会去当官不会当官。',
        h2: '官禄宫', t_hms: '00:28:37', part: 23,
      },
    });
  }
  if (guanQuan.length) {
    add({
      axis: 'func', value: '统筹掌权', strength: '强',
      basis: `官禄宫${guanQuan.join('、')}化权`,
      quote: {
        text: '要得正位…比如说官禄宫化权，官当官的本来就要掌权嘛。',
        h2: '官禄宫', t_hms: '00:32:39', part: 15,
      },
    });
  }
  if (guanKeHua.length) {
    add({
      axis: 'func', value: '专业技术专长', strength: '中',
      basis: `官禄宫${guanKeHua.join('、')}化科`,
      quote: {
        text: '那有的人科在官禄，他一定要考公家单位去。',
        h2: '三、化科 · 主名声、考试、专业、才艺', t_hms: '00:15:26', part: 9,
      },
    });
    add({
      axis: 'func', value: '教育传道', strength: '中',
      basis: `官禄宫${guanKeHua.join('、')}化科，科主人之师`,
      quote: {
        text: '化科的星在官禄宫，就跑去当老师，当教授去了。',
        h2: '三、化科 · 主名声、考试、专业、才艺', t_hms: '00:03:39', part: 21,
      },
    });
  }
  if (guanLu.length) {
    add({
      axis: 'func', value: '统筹掌权', strength: '中',
      basis: `官禄宫${guanLu.join('、')}化禄（禄在官禄为掌财权）`,
      quote: {
        text: '他权很大那叫做掌财权。',
        h2: '官禄宫', t_hms: '00:33:09', part: 15,
      },
    });
  }
  if (guanJi.length) {
    add({
      axis: 'func', value: '行政执行', strength: '弱',
      basis: `官禄宫${guanJi.join('、')}化忌（官运有阻）`,
      quote: {
        text: '那如果说官禄宫有杀星在里面，那你当官当然不容易了。',
        h2: '官禄宫', t_hms: '00:12:07', part: 9,
      },
    });
  }
  if (guanKe.length) {
    add({
      axis: 'org', value: '公家单位', strength: '中',
      basis: `官禄宫见科甲星${guanKe.join('、')}`,
      quote: {
        text: '我们官星啊，官禄宫的官星哦，一定要科甲星，或者是化权的星在里面最好。',
        h2: '官禄宫', t_hms: '00:03:31', part: 21,
      },
    });
  }
  // 地劫空在官禄：不当官
  if (guanAll.some((s) => s === '地劫' || s === '地空' || s === '地空' || s === '劫煞')) {
    add({
      axis: 'org', value: '私人企业', strength: '中',
      basis: '官禄宫见地劫空',
      quote: {
        text: '你看她官禄宫是什么…地劫空的就不会当官的，地劫空的就不会当官的。',
        h2: '官禄宫', t_hms: '00:19:23', part: 27,
      },
    });
  }
  // 官禄宫武曲天相 + 杀星 → 不走公职
  if (guanStars.includes('武曲') && guanStars.includes('天相')
    && guanAll.some((s) => ['七杀', '破军', '廉贞', '贪狼'].includes(s))) {
    add({
      axis: 'org', value: '私人企业', strength: '中',
      basis: '官禄宫武曲天相同宫又见杀星，不走公职',
      quote: {
        text: '像这个官禄宫武曲星呐…天相这种杀星在官禄宫，都不会走公职的，不会走公职走私人企业。',
        h2: '官禄宫', t_hms: '00:38:08', part: 25,
      },
    });
  }

  // ── 财帛宫 ──────────────────────────────────────────────
  const caiCaiXing = caiStars.filter((s) => CAI_XING.includes(s));
  if (caiCaiXing.length || caiLu.length) {
    add({
      axis: 'org', value: '私人企业', strength: '强',
      basis: caiCaiXing.length
        ? `${caiWhere}，见财星${caiCaiXing.join('、')}`
        : `${caiWhere}，见化禄${caiLu.join('、')}，禄在财帛主自己会做生意`,
      quote: {
        text: '财帛是什么，你到私人企业你自己去做生意当老板。',
        h2: '财帛宫', t_hms: '00:15:03', part: 3,
      },
    });
  }
  if (caiLu.length) {
    add({
      axis: 'func', value: '经商老板', strength: '强',
      basis: `财帛宫${caiLu.join('、')}化禄`,
      quote: {
        text: '有的人禄在财帛宫他自己会做生意。',
        h2: '五、化禄 · 主财禄、家业', t_hms: '00:11:14', part: 5,
      },
    });
  }
  if (caiQuan.length && !caiLu.length) {
    add({
      axis: 'func', value: '统筹掌权', strength: '强',
      basis: `财帛宫${caiQuan.join('、')}化权（有权无禄）`,
      quote: {
        text: '因为他的命里面只有权没有禄，所以他只能在私人企业里面上班，掌权做个主管，掌权做个主管。',
        h2: '财帛宫', t_hms: '00:44:50', part: 17,
      },
    });
    add({
      axis: 'org', value: '私人企业', strength: '中',
      basis: '财帛宫化权，落在私人企业当主管',
      quote: {
        text: '财帛宫只要有化权化科化禄…一般来说他都会在私人企业里面…因为他的命里面只有权没有禄。',
        h2: '财帛宫', t_hms: '00:44:50', part: 17,
      },
    });
  }
  if (caiKeHua.length) {
    add({
      axis: 'func', value: '专业技术专长', strength: '强',
      basis: `财帛宫${caiKeHua.join('、')}化科`,
      quote: {
        text: '科主两个意思，一个科是主的是考试金榜题名，科主的是专业专长。',
        h2: '三、化科 · 主名声、考试、专业、才艺', t_hms: '00:15:02', part: 9,
      },
    });
    add({
      axis: 'org', value: '自由职业', strength: '中',
      basis: `财帛宫${caiKeHua.join('、')}化科，主专业自由业`,
      quote: {
        text: '自由业，医师律师会计师工程师建筑师自由业。',
        h2: '三、化科 · 主名声、考试、专业、才艺', t_hms: '00:43:29', part: 15,
      },
    });
  }
  // 财帛廉破 → 不自己做生意，走正官/武职
  if (caiStars.includes('廉贞') && caiStars.includes('破军')) {
    add({
      axis: 'org', value: '军警武职', strength: '中',
      basis: `${caiWhere}，廉贞破军同宫，不主自行经商`,
      quote: {
        text: '这种财帛廉破哦，财帛宫是廉破的话，不可能说会自己做生意，那不可能的，完全不可能的。',
        h2: '财帛宫', t_hms: '00:01:23', part: 27,
      },
    });
  }
  if (caiJi.length) {
    add({
      axis: 'org', value: '军警武职', strength: '中',
      basis: `财帛宫${caiJi.join('、')}化忌，不主经商`,
      quote: {
        text: '这个人财帛宫是化忌，这种人不会去做事业的做生意的，一定是走正官。',
        h2: '财帛宫', t_hms: '00:34:25', part: 25,
      },
    });
  }
  if (caiAll.includes('禄存')) {
    add({
      axis: 'func', value: '理财守成', strength: '中',
      basis: `${caiWhere}，禄存在财帛`,
      quote: {
        text: '像财帛在禄存的…第一个她非常善于理财…比较守财。',
        h2: '财帛宫', t_hms: '00:03:31', part: 17,
      },
    });
  }
  if (caiStars.includes('天机') && caiStars.includes('天同')) {
    add({
      axis: 'org', value: '私人企业', strength: '中',
      basis: `${caiWhere}，天机天同同宫`,
      quote: {
        text: '那天机天同进入财帛…应在私人企业公司行号…私人企业来做事情。',
        h2: '财帛宫', t_hms: '00:19:29', part: 27,
      },
    });
  }
  if (caiStars.includes('紫微') && caiStars.includes('七杀')) {
    add({
      axis: 'func', value: '经商老板', strength: '中',
      basis: `${caiWhere}，紫微七杀同宫`,
      quote: {
        text: '那紫微七杀在财帛…这个是意思在私人企业自己做事业。',
        h2: '财帛宫', t_hms: '00:04:02', part: 21,
      },
    });
  }
  if (caiStars.includes('太阳') && !caiLu.length && !caiQuan.length) {
    add({
      axis: 'func', value: '行政执行', strength: '弱',
      basis: '财帛宫太阳无禄无权，不主经商当老板',
      quote: {
        text: '做生意当老板的人，一定要有权有禄才行。',
        h2: '财帛宫', t_hms: '00:49:53', part: 11,
      },
    });
  }

  // ── 全局四化（职能性质的底色） ──────────────────────────
  const quanStars = chart.palaces.flatMap((p) => siHuaStars(p, '权'));
  const keStars = chart.palaces.flatMap((p) => siHuaStars(p, '科'));
  const luStars = chart.palaces.flatMap((p) => siHuaStars(p, '禄'));

  if (quanStars.length) {
    add({
      axis: 'func', value: '统筹掌权', strength: '强',
      basis: `本命${quanStars.join('、')}化权，天生领导者`,
      quote: {
        text: '这种人命里面有化权的人，先天上面来说，这种人天生的就是一个领导者。很多将领，很多总经理，很多银行的经理，很多厂长，就是命中他就有权的人。',
        h2: '四、化权 · 主官印、性刚、领导', t_hms: '00:06:37', part: 5,
      },
    });
  }
  if (keStars.length && !quanStars.length) {
    add({
      axis: 'func', value: '参谋顾问', strength: '中',
      basis: `本命${keStars.join('、')}化科而有科无权，只能佐才`,
      quote: {
        text: '如果那个人只有科没有权你就不能做…因为这个人有专业知识有专长，但是不见得能够统御领导，所以只能做军师，参谋顾问。',
        h2: '四、化权 · 主官印、性刚、领导', t_hms: '00:07:01', part: 5,
      },
    });
  }
  if (keStars.length) {
    add({
      axis: 'func', value: '文化艺术', strength: '弱',
      basis: `本命${keStars.join('、')}化科，主名声才艺`,
      quote: {
        text: '科…第一个，我们参加考试金榜题名，这是一个科。还有画画画的很好，才艺出众，才艺超人也是科。还有我当老师也是科。',
        h2: '三、化科 · 主名声、考试、专业、才艺', t_hms: '00:01:55', part: 5,
      },
    });
  }
  if (luStars.length) {
    add({
      axis: 'func', value: '理财守成', strength: '弱',
      basis: `本命${luStars.join('、')}化禄，主财禄家业`,
      quote: {
        text: '禄就是财，钱财。禄是性守，性比较守。',
        h2: '五、化禄 · 主财禄、家业', t_hms: '00:10:24', part: 5,
      },
    });
  }
  // 权禄同宫或对宫 → 自己做事业当老板
  const quanLuMeet = chart.palaces.some((p) => {
    const hasQ = p.stars.some((s) => s.siHua === '权');
    const hasL = p.stars.some((s) => s.siHua === '禄');
    if (hasQ && hasL) return true;
    const opp = chart.palaces.find((x) => x.branch === (p.branch + 6) % 12);
    return !!opp && opp.stars.some((s) => s.siHua === '权') && opp.stars.some((s) => s.siHua === '禄');
  });
  if (quanLuMeet) {
    add({
      axis: 'func', value: '经商老板', strength: '强',
      basis: '权禄相逢（本命化权与化禄同宫或对宫）',
      quote: {
        text: '权禄相逢的人呢，他一定会去财帛，会去做事业当老板，一定会做事业当老板。',
        h2: '五、化禄 · 主财禄、家业', t_hms: '00:19:52', part: 15,
      },
    });
  }

  // ── 领域五行（行业属性） ────────────────────────────────
  const fieldSources: { el: FieldLabel; from: string }[] = [];
  for (const s of guanStars) {
    const e = starElement(s);
    if (e) fieldSources.push({ el: e, from: `官禄宫${s}` });
  }
  for (const s of caiStars) {
    const e = starElement(s);
    if (e) fieldSources.push({ el: e, from: `财帛宫${s}` });
  }
  const fieldCount = new Map<FieldLabel, string[]>();
  for (const f of fieldSources) {
    const list = fieldCount.get(f.el) ?? [];
    list.push(f.from);
    fieldCount.set(f.el, list);
  }
  for (const [el, froms] of fieldCount) {
    add({
      axis: 'field', value: el,
      strength: froms.length > 1 ? '中' : '弱',
      basis: `${froms.join('、')}的星曜五行属${el}`,
    });
  }

  return out;
}

/** 取某一轴上的标签 */
export function labelsOnAxis(labels: ZiweiLabel[], axis: 'org' | 'func' | 'field'): ZiweiLabel[] {
  return labels.filter((l) => l.axis === axis);
}

/** 标签摘要（给融合层与模型用） */
export function summarizeLabels(labels: ZiweiLabel[]): string {
  if (!labels.length) return '';
  const byAxis = new Map<string, ZiweiLabel[]>();
  for (const l of labels) {
    const arr = byAxis.get(l.axis) ?? [];
    arr.push(l);
    byAxis.set(l.axis, arr);
  }
  const names: Record<string, string> = { org: '组织形态', func: '职能位置', field: '领域五行' };
  const order = ['org', 'func', 'field'];
  const parts: string[] = [];
  for (const axis of order) {
    const arr = byAxis.get(axis);
    if (!arr?.length) continue;
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
