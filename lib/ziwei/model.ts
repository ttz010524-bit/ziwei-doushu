/**
 * lib/ziwei/model —— 命理解读的大模型层
 *
 * 分工：**本地解读数据集负责「事实」，模型负责「表达」。**
 *
 * buildAnswer() 已经把本命断语 + 现算的大限/流年四化 + 落宫三方四正
 * 组装成一段可核查的事实文本；这里把它当上下文交给模型，让模型按客户端
 * 要求的小节结构重新组织成一段给命主看的解读。
 *
 * 三条不能破的约束：
 * 1. 模型只许用事实层里的信息。数据集**没有**流年/大限正文，模型要是
 *    自己补，就是编 —— 这是这套数据最大的风险，所以系统提示词里写死了。
 * 2. 客户端按行匹配小节标题（^\*\*【(.+?)】\*\*$），标题必须独占一行。
 * 3. thinking 与正文共用 max_tokens 配额，给小了会只吐 thinking 没有正文。
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Palace, Star, ZiweiChart } from './types';
import { BRANCHES } from './constants';

/** 默认模型。ANTHROPIC_MODEL 可覆盖；走本地代理时端点会忽略这个值。 */
export const DEFAULT_MODEL = 'claude-opus-4-7';

/** max_tokens 要够 thinking + 正文 —— 两者共用这个配额，给小了会只吐 thinking */
const MAX_TOKENS = 8000;

function envVal(name: string): string {
  return (process.env[name] ?? '').trim();
}

/**
 * 是否配置了可用的接入方式。
 * 两种都算：真实的 ANTHROPIC_API_KEY，或者本地代理用的 ANTHROPIC_AUTH_TOKEN。
 * 一个都没有就走本地查表，功能不缺失，只是没那么「说人话」。
 */
export function modelEnabled(): boolean {
  return !!(envVal('ANTHROPIC_API_KEY') || envVal('ANTHROPIC_AUTH_TOKEN'));
}

let cachedClient: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (cachedClient) return cachedClient;
  const apiKey = envVal('ANTHROPIC_API_KEY');
  const authToken = envVal('ANTHROPIC_AUTH_TOKEN');
  const baseURL = envVal('ANTHROPIC_BASE_URL');
  try {
    cachedClient = new Anthropic({
      ...(apiKey ? { apiKey } : {}),
      ...(authToken ? { authToken } : {}),
      ...(baseURL ? { baseURL } : {}),
    });
  } catch (e) {
    console.error('[model] Anthropic 客户端初始化失败:', e);
    cachedClient = null;
  }
  return cachedClient;
}

/**
 * 解读层的通用规则：写给模型看的「不许做什么」与「怎么写」。
 *
 * 两半都不能省：少了「不许」，模型就会自己排盘、自己补流年断语；
 * 少了「怎么写」，小节标题不独占一行，客户端就渲染成一堵字墙。
 *
 * 小节名的来源刻意设计成「沿用事实层」：事实层（buildAnswer /
 * buildHemingFacts）已经把该出现哪些小节、什么顺序算好了，
 * 模型只要照着列，不必自己规划结构 —— 这样客户端请求的小节
 * 与模型输出的小节天然对齐。
 */
export const SYSTEM_RULES = `你是紫微斗数（三合派）解读师，传承倪海厦《天纪》体系。

# 铁律
1. 只依据 <命盘事实> 作答。事实里没有的星曜、宫位、四化、年龄、大限，一律不许写。
2. 严禁虚构倪师原话或古籍原文。事实中出现的引文可以照抄并用「」包住；不得自行编造倪师说法。
   事实里的断法若是「将星入命→威震边疆、武职大贵」这种箭头式要点，请转述，
   不要改写成对白再放进「」——「」里的字必须与事实一字不差。
3. 事实里的本命断语只覆盖一辈子。大限与流年只能依据事实里现算出来的四化与落宫关系，不要杜撰流年/大限断语。
4. 不要重新排盘，不要改动事实里的四化表、落宫与三方四正关系。
5. 事实是素材，不是答案。要把它讲给命主听：给结论、讲依据、给能落地的建议，而不是复述事实。
6. 用中文，像一位懂命的师傅当面讲盘。不要说明书腔，不要空话套话。

# 输出格式（必须严格遵守）
- 逐节输出。每节标题**独占一行**，写成 **【小节名】**，标题前后不要加别的字符。
- 小节名与顺序，直接沿用 <命盘事实> 里已有的小节，不要新增、不要改名、不要合并。
- 每节 2–5 句，说清「是什么、为什么、怎么办」，不要重复同一句话。
- 可以用 **加粗** 标出星曜与四化（例如 **紫微**、**化忌**）。
- 不要输出 markdown 标题（#）、表格、代码块。`;

/** 一次模型请求要带的东西 */
export interface ModelAsk {
  /** 用户这次的问题原文（客户端的提问模板或自由输入） */
  question: string;
  /** 上一次的问题，自由追问时给上下文用 */
  prevQuestion?: string;
  /** 事实层（buildAnswer / buildHemingFacts 的产出） */
  facts: string;
  /** 命盘摘要 */
  digest?: string;
  /** 追加在通用规则之前的领域方法论（合盘用 HEMING_METHODOLOGY） */
  system?: string;
  /** 模型 ID，默认 DEFAULT_MODEL */
  model?: string;
  /** 思考强度。命理解读用 low 就够，high 会显著拖慢首字时间 */
  effort?: 'low' | 'medium' | 'high';
}

