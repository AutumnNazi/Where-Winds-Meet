#!/usr/bin/env node
/**
 * 从灰机 wiki（yy16s.huijiwiki.com，CC BY-SA 协议）的「流派」页拉取
 * 心法中文名录（11 流派 × 4 部 + 通用心法按品质分级），
 * 解析后生成 src/data/innerway-zh-catalog.json。
 *
 * 注意：灰机 wiki 有 Cloudflare 质询，直连被拦时自动改走本机代理 127.0.0.1:7890。
 * 用法：node scripts/fetch-huiji-catalog.mjs
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const URL_API =
  'https://yy16s.huijiwiki.com/api.php?action=parse&page=%E6%B5%81%E6%B4%BE&prop=wikitext&format=json';
const OUT = path.resolve(import.meta.dirname, '../src/data/innerway-zh-catalog.json');

function fetchWikitext(useProxy) {
  const proxyArg = useProxy ? '-x http://127.0.0.1:7890' : '';
  const out = execSync(
    `curl -s ${proxyArg} --compressed -A "${UA}" "${URL_API}"`,
    { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
  );
  const j = JSON.parse(out);
  return j.parse?.wikitext?.['*'];
}

let wikitext;
try {
  wikitext = fetchWikitext(false);
} catch {
  console.log('直连被 Cloudflare 拦截，改走代理 127.0.0.1:7890 重试…');
  wikitext = fetchWikitext(true);
}
if (!wikitext) {
  console.error('拉取失败：未取得流派页 wikitext');
  process.exit(1);
}

// 解析 {{#invoke:...|鸣金·虹=[[A]]，[[B]]...}} 流派区
const factions = [];
// 解析 "** 金色品质：[[A]]，[[B]]" 通用心法区
const common = {};
let currentQuality = null;

for (const rawLine of wikitext.split('\n')) {
  const line = rawLine.trim();
  const factionMatch = /^\|([^|=]+)=(.+)$/.exec(line);
  if (factionMatch && factionMatch[1].includes('·')) {
    const names = [...factionMatch[2].matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
    if (names.length) factions.push({ key: factionMatch[1].trim(), innerways: names });
    continue;
  }
  const qualityMatch = /^\*\*\s*(金色|紫色|蓝色)品质[：:](.*)$/.exec(line);
  if (qualityMatch) {
    currentQuality = qualityMatch[1];
    common[currentQuality] = [...qualityMatch[2].matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
  }
}

const catalog = {
  _source:
    '灰机wiki「流派」页（https://yy16s.huijiwiki.com/wiki/流派），CC BY-SA 协议，署名转载',
  fetchedAt: new Date().toISOString().slice(0, 10),
  factions,
  common,
};

fs.writeFileSync(OUT, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
const total = factions.reduce((n, f) => n + f.innerways.length, 0);
console.log(`心法名录已生成 → ${OUT}`);
console.log(`流派 ${factions.length} 个、流派心法 ${total} 部、通用心法 ${Object.values(common).flat().length} 部`);
