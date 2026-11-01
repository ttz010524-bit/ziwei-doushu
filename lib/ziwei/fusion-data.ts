/**
 * lib/ziwei/fusion-data —— 合参的**纯数据层**（浏览器可跑）
 *
 * 把 fusion-text.ts 里的「算」与「讲」分开：
 *   这里只负责把命盘变成一组结构化数据（八字盘、两侧标签、叉乘结果）；
 *   fusion-text.ts 负责把这些数据排成可核查的文本（服务端）。
 *
 * 分家的理由很实际：合参面板要在浏览器里实时算（排盘一改就重算），
 * 而文本层要引倪师语料（node:fs，服务端才有）。两者不能塞进同一个模块。
 *
 * 这一层仍然是**确定性**的：只做集合运算与打分，不生成任何自然语言断语。
 */
import type { ZiweiChart } from './types';
import {
  computeBazi, ganZhiShiShen, liuNianGanZhi, GAN_ELEMENT,
  type BaziChart, type DaYunItem,
} from './bazi';
import { deriveZiweiLabels, type ZiweiLabel } from './ziwei-labels';
import { deriveBaziLabels, type BaziLabel } from './bazi-labels';
import { fuse, type FusionResult } from './fusion';

export interface FusionData {
  /** 八字盘（取不到节气四柱时为 null） */
  bazi: BaziChart | null;
  /** 紫微侧标签 */
  ziweiLabels: ZiweiLabel[];
  /** 八字侧标签 */
  baziLabels: BaziLabel[];
  /** 叉乘 + 交叉约束的结果 */
  result: FusionResult;
}

/** 当前所处大运 */
export function currentDaYun(b: BaziChart, year: number): DaYunItem | undefined {
  return b.daYun.find((d) => year >= d.startYear && year <= d.startYear + (d.endAge - d.startAge));
}

/** 某一运限干支与日主的关系（简版，不做完整合参） */
export function ganZhiTone(b: BaziChart, ganZhi: string): string {
  const ss = ganZhiShiShen(b.dayGan, ganZhi);
  const parts: string[] = [`天干${ganZhi[0]}为${ss.gan}`, `地支${ganZhi[1]}本气为${ss.zhi}`];
  if (b.useGod) {
    if (ss.gan === b.useGod.shiShen) parts.push('天干正是用神');
    if (ss.zhi === b.useGod.shiShen) parts.push('地支本气正是用神');
    if (b.jiShen && GAN_ELEMENT[ganZhi[0]] === b.jiShen) parts.push('天干为忌神');
  }
  return parts.join('，');
}

/** 合参数据：命盘 → 结构化结论 */
export function buildFusionData(chart: ZiweiChart, year?: number): FusionData {
  const ziweiLabels = deriveZiweiLabels(chart);
  const bazi = computeBazi(chart);
  const baziLabels = bazi ? deriveBaziLabels(bazi) : [];
  const result = fuse(ziweiLabels, baziLabels);
  return { bazi, ziweiLabels, baziLabels, result };
}
