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

/** 词条/属性 key 的中文名（仅收录高置信度通用词，其余显示英文原文，待官方文案校对） */
const STAT_LABELS: Record<string, string> = {
  dmgBonus: '伤害加成',
  dmgBoost: '伤害提升',
  vsBossDmg: '对首领伤害',
  crit: '暴击',
  critDmgBonus: '暴击伤害',
  maxHp: '生命上限',
  defense: '防御',
};

export function statLabel(key: string): string {
  if (STAT_LABELS[key]) return STAT_LABELS[key];
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
export function renderEffectEntry(entry: unknown): EffectRender {
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
        parts.push(`${statLabel(key)} +${fmtStatValue(key, val)}`);
      }
    }
  }

  if (e.effect) {
    for (const [key, val] of Object.entries(e.effect)) {
      if (typeof val === 'number') {
        parts.push(`${statLabel(key)} +${fmtStatValue(key, val)}`);
      } else if (val && typeof val === 'object' && 'function' in (val as object)) {
        return { raw: entry };
      }
    }
  }

  if (e.convert) {
    parts.push(
      `${statLabel(e.convert.from ?? '?')} 按 ${(e.convert.ratio ?? 1) * 100}% 转化为 ${statLabel(e.convert.to ?? '?')}`,
    );
  }

  if (!parts.length) return { raw: entry };
  return { text: parts.join('，') };
}

export function renderEffectList(tier: unknown): EffectRender[] {
  if (!tier || typeof tier !== 'object') return [];
  const effect = (tier as { effect?: unknown }).effect;
  if (!Array.isArray(effect)) return [];
  return effect.map(renderEffectEntry);
}
