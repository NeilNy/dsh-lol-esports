import {
  API_BASE,
  API_KEY,
  DETAIL_TTL,
  LIVE_BASE,
  LIVE_GAME_TTL,
  LIVE_POLL,
  LIVE_TIMEOUT,
  REQUEST_TIMEOUT,
  SCHEDULE_TTL,
  WORLDS_ID,
} from './constants';
import { formatGold } from './format';
import { streamUrl, vodUrl, watchTargets } from './links';
import type {
  Draft,
  DraftPick,
  LiveGameRef,
  LivePlayer,
  LiveSide,
  LiveStats,
  MatchDetailData,
  MatchEvent,
  Team,
  TeamCode,
  TeamRecord,
} from './types';

/** Raw payloads are only shaped by the normalizers below, so they stay untyped. */
type Payload = any;

const scheduleCache: { at: number; events: MatchEvent[] | null } = { at: 0, events: null };
const detailCache = new Map<string, { at: number; detail: MatchDetailData }>();

async function apiGet(path: string, params: Record<string, string>): Promise<Payload> {
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set('hl', 'zh-CN');
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  let failure: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller === null ? null : setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    try {
      const init: RequestInit = { headers: { 'x-api-key': API_KEY } };
      if (controller !== null) init.signal = controller.signal;
      const response = await fetch(url, init);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (reason) {
      failure = reason;
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }
  throw failure instanceof Error ? failure : new Error(String(failure));
}

/** The API reports each team's tournament record; only the numbers matter here. */
function normalizeRecord(record: Payload): TeamRecord | null {
  if (record === null || typeof record !== 'object') return null;
  const wins = record.wins;
  const losses = record.losses;
  if (typeof wins !== 'number' || typeof losses !== 'number') return null;
  return { wins, losses };
}

/** The API hands out http:// asset URLs; the app itself is served over https. */
export function httpsImage(url: unknown): string | null {
  if (typeof url !== 'string' || url === '') return null;
  return url.startsWith('http://') ? `https://${url.slice(7)}` : url;
}

function normalizeTeam(team: Payload): Team {
  const value = team ?? {};
  const code = typeof value.code === 'string' && value.code !== '' ? value.code : 'TBD';
  return {
    id: value.id === undefined || value.id === null ? '' : String(value.id),
    code,
    name: typeof value.name === 'string' ? value.name : '',
    image: httpsImage(value.image),
    score: value.result?.gameWins ?? 0,
    record: normalizeRecord(value.record),
  };
}

export function normalizeEvent(raw: Payload): MatchEvent {
  const match = raw.match ?? {};
  const rawTeams = Array.isArray(match.teams) ? match.teams : [];
  const bestOf = match.strategy?.count ?? 0;
  const teams: [Team, Team] = [normalizeTeam(rawTeams[0]), normalizeTeam(rawTeams[1])];
  /**
   * The schedule keeps a decided series on "inProgress" for a few minutes after
   * the last game, so settle it locally: a best-of is over as soon as one side
   * holds the wins it needs.
   */
  const winsNeeded = bestOf > 0 ? Math.ceil(bestOf / 2) : 0;
  const decided = winsNeeded > 0 && (teams[0].score >= winsNeeded || teams[1].score >= winsNeeded);
  return {
    id: String(match.id),
    start: new Date(raw.startTime),
    state: decided ? 'completed' : typeof raw.state === 'string' ? raw.state : 'unstarted',
    stage: typeof raw.blockName === 'string' ? raw.blockName : '',
    bestOf: bestOf > 0 ? bestOf : 1,
    teams,
  };
}

export async function loadSchedule(force?: boolean): Promise<MatchEvent[]> {
  if (!force && scheduleCache.events !== null && Date.now() - scheduleCache.at < SCHEDULE_TTL) {
    return scheduleCache.events;
  }
  const payload = await apiGet('getSchedule', { leagueId: WORLDS_ID });
  const raw = payload?.data?.schedule?.events;
  const events = (Array.isArray(raw) ? raw : [])
    .filter((item: Payload) => item?.type === 'match' && item.match?.id !== undefined)
    .map(normalizeEvent)
    .sort((a: MatchEvent, b: MatchEvent) => a.start.getTime() - b.start.getTime());
  scheduleCache.at = Date.now();
  scheduleCache.events = events;
  return events;
}

export async function loadDetail(matchId: string): Promise<MatchDetailData> {
  const cached = detailCache.get(matchId);
  if (cached !== undefined && Date.now() - cached.at < DETAIL_TTL) return cached.detail;
  const payload = await apiGet('getEventDetails', { id: matchId });
  const event = payload?.data?.event;
  if (event === undefined || event === null) throw new Error('empty event');
  const teamById = new Map<string, Payload>();
  for (const team of event.match?.teams ?? []) teamById.set(String(team.id), team);
  const games = Array.isArray(event.match?.games) ? event.match.games : [];
  const detail: MatchDetailData = {
    streams: (Array.isArray(event.streams) ? event.streams : [])
      .map((stream: Payload) => ({ url: streamUrl(stream), locale: stream.locale ?? '' }))
      .filter((item: { url: string | null }) => item.url !== null) as MatchDetailData['streams'],
    games: games
      .filter((game: Payload) => game.state === 'completed' || game.state === 'inProgress')
      .map((game: Payload) => {
        const vods = Array.isArray(game.vods) ? game.vods : [];
        return {
          number: game.number,
          id: game.id === undefined || game.id === null ? '' : String(game.id),
          sides: (Array.isArray(game.teams) ? game.teams : []).map((side: Payload) => ({
            side: side.side,
            code: teamById.get(String(side.id))?.code ?? '?',
          })),
          vods: watchTargets(vods, vodUrl),
        };
      }),
  };
  detailCache.set(matchId, { at: Date.now(), detail });
  return detail;
}

// ------------------------------------------------------------------ live stats

const liveGameCache = new Map<string, { at: number; gameId: string | null; teams: TeamCode[] }>();
const liveStatsCache = new Map<string, { at: number; stats: LiveStats | null }>();

/** The in-game feed only knows games, so resolve the match's current game first. */
export async function loadLiveGameId(matchId: string): Promise<LiveGameRef> {
  const cached = liveGameCache.get(matchId);
  if (cached !== undefined && Date.now() - cached.at < LIVE_GAME_TTL) return cached;
  const payload = await apiGet('getEventDetails', { id: matchId });
  const event = payload?.data?.event;
  const games = event?.match?.games;
  const live = Array.isArray(games) ? games.find((game: Payload) => game?.state === 'inProgress') : undefined;
  const gameId = live?.id === undefined || live?.id === null ? null : String(live.id);
  /** Schedule teams carry no ids, so the blue/red mapping has to come from here. */
  const teams: TeamCode[] = (Array.isArray(event?.match?.teams) ? event.match.teams : [])
    .filter((team: Payload) => team?.id !== undefined && team?.id !== null)
    .map((team: Payload) => ({ id: String(team.id), code: typeof team.code === 'string' ? team.code : '' }));
  const entry = { at: Date.now(), gameId, teams };
  liveGameCache.set(matchId, entry);
  return entry;
}

export function sumOf(players: LivePlayer[], key: keyof LivePlayer): number {
  return players.reduce((total, player) => total + (Number(player[key]) || 0), 0);
}

/** One side of a frame, joined with the participant metadata that names it. */
function liveSide(team: Payload, metadata: Payload, metaKey: 'blueTeamMetadata' | 'redTeamMetadata'): LiveSide {
  const roster = new Map<number, Payload>();
  for (const entry of metadata?.[metaKey]?.participantMetadata ?? []) roster.set(entry.participantId, entry);
  const players: LivePlayer[] = (Array.isArray(team?.participants) ? team.participants : []).map((player: Payload) => {
    const info = roster.get(player.participantId) ?? {};
    return {
      id: player.participantId,
      name: typeof info.summonerName === 'string' && info.summonerName !== '' ? info.summonerName : `#${player.participantId}`,
      champion: typeof info.championId === 'string' ? info.championId : '',
      kills: Number(player.kills) || 0,
      deaths: Number(player.deaths) || 0,
      assists: Number(player.assists) || 0,
      cs: Number(player.creepScore) || 0,
    };
  });
  const meta = metadata?.[metaKey] ?? {};
  return {
    teamId: meta.esportsTeamId === undefined || meta.esportsTeamId === null ? '' : String(meta.esportsTeamId),
    kills: Number(team?.totalKills) || sumOf(players, 'kills'),
    gold: Number(team?.totalGold) || 0,
    towers: Number(team?.towers) || 0,
    dragons: Array.isArray(team?.dragons) ? team.dragons.length : 0,
    barons: Number(team?.barons) || 0,
    players,
  };
}

/**
 * The newest frame of a window payload. A game starts at 0/0 with everyone on
 * level 1, so an all-zero frame is real data while it is fresh; Riot's
 * metadata-only frames keep the game's start timestamp, so age tells them apart.
 */
export function normalizeLive(payload: Payload): LiveStats | null {
  const frames = Array.isArray(payload?.frames) ? payload.frames : [];
  const frame = frames[frames.length - 1];
  if (frame === undefined || frame === null) return null;
  const metadata = payload.gameMetadata ?? {};
  const blue = liveSide(frame.blueTeam, metadata, 'blueTeamMetadata');
  const red = liveSide(frame.redTeam, metadata, 'redTeamMetadata');
  if (blue.players.length === 0 && red.players.length === 0) return null;
  const idle =
    blue.kills === 0 && red.kills === 0 &&
    blue.gold === 0 && red.gold === 0 &&
    blue.towers === 0 && red.towers === 0 &&
    sumOf(blue.players, 'cs') === 0 && sumOf(red.players, 'cs') === 0;
  const at = typeof frame.rfc460Timestamp === 'string' ? frame.rfc460Timestamp : null;
  const age = at === null ? Number.POSITIVE_INFINITY : Date.now() - Date.parse(at);
  if (idle && !(age >= 0 && age < 10 * 60 * 1000)) return null;
  return { blue, red, at, state: typeof frame.gameState === 'string' ? frame.gameState : null };
}

/** One window request; null when the feed has nothing for that range. */
async function fetchWindow(gameId: string, startingTime: string | null): Promise<Payload | null> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller === null ? null : setTimeout(() => controller.abort(), LIVE_TIMEOUT);
  try {
    const init: RequestInit = controller === null ? {} : { signal: controller.signal };
    const url = new URL(`${LIVE_BASE}/window/${encodeURIComponent(gameId)}`);
    if (startingTime !== null) url.searchParams.set('startingTime', startingTime);
    const response = await fetch(url, init);
    if (response.status === 204 || !response.ok) return null;
    return await response.json();
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

/**
 * The feed answers with a ten-second window that starts at an aligned stamp and
 * rejects any window whose end is less than 50 seconds old, so the newest
 * pollable window sits about a minute behind the live game. A bare call returns
 * the game's opening frames instead, which is all there is while that window
 * does not exist yet.
 */
// ---------------------------------------------------------------- draft

const draftCache = new Map<string, { at: number; draft: Draft | null }>();

function draftPicks(metadata: Payload, key: 'blueTeamMetadata' | 'redTeamMetadata'): DraftPick[] {
  const list = metadata?.[key]?.participantMetadata;
  if (!Array.isArray(list)) return [];
  return list.map((entry: Payload) => ({
    role: typeof entry.role === 'string' ? entry.role : '',
    champion: typeof entry.championId === 'string' ? entry.championId : '',
    player: typeof entry.summonerName === 'string' ? entry.summonerName : '',
  }));
}

/**
 * Picks for one game. The livestats metadata carries each player's champion and
 * role; Riot's public feeds expose no bans, so this is picks only.
 */
export function normalizeDraft(metadata: Payload): Draft | null {
  const blue = draftPicks(metadata, 'blueTeamMetadata');
  const red = draftPicks(metadata, 'redTeamMetadata');
  if (blue.length === 0 && red.length === 0) return null;
  return { blue, red };
}

export async function loadDraft(gameId: string): Promise<Draft | null> {
  if (gameId === '') return null;
  const cached = draftCache.get(gameId);
  if (cached !== undefined && Date.now() - cached.at < 30 * 60 * 1000) return cached.draft;
  let payload: Payload | null = null;
  try {
    payload = await fetchWindow(gameId, null);
  } catch {
    payload = null;
  }
  const draft = payload === null ? null : normalizeDraft(payload.gameMetadata);
  draftCache.set(gameId, { at: Date.now(), draft });
  return draft;
}

const DD_BASE = 'https://ddragon.leagueoflegends.com/cdn';
const DD_FALLBACK = '16.22.1';
let championVersion: string | null = null;

/** Riot's Data Dragon hosts the portraits; the version lookup happens once. */
export async function championImageUrl(champion: string): Promise<string | null> {
  const id = champion.replace(/[^A-Za-z0-9]/g, '');
  if (id === '') return null;
  if (championVersion === null) {
    try {
      const response = await fetch(`${DD_BASE}/api/versions.json`);
      const versions = await response.json();
      championVersion = Array.isArray(versions) && versions.length > 0 ? String(versions[0]) : DD_FALLBACK;
    } catch {
      championVersion = DD_FALLBACK;
    }
  }
  return `${DD_BASE}/${championVersion}/img/champion/${id}.png`;
}

export async function loadLiveStats(gameId: string): Promise<LiveStats | null> {
  const cached = liveStatsCache.get(gameId);
  if (cached !== undefined && Date.now() - cached.at < LIVE_POLL) return cached.stats;
  const step = 10 * 1000;
  const latest = Math.floor((Date.now() - 70 * 1000) / step) * step;
  const startingTime = new Date(latest).toISOString().replace(/\.\d{3}Z$/, 'Z');
  let payload = await fetchWindow(gameId, startingTime);
  if (payload === null) payload = await fetchWindow(gameId, null);
  const stats = payload === null ? null : normalizeLive(payload);
  liveStatsCache.set(gameId, { at: Date.now(), stats });
  return stats;
}

export { formatGold };
