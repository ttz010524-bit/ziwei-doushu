/**
 * lib/ziwei/dataset —— 本地解读数据集查表
 *
 * 数据来自 Release `v4.0-13d`「紫微斗数开源解读数据集 v4.0」(CC BY 4.0)：
 * 674,976 张命盘 × 13 维 = 8,774,688 段解读，官方压缩态 161 MB。
 *
 * 目录布局（由 ziwei-data 目录提供，可用 ZIWEI_DATA_DIR 覆盖）：
 *   <root>/months/year-YYYY/MM.zst   按月切帧（window_log=27），查表只解压命中月份
 *   <root>/years/year-YYYY.jsonl.zst 官方原始整年文件，作为回退
 *
 * 查表键 = 公历日期 + 时辰序号 + 性别，与官方数据集的 `k` 字段一一对应
 * （已核对：本仓库排盘引擎算出的命宫主星与数据集 `ms` 字段逐例一致）。
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { decompress } from '@mongodb-js/zstd';
import type { TopicKey } from './db-analysis';

export type { TopicKey };
export type Gender = 'male' | 'female';

export interface Reading {
  /** 查表键，如 `1990-07-15-5-male` */
  k: string;
  /** 命宫主星 */
  ms: string;
  /** 各维字数 */
  t: Record<TopicKey, number>;
  /** 13 维正文 */
  c: Record<TopicKey, string>;
}

export interface LookupQuery {
  year: number;
  month: number;
  day: number;
  /** 时辰序号 0=子 … 11=亥 */
  hour: number;
  gender: Gender;
}

/** 数据集覆盖的公历年份 */
export const DATASET_RANGE = { first: 1950, last: 2026 } as const;

let cachedRoot: string | null = null;

function dataRoot(): string {
  if (cachedRoot) return cachedRoot;
  const candidates = [
    process.env.ZIWEI_DATA_DIR,
    path.resolve(process.cwd(), '..', '..', 'ziwei-data'),
    path.resolve(process.cwd(), 'ziwei-data'),
  ].filter((c): c is string => !!c);
  for (const c of candidates) {
    if (existsSync(path.join(c, 'months')) || existsSync(path.join(c, 'years'))) {
      cachedRoot = c;
      return c;
    }
  }
  cachedRoot = candidates[0];
  return cachedRoot;
}

/** 数据集是否已就位（用于区分「没装数据集」与「年份不覆盖」） */
export function datasetInstalled(): boolean {
  const root = dataRoot();
  return existsSync(path.join(root, 'months')) || existsSync(path.join(root, 'years'));
}

const pad2 = (n: number) => String(n).padStart(2, '0');

async function readZst(file: string): Promise<Buffer | null> {
  try {
    return await decompress(await readFile(file));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

/** 从整块 JSONL 里抠出 `k` 对应的那一行 */
function extractLine(buf: Buffer, key: string): string | null {
  const at = buf.indexOf(Buffer.from(`"k":"${key}"`, 'utf8'));
  if (at < 0) return null;
  const start = buf.lastIndexOf(10, at) + 1;
  const nl = buf.indexOf(10, at);
  return buf.subarray(start, nl < 0 ? buf.length : nl).toString('utf8');
}

/**
 * 查一张命盘的 13 维解读。
 * 命中按月块（解压 ~59 MB，约 120 ms）；无月块时回退到官方整年文件（解压 0.69 GB，约 1.4 s）。
 */
export async function lookupReading(q: LookupQuery): Promise<Reading | null> {
  const root = dataRoot();
  const key = `${q.year}-${pad2(q.month)}-${pad2(q.day)}-${q.hour}-${q.gender}`;

  let buf = await readZst(path.join(root, 'months', `year-${q.year}`, `${pad2(q.month)}.zst`));
  if (!buf) buf = await readZst(path.join(root, 'years', `year-${q.year}.jsonl.zst`));
  if (!buf) return null;

  const line = extractLine(buf, key);
  return line ? (JSON.parse(line) as Reading) : null;
}
