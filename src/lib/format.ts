/**
 * 展示层助手：名称回落（中文优先，缺中文时用英文并标注）、
 * 数值格式化、效果 DSL 的尽力转译。
 * 转译不了的条目返回 raw，由页面折叠展示 JSON 原文。
 */

export type LocalizedName = { en: string; zh: string | null };

export function displayName(name: LocalizedName): { text: string; zhMissing: boolean } {
  return name.zh
    ? { text: name.zh, zhMissing: false }
    : { text: name.en, zhMissing: true };
}

export type ZhInfo = { zh: string; confidence: 'high' | 'medium' } | null;

/** 心法显示名：人工对照的中文名优先；medium 置信的标注「待确认」 */
export function displayNameVerified(
  name: LocalizedName,
  zhInfo: ZhInfo,
): { text: string; zhMissing: boolean; zhPending: boolean } {
  if (zhInfo) {
    return {
      text: zhInfo.zh,
      zhMissing: false,
      zhPending: zhInfo.confidence === 'medium',
    };
  }
  const base = displayName(name);
  return { text: base.text, zhMissing: base.zhMissing, zhPending: false };
}

/** PascalCase → kebab-case（PhalanxbaneBlade → phalanxbane-blade），用于 tag 反查数据 id */
export function pascalToKebab(tag: string): string {
  return tag.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * 词条/属性 key 的中文名（来源：17173 全武器攻略的效果描述原文、九游五维属性说明，
 * 均为游戏内官方用语的玩家转述）：
 * - 五维：劲/体/敏/势/御（power/body/agility/momentum/defense）
 * - 暴击两系：会心（crit）与 会意（affinity，鸣金流派专用）
 * - 五系属性攻击：外功/鸣金/裂石/牵丝/破竹
 */
const STAT_LABELS: Record<string, string> = {
  dmgBonus: '伤害加成',
  dmgBoost: '伤害提升',
  vsBossDmg: '对首领伤害',
  crit: '会心',
  critRate: '会心率',
  critDmgBonus: '会心伤害',
  affinity: '会意',
  affinityRate: '会意率',
  affinityDmgBonus: '会意伤害',
  precision: '精准',
  maxHp: '气血上限',
  defense: '御',
  power: '劲',
  body: '体',
  agility: '敏',
  momentum: '势',
  minPhys: '最小外功攻击',
  maxPhys: '最大外功攻击',
  minBellstrike: '最小鸣金攻击',
  maxBellstrike: '最大鸣金攻击',
  minStonesplit: '最小裂石攻击',
  maxStonesplit: '最大裂石攻击',
  minSilkbind: '最小牵丝攻击',
  maxSilkbind: '最大牵丝攻击',
  minBamboocut: '最小破竹攻击',
  maxBamboocut: '最大破竹攻击',
  allMartialArts: '全武学伤害加成',
  moBladeDmgBoost: '陌刀伤害提升',
  hengBladeDmgBoost: '横刀伤害提升',
  umbrellaDmgBoost: '伞伤害提升',
  ropeDartDmgBoost: '绳镖伤害提升',
  gauntletDmgBoost: '拳套伤害提升',
  spearDmgBoost: '枪伤害提升',
  swordDmgBoost: '剑伤害提升',
  fanDmgBoost: '扇伤害提升',
  dualBladesDmgBoost: '双刀伤害提升',
};

export type AffixDef = { key: string; name: { en: string; zh: string | null }; percentage: boolean };
export type AffixLookup = (key: string) => AffixDef | undefined;

export function statLabel(key: string, affixLookup?: AffixLookup): string {
  if (STAT_LABELS[key]) return STAT_LABELS[key];
  const def = affixLookup?.(key);
  if (def) return def.zh ?? def.en;
  // 驼峰转空格，如 moBladeDmgBoost → mo Blade Dmg Boost（无可靠译名，保留可读英文）
  return key.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/** 百分比型属性：按数据 percentage 标记或后缀约定判断（后缀匹配不区分大小写） */
const PERCENT_SUFFIXES = ['dmgbonus', 'dmgboost', 'boost', 'penetration', 'resistance'];
export function isPercentStat(key: string, percentage?: boolean): boolean {
  if (percentage !== undefined) return percentage;
  const lower = key.toLowerCase();
  return lower === 'vsbossdmg' || PERCENT_SUFFIXES.some((s) => lower.endsWith(s));
}

export function fmtStatValue(key: string, value: number, percentage?: boolean): string {
  if (isPercentStat(key, percentage)) {
    return `${(value * 100).toFixed(1).replace(/\.0$/, '')}%`;
  }
  return String(value);
}

export type EffectRender = { text: string } | { raw: unknown };

type DslEntry = {
  requirement?: Array<{ target?: string; value?: string; operator?: string; operand?: unknown }>;
  effect?: Record<string, unknown>;
  rawStat?: Record<string, number>;
  convert?: { from?: string; to?: string; ratio?: number };
};

/** 转译单个效果条目；无法识别的结构返回原文 */
export function renderEffectEntry(entry: unknown, affixLookup?: AffixLookup): EffectRender {
  if (!entry || typeof entry !== 'object') return { raw: entry };
  const e = entry as DslEntry;
  const parts: string[] = [];

  if (e.requirement?.length) {
    const conds = e.requirement
      .filter((r) => r?.target === 'skillTag' && r.value)
      .map((r) => r.value);
    if (conds.length === 1) parts.push(`【${conds[0]}】`);
    else if (conds.length > 1) parts.push(`【${conds.join(' / ')}】`);
  }

  if (e.rawStat) {
    for (const [key, val] of Object.entries(e.rawStat)) {
      if (typeof val === 'number') {
        parts.push(`${statLabel(key, affixLookup)} +${fmtStatValue(key, val)}`);
      }
    }
  }

  if (e.effect) {
    for (const [key, val] of Object.entries(e.effect)) {
      if (typeof val === 'number') {
        parts.push(`${statLabel(key, affixLookup)} +${fmtStatValue(key, val)}`);
      } else if (val && typeof val === 'object' && 'function' in (val as object)) {
        return { raw: entry };
      }
    }
  }

  if (e.convert) {
    parts.push(
      `${statLabel(e.convert.from ?? '?', affixLookup)} 按 ${(e.convert.ratio ?? 1) * 100}% 转化为 ${statLabel(e.convert.to ?? '?', affixLookup)}`,
    );
  }

  if (!parts.length) return { raw: entry };
  return { text: parts.join('，') };
}

export function renderEffectList(tier: unknown, affixLookup?: AffixLookup): EffectRender[] {
  if (!tier || typeof tier !== 'object') return [];
  const effect = (tier as { effect?: unknown }).effect;
  if (!Array.isArray(effect)) return [];
  return effect.map((e) => renderEffectEntry(e, affixLookup));
}

/** 技能伤害系数摘要：物理/丝缚系数合计与段数，无伤害动作返回 null */
export function skillDamageSummary(
  actions: Array<Record<string, unknown>>,
): { label: string; value: string } | null {
  const dmgs = actions.filter((a) => a?.type === 'damage');
  if (!dmgs.length) return null;
  const sum = (pick: (a: Record<string, unknown>) => unknown) =>
    dmgs.map(pick).reduce((s: number, v) => (typeof v === 'number' ? s + v : s), 0);
  const parts: string[] = [];
  const phy = sum((a) => a.phyCoef);
  if (phy > 0) parts.push(`物理系数 ${dmgs.length > 1 ? `${dmgs.length} 段合计 ` : ''}${phy.toFixed(2)}`);
  const silk = sum((a) => a.silkbindCoef);
  if (silk > 0) parts.push(`丝缚系数 ${silk.toFixed(2)}`);
  if (!parts.length) return null;
  return { label: '伤害', value: parts.join('，') };
}
