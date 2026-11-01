'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const obsidian = require('../src/main/obsidian');
const direct = require('../src/main/direct');
const commands = require('../src/shared/commands');

test('all registered command aliases normalize without translating arguments', () => {
  for (const [canonical, aliases] of Object.entries(commands.roots)) {
    for (const alias of aliases) assert.equal(commands.normalize(`/${alias} Meu Texto`), `/${canonical} Meu Texto`);
  }
  for (const [canonical, aliases] of Object.entries(commands.actions)) {
    for (const alias of aliases) assert.equal(commands.normalize(`/obsidian ${alias} Pasta/Open.md | Don't translate`), `/obsidian ${canonical} Pasta/Open.md | Don't translate`);
  }
  for (const [canonical, aliases] of Object.entries(commands.history)) {
    for (const alias of aliases) assert.equal(commands.normalize(`/obsidian history ${alias}`), `/obsidian historico ${canonical}`);
  }
  assert.equal(commands.normalize('/RUN Write-Output "open créer abrir"'), '/executar Write-Output "open créer abrir"');
  assert.equal(commands.normalize('/open choose'), '/abrir escolher');
  assert.equal(commands.normalize('/unknown argument'), '/unknown argument');
});

test('completion guides command levels, aliases and stops at literal arguments', () => {
  assert.equal(commands.suggestions('/').length, 5);
  assert.equal(commands.suggestions('/obsidian op')[0].label, '/obsidian open');
  assert.equal(commands.suggestions('/obsidian history ').length, 4);
  assert.equal(commands.suggestions('/obsidian history en')[0].value, '/obsidian history enable ');
  assert.equal(commands.suggestions('/obsidian open Folder').length, 0);
  assert.equal(commands.suggestions('/run Write-Output /').length, 0);
  assert.equal(commands.suggestions('example /obsidian').length, 0);
  assert.match(commands.help(), /Open note/);
});

test('translated Obsidian commands create, read and open the same literal note path', async t => {
  const f = fixture(t); let opened;
  f.options.openExternal = async uri => { opened = new URL(uri).searchParams.get('file'); };
  await obsidian.handle('/obsidian create Notes/open.md | Original text', f.options);
  assert.equal(await obsidian.handle('/obsidian lire Notes/open.md', f.options), 'Original text\n');
  await obsidian.handle('/obsidian open Notes/open.md', f.options);
  assert.equal(opened, 'Notes/open.md');
  assert.match(await obsidian.handle('/obsidian find original', f.options), /Original text/);
});

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

test('local search returns content and filename matches regardless of accents', async (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.vault, 'Rotina.md'), '# Rotina\nRevisão do computador');
  fs.writeFileSync(path.join(f.vault, 'Memória.md'), 'Dados da RAM');
  f.options.openExternal = async () => { throw new Error('Search must stay local'); };
  assert.match(await obsidian.handle('/obsidian pesquisar REVISAO', f.options), /Rotina.md \(linha 2\)\nRevisão/);
  assert.match(await obsidian.handle('/obsidian pesquisar memoria', f.options), /Memória.md/);
  await assert.rejects(obsidian.handle('/obsidian pesquisar', f.options), /termo de pesquisa/);
  assert.match(await obsidian.handle('/obsidian pesquisar inexistente', f.options), /Nenhuma correspondência/);
});

test('local search skips hidden notes, junctions and oversized files and bounds results', (t) => {
  const f = fixture(t), vault = { path: f.vault };
  fs.writeFileSync(path.join(f.vault, '.obsidian', 'private.md'), 'segredo');
  const outside = path.join(f.root, 'outside'); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'private.md'), 'segredo');
  fs.symlinkSync(outside, path.join(f.vault, 'junction'), 'junction');
  fs.writeFileSync(path.join(f.vault, 'large.md'), 'segredo'.repeat(80000));
  const empty = obsidian.searchNotes(vault, 'segredo');
  assert.equal(empty.matches.length, 0);
  assert.equal(empty.skipped, 1);
  for (let i = 0; i < 35; i++) fs.writeFileSync(path.join(f.vault, `${i}.md`), 'correspondência');
  const result = obsidian.searchNotes(vault, 'correspondencia');
  assert.equal(result.matches.length, 30);
  assert.equal(result.limited, true);
});

test('daily note validates dates and uses local calendar date', () => {
  assert.equal(obsidian.dailyPath('', new Date(2026, 10, 1, 23, 59)), 'Capri/Diário/2026-11/2026-11-01.md');
  assert.equal(obsidian.dailyPath('2028-02-29'), 'Capri/Diário/2028-02/2028-02-29.md');
  for (const value of ['2026-02-29', '2026-13-01', '../escape', '2026-2-1']) assert.throws(() => obsidian.dailyPath(value), /data válida/);
});

test('daily notes require approval and never overwrite existing user text', async (t) => {
  const f = fixture(t), relative = obsidian.dailyPath('2026-11-01');
  let uri;
  f.options.openExternal = async value => { uri = value; };
  f.options.approve = async () => false;
  assert.match(await obsidian.handle('/obsidian diario 2026-11-01', f.options), /cancelada/);
  assert.equal(fs.existsSync(path.join(f.vault, relative)), false);
  f.options.approve = async () => true;
  assert.match(await obsidian.handle('/obsidian diario 2026-11-01', f.options), /criado/);
  assert.equal(new URL(uri).searchParams.get('file'), relative);
  fs.writeFileSync(path.join(f.vault, relative), 'Meu texto');
  f.options.approve = async () => { throw new Error('Existing note needs no creation approval'); };
  assert.match(await obsidian.handle('/obsidian diário 2026-11-01', f.options), /existente/);
  assert.equal(fs.readFileSync(path.join(f.vault, relative), 'utf8'), 'Meu texto');
});

test('daily note survives a concurrent creation and reports failed opening accurately', async (t) => {
  const f = fixture(t), file = path.join(f.vault, obsidian.dailyPath('2026-11-02'));
  f.options.approve = async () => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, 'Outra edição'); return true; };
  f.options.openExternal = async () => { throw new Error('No URI handler'); };
  assert.match(await obsidian.handle('/obsidian diario 2026-11-02', f.options), /existente.*\nNão foi possível/s);
  assert.equal(fs.readFileSync(file, 'utf8'), 'Outra edição');
});
