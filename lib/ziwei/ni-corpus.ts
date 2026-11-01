/**
 * lib/ziwei/ni-corpus —— 倪师语录检索层
 *
 * 语料：docs/tianji-ziwei/entries.jsonl，《天纪·紫微斗数》原话 1848 条。
 * 一行一条，字段与姊妹仓库 nihai-tianji-corpus 相同：
 *   book / h2 / h3 / quote / section / t_hms / note / bvid / part
 *
 * 语料本身的骨架就适合检索：
 *   - `book` 分册：01 主星、02 宫位、03 格局、04 四化、05 疾厄、07 方法论…
 *   - `h2` 是该条所属的**节**：主星节（「紫微（北斗 · 帝星）」）、宫位节（「官禄宫」）、
 *     四化节（「三、化科 · 主名声、考试、专业、才艺」）——等于天然的检索键。
 *   - `h3` 是节内小节（「定性」「食神」「命好不如限好」）。
 *   - `note` 是考据标注（843 条有）：错字裁决、勘误。**必须随原话一起给出**，
 *     否则等于私自改了倪师原话。
 *
 * 这一层把语录变成**可检索的引用源**：
 *   - 解读与合参按命盘实际坐的星曜 / 宫位 / 四化去取原话，而不是只引那几条手挑的；
 *   - 检索页按星曜 / 宫位 / 关键词搜，命中就给时间码与 B 站链接。
 *
 * 两条硬规矩：
 *   ① 原话一字不改（语料库里已按人工裁决改正错字），考据标注随行。
 *   ② 著作权归原权利人，CC BY-NC-SA 4.0，**不许商用**。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

// ─── 词表 ──────────────────────────────────────────────────

/** 14 主星 */
export const MAIN_STARS = [
  '紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府',
  '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军',
];

/** 辅星 / 煞星 / 杂曜 */
export const MINOR_STARS = [
  '文昌', '文曲', '左辅', '右弼', '禄存', '天魁', '天钺',
  '擎羊', '陀罗', '火星', '铃星', '地空', '地劫', '红鸾', '天喜',
];

export const ALL_STARS = [...MAIN_STARS, ...MINOR_STARS];

/**
 * 宫位词表。语料里宫名多带「宫」字（「官禄宫」），引文里也常写「官禄」，
 * 两种都要认；「交友」与「仆役」是同一个宫的两种叫法。
 */
export const PALACE_WORDS = [
  '命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移',
  '交友', '仆役', '官禄', '田宅', '福德', '父母', '身宫',
];

/**
 * 宫位别名：同宫异称归到同一个键。
 * 命盘上 iztro 用「仆役」，语料里写「交友」——不归一就永远检索不到。
 */
const PALACE_CANON: Record<string, string> = {
  交友: '交友',
  仆役: '交友',
  朋友: '交友',
  事业: '官禄',
  命: '命宫',
};

/**
 * 一个宫的所有叫法（用于文本匹配）。
 *
 * 「命宫」只认「命宫」两个字：**不能**把裸「命」也算进来——
 * 语料里「命运」「命好不如限好」满地都是，认了「命」就等于每条都命中命宫。
 */
const PALACE_FORMS: Record<string, string[]> = {
  命宫: ['命宫'],
  兄弟: ['兄弟'],
  夫妻: ['夫妻'],
  子女: ['子女'],
  财帛: ['财帛'],
  疾厄: ['疾厄'],
  迁移: ['迁移'],
  交友: ['交友', '仆役', '朋友'],
  官禄: ['官禄', '事业'],
  田宅: ['田宅'],
  福德: ['福德'],
  父母: ['父母'],
  身宫: ['身宫'],
};

/** 四化 */
export const SI_HUA_WORDS = ['禄', '权', '科', '忌'];

/** 册名 → 中文标签（界面上显示用） */
export const BOOK_LABEL: Record<string, string> = {
  '01-stars': '主星',
  '02-palaces': '宫位',
  '03-patterns': '格局',
  '04-sihua': '四化',
  '05-illness': '疾厄',
  '07-methodology': '方法论',
  '08-yili': '易经',
  '10-divination': '占卜',
  '11-fengshui': '堪舆',
};

