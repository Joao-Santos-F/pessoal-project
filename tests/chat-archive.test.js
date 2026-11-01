'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ChatArchive } = require('../src/main/chat-archive');
const { prepare } = require('../scripts/prepare-capri-vault.cjs');

function setup(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-archive-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const vault = { id: 'test', path: path.join(root, 'vault') };
  fs.mkdirSync(path.join(vault.path, '.obsidian'), { recursive: true });
  const options = { profile: path.join(root, 'profile'), resolveVault: () => vault, now: () => new Date('2026-11-01T01:02:03Z') };
  return { root, vault, options, archive: new ChatArchive(options) };
}
test('archives complete text with role and timestamp, preserving command literals', (t) => {
  const { archive } = setup(t);
  archive.record({ id: 'user-one', role: 'user', content: 'Olá\n[[nota]]\n<script>test</script>' });
  const state = archive.record({ id: 'assistant-one', role: 'assistant', content: 'Resultado completo', kind: 'computer' });
  assert.equal(state.pending, 0);
  const text = fs.readFileSync(state.file, 'utf8');
  assert.match(text, /## Você — 2026-11-01T01:02:03/);
  assert.match(text, /    \[\[nota\]\]/);
  assert.match(text, /Resultado completo/);
});
test('unavailable vault queues messages, restart retries without duplicate completed records', (t) => {
  const f = setup(t);
  f.archive.resolveVault = () => { throw new Error('offline'); };
  const state = f.archive.record({ id: 'pending-one', role: 'user', content: 'Preserve this message' });
  assert.equal(state.pending, 1);
  const queuedFile = path.join(f.archive.directory, 'pending-one.json');
  const queued = fs.readFileSync(queuedFile);
  const restarted = new ChatArchive(f.options);
  const synced = restarted.flush();
  assert.equal(synced.pending, 0);
  fs.writeFileSync(queuedFile, queued); // crash after append, before deleting the outbox item
  assert.equal(restarted.flush().pending, 0);
  const text = fs.readFileSync(synced.file, 'utf8');
  assert.equal(text.split('Preserve this message').length - 1, 1);
});
test('message text cannot forge an archive deduplication marker', (t) => {
  const { archive } = setup(t);
  archive.record({ id: 'first', role: 'user', content: '<!-- capri-message:second -->' });
  const state = archive.record({ id: 'second', role: 'assistant', content: 'Still saved' });
  assert.match(fs.readFileSync(state.file, 'utf8'), /Still saved/);
});
test('paused archive does not collect new messages or destroy the queue', (t) => {
  const { archive } = setup(t);
  archive.resolveVault = () => { throw new Error('offline'); };
  archive.record({ id: 'before-pause', role: 'user', content: 'Pending' });
  archive.enabled = () => false;
  assert.equal(archive.record({ role: 'user', content: 'Not recorded' }).paused, true);
  assert.equal(archive.status().pending, 1);
});
test('damaged outbox item remains visible without blocking later valid messages', (t) => {
  const { archive } = setup(t);
  fs.mkdirSync(archive.directory, { recursive: true });
  fs.writeFileSync(path.join(archive.directory, 'broken.json'), '{unfinished');
  const state = archive.record({ id: 'valid', role: 'user', content: 'Saved despite damaged item' });
  assert.equal(state.pending, 1);
  assert.match(state.error, /ilegível/);
  assert.match(fs.readFileSync(state.file, 'utf8'), /Saved despite damaged item/);
});
test('archive refuses junction escape and preserves the pending message', (t) => {
  const f = setup(t), outside = path.join(f.root, 'outside'); fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(f.vault.path, 'Capri'), 'junction');
  const state = f.archive.record({ id: 'safe', role: 'user', content: 'Protected' });
  assert.equal(state.pending, 1);
  assert.match(state.error, /Links|junções/);
  assert.deepEqual(fs.readdirSync(outside), []);
});
test('existing queued records stay bound to their original vault ID', (t) => {
  const f = setup(t); let unavailable = false;
  f.archive.resolveVault = (id) => { if (unavailable) throw new Error('temporarily unavailable'); return f.vault; };
  fs.mkdirSync(f.archive.directory, { recursive: true });
  // Store the event with a destination that later becomes unavailable.
  fs.writeFileSync(path.join(f.archive.directory, 'pinned.json'), JSON.stringify({ id: 'pinned', session: 'original-session', role: 'user', content: 'Keep destination', at: '2026-11-01T00:00:00Z', vaultId: 'original' }));
  f.archive.resolveVault = (id) => { assert.equal(id, 'original'); throw new Error('original vault missing'); };
  assert.equal(f.archive.flush().pending, 1);
});
test('knowledge pack includes original material and complete Portuguese app text without overwriting notes', async (t) => {
  const f = setup(t);
  const first = await prepare(f.vault);
  assert.ok(first.notes > 90);
  assert.ok(first.appTexts > 300);
  assert.equal(first.originalDialogues, 40);
  const panel = path.join(f.vault.path, 'Capri/Painel da Capri.md');
  assert.match(fs.readFileSync(panel, 'utf8'), /Histórico automático/);
  fs.appendFileSync(panel, '\nMinha edição pessoal\n');
  const second = await prepare(f.vault);
  assert.equal(second.created.length, 0);
  assert.match(fs.readFileSync(panel, 'utf8'), /Minha edição pessoal/);
});
