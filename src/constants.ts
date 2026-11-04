/** Endpoints, identifiers and timings shared by the data and formatting layers. */

/** Public lolesports web key; replace here if Riot rotates it. */
export const API_KEY = '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z';
export const API_BASE = 'https://esports-api.lolesports.com/persisted/gw';
export const LIVE_BASE = 'https://feed.lolesports.com/livestats/v1';
export const WORLDS_ID = '98767975604431411';
/** Slot keys used when registering the panel and its sidebar entry. */
export const PANEL_ID = 'lol';
/** Synthetic ask-state id so the tournament-level box never collides with a match id. */
export const DIGEST_ASK_ID = '__digest__';
export const OFFICIAL_URL = 'https://lolesports.com/live/worlds';
export const SITE_URL = 'https://lolesports.com/en-US';

export const REQUEST_TIMEOUT = 12000;
export const SCHEDULE_TTL = 60 * 1000;
export const DETAIL_TTL = 10 * 60 * 1000;
export const REFRESH_INTERVAL = 60 * 1000;

/** In-game counters come from the livestats feed, one window per game. */
export const LIVE_POLL = 20 * 1000;
export const LIVE_GAME_TTL = 60 * 1000;
export const LIVE_TIMEOUT = 10000;

/** Two Worlds editions are always months apart; stages inside one are days apart. */
export const EDITION_GAP = 14 * 24 * 60 * 60 * 1000;
