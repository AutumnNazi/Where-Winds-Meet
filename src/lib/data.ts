import { z } from 'astro:content';
import { statLabel } from './format';
import attunementsRaw from '../data/attunements.json';
import buildsRaw from '../data/builds.json';
import gearDefsRaw from '../data/gear-defs.json';
import gearSetsRaw from '../data/gear-sets.json';
import innerwaysRaw from '../data/innerways.json';
import martialArtsRaw from '../data/martial-arts.json';
import pathsRaw from '../data/paths.json';
import skillsRaw from '../data/skills.json';
import weaponsRaw from '../data/weapons.json';
import affixValuesRaw from '../data/affix-values.json';
import innerwayZhCatalogRaw from '../data/innerway-zh-catalog.json';
import innerwayZhDescRaw from '../data/innerway-zh-desc.json';
import martialArtsZhDescRaw from '../data/martial-arts-zh-desc.json';
import martialArtsZhMapRaw from '../data/martial-arts-zh-map.json';
import tiaolvKnowledgeRaw from '../data/tiaolv-knowledge.json';
import zhMapRaw from '../data/innerway-zh-map.json';
import {
  affixValuesSchema,
  attunementsSchema,
  buildsSchema,
  gearDefsSchema,
  gearSetsSchema,
  innerwaysSchema,
  martialArtsSchema,
  pathsSchema,
  skillsSchema,
  weaponsSchema,
} from './schemas';

// 构建时对数据做 schema 校验：数据重新导入后若结构不兼容，build 直接失败
export const attunements = attunementsSchema.parse(attunementsRaw);
export const builds = buildsSchema.parse(buildsRaw);
export const gearDefs = gearDefsSchema.parse(gearDefsRaw);
export const gearSets = gearSetsSchema.parse(gearSetsRaw);
export const innerways = innerwaysSchema.parse(innerwaysRaw);
export const martialArts = martialArtsSchema.parse(martialArtsRaw);
export const paths = pathsSchema.parse(pathsRaw);
export const skills = skillsSchema.parse(skillsRaw);
export const weapons = weaponsSchema.parse(weaponsRaw);
export const affixValues = affixValuesSchema.parse(affixValuesRaw);

// 灰机 wiki 心法中文名录 + 17173 中文描述 + 人工中英对照（策划数据，宽松校验）
const zhMapEntrySchema = z.object({
  zh: z.string(),
  confidence: z.enum(['high', 'medium']),
});
const zhDescEntrySchema = z.object({
  faction: z.string(),
  category: z.string().nullable(),
  effect: z.string().nullable(),
  obtain: z.string().nullable(),
});
const maZhDescEntrySchema = z.object({
  faction: z.string(),
  effects: z.array(z.string()),
});
export const innerwayZhCatalog = z
  .object({
    _source: z.string(),
    fetchedAt: z.string(),
    factions: z.array(
      z.object({ key: z.string(), innerways: z.array(z.string()) }),
    ),
    common: z.record(z.string(), z.array(z.string())),
  })
  .parse(innerwayZhCatalogRaw);
const zhMap = z
  .record(z.string(), zhMapEntrySchema)
  .parse(
    Object.fromEntries(
      Object.entries(zhMapRaw).filter(([key]) => !key.startsWith('_')),
    ),
  );
const zhAnchor = z
  .record(z.string(), z.string())
  .parse((zhMapRaw as Record<string, unknown>)._factionsAnchor ?? {});
const innerwayZhDesc = z
  .object({ innerways: z.record(z.string(), zhDescEntrySchema) })
  .parse(innerwayZhDescRaw).innerways;
const martialArtsZhDesc = z
  .object({ martialArts: z.record(z.string(), maZhDescEntrySchema) })
  .parse(martialArtsZhDescRaw).martialArts;
const martialArtsZhMap = z
  .record(z.string(), zhMapEntrySchema)
  .parse(
    Object.fromEntries(
      Object.entries(martialArtsZhMapRaw).filter(([key]) => !key.startsWith('_')),
    ),
  );

export const innerwayZhInfo = (id: string) => zhMap[id] ?? null;
export const martialArtZhInfo = (id: string) => martialArtsZhMap[id] ?? null;
export const martialArtZhDesc = (zhName: string) =>
  martialArtsZhDesc[zhName] ?? null;

