/** Dates, labels, and the prompts handed to the model. */
import { EDITION_GAP, OFFICIAL_URL } from './constants';
import type { MatchEvent, TeamRecord, TeamCode, Translate } from './types';

/** Two Worlds editions are months apart; take the last contiguous run. */
export function currentEdition(events: MatchEvent[]): MatchEvent[] {
  let start = 0;
  for (let index = events.length - 1; index > 0; index -= 1) {
    if (events[index].start.getTime() - events[index - 1].start.getTime() > EDITION_GAP) {
      start = index;
      break;
    }
  }
  return events.slice(start);
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export interface DayGroup {
  key: string;
  date: Date;
  items: MatchEvent[];
}

/**
 * Day groups as one chronological timeline: earlier match days on top, today in
 * the middle, upcoming days below. The panel scrolls today's group into view on
 * open, so scrolling up walks back through history and down walks forward.
 */
export function orderDayGroups(groups: DayGroup[], now: Date = new Date()): DayGroup[] {
  const todayStart = startOfDay(now).getTime();
  const stamped = groups.map(group => ({ group, day: startOfDay(group.date).getTime() }));
  const past = stamped.filter(item => item.day < todayStart).sort((a, b) => a.day - b.day);
  const today = stamped.filter(item => item.day === todayStart);
  const future = stamped.filter(item => item.day > todayStart).sort((a, b) => a.day - b.day);
  return [...past, ...today, ...future].map(item => item.group);
}

/** Where the timeline should open: today, else the next match day, else the last one. */
export function anchorDayIndex(groups: DayGroup[], now: Date = new Date()): number {
  if (groups.length === 0) return -1;
  const todayStart = startOfDay(now).getTime();
  const exact = groups.findIndex(group => startOfDay(group.date).getTime() === todayStart);
  if (exact !== -1) return exact;
  const next = groups.findIndex(group => startOfDay(group.date).getTime() > todayStart);
  return next !== -1 ? next : groups.length - 1;
}

export function groupByDay(events: MatchEvent[]): DayGroup[] {
  const groups: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const event of events) {
    const key = dayKey(event.start);
    if (current === null || current.key !== key) {
      current = { key, date: event.start, items: [] };
      groups.push(current);
    }
    current.items.push(event);
  }
  return groups;
}

export function uiLang(): string {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.getAttribute('lang');
    if (typeof lang === 'string' && lang !== '') return lang;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') return navigator.language;
  return 'zh-CN';
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();
export function formatDay(date: Date, t: Translate): string {
  const lang = uiLang();
  let formatter = dayFormatters.get(lang);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', weekday: 'short' });
    dayFormatters.set(lang, formatter);
  }
  const label = formatter.format(date);
  const offset = Math.round((startOfDay(date).getTime() - startOfDay(new Date()).getTime()) / 86400000);
  if (offset === 0) return `${t('time.today')} · ${label}`;
  if (offset === 1) return `${t('time.tomorrow')} · ${label}`;
  return label;
}

const clockFormatters = new Map<string, Intl.DateTimeFormat>();
export function formatClock(date: Date): string {
  const lang = uiLang();
  let formatter = clockFormatters.get(lang);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
    clockFormatters.set(lang, formatter);
  }
  return formatter.format(date);
}

