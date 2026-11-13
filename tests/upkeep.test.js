'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');

function fixture(t, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capri-upkeep-test-'));
  const pictures = path.join(root, 'OneDrive', 'Pictures');
  const downloads = path.join(root, 'Downloads');
  fs.mkdirSync(pictures, { recursive: true });
  fs.mkdirSync(downloads);
  t.after(() => {
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('capri-upkeep-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const trashed = [];
  let now = Date.now();
  const filename = path.resolve('src/main/upkeep.js');
  const native = createRequire(filename);
  const module = { exports: {} };
  const mocks = {
    electron: { app: { getPath: name => name === 'downloads' ? downloads : pictures }, shell: { trashItem: async file => { trashed.push(file); } } },
    './apps': { powershell: async () => { throw new Error('Unexpected PowerShell'); } },
    'node:os': { ...os, homedir: () => root },
    ...options.mocks,
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, require: name => name in mocks ? mocks[name] : native(name), Buffer,
    process: { platform: process.platform, env: { ...process.env, OneDrive: path.join(root, 'OneDrive') } },
    Date: class extends Date { static now() { return now; } },
    setTimeout: options.setTimeout || setTimeout, clearTimeout, console,
  }, { filename });
  const write = (name, value = 'a', base = pictures) => {
    const file = path.join(base, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, value.repeat(12000));
    return file;
  };
  return { api: module.exports, root, pictures, downloads, trashed, write, advance: ms => { now += ms; } };
}

test('duplicate scan deduplicates overlapping Windows and OneDrive roots', async t => {
  const f = fixture(t);
  f.write('only.png');
  assert.equal((await f.api.duplicates('pictures')).length, 0);
  assert.equal((await f.api.trashDuplicates('pictures')).count, 0);
  assert.equal(f.trashed.length, 0);
});

test('duplicate cleanup retains oldest file and consumes the reviewed scan once', async t => {
  const f = fixture(t), oldest = f.write('original.png'), copy = f.write('copy.png');
  fs.utimesSync(oldest, new Date(100000), new Date(100000));
  const groups = await f.api.duplicates('pictures');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].files[0], oldest);
  assert.equal((await f.api.trashDuplicates('pictures')).count, 1);
  assert.deepEqual(f.trashed, [copy]);
  assert.equal((await f.api.trashDuplicates('pictures')).expired, true);
  assert.equal(f.trashed.length, 1);
});

for (const changed of ['original.png', 'copy.png']) {
  test(`duplicate cleanup preserves a group when ${changed} changes without changing size`, async t => {
    const f = fixture(t);
    const original = f.write('original.png'); f.write('copy.png');
    fs.utimesSync(original, new Date(100000), new Date(100000));
    await f.api.duplicates('pictures');
    f.write(changed, 'b');
    assert.equal((await f.api.trashDuplicates('pictures')).count, 0);
    assert.equal(f.trashed.length, 0);
  });
}

test('expired or mismatched duplicate scans never authorize a fresh deletion', async t => {
  const f = fixture(t);
  f.write('original.png'); f.write('copy.png');
  await f.api.duplicates('pictures');
  assert.equal((await f.api.trashDuplicates('downloads')).expired, true);
  f.advance(11 * 60 * 1000);
  assert.equal((await f.api.trashDuplicates('pictures')).expired, true);
  assert.equal(f.trashed.length, 0);
});

test('download recycling rejects folders, traversal and junction escapes', async t => {
  const f = fixture(t);
  const good = f.write('large.zip', 'a', f.downloads);
  const outside = f.write('outside.zip', 'b', f.root);
  const link = path.join(f.downloads, 'linked');
  fs.symlinkSync(f.pictures, link, 'junction');
  f.write('protected.png');
  assert.equal((await f.api.trash(path.join(link, 'protected.png'))).ok, false);
  assert.equal((await f.api.trash(outside)).ok, false);
  assert.equal((await f.api.trash(f.downloads)).ok, false);
  assert.equal((await f.api.trash(path.join(f.downloads, '..', 'outside.zip'))).ok, false);
  assert.equal((await f.api.trash(good)).ok, true);
  assert.deepEqual(f.trashed, [good]);
});

function wingetMock(results) {
  let calls = 0;
  return { spawn() {
    const result = results[calls++];
    assert.ok(result, 'unexpected winget invocation');
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = { resume() {} };
    child.kill = () => child.emit('close', null);
    queueMicrotask(() => {
      if (result.error) child.emit('error', Error('missing'));
      else if (!result.hang) { child.stdout.emit('data', Buffer.from(result.out || '')); child.emit('close', result.code); }
    });
    return child;
  } };
}

test('winget failures and missing executables are not reported as up to date', async t => {
  const f = fixture(t, { mocks: { 'node:child_process': wingetMock([{ code: 1 }, { error: true }, { code: 1 }]) } });
  assert.equal(await f.api.updates(), null);
  assert.equal(await f.api.updates(), null);
  assert.equal(await f.api.updateAll(), null);
});

test('winget successful install followed by failed verification remains unknown', async t => {
  const f = fixture(t, { mocks: { 'node:child_process': wingetMock([{ code: 0 }, { code: 1 }]) } });
  assert.equal(await f.api.updateAll(), null);
});

test('winget recognizes its no-applicable-update code and a real upgrade table', async t => {
  const header = 'Name                 Id                    Version    Available   Source';
  const row = 'Example App'.padEnd(21) + 'Example.App'.padEnd(22) + '1.0'.padEnd(11) + '2.0'.padEnd(12) + 'winget';
  const f = fixture(t, { mocks: { 'node:child_process': wingetMock([{ code: -1978335189 }, { code: 0, out: `${header}\n${'-'.repeat(72)}\n${row}\n` }]) } });
  assert.equal((await f.api.updates()).length, 0);
  const rows = await f.api.updates();
  assert.equal(rows[0].id, 'Example.App');
  assert.equal(rows[0].available, '2.0');
});

test('winget timeouts resolve as failures even if the child emits no exit', async t => {
  const f = fixture(t, { mocks: { 'node:child_process': wingetMock([{ hang: true }]) }, setTimeout: fn => setTimeout(fn, 10) });
  assert.equal(await f.api.updates(), null);
});
