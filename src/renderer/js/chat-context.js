// Keep the full conversation on disk; bound only the context sent to the model.
export const CONTEXT_CHARS = 48000;
export const CONTEXT_HOUR = 60 * 60 * 1000;

export function chatContext(history, now = Date.now(), budget = CONTEXT_CHARS) {
  // Include the last exchanges even after a long pause, plus the entire recent hour.
  const candidates = history.filter((m, i) => !m.at || m.at >= now - CONTEXT_HOUR || i >= history.length - 20);
  const selected = [];
  let used = 0;
  for (let i = candidates.length - 1; i >= 0; i--) {
    const { role, content } = candidates[i];
    if (used + content.length > budget && selected.length) break;
    selected.unshift({ role, content });
    used += content.length;
  }
  return selected;
}
