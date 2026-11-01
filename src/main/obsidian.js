'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const HELP = `Obsidian — comandos locais:
/obsidian status
/obsidian cofres
/obsidian usar NOME OU ID
/obsidian listar [termo no caminho]
/obsidian ler Pasta/Nota.md
/obsidian abrir Pasta/Nota.md
/obsidian buscar termo
/obsidian criar Pasta/Nota.md | conteúdo
/obsidian acrescentar Pasta/Nota.md | conteúdo
/obsidian comandos [filtro]
/obsidian comando ID
/obsidian historico status|ativar|pausar|sincronizar
Criação e acréscimo pedem confirmação. Notas existentes não são sobrescritas. Comandos internos exigem a CLI habilitada em Configurações → Geral → Avançado → Interface de linha de comando.`;

function vaults(appData) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(appData, 'obsidian', 'obsidian.json'), 'utf8'));
    return Object.entries(data.vaults || {}).filter(([, v]) => typeof v.path === 'string' && fs.existsSync(path.join(v.path, '.obsidian')))
      .map(([id, v]) => ({ id, name: path.basename(v.path), path: fs.realpathSync(v.path), open: !!v.open }));
  } catch { return []; }
}

function selectVault(items, selected) {
  if (selected) {
    const matches = items.filter((v) => v.id === selected || v.name.toLowerCase() === selected.toLowerCase());
    if (matches.length === 1) return matches[0];
    throw new Error('Cofre não encontrado ou nome ambíguo. Use /obsidian cofres e selecione pelo ID.');
  }
  if (items.length === 1) return items[0];
  throw new Error('Selecione um cofre com /obsidian usar ID. Consulte /obsidian cofres.');
}

// Reject traversal, ADS, Windows devices, config folders and junction/symlink escapes.
function notePath(vault, relative, create = false) {
  let name = String(relative || '').trim().replace(/\\/g, '/');
  if (/[. ]$/.test(name)) throw new Error('O nome da nota não pode terminar em ponto ou espaço.');
  if (!name.toLowerCase().endsWith('.md')) name += '.md';
  const parts = name.split('/');
  if (!relative || path.isAbsolute(name) || parts.some((p) => !p || p.startsWith('.') || /[<>:"|?*\x00-\x1f]/.test(p)
    || /[. ]$/.test(p) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))) throw new Error('Use um caminho Markdown relativo ao cofre, sem pastas ocultas ou caracteres reservados.');
  const root = fs.realpathSync(vault.path);
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    if (fs.existsSync(current)) {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error('Links e junções não são aceitos na integração de notas.');
      const rel = path.relative(root, fs.realpathSync(current));
      if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Caminho fora do cofre.');
      if (i < parts.length - 1 && !stat.isDirectory()) throw new Error('A pasta solicitada não é um diretório.');
    } else if (!create) throw new Error('Nota não encontrada.');
  }
  return current;
}

function listNotes(vault, query = '') {
  const found = [], pending = [vault.path];
  let visited = 0, limited = false;
  while (pending.length && visited < 20000 && found.length < 100) {
    const folder = pending.pop();
    let entries;
    try { entries = fs.readdirSync(folder, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      if (++visited > 20000) { limited = true; break; }
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) pending.push(full);
      else if (entry.isFile() && /\.md$/i.test(entry.name)) {
        const rel = path.relative(vault.path, full).replace(/\\/g, '/');
        if (rel.toLowerCase().includes(query.toLowerCase())) found.push(rel);
        if (found.length >= 100) { limited = true; break; }
      }
    }
  }
  return { files: found.sort(), limited: limited || pending.length > 0 };
}

function cliPath() {
  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Obsidian', 'Obsidian.com'),
    path.join(process.env.LOCALAPPDATA || '', 'Obsidian', 'Obsidian.com'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Obsidian', 'Obsidian.com'),
    ...(process.env.PATH || '').split(path.delimiter).filter(Boolean).map((p) => path.join(p, 'Obsidian.com')),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function cli(file, args, signal) {
  if (!file) throw new Error('CLI não encontrada. Instale o Obsidian 1.12.7 ou superior e habilite a interface de linha de comando.');
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 15000, maxBuffer: 256 * 1024, signal }, (error, stdout, stderr) => {
      const output = String(stdout || stderr).trim();
      if (/not enabled|unable to find Obsidian/i.test(output)) return reject(new Error('Abra o Obsidian e habilite Configurações → Geral → Avançado → Interface de linha de comando. Depois repita o comando.'));
      if (error) return reject(new Error(output || error.message));
      resolve(output.slice(0, 16000) || 'Comando enviado ao Obsidian.');
    });
  });
}

async function handle(text, { appData, selected, saveSelection, openExternal, approve, signal, runCli = cli }) {
  const parsed = /^\/obsidian(?:\s+(\S+))?(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!parsed) return null;
  const action = (parsed[1] || 'ajuda').toLowerCase(), arg = (parsed[2] || '').trim();
  const check = () => { if (signal?.aborted) throw new Error('Tarefa cancelada.'); };
  check();
  if (['ajuda', 'help'].includes(action)) return HELP;
  const items = vaults(appData);
  if (action === 'cofres') return items.map((v) => `${v.name} — ${v.id}\n${v.path}`).join('\n\n') || 'Nenhum cofre encontrado. Abra seu cofre no Obsidian primeiro.';
  const vault = selectVault(items, action === 'usar' ? arg : selected);
  if (action === 'usar') { if (!arg) throw new Error('Informe o ID ou nome do cofre.'); saveSelection(vault.id); return `Cofre selecionado: ${vault.name}`; }
  if (action === 'status') return `Cofre: ${vault.name}\nPasta: ${vault.path}\nCLI: ${cliPath() || 'não encontrada'}\nNotas locais disponíveis. Para testar a CLI use /obsidian comandos.`;
  if (action === 'listar') { const result = listNotes(vault, arg); return `${result.files.join('\n') || 'Nenhuma nota encontrada.'}${result.limited ? '\nLista limitada; refine o termo.' : ''}`; }
  if (action === 'ler') {
    const file = notePath(vault, arg);
    if (!fs.statSync(file).isFile() || fs.statSync(file).size > 128 * 1024) throw new Error('A leitura aceita notas de até 128 KiB.');
    const content = fs.readFileSync(file, 'utf8');
    return content.length > 16000 ? content.slice(0, 16000) + '\n[Conteúdo truncado]' : content || '(Nota vazia)';
  }
  if (['abrir', 'buscar'].includes(action)) {
    if (action === 'abrir' && arg) notePath(vault, arg);
    const params = new URLSearchParams({ vault: vault.id });
    if (arg) params.set(action === 'abrir' ? 'file' : 'query', arg);
    await openExternal(`obsidian://${action === 'abrir' ? 'open' : 'search'}?${params}`);
    return 'Solicitação enviada ao Obsidian.';
  }
  if (['criar', 'acrescentar'].includes(action)) {
    const divider = arg.indexOf('|');
    if (divider < 1) throw new Error('Use: /obsidian criar Pasta/Nota.md | conteúdo');
    const relative = arg.slice(0, divider).trim(), content = arg.slice(divider + 1).trim();
    if (!content || content.length > 12000) throw new Error('Informe conteúdo entre 1 e 12000 caracteres.');
    let file = notePath(vault, relative, action === 'criar');
    if (action === 'criar' && fs.existsSync(file)) throw new Error('Nota já existe. Use acrescentar; a integração não sobrescreve notas.');
    if (!(await approve(`${action === 'criar' ? 'Criar nota' : 'Acrescentar à nota'} em ${vault.name}`, `${relative}\n\n${content}`))) return 'Operação cancelada.';
    check();
    file = notePath(vault, relative, action === 'criar');
    if (action === 'criar') {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content + '\n', { encoding: 'utf8', flag: 'wx' });
    } else {
      // r+ never recreates a note removed while the confirmation was visible.
      const fd = fs.openSync(file, 'r+');
      try { fs.writeSync(fd, '\n' + content + '\n', fs.fstatSync(fd).size, 'utf8'); } finally { fs.closeSync(fd); }
    }
    return `Nota ${action === 'criar' ? 'criada' : 'atualizada'}: ${relative}`;
  }
  if (action === 'comandos') return runCli(cliPath(), [`vault=${vault.id}`, 'commands', ...(arg ? [`filter=${arg}`] : [])], signal);
  if (action === 'comando') {
    if (!/^[a-zA-Z0-9_.:/-]{1,200}$/.test(arg)) throw new Error('Informe um ID retornado por /obsidian comandos.');
    const available = await runCli(cliPath(), [`vault=${vault.id}`, 'commands'], signal);
    if (!available.split(/\r?\n/).some((line) => line.trim().split(/\s/)[0] === arg)) throw new Error('Comando não encontrado na lista atual do Obsidian.');
    if (!(await approve('Executar comando interno do Obsidian', `Cofre: ${vault.name}\nID: ${arg}\nO comando pode alterar notas ou configurações, conforme sua função no Obsidian.`))) return 'Operação cancelada.';
    check();
    return runCli(cliPath(), [`vault=${vault.id}`, 'command', `id=${arg}`], signal);
  }
  throw new Error(HELP);
}

module.exports = { vaults, selectVault, notePath, listNotes, cliPath, cli, handle, HELP };
