/**
 * 八字大运「起始公历年 ↔ 虚岁」映射 — 回归测试
 *
 * 背景（2026-11-02）：命盘页「八字 × 紫微合参」面板要显示「当前大运」，
 * 逐盘核对时发现同一个人在浏览器里显示「乙亥（32–41 岁）」，而按农历起运推算是「癸未」。
 * 追下来不是合参面板的锅，是 lib/ziwei/bazi.ts 里大运起始年的换算写错了：
 *
 *   旧：startYear = 起运公历年 + (起运虚岁 - 1)
 *   新：startYear = 出生年   + (该步大运虚岁 - 1)
 *
 * lunar-javascript 自己的 getStartYear() 用的是后者（它内部就是
 * startAge = startYear - birthYear + 1）。旧式把「起运那一年的公历年」
 * 当成了「第一步大运的起始年」，等于把整张大运表整体后移了「起运岁数」年——
 * 九岁起运的命盘能差出九年，「当前大运」直接选错一步（且随起运早晚而漂）。
 *
 * 本测试锁住：
 *   ① 起始年 = 出生年 + 虚岁 - 1（每一步都成立）
 *   ② 相邻两步间隔 10 年、首尾连续（不能有洞）
 *   ③ 两个真实命例的「当前大运」（2026 年）选对
 */
import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { computeBazi } from '../../lib/ziwei/bazi';

let passed = 0;
const ok = (name: string, cond: boolean) => { assert.ok(cond, `❌ ${name}`); console.log(`  ✅ ${name}`); passed++; };

const bazi = (y: number, mo: number, d: number, h: number, gender: 'male' | 'female') => {
  const b = computeBazi(generateChart({ year: y, month: mo, day: d, hour: h, gender } as any));
  assert.ok(b, '取不到节气四柱');
  return b;
};

const current = (b: NonNullable<ReturnType<typeof computeBazi>>, year: number) =>
  b.daYun.find((d) => year >= d.startYear && year <= d.startYear + (d.endAge - d.startAge));

// ① 起始年 ↔ 虚岁 一致（两种性别各验一遍：顺排 / 逆排）
for (const gender of ['female', 'male'] as const) {
  const b = bazi(1985, 3, 8, 5, gender);
  const bad = b.daYun.filter((d) => d.startYear !== 1985 + d.startAge - 1);
  ok(`${gender} 1985-03-08 巳时：每步大运起始年 = 出生年 + 虚岁 - 1`, bad.length === 0);
  ok(`${gender} 1985-03-08 巳时：大运每步间隔 10 年且首尾连续`, (() => {
    for (let i = 1; i < b.daYun.length; i++) {
      if (b.daYun[i].startYear !== b.daYun[i - 1].startYear + 10) return false;
      if (b.daYun[i].startAge !== b.daYun[i - 1].startAge + 10) return false;
    }
    return b.daYun.length >= 8;
  })());
}

// ② 真实命例的「当前大运」
//    女：1985-03-08 巳时，1994-06-08 起运（9 岁 3 个月），大运顺排 → 2024 起癸未
const f = bazi(1985, 3, 8, 5, 'female');
ok('女 1985-03-08 巳时：第一步大运庚辰起于 1994 年（起运当年）', f.daYun[0].ganZhi === '庚辰' && f.daYun[0].startYear === 1994);
ok('女 1985-03-08 巳时：2026 年当前大运 = 癸未（40–49 岁）', current(f, 2026)?.ganZhi === '癸未');

//    男：同生日，大运逆排，2026 年正好交运
const m = bazi(1985, 3, 8, 5, 'male');
ok('男 1985-03-08 巳时：乙亥起于 2016 年（不是 2017）', m.daYun.find((d) => d.ganZhi === '乙亥')?.startYear === 2016);
ok('男 1985-03-08 巳时：2026 年当前大运 = 甲戌（42–51 岁，交运年）', current(m, 2026)?.ganZhi === '甲戌');

// ③ 大运年份单调递增，且不与出生年之前重叠
ok('女命：大运起始年全部晚于出生年', f.daYun.every((d) => d.startYear > 1985));
ok('女命：当前大运落在表内且唯一', (() => {
  const hits = f.daYun.filter((d) => 2026 >= d.startYear && 2026 <= d.startYear + (d.endAge - d.startAge));
  return hits.length === 1;
})());

console.log(`\n[dayun-start-year] ${passed} 项断言全部通过`);