/** 调律机制知识（社区整理的官方机制数据，宽松校验） */
export const tiaolvKnowledge = z
  .object({
    _comment: z.string(),
    updatedAt: z.string(),
    fiveStats: z.object({
      title: z.string(),
      note: z.string(),
      rows: z.array(z.object({ stat: z.string(), convert: z.string() })),
    }),
    rateCaps: z.object({
      title: z.string(),
      rows: z.array(z.object({ name: z.string(), cap: z.string() })),
    }),
    damageFlow: z.object({
      title: z.string(),
      steps: z.array(z.string()),
    }),
    factionSplit: z.object({
      title: z.string(),
      rows: z.array(z.object({ type: z.string(), detail: z.string() })),
      note: z.string(),
    }),
    affixPriority: z.object({
      title: z.string(),
      order: z.array(z.string()),
      notes: z.array(z.string()),
    }),
    factionPriority: z.object({
      title: z.string(),
      _source: z.string(),
      factions: z.array(
        z.object({
          name: z.string(),
          priority: z.string(),
          note: z.string().optional(),
        }),
      ),
      note: z.string(),
    }),
    gradPanels: z.object({
      title: z.string(),
      _source: z.string(),
      grad: z.array(z.object({ stat: z.string(), value: z.string() })),
      advanced: z.array(z.object({ stat: z.string(), value: z.string() })),
      notes: z.array(z.string()),
    }),
  })
  .parse(tiaolvKnowledgeRaw);

/** 心法流派 tag → 中文流派名（StonesplitMight → 裂石·威） */
export const factionZhByTag = (tag: string) => zhAnchor[tag] ?? null;

export type InnerwayCatalogEntry = {
  slug: string;
  zhName: string;
  enName: string | null;
  faction: string;
  quality: string | null;
  refId: string | null;
  confidence: 'high' | 'medium' | null;
  desc: { category: string | null; effect: string | null; obtain: string | null } | null;
  tiers: Array<Record<string, unknown> | null> | null;
};

/**
 * 心法全目录（60 部）：灰机名录 + 17173 描述 + 参考数据三源合并。
 * 参考数据 18 部带英文 slug 与 T0–T6 效果；其余以中文名为 slug。
 */
export const innerwayCatalogList: InnerwayCatalogEntry[] = (() => {
  const zhToId = new Map(
    [...Object.entries(zhMap)].map(([id, v]) => [v.zh, id]),
  );
  const entries: InnerwayCatalogEntry[] = [];
  const push = (
    zhName: string,
    faction: string,
    quality: string | null,
  ) => {
    const refId = zhToId.get(zhName) ?? null;
    const ref = refId ? innerways[refId] : null;
    entries.push({
      slug: refId ?? zhName,
      zhName,
      enName: ref?.name.en ?? null,
      faction,
      quality,
      refId,
      confidence: refId ? zhMap[refId].confidence : null,
      desc: innerwayZhDesc[zhName] ?? null,
      tiers: ref?.tiers ?? null,
    });
  };
  for (const f of innerwayZhCatalog.factions) {
    for (const zhName of f.innerways) push(zhName, f.key, null);
  }
  for (const [quality, names] of Object.entries(innerwayZhCatalog.common)) {
    for (const zhName of names) push(zhName, '通用', quality);
  }
  return entries;
})();

export const innerwayCatalogEntryBySlug = (slug: string) =>
  innerwayCatalogList.find((e) => e.slug === decodeURIComponent(slug));

export const innerwayCatalogTotal = {
  factions: innerwayZhCatalog.factions.length,
  factionInnerways: innerwayZhCatalog.factions.reduce(
    (n, f) => n + f.innerways.length,
    0,
  ),
  commonInnerways: Object.values(innerwayZhCatalog.common).flat().length,
};

export const innerwayById = (id: string) => innerways[id];
/** 配装数据里武学为短名（thundercry），兼容匹配到完整 id（thundercry-blade） */
export const martialArtById = (id: string) =>
  martialArts[id] ??
  Object.values(martialArts).find(
    (m) => m.id.startsWith(`${id}-`) || m.id === id,
  );
export const weaponByKey = (key: string) => weapons.find((w) => w.key === key);
/** 配装数据里心法键为 PascalCase（如 ExquisiteScenery），归一化为 kebab-case 查找 */
export const innerWayByKey = (key: string) => {
  const kebab = key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
  return innerways[key] ?? innerways[kebab];
};
export const gearSetByKey = (key: string) =>
  gearSets.find((s) => s.key === key);
export const pathByTag = (tag: string) =>
  paths.find((p) => p.tag === tag) ??
  paths.find(
    (p) =>
      p.key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()) === tag,
  );
export const skillsBySource = (source: string) =>
  skills.filter((s) => s.source === source);

export const affixByKey = new Map(gearDefs.affixes.map((a) => [a.key, a]));
export const affixLookup = (key: string) => affixByKey.get(key);
/** 属性显示名：中文表 → 词条定义（zh 优先回落英文）→ 英文驼峰展开 */
export function statDisplayName(key: string): string {
  return statLabel(key, affixLookup);
}

export const SITE = {
  title: '燕云资料站',
  subtitle: 'Where Winds Meet 游戏资料',
  nav: [
    { href: '/innerways/', label: '心法' },
    { href: '/martial-arts/', label: '武学' },
    { href: '/skills/', label: '技能' },
    { href: '/attunements/', label: '词条' },
    { href: '/builds/', label: '配装' },
  ],
};
