/**
 * Entry point. The DSH client module loader calls `factory(require)` and expects
 * the plugin object; React is only reachable through that injected `require`,
 * so it is bound before anything renders.
 */
import { apply, inject } from './panel';
import { setReact } from './runtime';
import type { ReactLike } from './types';

interface ModuleLoader {
  load: (spec: { id: string; factory: (require: (id: string) => unknown) => unknown }) => void;
}

declare global {
  interface Window {
    __ModuleLoader__: ModuleLoader;
  }
}

window.__ModuleLoader__.load({
  id: 'dsh-lol-esports',
  factory(require) {
    setReact(require('react') as ReactLike);
    return { inject, apply };
  },
});