export function formatFull(date: Date): string {
  return new Intl.DateTimeFormat(uiLang(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function describe(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function mintRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `lol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const ROLE_KEYS: Record<string, string> = {
  top: 'role.top',
  jungle: 'role.jungle',
  mid: 'role.mid',
  bottom: 'role.bottom',
  support: 'role.support',
};

/** Riot reports roles as top/jungle/mid/bottom/support; unknown ones stay raw. */
export function roleLabel(role: string, t: Translate): string {
  const key = ROLE_KEYS[role];
  return key === undefined ? role : t(key);
}

export function stateLabel(state: string, t: Translate): string {
  if (state === 'inProgress') return t('state.live');
  if (state === 'completed') return t('state.done');
  return t('state.upcoming');
}

/** Stage names arrive from the zh-CN feed; map the known ones for other locales. */
const STAGE_KEYS: Record<string, string> = {
  '入围赛': 'stage.playin',
  '瑞士轮': 'stage.swiss',
  '四分之一决赛': 'stage.quarter',
  '半决赛': 'stage.semi',
  '决赛': 'stage.final',
};

export function stageName(block: string, t: Translate): string {
  const key = STAGE_KEYS[block];
  return key === undefined ? block : t(key);
}

/**
 * Riot hands out summoner names with the team code glued on — "IG TheShy",
 * "TES 369". Strip that prefix only when it really is the team code, so a
 * two-word player name such as "Hans Sama" stays whole.
 */
export function displayName(name: string, code: string): string {
  const value = typeof name === 'string' ? name : '';
  const prefix = typeof code === 'string' ? code.trim() : '';
  if (prefix === '' || value === '') return value;
  const cut = value.indexOf(' ');
  if (cut === -1) return value;
  if (value.slice(0, cut).toLowerCase() !== prefix.toLowerCase()) return value;
  const rest = value.slice(cut + 1).trim();
  return rest === '' ? value : rest;
}

/** 45210 -> "45.2k", small numbers left alone. */
export function formatGold(value: number): string {
  const gold = Number(value) || 0;
  return gold >= 1000 ? `${(gold / 1000).toFixed(1)}k` : String(gold);
}

export function buildPrompt(t: Translate, match: MatchEvent, question: string, year: number): string {
  const home = match.teams[0];
  const away = match.teams[1];
  return t('prompt.template', {
    event: t('edition', { year }),
    stage: match.stage === '' ? '-' : stageName(match.stage, t),
    home: home.name === '' ? home.code : `${home.name} (${home.code})`,
    away: away.name === '' ? away.code : `${away.name} (${away.code})`,
    format: t('bo', { n: match.bestOf }),
    time: formatFull(match.start),
    state: stateLabel(match.state, t),
    score: match.state === 'unstarted' ? '-' : `${home.score} : ${away.score}`,
    link: OFFICIAL_URL,
    question,
  });
}

/** "10/24 01:00" — compact local stamp for the text handed to the model. */
const stampFormatters = new Map<string, Intl.DateTimeFormat>();
export function stamp(date: Date): string {
  const lang = uiLang();
  let formatter = stampFormatters.get(lang);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(lang, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    stampFormatters.set(lang, formatter);
  }
  return formatter.format(date);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(uiLang(), { dateStyle: 'medium' }).format(date);
}

function matchLine(match: MatchEvent, t: Translate, withStage: boolean): string {
  const home = match.teams[0];
  const away = match.teams[1];
  const score = match.state === 'unstarted' ? 'vs' : `${home.score}:${away.score}`;
  const tail = [t('bo', { n: match.bestOf })];
  if (match.state === 'inProgress') tail.push(t('state.live'));
  const stage = withStage && match.stage !== '' ? `${stageName(match.stage, t)} ` : '';
  return `- ${stamp(match.start)} ${stage}${home.code} ${score} ${away.code}（${tail.join('，')}）`;
}

export interface DigestOptions {
  withStage?: boolean;
  records?: boolean;
}

/** Finished and pending matches as two labelled blocks, plus team records when asked. */
export function digestBlock(events: MatchEvent[], t: Translate, options?: DigestOptions): string {
  const opts = options ?? {};
  const finished = events.filter(event => event.state === 'completed').sort((a, b) => a.start.getTime() - b.start.getTime());
  const pending = events.filter(event => event.state !== 'completed').sort((a, b) => a.start.getTime() - b.start.getTime());
  const lines: string[] = [];
  if (finished.length > 0) {
    lines.push(`${t('digest.finished')}${finished.length}${t('digest.count')}`);
    for (const match of finished) lines.push(matchLine(match, t, opts.withStage === true));
  }
  if (pending.length > 0) {
    if (lines.length > 0) lines.push('');
    lines.push(`${t('digest.pending')}${pending.length}${t('digest.count')}`);
    for (const match of pending) lines.push(matchLine(match, t, opts.withStage === true));
  }
  if (opts.records === true) {
    const records = recordsOf(events);
    if (records.length > 0) {
      lines.push('');
      lines.push(`${t('digest.records')}${records.map(([code, record]) => `${code} ${record.wins}-${record.losses}`).join('，')}`);
    }
  }
  return lines.join('\n');
}

/** Latest tournament record seen per team, strongest first. */
function recordsOf(events: MatchEvent[]): [string, TeamRecord][] {
  const byTeam = new Map<string, TeamRecord>();
  for (const event of events) {
    for (const team of event.teams) {
      if (team.record === null || team.code === 'TBD') continue;
      byTeam.set(team.code, team.record);
    }
  }
  return [...byTeam.entries()]
    .sort((a, b) => b[1].wins - a[1].wins || a[1].losses - b[1].losses || a[0].localeCompare(b[0]))
    .slice(0, 24);
}

export interface TodayScope {
  events: MatchEvent[];
  date: Date;
  isToday: boolean;
}

/** The local day to talk about: today when it has matches, else the last day that had any. */
export function resolveTodayScope(events: MatchEvent[]): TodayScope | null {
  if (events.length === 0) return null;
  const today = dayKey(new Date());
  const todayEvents = events.filter(event => dayKey(event.start) === today);
  if (todayEvents.length > 0) {
    return { events: todayEvents, date: todayEvents[0].start, isToday: true };
  }
  const days = [...new Set(events.map(event => dayKey(event.start)))].sort();
  const latest = days[days.length - 1];
  if (latest === undefined) return null;
  const latestEvents = events.filter(event => dayKey(event.start) === latest);
  return { events: latestEvents, date: latestEvents[0].start, isToday: false };
}

export interface StageScope {
  stage: string;
  events: MatchEvent[];
}

/** The stage to talk about: the active filter, else the stage of the next match. */
export function resolveStageScope(events: MatchEvent[], stage: string): StageScope {
  const blocks: string[] = [];
  for (const event of events) if (event.stage !== '' && !blocks.includes(event.stage)) blocks.push(event.stage);
  let chosen = stage;
  if (chosen === '') {
    const next = events
      .filter(event => event.state !== 'completed')
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
    chosen = next?.stage ?? blocks[blocks.length - 1] ?? '';
  }
  return { stage: chosen, events: chosen === '' ? events : events.filter(event => event.stage === chosen) };
}

export function buildDigestPrompt(
  t: Translate,
  kind: 'today' | 'stage',
  scope: TodayScope | StageScope,
  year: number,
  question: string,
): string {
  if (kind === 'today') {
    const today = scope as TodayScope;
    return t('prompt.today', {
      date: formatDate(today.date),
      matches: digestBlock(today.events, t, { withStage: true }),
      question,
    });
  }
  const stage = scope as StageScope;
  return t('prompt.stage', {
    year,
    stage: stageName(stage.stage, t),
    matches: digestBlock(stage.events, t, { records: true }),
    question,
  });
}

export type { TeamCode };
