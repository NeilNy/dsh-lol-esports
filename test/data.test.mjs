import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeEvent, normalizeLive } from '../.tmp/api.js';
import { displayName, formatGold } from '../.tmp/format.js';

const event = (state, bestOf, homeWins, awayWins) => normalizeEvent({
  state,
  startTime: '2026-11-04T22:00:00Z',
  blockName: '半决赛',
  match: {
    id: 1,
    strategy: { count: bestOf },
    teams: [{ code: 'IG', result: { gameWins: homeWins } }, { code: 'TES', result: { gameWins: awayWins } }],
  },
});

test('a decided best-of settles locally even while the feed says inProgress', () => {
  assert.equal(event('inProgress', 5, 2, 1).state, 'inProgress');
  assert.equal(event('inProgress', 5, 3, 1).state, 'completed');
  assert.equal(event('inProgress', 3, 2, 0).state, 'completed');
  assert.equal(event('inProgress', 1, 1, 0).state, 'completed');
  assert.equal(event('unstarted', 5, 0, 0).state, 'unstarted');
  assert.equal(event('unstarted', 0, 0, 0).bestOf, 1);
});

test('summoner names lose only a real team-code prefix', () => {
  assert.equal(displayName('IG TheShy', 'IG'), 'TheShy');
  assert.equal(displayName('TES 369', 'TES'), '369');
  assert.equal(displayName('T1 Faker', 't1'), 'Faker');
  assert.equal(displayName('Hans Sama', 'KC'), 'Hans Sama');
  assert.equal(displayName('Faker', 'T1'), 'Faker');
});

test('gold is shortened only past a thousand', () => {
  assert.equal(formatGold(45210), '45.2k');
  assert.equal(formatGold(900), '900');
  assert.equal(formatGold(0), '0');
});

const frame = (over) => ({
  frames: [{
    rfc460Timestamp: new Date().toISOString(),
    gameState: 'in_game',
    blueTeam: { totalGold: 1200, totalKills: 2, towers: 1, barons: 0, dragons: [], participants: [{ participantId: 1, kills: 2, creepScore: 30 }] },
    redTeam: { totalGold: 1100, totalKills: 1, towers: 0, barons: 0, dragons: [], participants: [{ participantId: 6, kills: 1, creepScore: 20 }] },
    ...over,
  }],
});

test('live frames keep their game state', () => {
  const stats = normalizeLive(frame({ gameState: 'finished' }));
  assert.equal(stats.state, 'finished');
  assert.equal(stats.blue.kills, 2);
  assert.equal(stats.red.gold, 1100);
});

test('an all-zero frame is hidden once it is stale', () => {
  const zero = {
    blueTeam: { totalGold: 0, totalKills: 0, towers: 0, barons: 0, dragons: [], participants: [{ participantId: 1 }] },
    redTeam: { totalGold: 0, totalKills: 0, towers: 0, barons: 0, dragons: [], participants: [{ participantId: 6 }] },
  };
  // A game starts at 0/0, so a fresh zero frame is real data and must render.
  const fresh = normalizeLive(frame(zero));
  assert.equal(fresh.blue.kills, 0);
  assert.equal(fresh.red.gold, 0);
  // The same frame an hour later can only be Riot's metadata-only stub.
  const stale = frame({ ...zero, rfc460Timestamp: new Date(Date.now() - 3600 * 1000).toISOString() });
  assert.equal(normalizeLive(stale), null);
});
