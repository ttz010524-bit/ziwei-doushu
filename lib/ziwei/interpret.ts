/**
 * lib/ziwei/interpret —— 把「客户端的提问」映射到「数据集里的 13 维解读」
 *
 * 客户端（components/InsightPanel.tsx）会按固定结构发问，例如：
 *   请生成命格总览，按以下结构输出：
 *   **【命格定性】** … **【主星解读】** … **【三方四正】** …
 * 数据集每一维的正文本身也带小节标题（一句话定调 / 核心论断 / 三方四正联动 /
 * 四化路径分析 / 年干四化 / 命盘依据 / 风险提醒 / 针对你的命盘），
 * 这里做「请求小节 → 数据集小节」的映射，让返回的正文沿用客户端请求的结构，
 * 客户端渲染逻辑无需改动。
 *
 * 小节名与出现范围由 1990 年全量 8760 张命盘统计得出（见 scripts/ 里的
 * 标题统计脚本），不是猜的。
 */
import type { Reading, TopicKey } from './dataset';

export const TOPIC_KEYS: TopicKey[] = [
  'overview', 'personality', 'love', 'career', 'wealth', 'health',
  'family', 'children', 'move', 'friends', 'home', 'spirit', 'parents',
];

export interface Block {
  /** 小节标题，已去掉「· 落到你这盘」这类后缀 */
  title: string;
  body: string;
}

const HEAD_RE = /^\*\*(【.+?】)\*\*\s*$/;

/** 标题别名：数据集里同一语义在不同命盘里写法略有出入 */
const TITLE_ALIAS: Record<string, string> = {
  四化路径: '四化路径分析',
  '⚠️ 风险提醒': '风险提醒',
  风险提醒: '风险提醒',
};

/** 把数据集的一段正文拆成小节；第 0 段是该维的总览 */
export function splitBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const line of text.split('\n')) {
    const m = line.match(HEAD_RE);
    if (m) {
      if (cur) blocks.push(cur);
      const raw = m[1].replace(/[【】]/g, '').split(/[·・]/)[0].trim();
      cur = { title: TITLE_ALIAS[raw] ?? raw, body: '' };
    } else if (cur) {
      cur.body += (cur.body ? '\n' : '') + line;
    }
  }
  if (cur) blocks.push(cur);
  return blocks.map((b) => ({ ...b, body: b.body.trim() }));
}

/** 某一维的小节表：标题 → 正文 */
function indexOf(topic: TopicKey, reading: Reading): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of splitBlocks(reading.c[topic])) m.set(b.title, b.body);
  return m;
}

/** 请求小节名 → 数据集小节。'summary'/'advice' 是总览正文的两种取法 */
type Target = string | 'summary' | 'advice';

