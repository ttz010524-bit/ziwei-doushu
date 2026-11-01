/**
 * app/api/niyu —— 倪师《天纪·紫微斗数》原话检索接口
 *
 * 语料是 docs/tianji-ziwei/entries.jsonl（1848 条原话），在服务端读取——
 * 741 KB 的语料不该打进浏览器包里。
 *
 * 查询参数（GET，可都省略，逗号分隔多个）：
 *   q       自由关键词（空格分隔，需全部命中）
 *   stars   星曜名，如「紫微,廉贞」
 *   palaces 宫位名，如「官禄,财帛」（「交友」与「仆役」通用）
 *   siHua   四化，禄/权/科/忌
 *   books   册名，如「01-stars,02-palaces」
 *   limit   最多返回几条，默认 30，上限 100
 *
 * GET 返回：{ installed, total, hits[] }
 *   hits[i] = { quote, note, book, bookLabel, h2, h3, t_hms, part, bvid, url, citation, ... }
 *   url 直接跳到 B 站原视频的那一秒；note 是语料库里的考据标注（错字裁决），必须随原话一起给。
 *
 * POST（body = { chart, palaces?, limit? }）：按命盘取原话。
 *   合参面板要的是「这张盘上真正坐着的星曜怎么说」，不是手挑那几条——
 *   空宫借对宫的规矩也在服务端算（倪师体系），所以走服务端而不是浏览器。
 *
 * 著作权：原话归原权利人，CC BY-NC-SA 4.0，**不许商用**。
 */
import type { NextRequest } from 'next/server';
import { searchNi, corpusInstalled, loadCorpus, niForPalaces } from '@/lib/ziwei/ni-corpus';
import type { ZiweiChart } from '@/lib/ziwei/types';

export const runtime = 'nodejs';

const MAX_LIMIT = 100;

function list(sp: URLSearchParams, key: string): string[] {
  return (sp.get(key) ?? '')
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const installed = corpusInstalled();
  if (!installed) {
    return Response.json({
      installed: false,
      total: 0,
      hits: [],
      message: '语料库未安装（找不到 docs/tianji-ziwei/entries.jsonl）。可用环境变量 NI_CORPUS_PATH 指定。',
    });
  }

  const limitRaw = parseInt(sp.get('limit') ?? '', 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(limitRaw, 1), MAX_LIMIT)
    : 30;

  const hits = searchNi({
    q: sp.get('q') ?? undefined,
    stars: list(sp, 'stars'),
    palaces: list(sp, 'palaces'),
    siHua: list(sp, 'siHua'),
    books: list(sp, 'books'),
    limit,
  });

  return Response.json({
    installed: true,
    total: loadCorpus().length,
    hits,
  });
}

/** 命盘是否像一张盘（合参面板 POST 用） */
function isChart(u: unknown): u is ZiweiChart {
  const x = u as Partial<ZiweiChart> | null;
  return !!x && Array.isArray(x.palaces) && x.palaces.length > 0 && Array.isArray(x.daXians);
}

/** 按命盘取原话：默认取官禄 / 财帛 / 命三宫（事业相关原话最集中的地方） */
export async function POST(request: NextRequest) {
  let body: { chart?: unknown; palaces?: string[]; limit?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid json body' }, { status: 400 });
  }
  if (!isChart(body.chart)) {
    return Response.json({ error: 'missing chart' }, { status: 400 });
  }
  if (!corpusInstalled()) {
    return Response.json({
      installed: false,
      total: 0,
      hits: [],
      message: '语料库未安装（找不到 docs/tianji-ziwei/entries.jsonl）。可用环境变量 NI_CORPUS_PATH 指定。',
    });
  }

  const limit = Math.min(Math.max(Number(body.limit) || 8, 1), 20);
  const palaces = body.palaces?.length ? body.palaces : ['官禄', '财帛', '命'];
  const hits = niForPalaces(body.chart, palaces, limit);

  return Response.json({
    installed: true,
    total: loadCorpus().length,
    hits,
  });
}
