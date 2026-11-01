'use strict';
const fs = require('node:fs');
const path = require('node:path');
const commands = require('../shared/commands');

async function handle(text, { launch, shell, approve, execute, signal, chooseFile, chooseApp, aliases = {}, rememberApp }) {
  const match = /^\/(abrir|executar)(?:\s+([\s\S]*))?$/i.exec(commands.normalize(text));
  if (!match) return null;
  const action = match[1].toLowerCase();
  let value = (match[2] || '').trim();
  const aliasName = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  let selectedFile = false;
  const check = () => { if (signal.aborted) throw new Error('Tarefa cancelada.'); };
  check();
  if (action === 'executar') {
    if (!value || value.length > 6000) throw new Error('Use /executar seguido de um comando PowerShell de até 6000 caracteres.');
    if (!(await approve('Executar comando no computador', value))) return 'Comando cancelado.';
    check();
    const result = await execute(value, signal);
    return `${result.ok ? 'Comando concluído.' : 'Comando falhou.'}\n${result.output || ''}${result.error ? `\n${result.error}` : ''}`.trim();
  }
  if (!value || value.toLowerCase() === 'escolher') value = await chooseFile();
  else if (Object.hasOwn(aliases, aliasName) && typeof aliases[aliasName] === 'string' && path.isAbsolute(aliases[aliasName]) && fs.existsSync(aliases[aliasName])) value = aliases[aliasName];
  if (!value) return 'Abertura cancelada.';
  check();
  value = value.replace(/^"([\s\S]*)"$/, '$1');
  if (!path.isAbsolute(value) && launch.findCandidates) {
    const items = await launch.findCandidates(value);
    check();
    if (items.length) {
      const item = items.length === 1 ? items[0] : await chooseApp?.(items);
      check();
      if (!item) return 'Abertura cancelada.';
      if (!items.includes(item)) throw new Error('Seleção de aplicativo inválida.');
      if (launch.risky(item) && !(await approve('Abrir aplicativo', `${item.name}\n${item.id}`))) return 'Abertura cancelada.';
      check();
      await launch.launch({ ...item, confirmed: true });
      return `Abertura solicitada: ${item.name}`;
    }
    value = await chooseFile?.(value);
    selectedFile = true;
    if (!value) return 'Aplicativo não encontrado; seleção cancelada.';
    check();
  }
  if (path.isAbsolute(value)) {
    const stat = fs.statSync(value);
    if (!stat.isFile() && !stat.isDirectory()) throw new Error('Selecione um arquivo ou pasta.');
    if (stat.isFile() && launch.risky({ kind: 'file', id: value }) && !(await approve('Abrir programa ou arquivo executável', value))) return 'Abertura cancelada.';
    check();
    const error = await shell.openPath(value);
    if (error) throw new Error(error);
    if (selectedFile && rememberApp) await rememberApp(aliasName, value);
    return `Abertura solicitada: ${value}`;
  }
  const item = await launch.find(value);
  if (!item) throw new Error('Aplicativo não encontrado. Use /abrir escolher para selecionar o executável, ou /abrir seguido do caminho completo.');
  if (launch.risky(item) && !(await approve('Abrir aplicativo', item.id))) return 'Abertura cancelada.';
  check();
  await launch.launch({ ...item, confirmed: true });
  return `Abertura solicitada: ${item.name}`;
}
module.exports = { handle };
