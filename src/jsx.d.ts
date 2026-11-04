/**
 * Classic JSX runtime: the panel compiles JSX to `h(...)` (see src/runtime.ts)
 * instead of the automatic runtime, because React only arrives through the
 * loader-injected `require`. Only the shapes TypeScript needs are declared here.
 */
declare namespace JSX {
  type Element = unknown;
  interface ElementChildrenAttribute {
    children: unknown;
  }
  interface IntrinsicAttributes {
    key?: string | number;
  }
  interface IntrinsicElements {
    [name: string]: any;
  }
}
