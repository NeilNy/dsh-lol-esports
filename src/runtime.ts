/**
 * The loader hands `require` to the factory, and React may only be resolved from
 * there — a static `import 'react'` would be evaluated at module scope, outside
 * the factory, where the loader's `require` is not in scope. Components therefore
 * build elements through this late-bound `h`.
 */
import type { ReactLike } from './types';

let react: ReactLike | null = null;

export function setReact(api: ReactLike): void {
  react = api;
}

export function getReact(): ReactLike {
  if (react === null) throw new Error('dsh-lol-esports: React is not bound yet');
  return react;
}

/** Stands in for `React.createElement`; JSX is compiled to calls to this. */
export function h(type: unknown, props?: unknown, ...children: unknown[]): unknown {
  const create = getReact().createElement as (...args: unknown[]) => unknown;
  return create(type, props, ...children);
}
