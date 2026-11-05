import { CSS } from './css';

const STYLE_ID = 'dsh-lol-esports-css';

/**
 * Injects the panel stylesheet once per document.
 *
 * The tag deliberately carries no `data-plugin` attribute: the shell removes
 * `style[data-plugin]` tags when a module instance is disposed (HMR replaces a
 * row, for instance), and a tag keyed to this plugin id would be collected
 * together with the outgoing instance. A plain id survives that.
 */
export function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (existing !== null) {
    if (existing.textContent !== CSS) existing.textContent = CSS;
    return;
  }
  const tag = document.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = CSS;
  const host = document.head ?? document.documentElement;
  if (host !== undefined && host !== null) host.appendChild(tag);
}