/** 语料里的「六杀」节包含的六颗煞星 */
const SHA_SIX = ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'];

// ─── 数据 ──────────────────────────────────────────────────

export interface NiEntry {
  book: string;
  h2: string;
  h3: string;
  quote: string;
  section: number;
  t_hms: string;
  note: string;
  bvid: string;
  part: number;
}

/** 一条命中的语录 */
export interface NiHit {
  quote: string;
  /** 考据标注（错字裁决 / 勘误），没有就是空串 */
  note: string;
  book: string;
  bookLabel: string;
  h2: string;
  h3: string;
  t_hms: string;
  part: number;
  bvid: string;
  /** B 站链接，点开就是那一秒 */
  url: string;
  /** 人读出处：「紫微（北斗 · 帝星）· 定性　00:36:09　第5讲」 */
  citation: string;
  score: number;
  /** 命中的星曜 */
  stars: string[];
  /** 命中的宫位 */
  palaces: string[];
  /** 命中的四化 */
  siHua: string[];
}

let cache: NiEntry[] | null = null;

/** 语料文件位置：先找仓库根，再往上找两级（兼容 monorepo 与全局安装） */
function corpusPath(): string | null {
  const candidates = [
    process.env.NI_CORPUS_PATH,
    path.resolve(process.cwd(), 'docs', 'tianji-ziwei', 'entries.jsonl'),
    path.resolve(process.cwd(), '..', '..', 'docs', 'tianji-ziwei', 'entries.jsonl'),
  ].filter((c): c is string => !!c);
  for (const c of candidates) {
    try {
      readFileSync(c, 'utf8');
      return c;
    } catch { /* 换下一个 */ }
  }
  return null;
}

/** 载入语料（进程内缓存一次） */
export function loadCorpus(): NiEntry[] {
  if (cache) return cache;
  const file = corpusPath();
  if (!file) {
    cache = [];
    return cache;
  }
  const raw = readFileSync(file, 'utf8');
  const out: NiEntry[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as NiEntry);
    } catch { /* 坏行跳过，不影响整体 */ }
  }
  cache = out;
  return cache;
}

/** 语录是否就位 */
export function corpusInstalled(): boolean {
  return loadCorpus().length > 0;
}

// ─── 出处 ──────────────────────────────────────────────────

/** 「00:36:09」→ 2169 秒 */
export function tToSeconds(t: string): number {
  const [h, m, s] = t.split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 3600 + (m || 0) * 60 + (s || 0);
}

/** B 站链接，点开就是原视频的那一秒 */
export function urlOf(e: NiEntry): string {
  return `https://www.bilibili.com/video/${e.bvid}?p=${e.part}&t=${tToSeconds(e.t_hms)}`;
}

/** 人读出处 */
export function citationOf(e: NiEntry): string {
  const where = e.h3 ? `${e.h2} · ${e.h3}` : e.h2;
  return `${where}　${e.t_hms}　第${e.part}讲`;
}

// ─── 检索 ──────────────────────────────────────────────────

export interface NiQuery {
  /** 自由关键词（空格分隔，需全部命中） */
  q?: string;
  /** 星曜名 */
  stars?: string[];
  /** 宫位名（不带「宫」字也行） */
  palaces?: string[];
  /** 四化：'禄' | '权' | '科' | '忌' */
  siHua?: string[];
  /** 册名过滤 */
  books?: string[];
  /** 最多返回几条 */
  limit?: number;
}

/** 命中的四化字符 */
function siHuaOf(text: string): string[] {
  const out: string[] = [];
  for (const s of SI_HUA_WORDS) if (text.includes(`化${s}`)) out.push(s);
  return out;
}

/** 宫位归一：把「官禄宫」「事业」「仆役」都归到同一个键 */
function normalizePalace(word: string): string {
  const w = word.replace(/宫$/, '');
  return PALACE_CANON[w] ?? w;
}

/**
 * 一条语录命中的星曜。
 * 除了引文里点名，还要认「所在节就是这颗星的节」——
 * 比如 h2=「紫微（北斗 · 帝星）」那一节里的每一条，讲的都是紫微。
 */
