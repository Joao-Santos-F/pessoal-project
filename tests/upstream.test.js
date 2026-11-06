'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const urls = new Map();
function moduleUrl(file) {
  if (urls.has(file)) return urls.get(file);
  const source = fs.readFileSync(file, 'utf8').replace(/from '(\.\/[^']+)'/g,
    (_, relative) => `from '${moduleUrl(path.resolve(path.dirname(file), relative))}'`);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  urls.set(file, url);
  return url;
}
globalThis.matchMedia = () => ({ matches: false });
const bondModule = () => import(moduleUrl(path.join(__dirname, '../src/renderer/js/bond.js')));

test('automatic assistant selection does not prioritize partial Codex hooks over complete Claude hooks', () => {
  const codexState = { installed: false, events: ['Stop'], file: 'C:/fixture/hooks.json' };
  const module = { exports: {} };
  const mocks = {
    'node:fs': { existsSync: () => false }, 'node:path': path,
    '../../scripts/install-codex-hooks': { status: () => codexState },
    '../../scripts/install-hooks': { status: () => ({ installed: true }) },
    '../../scripts/install-hooks-agy': { status: () => ({ installed: false }) },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main/assistants.js'), 'utf8'), {
    module, require: name => mocks[name],
  });
  assert.equal(module.exports.resolveAssistant('auto'), 'claude');
  codexState.installed = true;
  assert.equal(module.exports.resolveAssistant('auto'), 'codex');
  assert.equal(module.exports.resolveAssistant('claude'), 'claude');
});

test('petting gains bond with a daily cap and supplies its emotional context', async () => {
  const { Bond } = await bondModule();
  const bond = new Bond({ host: { saveConfig() {} } });
  clearTimeout(bond.saveTimer);
  bond.save = () => {};
  const before = bond.data.xp;
  for (let i = 0; i < 20; i++) bond.add('pet');
  assert.equal(bond.data.xp - before, 5);
  bond.feel('petted');
  assert.equal(bond.feeling, 'petted');
  assert.match(bond.moodLine(), /petted/);
});

test('jealous page closing stops when disabled or when the foreground page changes', async () => {
  const { Jealousy } = await bondModule();
  const jealousy = Object.assign(Object.create(Jealousy.prototype), {
    enabled: true, closePages: true, front: { id: 7, key: 'chatgpt', page: 'site' },
  });
  const target = { id: 7, key: 'chatgpt' };
  assert.equal(jealousy.still(target), true);
  jealousy.closePages = false;
  assert.equal(jealousy.still(target), false);
  jealousy.closePages = true;
  jealousy.front.page = null;
  assert.equal(jealousy.still(target), false);
  jealousy.front = { id: 8, key: 'chatgpt', page: 'site' };
  assert.equal(jealousy.still(target), false);
});

test('clicking the warning cancels closing and clears the pending warning', async () => {
  const { Jealousy } = await bondModule();
  let shown;
  const jealousy = Object.assign(Object.create(Jealousy.prototype), {
    brain: { t: { jealous: { spare: 'Let me' } } },
    panel: { say: value => { shown = value; } },
  });
  const warning = jealousy.warn('Warning', 5000);
  assert.ok(shown.actions.length);
  assert.equal(jealousy.spare(), true);
  assert.equal(await warning, true);
  assert.equal(jealousy.spare(), false);
});