const SECTION_TARGET: Record<string, Target | Target[]> = {
  // —— 命格总览 ——
  命格定性: '一句话定调',
  主星解读: '核心论断',
  三方四正: '三方四正联动',
  当前大限: ['年干四化', '四化路径分析'],
  优势与注意: ['summary', '风险提醒'],
  // —— 感情 ——
  感情格局: '一句话定调',
  夫妻宫分析: ['核心论断', '命盘推演'],
  三方联动: '三方四正联动',
  当前大限感情运: ['年干四化', '四化路径分析'],
  // —— 事业 ——
  事业格局: '一句话定调',
  官禄宫分析: ['核心论断', '命盘推演'],
  财帛宫联动: '三方四正联动',
  当前大限事业运: ['年干四化', '四化路径分析'],
  // —— 财运 ——
  财运格局: '一句话定调',
  财帛宫分析: ['核心论断', '命盘推演'],
  '田宅宫（财库）': ['核心论断', '命盘推演'],
  当前大限财运: ['年干四化', '四化路径分析'],
  // —— 健康 ——
  疾厄宫主星: ['核心论断', '命盘推演'],
  主要风险: ['风险提醒', 'summary'],
  大限健康走势: ['年干四化', '四化路径分析'],
  // —— 性格 ——
  命宫主星性格: '核心论断',
  三方性格综合: '三方四正联动',
  人际关系模式: '三方四正联动',
  优势与人生课题: ['summary', '风险提醒'],
  // —— 宫位追问 ——
  宫位定性: '一句话定调',
  三方四正联动: '三方四正联动',
  // —— 四化 ——
  '化基本含义': '四化路径分析',
  落宫影响: '四化路径分析',
  三方四正飞化路径: '三方四正联动',
  当前运势影响: ['年干四化', '四化路径分析'],
  // —— 建议类（数据集无同名小节，取总览里的建议段 + 针对你的命盘）——
  实际建议: ['针对你的命盘', 'advice'],
  理财建议: ['针对你的命盘', 'advice'],
  预防建议: ['针对你的命盘', 'advice'],
  // —— 兄弟 ——
  兄弟格局: '一句话定调',
  兄弟宫分析: ['核心论断', '命盘推演'],
  兄弟三方联动: '三方四正联动',
  当前大限兄弟运: ['年干四化', '四化路径分析'],
  // —— 子女 ——
  子女格局: '一句话定调',
  子女宫分析: ['核心论断', '命盘推演'],
  子女三方联动: '三方四正联动',
  当前大限子女运: ['年干四化', '四化路径分析'],
  // —— 迁移 ——
  迁移格局: '一句话定调',
  迁移宫分析: ['核心论断', '命盘推演'],
  迁移三方联动: '三方四正联动',
  当前大限迁移运: ['年干四化', '四化路径分析'],
  // —— 人际 ——
  人际格局: '一句话定调',
  交友宫分析: ['核心论断', '命盘推演'],
  人际三方联动: '三方四正联动',
  当前大限人际运: ['年干四化', '四化路径分析'],
  // —— 田宅 ——
  田宅格局: '一句话定调',
  田宅宫分析: ['核心论断', '命盘推演'],
  田宅三方联动: '三方四正联动',
  当前大限田宅运: ['年干四化', '四化路径分析'],
  // —— 福德 ——
  福德格局: '一句话定调',
  福德宫分析: ['核心论断', '命盘推演'],
  福德三方联动: '三方四正联动',
  当前大限福德运: ['年干四化', '四化路径分析'],
  // —— 父母 ——
  父母格局: '一句话定调',
  父母宫分析: ['核心论断', '命盘推演'],
  父母三方联动: '三方四正联动',
  当前大限父母运: ['年干四化', '四化路径分析'],
};

/** 请求小节名 → 固定维度（不填则由提问上下文决定） */
const SECTION_TOPIC: Record<string, TopicKey> = {
  '田宅宫（财库）': 'home',
};

const PALACE_TOPIC: [string, TopicKey][] = [
  ['命宫', 'overview'], ['兄弟', 'family'], ['夫妻', 'love'], ['子女', 'children'],
  ['财帛', 'wealth'], ['疾厄', 'health'], ['迁移', 'move'], ['交友', 'friends'],
  ['仆役', 'friends'], ['官禄', 'career'], ['田宅', 'home'], ['福德', 'spirit'], ['父母', 'parents'],
];

/** 宫名 → 维度（提示词里出现多个宫名时取最靠前的） */
export function palaceTopic(palace: string): TopicKey | null {
  const hit = PALACE_TOPIC.find(([p]) => palace.includes(p));
  return hit ? hit[1] : null;
}

const BRACKET_RE = /【([^【】]{1,16})】/g;

/**
 * 提示词里点名的宫位。客户端写的是宫名本身（【官禄】/【田宅】），不是「官禄宫」；
 * 而且请求小节也是【…】形式（【命宫主星性格】），所以只认「括号里正好是宫名」。
 */
function palaceInPrompt(prompt: string): TopicKey | null {
  let best: { topic: TopicKey; at: number } | null = null;
  BRACKET_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = BRACKET_RE.exec(prompt))) {
    const inner = m[1];
    for (const [palace, topic] of PALACE_TOPIC) {
      if (inner === palace || inner === `${palace}宫`) {
        if (!best || m.index < best.at) best = { topic, at: m.index };
        break;
      }
    }
  }
  return best?.topic ?? null;
}

/** 从提示词里取出客户端请求的小节名 */
export function requestedSections(prompt: string): string[] {
  const out: string[] = [];
  const re = /\*\*【(.+?)】\*\*/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt))) out.push(m[1]);
  return out;
}

