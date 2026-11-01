// Shared by Electron and the renderer. Only command words are translated; arguments stay literal.
(function (root) {
  'use strict';
  const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const roots = {
    obsidian: ['obsidian'],
    abrir: ['abrir', 'open', 'ouvrir', 'открыть', 'открой', 'öffnen', 'apri', 'aprire', '打开', '開く'],
    executar: ['executar', 'run', 'execute', 'ejecutar', 'exécuter', 'выполнить', 'ausführen', 'esegui', '运行', '実行'],
    pc: ['pc', 'computer', 'computador', 'ordinateur', 'ordenador', 'компьютер', 'task'],
    ajuda: ['ajuda', 'help', 'ayuda', 'aide', 'помощь', 'hilfe', 'aiuto', '帮助', 'ヘルプ'],
  };
  const actions = {
    ajuda: roots.ajuda,
    status: ['status', 'estado', 'statut', 'état', 'статус', 'stato', '状态', '状態'],
    cofres: ['cofres', 'vaults', 'bóvedas', 'coffres', 'хранилища', 'tresore', '保管庫', '仓库'],
    usar: ['usar', 'use', 'select', 'selecionar', 'utiliser', 'использовать', 'verwenden', 'usa', '使用'],
    listar: ['listar', 'list', 'liste', 'lister', 'список', 'auflisten', 'elenca', '列出', '一覧'],
    ler: ['ler', 'read', 'leer', 'lire', 'читать', 'lesen', 'leggi', '读取', '読む'],
    abrir: roots.abrir,
    buscar: ['buscar', 'search', 'rechercher', 'искать', 'suchen', 'cerca', '搜索', '検索'],
    pesquisar: ['pesquisar', 'find', 'query', 'investigar', 'trouver', 'найти', 'finden', 'trova', '查找', '探す'],
    diario: ['diario', 'diário', 'daily', 'journal', 'ежедневник', 'tagebuch', '日记', '日誌'],
    criar: ['criar', 'create', 'crear', 'créer', 'создать', 'erstellen', 'crea', '创建', '作成'],
    acrescentar: ['acrescentar', 'append', 'add', 'añadir', 'agregar', 'ajouter', 'добавить', 'anhängen', 'aggiungi', '追加', '追加する'],
    comandos: ['comandos', 'commands', 'commandes', 'команды', 'befehle', 'comandi', '命令列表', 'コマンド一覧'],
    comando: ['comando', 'command', 'commande', 'команда', 'befehl', '命令', 'コマンド'],
    historico: ['historico', 'histórico', 'history', 'historial', 'historique', 'история', 'verlauf', 'cronologia', '历史', '履歴'],
  };
  const history = {
    status: actions.status,
    ativar: ['ativar', 'enable', 'on', 'activar', 'activer', 'включить', 'aktivieren', 'attiva', '启用', '有効'],
    pausar: ['pausar', 'pause', 'disable', 'off', 'pausa', 'désactiver', 'приостановить', 'pausieren', '暂停', '一時停止'],
    sincronizar: ['sincronizar', 'sync', 'synchronize', 'synchroniser', 'синхронизировать', 'synchronisieren', 'sincronizza', '同步', '同期'],
  };
  const choose = ['escolher', 'choose', 'browse', 'elegir', 'choisir', 'выбрать', 'wählen', 'scegli', '选择', '選択'];
  function resolve(table, value) { return Object.keys(table).find(k => table[k].some(a => fold(a) === fold(value))); }
  function normalize(text) {
    const value = String(text || '').trim();
    const m = /^\/(\S+)([\s\S]*)$/.exec(value);
    if (!m) return value;
    const command = resolve(roots, m[1]);
    if (!command) return value;
    let tail = m[2];
    if (command === 'obsidian') {
      tail = tail.replace(/^(\s+)(\S+)/, (_, space, word) => space + (resolve(actions, word) || word));
      if (/^\s+historico(?:\s|$)/.test(tail)) {
        tail = tail.replace(/^(\s+historico\s+)(\S+)/, (_, prefix, word) => prefix + (resolve(history, word) || word));
      }
    } else if (command === 'abrir' && choose.some(a => fold(a) === fold(tail.trim()))) tail = ' escolher';
    return '/' + command + tail;
  }
  const descriptions = {
    ajuda: ['Lista de comandos / Command guide', ''],
    status: ['Verificar o cofre / Vault status', ''], cofres: ['Listar cofres / List vaults', ''],
    usar: ['Selecionar cofre / Select vault', 'NOME OU ID'], listar: ['Listar notas / List notes', '[termo]'],
    ler: ['Ler uma nota / Read a note', 'Pasta/Nota.md'], abrir: ['Abrir nota / Open note', 'Pasta/Nota.md'],
    buscar: ['Busca na janela do Obsidian / Search UI', 'termo'], pesquisar: ['Pesquisar no chat / Find in chat', 'termo'],
    diario: ['Criar ou abrir diário / Daily note', '[AAAA-MM-DD]'], criar: ['Criar nota / Create note', 'Pasta/Nota.md | texto'],
    acrescentar: ['Acrescentar texto / Append text', 'Pasta/Nota.md | texto'], comandos: ['Listar comandos internos / List commands', '[filtro]'],
    comando: ['Executar comando interno / Run command', 'ID'], historico: ['Histórico das conversas / Chat history', ''],
  };
  function suggestions(text) {
    const value = String(text || '').trimStart();
    if (!value.startsWith('/')) return [];
    const words = value.slice(1).split(/\s+/);
    let table = roots, prefix = '/', query = words[0], desc = null;
    if (words.length > 1) {
      if (resolve(roots, words[0]) !== 'obsidian') return [];
      prefix = `/${words[0]} `; table = actions; query = words[1]; desc = descriptions;
      if (words.length > 2) {
        if (resolve(actions, words[1]) !== 'historico' || words.length > 3) return [];
        prefix += words[1] + ' '; table = history; query = words[2]; desc = null;
      }
    }
    return Object.entries(table).flatMap(([key, aliases]) => {
      const exact = aliases.find(a => fold(a) === fold(query));
      const alias = exact || aliases.find(a => fold(a).startsWith(fold(query)));
      if (!alias) return [];
      const details = desc?.[key] || ({
        obsidian: ['Notas e diário / Notes and daily journal', ''], abrir: ['Abrir aplicativo / Open app', 'aplicativo ou caminho'],
        executar: ['Executar PowerShell / Run PowerShell', 'comando'], pc: ['Tarefa com IA / AI task', 'pedido'], ajuda: descriptions.ajuda,
        status: ['Ver estado do histórico / History status', ''], ativar: ['Ativar histórico / Enable history', ''],
        pausar: ['Pausar histórico / Pause history', ''], sincronizar: ['Salvar pendências / Sync pending messages', ''],
      })[key];
      return [{ value: prefix + alias + ' ', label: prefix + alias, description: details[0], example: details[1], aliases: aliases.join(', ') }];
    });
  }
  function help() {
    return 'Comandos / Commands — PT, EN, ES, FR, RU, DE, IT, 中文, 日本語\n' +
      '/abrir · /open aplicativo\n/executar · /run comando PowerShell\n/pc pedido\n/ajuda · /help\n\n' +
      Object.keys(actions).map(k => `/obsidian ${actions[k].slice(0, 3).join(' · ')} — ${descriptions[k][0]} ${descriptions[k][1]}`).join('\n') +
      '\n\n/obsidian history status|enable|pause|sync\nOs argumentos (caminhos, textos e scripts) são preservados. Use / para explorar os comandos.';
  }
  const api = { roots, actions, history, normalize, suggestions, help };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CapriCommands = api;
})(globalThis);