function buildUserText(ask: ModelAsk): string {
  const parts: string[] = [];
  if (ask.digest) parts.push(`<命盘摘要>\n${ask.digest}\n</命盘摘要>`);
  parts.push(`<命盘事实>\n${ask.facts}\n</命盘事实>`);
  if (ask.prevQuestion) parts.push(`<上一轮问题>\n${ask.prevQuestion}\n</上一轮问题>`);
  parts.push(`<本次问题>\n${ask.question}\n</本次问题>`);
  parts.push('请依据以上事实作答。');
  return parts.join('\n\n');
}

/**
 * 流式生成解读正文。只吐 text，不吐 thinking —— thinking 是模型的内部推理，
 * 混进正文里用户会看到一堆自问自答。
 */
export async function* streamAnswer(ask: ModelAsk): AsyncGenerator<string> {
  const cli = getClient();
  if (!cli) throw new Error('模型未配置');

  const model = ask.model || envVal('ANTHROPIC_MODEL') || DEFAULT_MODEL;
  const effort = ask.effort ?? 'low';

  const params: Anthropic.MessageCreateParamsStreaming = {
    model,
    max_tokens: MAX_TOKENS,
    // messages.stream() 自己会置 true，这里显式写上是为了满足类型
    stream: true,
    system: [
      {
        type: 'text',
        // 合盘等场景会在 ask.system 里补领域方法论（倪师合盘框架），
        // 通用规则永远接在后面，保证「不许做什么」不被冲掉。
        text: ask.system ? `${ask.system}\n\n${SYSTEM_RULES}` : SYSTEM_RULES,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: buildUserText(ask) }],
    thinking: { type: 'adaptive' },
    output_config: { effort },
  };

  let emitted = 0;
  try {
    for await (const t of runStream(cli, params)) {
      emitted++;
      yield t;
    }
    return;
  } catch (err) {
    // 端点不支持 adaptive thinking / effort（400）时，去掉这两个参数重试一次。
    // 只在还没吐字时重试，否则会出现重复正文。
    if (emitted > 0 || !isBadRequest(err)) throw err;
    console.warn('[model] adaptive thinking 不被接受，去掉后重试');
  }

  const { thinking: _t, output_config: _o, ...rest } = params;
  for await (const t of runStream(cli, rest as Anthropic.MessageCreateParamsStreaming)) {
    yield t;
  }
}

async function* runStream(
  cli: Anthropic,
  params: Anthropic.MessageCreateParamsStreaming,
): AsyncGenerator<string> {
  const stream = cli.messages.stream(params);
  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta' &&
      event.delta.text
    ) {
      yield event.delta.text;
    }
  }
}

function isBadRequest(err: unknown): boolean {
  const e = err as { status?: number; statusCode?: number } | null;
  return e?.status === 400 || e?.statusCode === 400;
}

// ─── 命盘摘要 ──────────────────────────────────────────────
//
// 给模型当「盘面事实」用。比整张 chart JSON 省 10 倍以上，而且直接是
// 人话：模型不需要自己从 palaces[] 里挑字段。

function starLabel(s: Star): string {
  const b = s.brightnessRaw ? `(${s.brightnessRaw})` : '';
  const h = s.siHua ? `化${s.siHua}` : '';
  return `${s.name}${b}${h}`;
}

function palaceStars(p: Palace): string {
  const majors = p.stars.filter((s) => s.type === 'major');
  if (majors.length) return majors.map(starLabel).join('、');
  if (p.borrowedStars?.length) {
    return `空宫，借${p.borrowedFromName ?? '对宫'}：${p.borrowedStars.join('、')}`;
  }
  return '空宫';
}

export function chartDigest(chart: ZiweiChart): string {
  const lines: string[] = [];
  const ming = chart.palaces.find((p) => p.name === '命宫');
  const shen = chart.palaces.find((p) => p.branch === chart.shenGongBranch);
  const dx = chart.daXians[chart.currentDaXianIndex];

  lines.push(`命宫主星：${ming ? palaceStars(ming) : '—'}`);
  lines.push(`身宫：${shen ? shen.name : '—'}`);
  lines.push(`五行局：${chart.wuxingJuName}`);
  lines.push(
    `农历：${chart.lunarInfo.lunarYear}年` +
      `${chart.lunarInfo.isLeapMonth ? '闰' : ''}${chart.lunarInfo.lunarMonth}月${chart.lunarInfo.lunarDay}日`,
  );
  if (dx) lines.push(`当前大限：${dx.startAge}–${dx.endAge} 岁，行${dx.palaceName}`);
  lines.push('');
  lines.push('十二宫主星（本命四化以「化X」标出）：');
  for (const p of chart.palaces) {
    lines.push(`- ${p.name}(${BRANCHES[p.branch]})：${palaceStars(p)}`);
  }
  return lines.join('\n');
}
