// Completion only: selecting a suggestion never sends a message or executes a command.
export class CommandMenu {
  constructor(input, form) {
    this.input = input;
    this.enabled = false;
    this.items = [];
    this.index = 0;
    this.box = document.createElement('div');
    this.box.className = 'command-menu';
    this.box.id = 'capri-command-menu';
    this.box.setAttribute('role', 'listbox');
    this.box.setAttribute('aria-label', 'Comandos / Commands');
    this.box.hidden = true;
    form.before(this.box);
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', this.box.id);
    input.setAttribute('aria-expanded', 'false');
    input.addEventListener('input', () => this.update());
    input.addEventListener('focus', () => this.update());
    input.addEventListener('blur', () => this.close());
    this.box.addEventListener('mousedown', e => e.preventDefault());
    this.box.addEventListener('click', e => e.stopPropagation());
    input.addEventListener('keydown', e => {
      if (this.box.hidden || e.isComposing) return;
      if (e.key === 'Escape') { e.preventDefault(); this.close(); }
      else if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        this.index = (this.index + (e.key === 'ArrowDown' ? 1 : -1) + this.items.length) % this.items.length;
        this.highlight();
      } else if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); this.select(); }
    });
  }
  close() {
    this.box.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }
  update() {
    if (!this.enabled || this.input.disabled || this.input.type === 'password') return this.close();
    this.items = globalThis.CapriCommands.suggestions(this.input.value);
    this.index = 0;
    this.box.replaceChildren();
    if (!this.items.length) return this.close();
    for (const [i, item] of this.items.entries()) {
      const row = document.createElement('div');
      row.id = `capri-command-${i}`;
      row.setAttribute('role', 'option');
      row.className = 'command-menu__item';
      row.title = item.aliases;
      const title = document.createElement('strong'); title.textContent = item.label;
      const detail = document.createElement('span'); detail.textContent = `${item.description}${item.example ? ` · ${item.example}` : ''}`;
      row.append(title, detail);
      row.addEventListener('click', () => { this.index = i; this.select(); });
      this.box.append(row);
    }
    this.box.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this.highlight();
  }
  highlight() {
    [...this.box.children].forEach((row, i) => row.setAttribute('aria-selected', String(i === this.index)));
    const row = this.box.children[this.index];
    this.input.setAttribute('aria-activedescendant', row.id);
    row.scrollIntoView({ block: 'nearest' });
  }
  select() {
    const item = this.items[this.index];
    if (!item) return;
    this.input.value = item.value;
    this.input.focus();
    this.input.setSelectionRange(item.value.length, item.value.length);
    this.update();
  }
}
