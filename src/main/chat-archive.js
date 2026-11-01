'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { notePath } = require('./obsidian');

// Durable outbox first, Markdown second. Each message has its own stable ID, so retries
// after a crash do not duplicate a message already appended to the vault.
class ChatArchive {
  constructor({ profile, resolveVault, enabled = () => true, now = () => new Date() }) {
    Object.assign(this, { resolveVault, enabled, now });
    this.directory = path.join(profile, 'obsidian-chat-outbox');
    this.session = randomUUID();
    this.lastError = null;
    this.lastFile = null;
  }

  record({ id = randomUUID(), role, content, kind = 'chat' } = {}) {
    if (!this.enabled()) return { ok: true, paused: true };
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(id) || !['user', 'assistant', 'system'].includes(role)
      || typeof content !== 'string' || !content || content.length > 512000) return { ok: false, error: 'Registro de conversa inválido.' };
    try {
      let vault = null;
      try { vault = this.resolveVault(); } catch { /* keep pending until a vault is available */ }
      const event = { id, session: this.session, role, content, kind: String(kind).slice(0, 40), at: this.now().toISOString(), vaultId: vault?.id || null };
      fs.mkdirSync(this.directory, { recursive: true });
      const file = path.join(this.directory, `${id}.json`);
      if (!fs.existsSync(file)) {
        const fd = fs.openSync(file, 'wx');
        try { fs.writeFileSync(fd, JSON.stringify(event), 'utf8'); fs.fsyncSync(fd); }
        finally { fs.closeSync(fd); }
      }
      return this.flush();
    } catch (error) {
      this.lastError = error.message;
      return { ok: false, error: error.message };
    }
  }

  status() {
    let pending = 0;
    try { pending = fs.readdirSync(this.directory).filter((f) => /^[a-zA-Z0-9-]+\.json$/.test(f)).length; } catch { /* no outbox yet */ }
    return { ok: true, enabled: this.enabled(), pending, file: this.lastFile, error: this.lastError };
  }

  flush() {
    if (!this.enabled()) return this.status();
    let names;
    try {
      names = fs.readdirSync(this.directory).filter((f) => /^[a-zA-Z0-9-]+\.json$/.test(f));
    } catch (error) {
      if (error.code !== 'ENOENT') this.lastError = error.message;
      return this.status();
    }
    this.lastError = null;
    const entries = [];
    for (const name of names) {
      try { entries.push({ name, event: JSON.parse(fs.readFileSync(path.join(this.directory, name), 'utf8')) }); }
      catch { this.lastError = `Registro pendente ilegível, preservado para recuperação: ${name}`; }
    }
    entries.sort((a, b) => String(a.event?.at || '').localeCompare(String(b.event?.at || '')));
    for (const { name, event } of entries) {
      try {
        if (!event || !/^[\w-]{1,80}$/.test(event.id) || name !== `${event.id}.json` || !/^[\w-]{1,80}$/.test(event.session)
          || !/^\d{4}-\d{2}-\d{2}T/.test(event.at) || typeof event.content !== 'string') throw new Error('Item inválido na fila de conversas.');
        const vault = this.resolveVault(event.vaultId);
        const relative = `Capri/Conversas/${event.at.slice(0, 7)}/${event.at.slice(0, 10)} - ${event.session}.md`;
        const file = notePath(vault, relative, true);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const marker = `<!-- capri-message:${event.id} -->`;
        const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        // Message bodies are indented code, so user text cannot forge our top-level marker.
        if (!previous.split('\n').includes(marker)) {
          const header = previous ? '' : `---\ntags: [capri, conversa]\nsessao: ${event.session}\ndata_utc: ${event.at.slice(0, 10)}\n---\n\n# Conversa com a Capri\n\n[[Capri/Painel da Capri|Painel da Capri]] · Registro local; horários em UTC.\n\n`;
          const who = { user: 'Você', assistant: 'Capri', system: 'Sistema' }[event.role] || 'Sistema';
          const body = event.content.replace(/\r\n/g, '\n').split('\n').map((line) => `    ${line}`).join('\n');
          const fd = fs.openSync(file, 'a');
          try {
            fs.writeFileSync(fd, `${header}## ${who} — ${event.at}\n\n${body}\n\n${marker}\n\n`, 'utf8');
            fs.fsyncSync(fd);
          } finally { fs.closeSync(fd); }
        }
        this.lastFile = file;
        fs.unlinkSync(path.join(this.directory, name));
      } catch (error) { this.lastError = error.message; }
    }
    return this.status();
  }
}

module.exports = { ChatArchive };
