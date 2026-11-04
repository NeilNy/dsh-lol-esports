import { PANEL_ID } from './constants';
import { buildPrompt, describe, mintRequestId } from './format';
import { NS, en, zh } from './i18n';
import { WorldsIcon, WorldsPage } from './ui';
import type { AskResult, MatchEvent, PanelContext, PanelFace } from './types';

export const inject = [
  'slots',
  'locale',
  'remote',
  'remote.session',
  'sessions',
  'workspaces',
  'uiWorkspace',
  'layout',
];

export function apply(ctx: PanelContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-lol: dictionaries');
  const t = ctx.locale.bind(NS);

  /** Open a brand-new conversation in the default Workspace and ask there. */
  const send = async (text: string): Promise<AskResult> => {
    try {
      const workspace = await ctx.workspaces.initializeDefault();
      const sessionId = await ctx.sessions.create(
        workspace === undefined ? {} : { workspaceId: workspace.workspaceId },
      );
      const result = await ctx.remote.session.prompt({
        requestId: mintRequestId(),
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text }],
      });
      if (!result.ok) return { ok: false, message: result.error?.message ?? 'unknown error' };
      ctx.uiWorkspace.openSession(sessionId);
      ctx.layout.selectPanel(null);
      return { ok: true };
    } catch (reason) {
      return { ok: false, message: describe(reason) };
    }
  };

  const face: PanelFace = {
    /** Active interface locale, used to order watch links. */
    getLang: () => ctx.locale.getSnapshot().active,
    /** One match, with its score, stage and watch link attached. */
    askMatch: (match: MatchEvent, question: string, year: number) => send(buildPrompt(t, match, question, year)),
    /** A ready-made prompt about a day or a stage. */
    askText: (text: string) => send(text),
  };

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: () => face,
  }, WorldsPage));

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 30,
    locale: NS,
    label: () => t('panel'),
  }, WorldsIcon));
}