function starsOf(e: NiEntry): string[] {
  const out: string[] = [];
  for (const s of ALL_STARS) if (e.quote.includes(s)) out.push(s);
  for (const s of ALL_STARS) {
    if (out.includes(s)) continue;
    if (e.h2.includes(s)) out.push(s);
  }
  // 「六杀（羊陀火铃空劫）」这一节讲的是六颗煞星
  if (e.h2.startsWith('六杀')) {
    for (const s of SHA_SIX) if (!out.includes(s)) out.push(s);
  }
  return out;
}

/** 一条语录命中的宫位（归一后的键） */
function palacesOf(e: NiEntry): string[] {
  const out = new Set<string>();
  const text = `${e.quote} ${e.h2}`;
  for (const [canon, forms] of Object.entries(PALACE_FORMS)) {
    if (forms.some((f) => text.includes(f))) out.add(canon);
  }
  return [...out];
}

/**
 * 检索语录。
 *
 * 打分思路：**引文里点名 > 所在节就是那一类**。
 * 「贪狼在官禄宫」这种一句里同时点到星与宫的原话最值钱；
 * 只在「贪狼」那一节里的次之；只在引文里顺带提一句的最弱。
 */
export function searchNi(query: NiQuery): NiHit[] {
  const entries = loadCorpus();
  if (!entries.length) return [];

  const kw = (query.q ?? '').trim().split(/\s+/).filter(Boolean);
  const wantStars = (query.stars ?? []).filter(Boolean);
  const wantPalaces = (query.palaces ?? []).map(normalizePalace).filter(Boolean);
  const wantSiHua = (query.siHua ?? []).filter(Boolean);
  const wantBooks = query.books ?? [];

  const hits: NiHit[] = [];
  const seen = new Set<string>();

  for (const e of entries) {
    if (wantBooks.length && !wantBooks.includes(e.book)) continue;

    const text = `${e.quote} ${e.h2} ${e.h3}`;
    // 关键词是 AND：全部命中才留
    if (kw.length && !kw.every((k) => text.includes(k))) continue;

    const eStars = starsOf(e);
    const ePalaces = palacesOf(e);
    const eSiHua = siHuaOf(text);

    const starHits = wantStars.filter((s) => eStars.includes(s));
    const palaceHits = wantPalaces.filter((p) => ePalaces.includes(p));
    const siHuaHits = wantSiHua.filter((s) => eSiHua.includes(s));

    // 没有指名星也没有指名宫时，只靠关键词/册子选；否则必须有命中
    const targeted = wantStars.length || wantPalaces.length || wantSiHua.length;
    if (targeted && !starHits.length && !palaceHits.length && !siHuaHits.length) continue;

    let score = 0;
    if (starHits.length) {
      score += Math.min(starHits.length, 2) * 6;
      // 引文里点名比「所在节就是它」更值钱
      const inQuote = starHits.filter((s) => e.quote.includes(s)).length;
      score += inQuote * 3;
    }
    if (palaceHits.length) {
      score += Math.min(palaceHits.length, 2) * 5;
      const inQuote = palaceHits.filter((p) =>
        (PALACE_FORMS[p] ?? [p]).some((f) => e.quote.includes(f)),
      ).length;
      score += inQuote * 3;
      // 所在节本身就是这个宫的节（h2=「官禄宫」）——讲的就是这个宫位的用法，
      // 比「某颗星带某句话」更贴题：解读要的是「这个宫管什么」，不是星性口诀。
      const ownSection = palaceHits.filter((p) =>
        (PALACE_FORMS[p] ?? [p]).some((f) => e.h2.includes(f)),
      ).length;
      score += Math.min(ownSection, 2) * 6;
    }
    if (siHuaHits.length) score += Math.min(siHuaHits.length, 2) * 3;
    if (kw.length) score += kw.length * 3;

    // 「天机化禄」这一类原话最值钱：引文里同时点了星与化
    for (const s of starHits) {
      for (const h of siHuaHits) {
        if (e.quote.includes(`${s}化${h}`)) score += 8;
      }
    }

    // 太碎的句子信息量低，太长的不适合当引文
    const len = e.quote.length;
    if (len < 10) score -= 3;
    else if (len > 140) score -= 2;
    else if (len >= 14 && len <= 90) score += 1;

    if (score <= 0) continue;

    const key = e.quote.trim();
    if (seen.has(key)) continue;
    seen.add(key);

    hits.push({
      quote: e.quote,
      note: e.note,
      book: e.book,
      bookLabel: BOOK_LABEL[e.book] ?? e.book,
      h2: e.h2,
      h3: e.h3,
      t_hms: e.t_hms,
      part: e.part,
      bvid: e.bvid,
      url: urlOf(e),
      citation: citationOf(e),
      score,
      stars: starHits,
      palaces: palaceHits,
      siHua: siHuaHits,
    });
  }

  // 同分时短句优先（引文要短才像「一句话」）
  hits.sort((a, b) => (b.score - a.score) || (Math.abs(a.quote.length - 45) - Math.abs(b.quote.length - 45)));
  return hits.slice(0, query.limit ?? 20);
}

