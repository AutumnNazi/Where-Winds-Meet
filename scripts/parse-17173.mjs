#!/usr/bin/env node
/**
 * 从 docs/source-17173-wuxue.html（17173《燕云十六声》全武器攻略，玩家整理的
 * 游戏内文案）解析武学与心法的中文描述，生成：
 *   src/data/martial-arts-zh-desc.json   12 套武学的效果描述（5 条/套）
 *   src/data/innerway-zh-desc.json       24 部心法的分类/基础增益/获取途径
 * 内容为玩家转述的游戏文案，以游戏内实际为准。
 * 用法：node scripts/parse-17173.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(import.meta.dirname, '../docs/source-17173-wuxue.html');
const OUT = path.resolve(import.meta.dirname, '../src/data');

const html = fs.readFileSync(SRC, 'utf8');
const text = html
  .replace(/<script[\s\S]*?<\/script>/g, ' ')
  .replace(/<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<br\s*\/?>/g, '\n')
  .replace(/<\/(p|div|h\d|li)>/g, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&[a-z]+;/g, '')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n{2,}/g, '\n');

// 按「N）名称：」切条目；条目内的键：心法效果/心法说明/基础增益/心法增益/心法获取/心法获取方式
const sections = [];
let currentFaction = null;
for (const raw of text.split('\n')) {
  const line = raw.trim();
  const factionMatch = /^(?:\d、)?([\u4e00-\u9fff]{3,4})流派(武学|心法)推荐[：:]?$/.exec(line);
  if (factionMatch) {
    currentFaction = { name: factionMatch[1], kind: factionMatch[2], items: {} };
    sections.push(currentFaction);
    continue;
  }
  if (!currentFaction) continue;
  const itemMatch = /^\d）\)?([\u4e00-\u9fff·]{2,12})[：:]?$/.exec(line);
  if (itemMatch) {
    currentFaction.items[itemMatch[1]] =
      currentFaction.kind === '武学' ? { __effects: [] } : {};
    continue;
  }
  const keys = Object.keys(currentFaction.items);
  if (!keys.length) continue;
  const lastName = keys[keys.length - 1];
  const entry = currentFaction.items[lastName];
  const kvMatch = /^(心法效果|心法说明|基础增益|心法增益|心法获取|获取方式|心法获取方式)[：:](.*)$/.exec(line);
  if (kvMatch) {
    entry[kvMatch[1]] = kvMatch[2].trim();
  } else if (currentFaction.kind === '武学' && /^\d、/.test(line)) {
    entry.__effects.push(line.replace(/^(\d)、/, '').replace(/；$/, '').trim());
  } else {
    const lastKey = Object.keys(entry).pop();
    if (lastKey && line && !/^【/.test(line)) {
      entry[lastKey] += line; // 描述折行拼接
    }
  }
}

// 心法条目字段自适应归类：「进攻·增伤」式短标签 → category，长文本 → effect
const isCategory = (v) => v.length <= 24 && v.includes('·');
const normalize = (obj) => {
  let category = null;
  let effect = null;
  for (const key of ['心法效果', '心法说明', '基础增益', '心法增益']) {
    const v = obj[key];
    if (!v) continue;
    if (!category && isCategory(v)) category = v;
    else if (!effect) effect = v;
  }
  return {
    category,
    effect,
    obtain: obj['心法获取'] ?? obj['获取方式'] ?? obj['心法获取方式'] ?? null,
  };
};

const innerwaysDesc = {};
const martialArtsDesc = {};
for (const section of sections) {
  for (const [name, raw] of Object.entries(section.items)) {
    if (section.kind === '心法') {
      innerwaysDesc[name] = { faction: section.name, ...normalize(raw) };
    } else {
      martialArtsDesc[name] = { faction: section.name, effects: raw.__effects };
    }
  }
}

const meta = {
  _source:
    '17173《燕云十六声》全武器攻略（news.17173.com/content/01142025/015407897.shtml），玩家整理的游戏内文案，版权归原站与官方，转载请注明',
  parsedAt: new Date().toISOString().slice(0, 10),
};

fs.writeFileSync(
  path.join(OUT, 'innerway-zh-desc.json'),
  JSON.stringify({ ...meta, innerways: innerwaysDesc }, null, 2) + '\n',
  'utf8',
);
fs.writeFileSync(
  path.join(OUT, 'martial-arts-zh-desc.json'),
  JSON.stringify({ ...meta, martialArts: martialArtsDesc }, null, 2) + '\n',
  'utf8',
);

const iwCount = Object.keys(innerwaysDesc).length;
const maCount = Object.keys(martialArtsDesc).length;
console.log(`心法描述 ${iwCount} 部、武学描述 ${maCount} 套`);
const noEffect = Object.entries(innerwaysDesc).filter(([, v]) => !v.effect);
if (noEffect.length) console.log('缺效果描述:', noEffect.map(([k]) => k).join('、'));
const sample = innerwaysDesc['抗造大法'];
console.log('样本(抗造大法):', JSON.stringify(sample));
