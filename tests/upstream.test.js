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

test('chat context retains more than 60 messages from the last hour without mutating saved history', async () => {
  const { chatContext } = await import(moduleUrl(path.join(__dirname, '../src/renderer/js/chat-context.js')));
  const now = Date.now();
  const history = Array.from({ length: 100 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `message ${i}`, at: now - 3500000 + i }));
  assert.equal(chatContext(history, now).length, 100);
  assert.equal(chatContext(history, now + 7200000).length, 20);
  const selected = chatContext(history, now, 30);
  assert.equal(selected.at(-1).content, 'message 99');
  assert.ok(selected.reduce((n, m) => n + m.content.length, 0) <= 30);
  assert.equal(history.length, 100);
  assert.ok(!('at' in selected[0]));
  assert.equal(chatContext([{ role: 'user', content: 'a'.repeat(16000) }])[0].content.length, 16000);
});

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

test('personal bond stays at 100% while petting retains its cap and emotional context', async () => {
  const { Bond } = await bondModule();
  const bond = new Bond({ host: { setConfig() {} }, data: { xp: 30 } });
  clearTimeout(bond.saveTimer);
  bond.save = () => {};
  assert.equal(bond.percent, 100);
  assert.equal(bond.stage, 4);
  for (let i = 0; i < 20; i++) bond.add('pet');
  assert.equal(bond.data.caps.pet, 5);
  bond.lose(100);
  assert.equal(bond.data.xp, 1000);
  assert.equal(bond.percent, 100);
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

async function localChat() {
  const { Chat } = await import(moduleUrl(path.join(__dirname, '../src/renderer/js/chat.js')));
  const { Care } = await import(moduleUrl(path.join(__dirname, '../src/renderer/js/care.js')));
  const { linesFor } = await import(moduleUrl(path.join(__dirname, '../src/renderer/js/lines.js')));
  const calls = [], output = [];
  const noop = () => {};
  const chat = Object.assign(Object.create(Chat.prototype), {
    brain: { lang: 'pt', t: linesFor('pt'), custom: {} },
    open: true, turn: 0, history: [], apps: [], agent: false,
    capri: { pulse: noop },
    panel: { setChatBusy: noop, setActions(buttons, handler) { this.buttons = buttons; this.handler = handler; },
      chatTurn: noop, stream: line => output.push(line), setFace: noop },
    host: { chatRemember: noop, onPcProgress: noop, async pcDo(req) { calls.push(req); return { total: 8 * 1024 ** 3, used: 4 * 1024 ** 3 }; },
      chatSend() { throw new Error('Local PC commands must not call an AI provider'); } },
    archive: noop, zap: noop,
  });
  chat.care = new Care({ chat, host: chat.host, panel: chat.panel, brain: chat.brain, capri: chat.capri });
  return { chat, calls, output };
}

test('0.5.2 diagnoses and commands coexist with guarded conversation in Portuguese and English', async () => {
  const { chat } = await localChat();
  for (const [text, what] of [
    ['por que meu PC está lento?', 'heavy'], ['Why is my PC slow?', 'heavy'],
    ['internet não funciona', 'internet'], ["The internet isn’t working", 'internet'],
    ['what starts with Windows?', 'startup'], ['libera espaço', 'space'],
    ['atualiza meus aplicativos', 'updates'], ['encontra fotos duplicadas', 'duplicates'],
    ['mute my mic', 'mic'], ['turn off Bluetooth', 'radio'], ['eject my USB stick', 'eject'],
    ['brightness down', 'brightness'], ['record my screen', 'gameBar'], ['clip that', 'gameBar'],
    ['I lost a window', 'rescue'], ['move Discord to the other screen', 'toScreen'],
    ['save my gaming setup', 'remember'], ['launch my gaming setup', 'launchSetup'],
    ['game mode', 'gameMode'], ['stop game mode', 'gameMode'],
    ['sound settings', 'settings'], ['how much battery?', 'info'], ['volume 30', 'volume'],
    ['timer 10 minutes', 'timer'], ['snip an area', 'snip'], ['tidy my windows', 'tidy'],
    ['put Discord on the left and Chrome on the right', 'arrange'], ['dark mode', 'theme'],
    ['restart my PC', 'power'],
  ]) assert.equal(chat.asked(text)?.what, what, text);
  for (const text of ['não desliga o PC', 'não ativa modo jogo', 'how do I restart my PC?', 'como desligar o computador?', '"libera espaço"', 'do not mute my mic']) {
    assert.equal(chat.asked(text), null, text);
  }
});

test('0.5.2 PC results work offline and take priority over inferred /pc tasks', async () => {
  const { chat, calls, output } = await localChat();
  await chat.send('quanto de RAM tem meu PC?');
  assert.deepEqual(calls, [{ action: 'info', what: 'ram' }]);
  assert.equal(chat.turn, 0);
  assert.ok(output.at(-1).includes('4'));
  let routed;
  chat.sendComputer = async text => { routed = text; chat.turn = 0; };
  await chat.send('/pc mostre a RAM');
  assert.equal(routed, '/pc mostre a RAM');
});

test('0.5.2 power stays behind confirmation even without an AI provider', async () => {
  const { chat, calls } = await localChat();
  await chat.send('restart my PC');
  assert.equal(calls.length, 0);
  assert.deepEqual(chat.panel.buttons.map(b => b.id), ['yes', 'no']);
  await chat.panel.handler('no');
  assert.equal(calls.length, 0);
  await chat.send('restart my PC');
  chat.countdown = () => {};
  await chat.panel.handler('yes');
  assert.equal(calls[0].action, 'power');
  assert.equal(calls[0].what, 'restart');
});

test('0.5.2 cleanup waits for a button and failures release the chat', async () => {
  const { chat, calls } = await localChat();
  chat.host.pcDo = async req => {
    calls.push(req);
    return req.action === 'space' ? { temp: 30 * 1024 ** 2, bin: 0, big: [], sources: [] } : { freed: 30 * 1024 ** 2 };
  };
  await chat.send('libera espaço');
  assert.deepEqual(calls.map(c => c.action), ['space']);
  assert.ok(chat.panel.buttons.length);
  await chat.panel.handler(chat.panel.buttons[0].id);
  assert.ok(calls.some(c => c.action === 'clean'));
  chat.host.pcDo = async () => { throw new Error('offline'); };
  await chat.send('volume 30');
  assert.equal(chat.turn, 0);
  assert.equal(chat.answer, chat.t.care.failed);
});

test('0.5.2 health breaks wait for quiet, skip games and reset after genuine idle time', async () => {
  const { Breaks } = await import(moduleUrl(path.join(__dirname, '../src/renderer/js/breaks.js')));
  let idle = 0, notices = 0;
  const breaks = Object.assign(Object.create(Breaks.prototype), {
    host: { pcIdle: async () => idle }, enabled: true, due: 0, since: 0,
    pc: { game: true }, quiet: () => true, remind: () => notices++,
  });
  await breaks.check(); assert.equal(notices, 0);
  breaks.pc.game = false;
  await breaks.check(); assert.equal(notices, 1);
  await breaks.check(); assert.equal(notices, 1);
  breaks.due = 0; idle = 300;
  await breaks.check(); assert.equal(notices, 1);
  assert.ok(breaks.due > Date.now() + 7100000);
  breaks.due = 0; idle = 0; breaks.enabled = false;
  await breaks.check(); assert.equal(notices, 1);
});

test('care buttons are single-use and cannot overwrite a newer conversation', async () => {
  const { chat, output } = await localChat();
  let finish, invoked = 0;
  chat.offer({ buttons: [{ id: 'go' }], onButton: () => { invoked++; return new Promise(resolve => { finish = resolve; }); } }, 'old answer');
  const click = chat.panel.handler;
  const pending = click('go');
  await Promise.resolve();
  await click('go');
  assert.equal(invoked, 1);
  await chat.send('quanto de RAM tem meu PC?');
  const fresh = output.at(-1);
  finish({ line: 'stale', buttons: [{ id: 'again' }] });
  await pending;
  assert.equal(output.at(-1), fresh);
  assert.deepEqual(chat.panel.buttons, []);
  await click('go');
  assert.equal(invoked, 1);
});

test('care buttons reject unknown IDs and catch synchronous failures', async () => {
  const { chat, output } = await localChat();
  let calls = 0;
  chat.offer({ buttons: [{ id: 'go' }], onButton() { calls++; throw new Error('failed'); } }, 'answer');
  const click = chat.panel.handler;
  await click('forged');
  assert.equal(calls, 0);
  await click('go');
  assert.equal(calls, 1);
  assert.ok(output.at(-1).includes(chat.t.care.failed));
});

test('closing the chat invalidates previously offered care actions', async () => {
  const { chat } = await localChat();
  chat.host.focusOverlay = () => {};
  let calls = 0;
  chat.offer({ buttons: [{ id: 'go' }], onButton() { calls++; } }, 'answer');
  const click = chat.panel.handler;
  chat.close();
  chat.open = true;
  await click('go');
  assert.equal(calls, 0);
});

test('background update failure reports failure instead of success or an unhandled rejection', async () => {
  const { chat } = await localChat();
  const told = [];
  chat.care.tell = line => told.push(line);
  chat.offer({ buttons: [{ id: 'go' }], onButton: () => ({ later: Promise.reject(new Error('update failed')) }) }, 'answer');
  await chat.panel.handler('go');
  await Promise.resolve();
  assert.deepEqual(told, [chat.t.care.failed]);
  chat.host.pcDo = async req => req.action === 'updates' ? [{ name: 'Example' }] : null;
  const offer = await chat.care.now({ what: 'updates' });
  const result = await offer.onButton('all').later;
  assert.equal(result.line, chat.t.care.failed);
});

test('an expired duplicate scan asks for a new review rather than claiming deletion', async () => {
  const { chat } = await localChat();
  chat.host.pcDo = async req => req.action === 'duplicates'
    ? { copies: 1, wasted: 12000, first: 'fixture.png' } : { expired: true, count: 0, freed: 0 };
  const offer = await chat.care.now({ what: 'duplicates', where: 'pictures' });
  assert.equal((await offer.onButton('trash')).line, chat.t.care.dupExpired);
});
