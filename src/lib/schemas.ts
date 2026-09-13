import { z } from 'astro:content';

/**
 * 本站数据 schema（src/data/ 由 scripts/import-ref-data.mjs 生成）。
 * 效果数据为参考仓库的机器可读 DSL，结构开放，用 record 保留原文；
 * 展示层（src/lib/format.ts）做尽力转译，转译不了的折叠显示原文。
 */

export const localizedNameSchema = z.object({
  en: z.string(),
  zh: z.string().nullable(),
});

export const innerwaysSchema = z.record(
  z.string(),
  z.object({
    id: z.string(),
    name: localizedNameSchema,
    tags: z.array(z.string()),
    /** T0–T6 七层效果，null 表示该层无效果 */
    tiers: z
      .array(z.record(z.string(), z.unknown()).nullable())
      .length(7),
    extras: z.record(z.string(), z.unknown()),
  }),
);

export const martialArtsSchema = z.record(
  z.string(),
  z.object({
    id: z.string(),
    name: localizedNameSchema,
    weapon: z.string(),
    tag: z.string().nullable(),
    talents: z.array(
      z.object({
        level: z.number(),
        entries: z.array(
          z.object({
            /** 强化名中文名，来自 CSV 的 talent 覆盖，可能为 null */
            nameZh: z.string().nullable(),
            data: z.record(z.string(), z.unknown()),
          }),
        ),
      }),
    ),
  }),
);

export const skillsSchema = z.array(
  z.object({
    source: z.string(),
    key: z.string(),
    name: localizedNameSchema,
    shortName: z.string().nullable(),
    /** 通用技能（弹反/完美闪避）的时长按当前武器取值，为分段函数对象 */
    castTime: z
      .union([z.number(), z.record(z.string(), z.unknown())])
      .nullable(),
    cooldown: z
      .union([z.number(), z.record(z.string(), z.unknown())])
      .nullable(),
    cooldownGroup: z.string().nullable(),
    damageGroup: z.string().nullable(),
    tags: z.array(z.string()),
    actions: z.array(z.record(z.string(), z.unknown())),
    modifiers: z.array(z.record(z.string(), z.unknown())),
  }),
);

export const attunementsSchema = z.array(
  z.object({
    key: z.string(),
    name: localizedNameSchema,
    percentage: z.boolean(),
    tags: z.array(z.string()),
    effect: z.record(z.string(), z.unknown()).nullable(),
  }),
);

export const gearDefsSchema = z.object({
  slots: z.array(z.object({ id: z.string(), name: localizedNameSchema })),
  affixes: z.array(
    z.object({
      key: z.string(),
      name: localizedNameSchema,
      percentage: z.boolean(),
    }),
  ),
  universalAdditionalAffixes: z.record(z.string(), z.array(z.string())),
  gear: z.array(
    z.object({
      key: z.string(),
      name: localizedNameSchema,
      slots: z.array(z.string()),
      martialArt: z.string().nullable(),
      baseStats: z.record(
        z.string(),
        z.record(z.string(), z.record(z.string(), z.number())),
      ),
      baseAffixes: z.record(z.string(), z.array(z.string())),
      additionalAffixes: z.record(z.string(), z.array(z.string())),
    }),
  ),
});

export const gearSetsSchema = z.array(
  z.object({
    key: z.string(),
    kind: z.enum(['weapon', 'armor', 'bowRing']),
    name: localizedNameSchema,
    tags: z.array(z.string()),
    options: z.record(z.string(), z.record(z.string(), z.unknown())),
  }),
);

export const pathsSchema = z.array(
  z.object({
    key: z.string(),
    tag: z.string().nullable(),
    name: localizedNameSchema,
    status: z.string().nullable(),
    buildGroup: z.string().nullable(),
    lockedWeapons: z.array(z.string()),
  }),
);

export const weaponsSchema = z.array(
  z.object({
    key: z.string(),
    name: localizedNameSchema,
    nameSource: z.string().nullable(),
    martialArts: z.array(z.string()),
  }),
);

export const buildsSchema = z.array(
  z.object({
    group: z.string(),
    id: z.string(),
    name: localizedNameSchema,
    order: z.number().nullable(),
    martialArts: z.array(z.string()),
    setup: z.object({
      innerWays: z.array(
        z.object({ innerWay: z.string(), tier: z.string() }),
      ),
      weaponSets: z.record(z.string(), z.number()),
      armorSets: z.record(z.string(), z.number()),
      bowRingSet: z.string().nullable(),
      arsenal: z.string().nullable(),
    }),
  }),
);

/** 词条数值上限：按装备等级（如 96/91）分档，affix 为副词条、attunement 为调律词条 */
export const affixValuesSchema = z.record(
  z.string(),
  z.object({
    affix: z.record(z.string(), z.number()),
    attunement: z.record(z.string(), z.number()),
  }),
);
