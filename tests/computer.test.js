'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { calculate, parseStep, task, runScript, infoRequest } = require('../src/main/computer');

test('PC information can be answered locally without model inference', () => {
  assert.equal(infoRequest('qual a memória do meu computador?'), true);
  assert.equal(infoRequest('liste os programas instalados'), true);
  assert.equal(infoRequest('instale novos programas'), false);
  assert.equal(infoRequest('liste programas e abra a calculadora'), false);
});

test('arithmetic precedence, decimal comma, percent and finite results', () => {
  for (const [input, expected] of [['(12 + 3) * 4', 60], ['1,5 + 2,5', 4], ['-2^2', -4], ['2^3^2', 512], ['200 * 15%', 30], ['2^-2', 0.25]]) assert.equal(calculate(input).result, expected);
  for (const input of ['1/0', '(2+3', '1 2', 'process.exit()', '2;whoami', '2**3', 'NaN', '']) assert.throws(() => calculate(input));
});
test('rejects prose, executable text and unknown tools as plans', () => {
  for (const value of ['Write-Output 42', '{"tool":"shell","script":"x"}', '{"tool":"powershell","reason":"x"}', 'null']) assert.throws(() => parseStep(value));
  assert.equal(parseStep('```json\n{"tool":"done","message":"ok"}\n```').tool, 'done');
});

function harness(steps, overrides = {}) {
  const controller = new AbortController();
  const calls = [];
  return { controller, calls, options: {
    text: 'Execute a tarefa solicitada', context: {}, signal: controller.signal,
    complete: async (messages) => { calls.push(messages.at(-1).content); return JSON.stringify(steps.shift()); },
    approve: async () => false, openApp: async () => { throw new Error('Unexpected launch'); },
    execute: async () => { throw new Error('Unexpected script execution'); }, ...overrides,
  } };
}
test('multi-step results are supplied back to planner before completion', async () => {
  const h = harness([{ tool: 'calculate', expression: '6*7' }, { tool: 'done', message: '42' }]);
  const result = await task(h.options);
  assert.equal(result.results[0].result.result, 42);
  assert.match(h.calls[1], /"result":42/);
});
test('declined script never executes or asks planner to continue', async () => {
  const h = harness([{ tool: 'powershell', reason: 'test', script: 'Write-Output 42' }]);
  const result = await task(h.options);
  assert.equal(result.results.length, 0);
  assert.equal(h.calls.length, 1);
  assert.match(result.text, /cancelada/);
});
test('model-requested Obsidian reads require approval before exposing note content', async () => {
  const h = harness([{ tool: 'obsidian', command: '/obsidian ler Privada.md' }]);
  h.options.obsidianTask = async () => { throw new Error('Unapproved note read'); };
  const result = await task(h.options);
  assert.equal(result.results.length, 0);
  assert.match(result.text, /cancelada/);
});
test('approval is for the exact proposed script, and failures reach planner', async () => {
  const script = 'Write-Output 42';
  const h = harness([{ tool: 'powershell', reason: 'test', script }, { tool: 'done', message: 'Falhou' }], {
    approve: async (step) => { assert.equal(step.script, script); return true; },
    execute: async (value) => { assert.equal(value, script); return { ok: false, error: 'test failure' }; },
  });
  await task(h.options);
  assert.match(h.calls[1], /test failure/);
});
test('cancellation during approval prevents execution even if accepted', async () => {
  const h = harness([{ tool: 'powershell', reason: 'test', script: 'Write-Output 42' }]);
  h.options.approve = async () => { h.controller.abort(); return true; };
  await assert.rejects(task(h.options), /cancelada/);
});
test('bounded execution stops a looping planner', async () => {
  const h = harness(Array.from({ length: 9 }, () => ({ tool: 'calculate', expression: '1+1' })));
  const result = await task(h.options);
  assert.equal(result.results.length, 8);
  assert.match(result.text, /limite/);
});
test('invalid planner output gets one repair and never executes', async () => {
  const h = harness([], { complete: async () => 'not JSON' });
  await assert.rejects(task(h.options));
});
test('routing keeps examples and negations in ordinary chat', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/renderer/js/computer-task.js'), 'utf8');
  const { computerTask } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  for (const text of ['não abra a calculadora', 'abra a calculadora', 'como criar uma pasta?', 'um exemplo: abra a calculadora', 'Olá']) assert.equal(computerTask(text), null);
  for (const text of ['abra a calculadora e calcule 2+2', 'calcule (2+3)*4', 'qual a memória do meu computador?', 'crie uma pasta de teste']) assert.equal(computerTask(text), text);
  assert.equal(computerTask('/pc liste meus programas'), 'liste meus programas');
  for (const text of ['/obsidian ajuda', '/abrir escolher', '/executar Write-Output 42']) assert.equal(computerTask(text), text);
});
test('real PowerShell output and errors, without changing user files', { skip: process.platform !== 'win32' }, async () => {
  const signal = new AbortController().signal;
  const good = await runScript('Write-Output (6 * 7)', signal);
  assert.equal(good.ok, true); assert.equal(good.output, '42');
  const bad = await runScript("throw 'expected-test-error'", signal, { automation: false });
  assert.equal(bad.ok, false); assert.match(bad.error, /expected-test-error/);
  const native = await runScript('& $env:ComSpec /d /c exit 7', signal, { automation: false });
  assert.equal(native.ok, false); assert.equal(native.exitCode, 7);
});
test('real PowerShell cancellation kills the waiting task', { skip: process.platform !== 'win32' }, async () => {
  const controller = new AbortController();
  const promise = runScript('Start-Sleep -Seconds 30', controller.signal, { automation: false });
  const timer = setTimeout(() => controller.abort(), 500);
  try { await assert.rejects(promise, /cancelada/); } finally { clearTimeout(timer); }
});