/** 提问上下文：客户端有三种固定发问式 + 自由提问 */
export interface PromptContext {
  kind: 'topic' | 'palace' | 'sihua' | 'free';
  /** 该上下文对应的维度 */
  topic: TopicKey;
  /** 四化提问里的星名与化气 */
  star?: string;
  siHua?: string;
}

/** 自由提问的关键词表；命中数多的维度优先，同数时按表内先后 */
const KEYWORD_TOPIC: [RegExp, TopicKey][] = [
  [/财库|不动产|房产|买房|置业|田宅/, 'home'],
  [/财运|财富|财源|收入|理财|赚钱|破财|财务|薪资|工资/, 'wealth'],
  [/事业|工作|职业|创业|升职|职场|官禄|升迁/, 'career'],
  [/感情|婚姻|恋爱|桃花|配偶|对象|结婚|夫妻|情感/, 'love'],
  [/性格|性情|脾气|个性|心理|处事/, 'personality'],
  [/健康|身体|疾病|养生|寿元/, 'health'],
  [/朋友|人际|社交|小人|贵人/, 'friends'],
  [/兄弟|手足|同辈/, 'family'],
  [/子女|小孩|儿女|生育|子女缘/, 'children'],
  [/迁移|外出|远行|异地|出国/, 'move'],
  [/福德|精神|内心|兴趣|福分/, 'spirit'],
  [/父母|长辈|文书|契约/, 'parents'],
  [/命格|格局|总览|整体|命盘/, 'overview'],
];

/** 提问上下文判定：宫位追问 / 四化追问 / 主题总览 / 自由提问 */
export function resolveContext(prompt: string, reading: Reading): PromptContext {
  // 四化：「【大限紫微化禄】的飞化影响」/「【本命太阳化禄】…」
  const si = prompt.match(/【(?:本命|大限|流年)?\s*([一-龥]{1,4})化([禄权科忌])】/);
  if (si) {
    const topic = siHuaTopic(prompt, reading, si[1], si[2]);
    return { kind: 'sihua', topic, star: si[1], siHua: si[2] };
  }

  // 宫位：「请重点分析【官禄】（主管：…）」
  const palace = palaceInPrompt(prompt);
  if (palace) {
    return { kind: 'palace', topic: palace };
  }

  // 主题总览：请求的小节里出现固定的维度锚点
  const sections = requestedSections(prompt);
  const anchor = sections.find((s) => ANCHOR_TOPIC[s]);
  if (anchor) return { kind: 'topic', topic: ANCHOR_TOPIC[anchor] };

  // 自由提问
  return { kind: 'free', topic: freeTopic(prompt, reading) };
}

/** 每个主题总览组的锚点小节 —— 出现即说明这是哪一维的总览 */
const ANCHOR_TOPIC: Record<string, TopicKey> = {
  命格定性: 'overview',
  感情格局: 'love',
  事业格局: 'career',
  财运格局: 'wealth',
  疾厄宫主星: 'health',
  命宫主星性格: 'personality',
  兄弟格局: 'family',
  子女格局: 'children',
  迁移格局: 'move',
  人际格局: 'friends',
  田宅格局: 'home',
  福德格局: 'spirit',
  父母格局: 'parents',
};

/**
 * 四化提问命中的维度：数据集每条四化都标了「（落{宫}·你{维度}的…）」，
 * 括号里的宫就是这颗四化真正坐下的宫位（各维度里标的都是同一个宫）。
 * 所以按「落宫 → 该宫所属维度」路由，而不是按「谁先提到它」。
 * 命盘里没有这颗四化（大限/流年宫干四化不在数据集里），退到提问里点名的宫位。
 */
