/**
 * lib/ziwei/chart-session —— 命盘页与解读页之间传盘
 *
 * 命盘和解读拆成两页之后，跨页要带的东西只有两样：
 *   ① 出生信息（BirthInfo）——用它可以**重新排出**同一张盘；
 *   ② 命盘上的选择（点了哪个宫、点了哪颗四化）——解读页要据此展开对应的解读。
 *
 * 为什么存 BirthInfo 而不是整张命盘 JSON：
 *   命盘是算出来的，同一份 BirthInfo 一定得到同一张盘；
 *   而命盘 JSON 里有大限表、十二宫星曜，落一份就几百 KB，
 *   塞进 sessionStorage 再解析一遍纯属浪费。存输入、现算，比存结果省。
 *
 * 只在浏览器里用（sessionStorage），所以两个页面都得是 client component。
 */
import type { BirthInfo } from './types';

const KEY = 'ziwei-chart-session';

/** 运限层（与 components/TimeNav 的 TimeView 同口径） */
export type SessionTimeView = 'mingpan' | 'daxian' | 'liunian';

export interface ChartSession {
  /** 出生信息：用它重排命盘 */
  birthInfo: BirthInfo;
  /** 命盘上选中的宫位（地支序号 0–11） */
  selectedBranch?: number | null;
  /** 命盘上点开的四化 */
  selectedSiHua?: {
    starName: string;
    siHua: string;
    view: SessionTimeView;
    liunianYear: number;
  } | null;
}

export function saveChartSession(s: ChartSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 隐私模式 / 配额满：不影响本页，只是跨页带不过去 */
  }
}

export function loadChartSession(): ChartSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const x = JSON.parse(raw) as ChartSession;
    if (!x?.birthInfo || typeof x.birthInfo.year !== 'number') return null;
    return x;
  } catch {
    return null;
  }
}

export function clearChartSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch { /* 忽略 */ }
}