// ─── 按命盘取 ──────────────────────────────────────────────

import type { ZiweiChart, Palace } from './types';

/**
 * 取某宫的「实际看的是哪一宫」——空宫借对宫（倪师体系）。
 * 与 ziwei-labels.ts 的 effectivePalace 同一口径。
 */
function effectivePalace(chart: ZiweiChart, palace: Palace | undefined): Palace | undefined {
  if (!palace) return undefined;
  const own = palace.stars.filter((s) => s.type === 'major');
  if (own.length) return palace;
  const opp = chart.palaces.find((p) => p.branch === (palace.branch + 6) % 12);
  return opp ?? palace;
}

/**
 * 按命盘的几处宫位取语录：宫里的主星 + 四化，交叉着宫位本身去检索。
 * 这是「解读与合参按盘取原话」的入口。
 *
 * 两处讲究：
 *   ① **按节去重**——一颗星往往自带一整节原话（如「廉贞 · 与杀破狼」有几十条），
 *      不限制的话整段会被同一节刷屏，看着像引用了很多，其实只说了一件事。
 *      同一节最多取 MAX_PER_SECTION 条。
 *   ② **跨宫位合并后按分数排序**——不按传入顺序返回，谁更贴题谁靠前。
 */
const MAX_PER_SECTION = 2;

export function niForPalaces(
  chart: ZiweiChart,
  palaceNames: string[],
  limit = 8,
): NiHit[] {
  const hits: NiHit[] = [];
  const seen = new Set<string>();
  const perSection = new Map<string, number>();

  for (const name of palaceNames) {
    const key = normalizePalace(name);
    const own = chart.palaces.find((p) => normalizePalace(p.name) === key);
    const eff = effectivePalace(chart, own);
    if (!eff) continue;

    const stars = eff.stars
      .filter((s) => s.type === 'major' || s.siHua)
      .map((s) => s.name);
    if (!stars.length) continue;

    // 这一宫自己带的四化（「天机化禄」这类原话最贴盘）
    const siHua = [...new Set(eff.stars.map((s) => s.siHua).filter((x): x is NonNullable<typeof x> => !!x))];

    const got = searchNi({ stars, siHua, palaces: [key], limit: limit * 4 });
    for (const h of got) {
      if (seen.has(h.quote)) continue;
      const n = perSection.get(h.h2) ?? 0;
      if (n >= MAX_PER_SECTION) continue;
      seen.add(h.quote);
      perSection.set(h.h2, n + 1);
      hits.push(h);
    }
  }

  hits.sort((a, b) => (b.score - a.score) || (Math.abs(a.quote.length - 45) - Math.abs(b.quote.length - 45)));
  return hits.slice(0, limit);
}

/** 一条命中的单行展示文本（含出处与链接） */
export function hitLine(h: NiHit): string {
  const note = h.note ? `〔${h.note}〕` : '';
  return `「${h.quote}」${note}（${h.citation}）${h.url}`;
}
