import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');

/** Load the built bundle the way the DSH client loader would, then hand back the plugin. */
function loadPlugin() {
  let spec = null;
  const windowStub = {
    __ModuleLoader__: { load: (next) => { spec = next; } },
  };
  const appended = [];
  const documentStub = {
    documentElement: { getAttribute: () => 'zh-CN' },
    querySelector: () => null,
    getElementById: () => null,
    createElement: () => ({ dataset: {}, textContent: '', id: '' }),
    head: { appendChild: (tag) => { appended.push(tag); } },
  };
  const fn = new Function('window', 'document', 'navigator', source);
  fn(windowStub, documentStub, { language: 'zh-CN' });
  assert.ok(spec !== null, 'bundle did not register with __ModuleLoader__');
  assert.equal(spec.id, 'dsh-lol-esports');
  const require = (id) => {
    if (id === 'react') return React;
    throw new Error(`unexpected require: ${id}`);
  };
  return { spec, plugin: spec.factory(require), appended };
}

const t = (key, params) => (params === undefined ? key : `${key}:${JSON.stringify(params)}`);

const match = (over) => ({
  id: '1',
  start: new Date('2026-11-04T22:00:00Z'),
  state: 'inProgress',
  stage: '四分之一决赛',
  bestOf: 5,
  teams: [
    { id: '11', code: 'IG', name: 'Invictus Gaming', image: null, score: 2, record: null },
    { id: '22', code: 'TES', name: 'TOP ESPORTS', image: null, score: 1, record: null },
  ],
  ...over,
});

test('the bundle registers and exposes the panel contract', () => {
  const { spec, plugin } = loadPlugin();
  assert.equal(spec.id, 'dsh-lol-esports');
  assert.ok(Array.isArray(plugin.inject));
  for (const name of ['slots', 'locale', 'remote.session', 'sessions', 'workspaces', 'uiWorkspace', 'layout']) {
    assert.ok(plugin.inject.includes(name), `missing injection: ${name}`);
  }
  assert.equal(typeof plugin.apply, 'function');
});

test('apply registers the dictionary, the panel and the sidebar entry', async () => {
  const { plugin, appended } = loadPlugin();
  const registered = [];
  const effects = [];
  const ctx = {
    effect: (fn, label) => { effects.push(label); fn(); },
    locale: {
      register: (ns, dictionaries) => { registered.push({ ns, keys: Object.keys(dictionaries.zh).length }); return () => {}; },
      bind: () => t,
      getSnapshot: () => ({ active: 'zh-CN' }),
    },
    slots: {
      inject: (name, register) => { register(); },
      register: (options, component) => { registered.push({ slot: options.name, component }); return () => {}; },
    },
    remote: { session: { prompt: async () => ({ ok: true }) } },
    sessions: { create: async () => 'session-1' },
    workspaces: { initializeDefault: async () => ({ workspaceId: 'ws-1' }) },
    uiWorkspace: { openSession: () => {} },
    layout: { selectPanel: () => {} },
  };
  plugin.apply(ctx);

  const dictionary = registered.find(item => item.ns === 'lol');
  assert.ok(dictionary, 'dictionary not registered');
  assert.ok(dictionary.keys >= 70, `dictionary looks too small: ${dictionary.keys}`);
  assert.ok(effects.includes('dsh-lol: dictionaries'));

  const main = registered.find(item => item.slot === 'main');
  const sidebar = registered.find(item => item.slot === 'sidebar.panellist');
  assert.ok(main && sidebar, 'slots not registered');
  assert.equal(typeof main.component, 'function');
  assert.equal(typeof sidebar.component, 'function');

  // The main slot renders without a DOM: effects are skipped, so it shows the loading state.
  const html = renderToStaticMarkup(
    React.createElement(main.component, { t, getLang: () => 'zh-CN', askMatch: async () => ({ ok: true }), askText: async () => ({ ok: true }) }),
  );
  assert.match(html, /lol-page/);
  assert.match(html, /lol-title/);

  // The stylesheet must land in the document as part of mounting the panel,
  // not only when the bundle happens to be evaluated.
  const style = appended.find(tag => tag.textContent && tag.textContent.includes('.lol-page{'));
  assert.ok(style, 'panel stylesheet was not injected');

  assert.equal(renderToStaticMarkup(React.createElement(sidebar.component, { size: 18, active: true })).includes('<svg'), true);
});
