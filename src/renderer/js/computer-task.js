// /pc is an explicit task. Natural-language routing is conservative so conversation stays chat.
export function computerTask(text) {
  const value = String(text || '').trim();
  if (value.startsWith('/')) return value;
  const plain = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/["“”«»`]/u.test(value) || /\b(nao|nunca|not|never|don't|exemplo|example)\b/.test(plain)) return null;
  // Asking for machine information is read-only, not a command inferred from a question.
  if (/\b(meu|my|este|this)\s+(pc|computador|computer|sistema)\b/.test(plain)
    && /\b(memoria|ram|processador|cpu|gpu|disco|espaco|programas|aplicativos|hardware|configurac|memory|storage|installed|specs)/.test(plain)) return value;
  if (/^(?:capri[, ]+)?(?:por favor[, ]+)?(?:calcule|calcula|calculate|quanto e)\b/.test(plain)) return value;
  const command = /^(?:capri[, ]+)?(?:por favor[, ]+)?(?:abra|abre|abrir|open|execute|executa|run|crie|cria|create|organize|organiza|mova|move|copie|copia|copy|renomeie|rename|instale|install|configure|configura|digite|escreva|preencha|clique|click|faca|faz|use|utilize)\b/;
  if (!command.test(plain)) return null;
  if (/\bobsidian\b/.test(plain) && !/^(?:abra|abre|open)\s+(?:o\s+)?obsidian[.!]?$/i.test(plain)) return value;
  // A simple app launch already has a fast local resolver. Do not require a model for it.
  if (/^(?:capri[, ]+)?(?:por favor[, ]+)?(?:abra|abre|abrir|open)\b/.test(plain)
    && !/\s(?:e|and|depois|then)\s|\b(?:calcule|calcula|calculate|digite|preencha|clique)\b/.test(plain)) return null;
  if (/\b(calculadora|calculator|powershell|terminal|arquivo|arquivos|pasta|pastas|file|files|folder|folders|notepad|bloco de notas)\b/.test(plain)
    || /\s(?:e|and|depois|then)\s/.test(plain)) return value;
  return null;
}
