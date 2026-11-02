/**
 * 合参三轴的「谁给这一轴」 — 回归测试
 *
 * 背景（2026-11-02）：合参面板的「行业五行」这一轴，早前两侧都给：
 * 紫微侧从官禄宫／财帛宫的**星曜五行**（紫微属土、贪狼属木水……）推出一个五行，
 * 八字侧给用神／喜神五行，然后两个五行并排列出来当「兼容」。
 *
 * 这是错的：星曜的五行在倪师体系里论的是**星性**（这颗星是什么底子），
 * 拿来给职业贴行业标签没有依据；「贪狼属水，所以适合水行业」这种推法在倪师体系里
 * 并不存在。而八字那一侧的用神五行才是行业属性的正经来源。
 *
 * 所以现在的口径是：
 *   组织形态、职能位置 —— 两侧都给，所以能交叉、能出矛盾；
 *   行业五行 —— **只有八字给**，紫微侧不参与这一轴。
 *
 * 本测试锁住：
 *   ① 紫微侧标签里没有任何 axis === 'field' 的标签；
 *   ② 紫微侧标签里没有把职能取值（教育传道等）错挂在 org 轴上的；
 *   ③ 融合结果的 field 轴全部来自八字侧，且没有「紫微·八字」并排的取值；
 *   ④ 组织形态 / 职能位置两轴仍然两侧都能给（别把合参改空了）。
 */
import assert from 'node:assert/strict';
import { generateChart } from '../../lib/ziwei/algorithm';
import { deriveZiweiLabels } from '../../lib/ziwei/ziwei-labels';
import { deriveBaziLabels } from '../../lib/ziwei/bazi-labels';
import { computeBazi } from '../../lib/ziwei/bazi';
import { fuse, AXIS_SOURCE } from '../../lib/ziwei/fusion';

let passed = 0;
const ok = (name: string, cond: boolean) => {
  assert.ok(cond, `❌ ${name}`);
  console.log(`  ✅ ${name}`);
  passed++;
};

const CASES = [
  { year: 1985, month: 3, day: 8, hour: 5, gender: 'female' as const },
  { year: 1990, month: 6, day: 15, hour: 6, gender: 'male' as const },
  { year: 1978, month: 11, day: 2, hour: 9, gender: 'male' as const },
  { year: 2001, month: 1, day: 20, hour: 3, gender: 'female' as const },
];

const ORG_VALUES = ['公家单位', '私人企业', '自由职业', '军警武职'];
const FUNC_VALUES = [
  '统筹掌权', '参谋顾问', '专业技术专长', '行政执行',
  '经商老板', '军警执法', '教育传道', '文化艺术', '理财守成',
];

for (const c of CASES) {
  const tag = `${c.year}-${c.month}-${c.day} ${c.gender}`;
  const chart = generateChart(c as any);
  const ziwei = deriveZiweiLabels(chart);
  const bazi = computeBazi(chart);
  assert.ok(bazi, `${tag}：取不到节气四柱`);
  const baziLabels = deriveBaziLabels(bazi);
  const result = fuse(ziwei, baziLabels);

  // ① 紫微侧不出领域五行
  // 类型上 ZiweiLabel.axis 已经是 'org' | 'func'，这里仍按字符串比，
  // 是为了「万一有人用 as 硬塞一个 field 进来」也能被这条抓住。
  ok(
    `${tag}：紫微侧没有领域五行标签`,
    ziwei.every((l) => (l.axis as string) !== 'field'),
  );

  // ② 轴与取值对得上：org 轴只能是组织形态取值，func 轴只能是职能取值
  ok(
    `${tag}：紫微侧 org 轴没有职能取值`,
    ziwei.filter((l) => l.axis === 'org').every((l) => ORG_VALUES.includes(l.value as string)),
  );
  ok(
    `${tag}：紫微侧 func 轴没有组织形态取值`,
    ziwei.filter((l) => l.axis === 'func').every((l) => FUNC_VALUES.includes(l.value as string)),
  );

  // ③ field 轴只来自八字
  const fieldAxis = result.axes.find((a) => a.axis === 'field');
  assert.ok(fieldAxis, `${tag}：缺少 field 轴`);
  ok(
    `${tag}：field 轴所有取值的来源都是八字`,
    fieldAxis.values.length > 0
    && fieldAxis.values.every((v) => v.sources.every((s) => s.side === '八字')),
  );
  ok(
    `${tag}：field 轴没有紫微来源`,
    !fieldAxis.values.some((v) => v.sources.some((s) => s.side === '紫微')),
  );

  // ④ 组织形态 / 职能位置仍然是两侧都能给的（合参没被改空）
  ok(
    `${tag}：组织形态仍由两侧共同给出`,
    AXIS_SOURCE.org === '两侧' && AXIS_SOURCE.func === '两侧',
  );
  const orgAxis = result.axes.find((a) => a.axis === 'org');
  assert.ok(orgAxis, `${tag}：缺少 org 轴`);
  ok(
    `${tag}：组织形态轴上有紫微侧的信号`,
    orgAxis.values.some((v) => v.sources.some((s) => s.side === '紫微')),
  );
  ok(
    `${tag}：行业五行的来源标注是「八字」`,
    AXIS_SOURCE.field === '八字',
  );
}

console.log(`\n[fusion-axis-source] ${passed} 项断言全部通过`);