function siHuaTopic(prompt: string, reading: Reading, star: string, siHua: string): TopicKey {
  const needle = `${star}化${siHua}`;
  const land = new RegExp(`${needle}\\*\\*（落([一-龥]{2,4})`);

  for (const title of ['四化路径分析', '年干四化']) {
    for (const topic of TOPIC_KEYS) {
      const block = splitBlocks(reading.c[topic]).find((b) => b.title === title);
      const m = block?.body.match(land);
      if (!m) continue;
      const t = palaceTopic(m[1]);
      if (t) return t;
    }
  }
  // 命盘里没有这颗四化（大限/流年宫干四化不在数据集里）：按提问里点名的宫位走，
  // 那是客户端按引擎排出的星曜所在宫，也就是这颗四化真正的落宫
  const palace = palaceInPrompt(prompt);
  if (palace) return palace;
  // 有这颗四化但标不出落宫：退到第一个提到它的维度
  for (const topic of TOPIC_KEYS) {
    if (reading.c[topic].includes(needle)) return topic;
  }
  return 'overview';
}

/** 自由提问：先查关键词表，再退到二元组打分 */
function freeTopic(question: string, reading: Reading): TopicKey {
  let hit: TopicKey | null = null;
  let bestHits = 0;
  for (const [re, topic] of KEYWORD_TOPIC) {
    if (!re.test(question)) continue;
    const hits = (question.match(new RegExp(re.source, 'g')) ?? []).length;
    if (hits > bestHits) { bestHits = hits; hit = topic; }
  }
  if (hit) return hit;

  const q = question.replace(/[^一-龥]/g, '');
  const grams = new Set<string>();
  for (let i = 0; i + 2 <= q.length; i++) grams.add(q.slice(i, i + 2));
  let best: TopicKey = 'overview';
  let bestScore = -1;
  for (const topic of TOPIC_KEYS) {
    const text = reading.c[topic];
    let score = 0;
    for (const g of grams) if (text.includes(g)) score++;
    if (score > bestScore) { bestScore = score; best = topic; }
  }
  return best;
}

/** 决定这次回答取数据集中的哪一维 */
export function resolveTopic(prompt: string, reading: Reading): TopicKey {
  return resolveContext(prompt, reading).topic;
}

/** 总览正文里带「建议」意味的段落 */
function adviceParagraphs(summary: string): string {
  const paras = summary.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const picked = paras.filter((p) => /建议|注意|宜|切忌|避免|提醒|别|不要/.test(p));
  return (picked.length ? picked : paras).join('\n\n');
}

/** 从某一维里按标题列表取正文，跳过该命盘没有的小节 */
function pick(reading: Reading, topic: TopicKey, titles: Target[]): string {
  const blocks = indexOf(topic, reading);
  const summary = blocks.values().next().value ?? '';
  let out = '';
  for (const t of titles) {
    let body = '';
    if (t === 'summary') body = summary;
    else if (t === 'advice') body = adviceParagraphs(summary);
    else body = blocks.get(t) ?? '';
    body = body.trim();
    if (!body) continue;
    out += (out ? '\n\n' : '') + body;
  }
  return out;
}

/** 组装最终回答：沿用客户端请求的小节结构 */
export function buildAnswer(prompt: string, reading: Reading): string {
  const ctx = resolveContext(prompt, reading);
  const sections = requestedSections(prompt);

  if (!sections.length) {
    // 自由提问：给该维的总览 + 定调 + 核心论断
    const blocks = indexOf(ctx.topic, reading);
    const summary = blocks.values().next().value ?? '';
    const parts = [summary, blocks.get('一句话定调'), blocks.get('核心论断')].filter(Boolean);
    return parts.join('\n\n');
  }

  const out: string[] = [];
  for (const name of sections) {
    let target = SECTION_TARGET[name];
    if (!target) {
      // 「化禄基本含义」这类动态小节名
      const norm = name.replace(/化[禄权科忌]/g, '化');
      target = SECTION_TARGET[norm] ?? SECTION_TARGET[norm.replace('化', '')];
    }
    if (!target) continue;

    const topic = SECTION_TOPIC[name] ?? ctx.topic;
    const titles = Array.isArray(target) ? target : [target];
    const body = pick(reading, topic, titles);
    if (!body.trim()) continue;
    out.push(`**【${name}】**\n\n${body.trim()}`);
  }

  if (!out.length) {
    const blocks = indexOf(ctx.topic, reading);
    const summary = blocks.values().next().value ?? '';
    out.push(`**【${blocks.keys().next().value ?? '解读'}】**\n\n${summary}`);
  }
  return out.join('\n\n');
}
