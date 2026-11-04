/** Domain shapes and the slice of the DSH host API this panel talks to. */

export interface TeamRecord {
  wins: number;
  losses: number;
}

export interface Team {
  id: string;
  code: string;
  name: string;
  image: string | null;
  /** Games won in this series. */
  score: number;
  record: TeamRecord | null;
}

export interface MatchEvent {
  id: string;
  start: Date;
  state: string;
  stage: string;
  bestOf: number;
  teams: [Team, Team];
}

export interface VodTarget {
  href: string;
  locale: string;
}

export interface GameSide {
  side: string;
  code: string;
}

export interface GameEntry {
  number: number;
  sides: GameSide[];
  vods: VodTarget[];
}

export interface StreamTarget {
  url: string;
  locale: string;
}

export interface MatchDetailData {
  streams: StreamTarget[];
  games: GameEntry[];
}

export interface LivePlayer {
  id: number;
  name: string;
  champion: string;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
}

export interface LiveSide {
  teamId: string;
  kills: number;
  gold: number;
  towers: number;
  dragons: number;
  barons: number;
  players: LivePlayer[];
}

export interface LiveStats {
  blue: LiveSide;
  red: LiveSide;
  at: string | null;
  /** Frame game state: `in_game`, `finished`, … */
  state: string | null;
}

export interface TeamCode {
  id: string;
  code: string;
}

export interface LiveGameRef {
  gameId: string | null;
  teams: TeamCode[];
}

export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** What the host injects into the panel component. */
export interface PanelFace {
  getLang: () => string;
  askMatch: (match: MatchEvent, question: string, year: number) => Promise<AskResult>;
  askText: (text: string) => Promise<AskResult>;
}

export interface AskResult {
  ok: boolean;
  message?: string;
}

type SetState<S> = (next: S | ((prev: S) => S)) => void;

export interface ReactLike {
  createElement: (...args: any[]) => any;
  useState: <S>(initial: S | (() => S)) => [S, SetState<S>];
  useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => void;
  useCallback: <F extends (...args: any[]) => any>(fn: F, deps: readonly unknown[]) => F;
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
  useRef: <T>(value: T) => { current: T };
}

export interface LocaleApi {
  register: (ns: string, dictionaries: { zh: Record<string, string>; en: Record<string, string> }) => unknown;
  bind: (ns: string) => Translate;
  getSnapshot: () => { active: string };
}

export interface SlotApi {
  inject: (name: string, register: () => unknown) => void;
  register: (options: Record<string, unknown>, component: unknown) => unknown;
}

export interface SessionPrompt {
  requestId: string;
  sessionId: string;
  mode: 'queue';
  content: { type: 'text'; text: string }[];
}

export interface RemoteApi {
  session: {
    prompt: (input: SessionPrompt) => Promise<{ ok: boolean; error?: { message?: string } }>;
  };
}

export interface WorkspacesApi {
  initializeDefault: () => Promise<{ workspaceId: string } | undefined>;
}

export interface SessionsApi {
  create: (options: { workspaceId?: string }) => Promise<string>;
}

export interface PanelContext {
  effect: (fn: () => unknown, label?: string) => void;
  locale: LocaleApi;
  slots: SlotApi;
  sessions: SessionsApi;
  workspaces: WorkspacesApi;
  remote: RemoteApi;
  uiWorkspace: { openSession: (sessionId: string) => void };
  layout: { selectPanel: (panel: string | null) => void };
}
