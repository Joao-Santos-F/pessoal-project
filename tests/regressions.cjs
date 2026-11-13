'use strict';
// Regression checks for the audited defects. PASS means the expected behavior holds.
// No real applications, screen captures, external requests, or user settings are used.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const ROOT = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
function cjs(file, mocks = {}) {
  const filename = path.join(ROOT, file);
  const native = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(read(file), {
    require: (name) => name in mocks ? mocks[name] : native(name), module, exports: module.exports,
    process, Buffer, URL, console, setTimeout, clearTimeout, __dirname: path.dirname(filename),
  }, { filename });
  return module.exports;
}
const urls = new Map();
function moduleUrl(file) {
  if (urls.has(file)) return urls.get(file);
  const source = fs.readFileSync(file, 'utf8').replace(/from '(\.\/[^']+)'/g,
    (_, relative) => `from '${moduleUrl(path.resolve(path.dirname(file), relative))}'`);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  urls.set(file, url);
  return url;
}
const esm = (file) => import(moduleUrl(path.join(ROOT, file)));
const noop = () => {};
const outcomes = [];
async function probe(name, fn) {
  try { const detail = await fn(); outcomes.push({ name, reproduced: true, detail }); }
  catch (error) { outcomes.push({ name, reproduced: false, error: error.message }); }
}
async function main() {
  globalThis.matchMedia = () => ({ matches: false });
  const { Chat } = await esm('src/renderer/js/chat.js');
  const { LINES, linesFor } = await esm('src/renderer/js/lines.js');
  function chat() {
    return Object.assign(Object.create(Chat.prototype), {
      brain: { lang: 'en', assistant: 'claude', t: LINES.en, custom: {} },
      capri: { pulse: noop }, host: {}, zap: noop,
    });
  }
  await probe('R01: Claude installer preserves unrelated command in mixed hook group', () => {
    let saved;
    const initial = { hooks: { Stop: [{ hooks: [
      { type: 'command', command: 'node capri-hook.js' },
      { type: 'command', command: 'my-important-hook' },
    ] }] } };
    const installer = cjs('scripts/install-hooks.js', { 'node:fs': {
      existsSync: () => true, readFileSync: () => JSON.stringify(initial),
      mkdirSync: noop, copyFileSync: noop, writeFileSync: (_, text) => { saved = JSON.parse(text); },
    } });
    installer.uninstall();
    assert.equal(JSON.stringify(saved).includes('my-important-hook'), true);
    return saved;
  });
  await probe('R01b: Antigravity installer preserves mixed namespace', () => {
    let saved;
    const initial = { shared: { Stop: [
      { type: 'command', command: 'node capri-agy-hook.js Stop' },
      { type: 'command', command: 'my-important-hook' },
    ] } };
    const installer = cjs('scripts/install-hooks-agy.js', { 'node:fs': {
      existsSync: () => true, readFileSync: () => JSON.stringify(initial),
      mkdirSync: noop, copyFileSync: noop, writeFileSync: (_, text) => { saved = JSON.parse(text); },
    } });
    installer.uninstall();
    assert.equal(JSON.stringify(saved).includes('my-important-hook'), true);
    return saved;
  });
  await probe('R02: permission is bound to its destination', () => {
    const source = read('src/main/main.js');
    const block = source.slice(source.indexOf('function screenDestination('), source.indexOf('function rebuildTray('));
    let cfg = { provider: 'ollama', lookAsked: true, customUrl: '' };
    const context = { config: { load: () => cfg }, pickModel: () => 'gemma3', process: { env: {} } };
    vm.createContext(context); vm.runInContext(block, context);
    assert.equal(context.screenAllowed(), false);
    cfg.lookConsent = context.screenDestination();
    assert.equal(context.screenAllowed(), true);
    cfg = { ...cfg, provider: 'openai' };
    assert.equal(context.screenAllowed(), false);
  });
  await probe('R03: negations and command questions do not execute actions', async () => {
    const c = chat();
    let launched = 0;
    c.host.findLaunch = async () => ({ kind: 'app', id: 'Spotify', name: 'Spotify', risky: false });
    c.host.launch = async () => { launched++; return { ok: true }; };
    const results = [];
    for (const text of ["don't open Spotify", 'não abre Spotify', 'how do I open Spotify?']) {
      const action = c.asked(text); assert.equal(action, null); results.push({ text, action });
    }
    assert.equal(launched, 0);
    assert.equal(c.asked('open Spotify').kind, 'open');
    assert.equal(c.asked('what is a screenshot?'), null);
    return { launched, results, screenshotQuestion: 'shot' };
  });
  await probe('R04: closing chat before discovery prevents request', async () => {
    const c = chat();
    let ready, saved, sends = 0, stops = 0;
    Object.assign(c, { open: true, turn: 0, history: [], agent: true,
      appsReady: new Promise((resolve) => { ready = resolve; }),
      panel: { setChatBusy: noop, setActions: noop, chatTurn: noop }, persona: () => 'persona',
    });
    c.host = { chatStop: () => { stops++; }, focusOverlay: noop, chatRemember: history => { saved = structuredClone(history); },
      chatSend: async () => { sends++; return { ok: true, text: 'response' }; } };
    const pending = c.send('hello');
    c.close(); ready(); await pending;
    assert.equal(stops, 1); assert.equal(sends, 0); assert.equal(c.open, false);
    assert.equal(saved[0].content, 'hello');
    assert.equal(c.history[0].content, 'hello');
    return { stopBeforeSend: stops, requestsAfterClose: sends };
  });
  await probe('R04b: new chat clears context only after storage succeeds and never during a reply', async () => {
    const c = chat();
    let resets = 0;
    Object.assign(c, { turn: 1, history: [{ role: 'user', content: 'old' }],
      panel: { chatInput: { value: 'draft' }, chatTurn: noop, stream: noop },
      host: { chatNew: async () => { resets++; } } });
    await c.newChat();
    assert.equal(resets, 0);
    c.turn = 0;
    c.host.chatNew = async () => { throw Error('disk'); };
    await c.newChat();
    assert.equal(c.history[0].content, 'old');
    c.host.chatNew = async () => { resets++; };
    await c.newChat();
    assert.equal(resets, 1);
    assert.equal(c.history.length, 0);
    assert.equal(c.panel.chatInput.value, '');
  });
  await probe('R05: expired intro resolves its promise', async () => {
    const { FxLayer } = await esm('src/renderer/js/fx.js');
    const fx = Object.assign(Object.create(FxLayer.prototype), {
      grab: {}, size: { w: 1280, h: 720 }, items: [], last: 0,
      canvas: { width: 1280, height: 720 }, ctx: { clearRect: noop },
      add(item) { this.items.push({ ...item, born: 0 }); },
    });
    let resolved = false;
    fx.intro({ to: { x: 100, y: 100 } }).then(() => { resolved = true; });
    fx.frame(5000); await Promise.resolve();
    assert.equal(fx.items.length, 0); assert.equal(resolved, true);
    return { effectsRemaining: fx.items.length, introResolved: resolved };
  });
  await probe('R06: force quit targets the previously selected process', async () => {
    const commands = [];
    const responses = [JSON.stringify([{ id: 43210, name: 'Discord', label: 'Discord', started: '123456' }]), '1', '0'];
    const apps = cjs('src/main/apps.js', { 'node:child_process': {
      execFile(_file, args, _options, cb) { commands.push(args.at(-1)); cb(null, responses.shift()); },
    } });
    const first = await apps.close('Discord');
    const forced = await apps.close('Discord', { force: true });
    assert.equal(first.running, true); assert.equal(forced.running, false);
    assert.equal(commands.some((s) => s.includes('Stop-Process')), true);
    return { first, forced, stopProcessExecuted: false };
  });
  await probe('R07: file search requires confirmation for executable extensions', async () => {
    const launch = cjs('src/main/launch.js', { electron: { app: {}, shell: {} } });
    assert.equal(launch.risky({ kind: 'file', id: 'example.cpl' }), true);
    assert.equal(launch.risky({ kind: 'file', id: 'example.lnk' }), true);
    const c = chat(); let opened;
    c.host.searchFiles = async () => [{ path: 'C:/fake/example.cpl', name: 'example.cpl', folder: 'fake' }];
    c.host.openFile = async (file) => { opened = file; return true; };
    await c.doNow({ kind: 'files', query: 'example', exts: [], then: 'open' });
    assert.equal(opened, undefined);
    return { autoOpened: opened, shortcutConsideredRisky: false };
  });
  await probe('R08: search fallback returns newest file first', async () => {
    const files = cjs('src/main/files.js', {
      electron: { app: { getPath: (key) => key }, shell: {}, screen: {}, desktopCapturer: {} },
      './apps': { powershell: async () => { throw Error('index offline'); } },
      './launch': { risky: () => false },
      'node:fs': { readdirSync: (dir) => dir === 'desktop' ? ['old-report.pdf', 'new-report.pdf'].map((name) => ({ name, isDirectory: () => false })) : [],
        statSync: (file) => ({ mtimeMs: file.includes('old-') ? 1 : 100 }) },
    });
    const found = await files.search({ query: 'report' });
    assert.equal(found[0].time, 100); assert.equal(found[1].time, 1);
    return found;
  });
  await probe('R09: reminder finds time after unrelated quantity', async () => {
    const { parseWhen } = await esm('src/renderer/js/reminders.js');
    const now = new Date(2026, 9, 31, 10).getTime();
    assert.ok(parseWhen('remind me to call at 9 pm', now));
    assert.equal(new Date(parseWhen('remind me to buy 2 books at 9 pm', now).at).getHours(), 21);
    return { input: 'remind me to buy 2 books at 9 pm', actual: null };
  });
  await probe('R10: translation data accepts intentional null placeholders', () => {
    const strings = (value) => typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
    assert.equal(linesFor('en', 'codex').bond.up[0], null);
    assert.ok(strings(linesFor('en', 'codex')).length > 0);
    // Verify the rest of the translation data with a null-safe traversal.
    const safeStrings = (v) => typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(safeStrings) : [];
    for (const lang of Object.keys(LINES)) {
      assert.doesNotMatch(safeStrings(linesFor(lang, 'codex')).join('\n'), /Claude|settings\.json|\.claude/);
    }
    return { nullPath: 'bond.up[0]', codexStringsChecked: Object.keys(LINES) };
  });
  await probe('R11: malformed HTTP target receives HTTP 400', async () => {
    let handler;
    const bridge = cjs('src/main/bridge.js', { 'node:http': { createServer(fn) {
      handler = fn; return { on: noop, listen: noop };
    } } });
    bridge.createBridge({ port: 0, onEvent: noop });
    let status; await handler({ headers: {}, method: 'GET', url: 'http://[' }, { writeHead: (code) => { status = code; }, end: noop }); assert.equal(status, 400);
    return { rejected: 'Invalid URL', responseSent: false };
  });

  for (const r of outcomes) console.log(`${r.reproduced ? 'PASS' : 'FAIL'} ${r.name}${r.error ? ': ' + r.error : ''}`);
  process.exitCode = outcomes.every((r) => r.reproduced) ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
