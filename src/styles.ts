import { CSS } from './css';

const STYLE_TAG_ID = 'dsh-lol-esports/page.css';

/** Injects the panel stylesheet once per document. */
export function ensureStyles(): void {
  if (typeof document === 'undefined') return;
  const selector = `style[data-plugin-css=${JSON.stringify(STYLE_TAG_ID)}]`;
  const existing = document.querySelector(selector);
  if (existing !== null) {
    existing.textContent = CSS;
    return;
  }
  const tag = document.createElement('style');
  tag.dataset.plugin = 'dsh-lol-esports';
  tag.dataset.pluginCss = STYLE_TAG_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
