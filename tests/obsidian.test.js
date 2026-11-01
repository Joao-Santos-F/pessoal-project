'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const obsidian = require('../src/main/obsidian');
const direct = require('../src/main/direct');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-obsidian-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const vault = path.join(root, 'Vault');
  fs.mkdirSync(path.join(vault, '.obsidian'), { recursive: true });
  fs.mkdirSync(path.join(root, 'obsidian'));
  fs.writeFileSync(path.join(root, 'obsidian/obsidian.json'), JSON.stringify({ vaults: { test: { path: vault } } }));
  const options = { appData: root, signal: new AbortController().signal, approve: async () => true, saveSelection: () => {}, openExternal: async () => {} };
  return { root, vault, options };
}
test('vault discovery, create, append and read roundtrip preserves existing notes', async (t) => {
  const f = fixture(t);
  assert.equal(obsidian.vaults(f.root)[0].name, 'Vault');
  await obsidian.handle('/obsidian criar Capri/Olá.md | Primeiro conteúdo', f.options);
  await obsidian.handle('/obsidian acrescentar Capri/Olá.md | Segundo conteúdo', f.options);
  assert.match(await obsidian.handle('/obsidian ler Capri/Olá.md', f.options), /Primeiro conteúdo\n\nSegundo conteúdo/);
  await assert.rejects(obsidian.handle('/obsidian criar Capri/Olá.md | substituir', f.options), /já existe/);
  assert.equal(await obsidian.handle('/obsidian listar Olá', f.options), 'Capri/Olá.md');
});
test('note operations reject traversal, reserved devices, hidden folders and junctions', (t) => {
  const f = fixture(t), vault = obsidian.vaults(f.root)[0];
  for (const name of ['../outside', '.obsidian/app', 'C:\\outside', 'nota:stream', 'CON', 'pasta/NUL.txt', 'abc/../../evil', 'nota. ']) assert.throws(() => obsidian.notePath(vault, name, true), name);
  const outside = path.join(f.root, 'outside'); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(f.vault, 'junction'), 'junction');
  assert.throws(() => obsidian.notePath(vault, 'junction/escape.md', true), /Links|fora/);
});
test('declined or aborted confirmation never writes a note', async (t) => {
  const f = fixture(t);
  f.options.approve = async () => false;
  assert.match(await obsidian.handle('/obsidian criar test | conteúdo', f.options), /cancelada/);
  assert.equal(fs.existsSync(path.join(f.vault, 'test.md')), false);
  const abort = new AbortController(); f.options.signal = abort.signal;
  f.options.approve = async () => { abort.abort(); return true; };
  await assert.rejects(obsidian.handle('/obsidian criar test | conteúdo', f.options), /cancelada/);
  assert.equal(fs.existsSync(path.join(f.vault, 'test.md')), false);
});
test('explicit vault selection is required with multiple vaults', () => {
  const items = [{ id: '1', name: 'Same' }, { id: '2', name: 'Same' }];
  assert.throws(() => obsidian.selectVault(items));
  assert.throws(() => obsidian.selectVault(items, 'Same'));
  assert.equal(obsidian.selectVault(items, '2').id, '2');
});
test('opening uses an encoded official URI without note content', async (t) => {
  const f = fixture(t); let uri;
  fs.writeFileSync(path.join(f.vault, 'Olá & teste.md'), 'private');
  f.options.openExternal = async (value) => { uri = value; };
  await obsidian.handle('/obsidian abrir Olá & teste.md', f.options);
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, 'obsidian:');
  assert.equal(parsed.searchParams.get('file'), 'Olá & teste.md');
  assert.equal(parsed.searchParams.get('vault'), 'test');
  assert.ok(!uri.includes('private'));
});
test('internal commands must be listed, explicitly approved and passed as arguments', async (t) => {
  const f = fixture(t), calls = [];
  f.options.runCli = async (_, args) => { calls.push(args); return args[1] === 'commands' ? 'app:open-settings\n' : 'done'; };
  f.options.approve = async () => false;
  assert.match(await obsidian.handle('/obsidian comando app:open-settings', f.options), /cancelada/);
  assert.equal(calls.length, 1);
  f.options.approve = async () => true;
  assert.equal(await obsidian.handle('/obsidian comando app:open-settings', f.options), 'done');
  assert.deepEqual(calls.at(-1), ['vault=test', 'command', 'id=app:open-settings']);
  await assert.rejects(obsidian.handle('/obsidian comando bogus', f.options), /não encontrado/);
});
test('direct PowerShell runs exact reviewed command, with no AI involved', async () => {
  let executed = false;
  const signal = new AbortController().signal;
  const options = { signal, approve: async () => false, execute: async (script) => { executed = true; assert.equal(script, 'Write-Output 42'); return { ok: true, output: '42' }; } };
  assert.match(await direct.handle('/executar Write-Output 42', options), /cancelado/);
  assert.equal(executed, false);
  options.approve = async () => true;
  assert.match(await direct.handle('/executar Write-Output 42', options), /42/);
  assert.equal(executed, true);
});
test('any selected executable path can open after confirmation', async (t) => {
  const f = fixture(t), file = path.join(f.root, 'Portable.exe'); fs.writeFileSync(file, 'fixture');
  let opened = null;
  const options = { signal: new AbortController().signal, launch: { risky: () => true }, shell: { openPath: async (p) => { opened = p; return ''; } }, approve: async () => false };
  assert.match(await direct.handle(`/abrir "${file}"`, options), /cancelada/);
  assert.equal(opened, null);
  options.approve = async () => true;
  await direct.handle(`/abrir "${file}"`, options);
  assert.equal(opened, file);
});
