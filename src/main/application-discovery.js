'use strict';
const fs = require('node:fs');
const path = require('node:path');
const excluded = /(?:^|[\s_.-])(unins\w*|uninstall\w*|setup|install\w*|update\w*|crash\w*|helper|diagnostic\w*)(?:$|[\s_.-])/i;
const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\.exe$/i, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

async function scan(roots, { maxEntries = 16000 } = {}) {
  const pending = roots.map(r => ({ ...r })), found = [], visited = new Set();
  let count = 0;
  while (pending.length && count < maxEntries) {
    const { directory, depth = 0 } = pending.shift();
    if (!directory || !path.isAbsolute(directory)) continue;
    let entries;
    try {
      if (fs.lstatSync(directory).isSymbolicLink()) continue;
      const key = fs.realpathSync(directory).toLowerCase();
      if (visited.has(key)) continue;
      visited.add(key);
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch { continue; }
    for (const entry of entries) {
      if (++count > maxEntries) break;
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory() && depth > 0 && !/^(node_modules|resources|cache|temp|logs)$/i.test(entry.name)) pending.push({ directory: full, depth: depth - 1 });
      else if (entry.isFile() && /\.(exe|lnk)$/i.test(entry.name) && !excluded.test(entry.name.replace(/\.(exe|lnk)$/i, ''))) {
        found.push({ name: entry.name.replace(/\.(exe|lnk)$/i, ''), kind: 'executable', id: full });
      }
    }
  }
  return found;
}

function defaultRoots(env = process.env) {
  const roots = (env.PATH || '').split(path.delimiter).filter(Boolean).map(directory => ({ directory: directory.replace(/^"|"$/g, ''), depth: 0 }));
  for (const root of [env.APPDATA, env.ProgramData]) if (root) roots.unshift({ directory: path.join(root, 'Microsoft/Windows/Start Menu/Programs'), depth: 4 });
  if (env.LOCALAPPDATA) roots.push({ directory: path.join(env.LOCALAPPDATA, 'Programs'), depth: 3 });
  for (const directory of [env.ProgramFiles, env['ProgramFiles(x86)']]) if (directory) roots.push({ directory, depth: 2 });
  return roots;
}

function candidates(items, query) {
  const wanted = normalize(query);
  if (!wanted) return [];
  const unique = [...new Map(items.map(i => [`${i.kind}:${i.id.toLowerCase()}`, i])).values()];
  const exact = unique.filter(i => normalize(i.name) === wanted || normalize(path.basename(i.id)) === wanted);
  if (exact.length) return exact;
  const tokens = wanted.split(' ');
  return unique.filter(i => {
    const name = normalize(i.name);
    return tokens.every(token => name.split(' ').includes(token)) || (wanted.length >= 3 && name.startsWith(wanted));
  }).sort((a,b) => a.name.localeCompare(b.name));
}
module.exports = { scan, defaultRoots, candidates, normalize };
