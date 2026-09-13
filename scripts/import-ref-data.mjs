#!/usr/bin/env node
/**
 * 从参考仓库 where-builds-meet（GPL-3.0，github.com/greydust/where-builds-meet）导入游戏数据，
 * 转换为本站 schema 后写入 src/data/。只搬运数据，不复制其代码。
 *
 * 用法：node scripts/import-ref-data.mjs [参考仓库路径]
 * 未传路径时默认使用系统临时目录下的 wwm-ref/where-builds-meet。
 *
 * 名称中文化规则：优先查 locales/translations.csv 的 zh-Hans 列，空则回落 zh-Hant，
 * 仍为空则保留英文（数据里 zh 为 null，页面显示"中文名待补"）。不编造译名。
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const REF = path.resolve(
  process.argv[2] ?? path.join(os.tmpdir(), 'wwm-ref', 'where-builds-meet'),
);
const OUT = path.resolve(import.meta.dirname, '../src/data');

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// ---- 名称映射表：data.<category>.<camelId>.name → { en, zh } ----
const csvLines = fs
  .readFileSync(path.join(REF, 'locales/translations.csv'), 'utf8')
  .trim()
  .split(/\r?\n/);
const [csvHeader, ...csvRows] = csvLines.map((line) => line.split(','));
const colIdx = Object.fromEntries(csvHeader.map((h, i) => [h, i]));
const NAME_MAP = new Map();
for (const row of csvRows) {
  const key = row[colIdx['key']]?.trim();
  if (!key) continue;
  const en = row[colIdx['en']]?.trim() ?? '';
  const zh =
    row[colIdx['zh-Hans']]?.trim() || row[colIdx['zh-Hant']]?.trim() || null;
  NAME_MAP.set(key, { en, zh });
}

const nameStats = { hit: 0, miss: 0 };
function rawName(fullKey) {
  const hit = NAME_MAP.get(fullKey);
  if (hit?.zh) {
    nameStats.hit++;
    return hit.zh;
  }
  nameStats.miss++;
  return null;
}
function zhName(category, camelId) {
  return rawName(`data.${category}.${camelId}.name`);
}

function writeFile(relPath, data) {
  const abs = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return abs;
}

// ---- 心法 innerway/*.json → data/innerways/{id}.json ----
// 参考数据 effect 的键为 "BattleAnthemT0"…形式，归一化为 T0–T6 有序数组；
// 出现其他键时放入 extras，保证不丢数据。
function convertInnerway(raw, id) {
  const tierMap = {};
  const extras = {};
  for (const [key, val] of Object.entries(raw.effect ?? {})) {
    const m = /^(.*)T(\d+)$/.exec(key);
    const isEmpty = !val || Object.keys(val).length === 0;
    if (m) {
      tierMap[`T${m[2]}`] = isEmpty ? null : val;
    } else if (!isEmpty) {
      extras[key] = val;
    }
  }
  const tiers = Array.from({ length: 7 }, (_, i) => tierMap[`T${i}`] ?? null);
  return {
    id,
    name: { en: raw.name, zh: zhName('innerway', kebabToCamel(id)) },
    tags: raw.tags ?? [],
    tiers,
    extras,
  };
}

// ---- 武学 martial-art/*.json → data/martial-arts/{id}.json ----
// talent 数组下标即强化层级；强化名中文名按 CSV 的
// data.martialArt.<id>.talent.<level>.<idx>.name 查询（武学本名在 CSV 中无覆盖）。
function convertMartialArt(raw, id) {
  const idCamel = kebabToCamel(id);
  return {
    id,
    name: { en: raw.name, zh: zhName('martialArtName', idCamel) },
    weapon: raw.weapon,
    tag: raw.tag ?? null,
    talents: (raw.talent ?? []).map((entries, level) => ({
      level,
      entries: (entries ?? []).map((entry, idx) => ({
        nameZh: entry?.name
          ? rawName(`data.martialArt.${idCamel}.talent.${level}.${idx}.name`)
          : null,
        data: entry ?? {},
      })),
    })),
  };
}

// ---- 技能 skill/*.json → data/skills.json（合并为一个数组）----
function convertSkills() {
  const dir = path.join(REF, 'data/skill');
  const skills = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const source = file.replace(/\.json$/, '');
    const raw = readJson(path.join(dir, file));
    for (const [key, s] of Object.entries(raw)) {
      skills.push({
        source,
        key,
        // CSV 的技能名 key 形式为 data.skill.<source>.<skillKey>.name
        name: {
          en: s.name ?? key,
          zh: rawName(`data.skill.${source}.${key}.name`),
        },
        shortName: s.shortName ?? null,
        castTime: s.castTime ?? null,
        cooldown: s.cooldown ?? null,
        cooldownGroup: s.cooldownGroup ?? null,
        damageGroup: s.damageGroup?.id ?? null,
        tags: s.tags ?? [],
        actions: s.action ?? [],
        modifiers: s.modifier ?? [],
      });
    }
  }
  return skills;
}

// ---- 调律词条 attunement.json → data/attunements.json ----
function convertAttunements() {
  const raw = readJson(path.join(REF, 'data/attunement.json'));
  return Object.entries(raw).map(([key, a]) => ({
    key,
    name: { en: a.name, zh: zhName('attunement', kebabToCamel(key)) },
    percentage: a.percentage ?? false,
    tags: a.tags ?? [],
    effect: a.effect ?? null,
  }));
}

// ---- 装备槽位与词条定义 gear.json → data/gear-defs.json ----
function convertGearDefs() {
  const raw = readJson(path.join(REF, 'data/gear.json'));
  const slots = Object.entries(raw.slots).map(([id, en]) => ({
    id,
    name: { en, zh: zhName('gearSlot', kebabToCamel(id)) },
  }));
  const affixes = Object.entries(raw.affixes).map(([key, a]) => ({
    key,
    name: { en: a.name, zh: zhName('affix', kebabToCamel(key)) },
    percentage: a.percentage ?? false,
  }));
  // 装备定义：名称、可用槽位、对应武学、按等级×品质的基础属性、按等级的词条池
  const gear = Object.entries(raw.gear ?? {}).map(([key, g]) => ({
    key,
    name: { en: g.name, zh: zhName('gear', kebabToCamel(key)) },
    slots: g.slots ?? [],
    martialArt: g.weapon ?? null,
    baseStats: g.baseStats ?? {},
    baseAffixes: g.baseAffixes ?? {},
    additionalAffixes: g.additionalAffixes ?? {},
  }));
  const unhandled = Object.keys(raw).filter(
    (key) => !['slots', 'affixes', 'gear', 'universalAdditionalAffixes'].includes(key),
  );
  for (const key of unhandled) {
    console.warn(`  [警告] gear.json 中未处理的键: ${key}（已跳过）`);
  }
  return {
    slots,
    affixes,
    universalAdditionalAffixes: raw.universalAdditionalAffixes ?? {},
    gear,
  };
}

// ---- 套装 gear-set / armor-set / bow-ring-set → data/gear-sets.json ----
function convertGearSets() {
  const sources = [
    { file: 'gear-set.json', kind: 'weapon', category: 'gearSet' },
    { file: 'armor-set.json', kind: 'armor', category: 'armorSet' },
    { file: 'bow-ring-set.json', kind: 'bowRing', category: 'bowRingSet' },
  ];
  const sets = [];
  for (const { file, kind, category } of sources) {
    const raw = readJson(path.join(REF, 'data', file));
    for (const [key, s] of Object.entries(raw)) {
      sets.push({
        key,
        kind,
        name: { en: s.name, zh: zhName(category, kebabToCamel(key)) },
        tags: s.tags ?? [],
        options: s.options ?? {},
      });
    }
  }
  return sets;
}

// ---- 流派 path.json → data/paths.json ----
function convertPaths() {
  const raw = readJson(path.join(REF, 'data/path.json'));
  return Object.entries(raw).map(([key, p]) => ({
    key,
    tag: p.tag ?? null,
    name: {
      en: p.name,
      zh: zhName('path', kebabToCamel(key)),
    },
    status: p.status ?? null,
    buildGroup: p.buildGroup ?? null,
    lockedWeapons: p.lockedWeapons ?? [],
  }));
}

// ---- 配装 build/<group>/*.json → data/builds.json ----
function convertBuilds() {
  const dir = path.join(REF, 'data/build');
  const builds = [];
  for (const group of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    const groupCamel = kebabToCamel(group.name);
    for (const file of fs
      .readdirSync(path.join(dir, group.name))
      .filter((f) => f.endsWith('.json'))) {
      const fileId = file.replace(/\.json$/, '');
      if (fileId === 'empty') continue; // 占位配装，无资料价值
      const raw = readJson(path.join(dir, group.name, file));
      builds.push({
        group: group.name,
        id: raw.id ?? `${group.name}-${fileId}`,
        name: {
          en: raw.name ?? fileId,
          zh: zhName('build', `${groupCamel}.${kebabToCamel(fileId)}`),
        },
        order: raw.order ?? null,
        martialArts: raw.martialArts ?? [],
        setup: {
          innerWays: raw.setup?.innerWays ?? [],
          weaponSets: raw.setup?.weaponSets ?? {},
          armorSets: raw.setup?.armorSets ?? {},
          bowRingSet: raw.setup?.bowRingSet ?? null,
          arsenal: raw.setup?.arsenal ?? null,
        },
      });
    }
  }
  return builds;
}

// ---- 武器类型 weapons.json ----
// 参考数据无武器类别名称，中文取社区译名（nameSource 标记 manual，待与官方文案校对）。
const WEAPON_ZH = {
  MoBlade: '陌刀',
  HengBlade: '横刀',
  Umbrella: '伞',
  RopeDart: '绳镖',
  Gauntlet: '拳套',
  Spear: '枪',
  Sword: '剑',
  Fan: '扇',
  DualBlades: '双刀',
};

function convertWeapons(martialArts) {
  const weaponSet = [...new Set(martialArts.map((m) => m.weapon))].sort();
  return weaponSet.map((key) => ({
    key,
    name: {
      en: key,
      zh: WEAPON_ZH[key] ?? null,
    },
    nameSource: WEAPON_ZH[key] ? 'manual' : null,
    martialArts: martialArts
      .filter((m) => m.weapon === key)
      .map((m) => m.id),
  }));
}

// ---- 词条数值上限 stat.json → data/affix-values.json（按装备等级，原样保留）----
function convertAffixValues() {
  return readJson(path.join(REF, 'data/stat.json'));
}

// ---- 主流程 ----
if (!fs.existsSync(REF)) {
  console.error(`参考仓库不存在: ${REF}`);
  console.error('请先 clone 到临时目录或传入路径参数。');
  process.exit(1);
}
fs.rmSync(OUT, { recursive: true, force: true });

const MARTIAL_ARTS = Object.fromEntries(
  fs
    .readdirSync(path.join(REF, 'data/martial-art'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const id = f.replace(/\.json$/, '');
      return [
        id,
        convertMartialArt(readJson(path.join(REF, 'data/martial-art', f)), id),
      ];
    }),
);
writeFile('martial-arts.json', MARTIAL_ARTS);
writeFile('weapons.json', convertWeapons(Object.values(MARTIAL_ARTS)));

writeFile('innerways.json', Object.fromEntries(
  fs
    .readdirSync(path.join(REF, 'data/innerway'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const id = f.replace(/\.json$/, '');
      return [id, convertInnerway(readJson(path.join(REF, 'data/innerway', f)), id)];
    }),
));

writeFile('skills.json', convertSkills());
writeFile('attunements.json', convertAttunements());
writeFile('affix-values.json', convertAffixValues());
writeFile('gear-defs.json', convertGearDefs());
writeFile('gear-sets.json', convertGearSets());
writeFile('paths.json', convertPaths());
writeFile('builds.json', convertBuilds());

console.log(`导入完成 → ${OUT}`);
console.log(`中文名命中 ${nameStats.hit} / ${nameStats.hit + nameStats.miss}（未命中项 zh 为 null，页面显示英文名）`);
