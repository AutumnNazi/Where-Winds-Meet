import { z } from 'astro:content';
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
import zhCatalogRaw from '../data/innerway-zh-catalog.json';
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

// 灰机 wiki 心法中文名录与人工核对的中英对照（策划数据，结构自控，宽松校验）
const zhMapEntrySchema = z.object({
  zh: z.string(),
  confidence: z.enum(['high', 'medium']),
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
  .parse(zhCatalogRaw);
const zhMap = z
  .record(z.string(), zhMapEntrySchema)
  .parse(
    Object.fromEntries(
      Object.entries(zhMapRaw).filter(([key]) => !key.startsWith('_')),
    ),
  );

/** 心法中文名：zh-map（人工对照）优先，medium 置信标注待确认 */
export function innerwayZhInfo(id: string) {
  return zhMap[id] ?? null;
}
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
