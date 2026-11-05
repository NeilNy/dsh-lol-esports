import { loadDetail, loadLiveGameId, loadLiveStats, loadSchedule } from './api';
import { DIGEST_ASK_ID, LIVE_POLL, OFFICIAL_URL, REFRESH_INTERVAL, SITE_URL } from './constants';
import {
  buildDigestPrompt,
  currentEdition,
  describe,
  displayName,
  formatClock,
  formatDay,
  formatGold,
  groupByDay,
  anchorDayIndex,
  orderDayGroups,
  resolveStageScope,
  resolveTodayScope,
  stageName,
  stateLabel,
  type StageScope,
  type TodayScope,
} from './format';
import { localeGroup, localizedTargets } from './links';
import { getReact, h } from './runtime';
import { ensureStyles } from './styles';
import type {
  AskResult,
  LiveStats,
  MatchDetailData,
  MatchEvent,
  Team,
  TeamCode,
  Translate,
} from './types';

const KIND_LIVE = 'inProgress';
const KIND_DONE = 'completed';
const KIND_UPCOMING = 'unstarted';

/** Sidebar glyph: the Worlds trophy at the size the sidebar asks for. */
export function WorldsIcon({ size, active }: { size: number; active: boolean }) {
  ensureStyles();
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 1.6 : 1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: 'block' }}
    >
      <path d="M8.5 3.5h7V9a3.5 3.5 0 0 1-7 0V3.5z" />
      <path d="M8.5 5H5.5v1.5a3.5 3.5 0 0 0 3 3.46" />
      <path d="M15.5 5h3v1.5a3.5 3.5 0 0 1-3 3.46" />
      <path d="M12 12.5V16" />
      <path d="M8.5 20.5h7" />
      <path d="M9.5 20.5v-1.5a2.5 2.5 0 0 1 5 0v1.5" />
    </svg>
  );
}

/** Team badge with a text fallback when the logo is missing or fails. */
function TeamMark({ team }: { team: Team }) {
  const { useState } = getReact();
  const [broken, setBroken] = useState(false);
  if (team.image === null || broken) {
    return (
      <span className="lol-mark lol-mark--text" aria-hidden="true">
        {team.code}
      </span>
    );
  }
  return <img className="lol-mark" src={team.image} alt="" loading="lazy" onError={() => setBroken(true)} />;
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a className="lol-btn" href={href} target="_blank" rel="noreferrer noopener">
      {label}
      <span aria-hidden="true">↗</span>
    </a>
  );
}

interface AskBoxProps {
  t: Translate;
  match: MatchEvent;
  onSubmit: (question: string) => void;
  pending: boolean;
  error: string | null;
}

function AskBox({ t, match, onSubmit, pending, error }: AskBoxProps) {
  const { useState } = getReact();
  const [text, setText] = useState('');
  const quickKeys = [
    match.state === KIND_DONE ? 'ask.quick.recap' : 'ask.quick.preview',
    'ask.quick.draft',
    'ask.quick.watch',
  ];
  const submit = (question?: string) => {
    const value = (question ?? text).trim();
    if (value === '' || pending) return;
    onSubmit(value);
  };
  const onKeyDown = (event: any) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setText('');
    }
  };
  return (
    <div className="lol-ask">
      <h3 className="lol-sectionTitle">{t('ask.title')}</h3>
      <div className="lol-askQuick">
        {quickKeys.map(key => (
          <button key={key} type="button" className="lol-chip" disabled={pending} onClick={() => submit(t(key))}>
            {t(key)}
          </button>
        ))}
      </div>
      <textarea
        className="lol-askInput"
        rows={2}
        value={text}
        placeholder={t('ask.placeholder')}
        disabled={pending}
        onChange={(event: any) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="lol-askFoot">
        <span className="lol-hint">{t('ask.hint')}</span>
        <button
          type="button"
          className="lol-btn lol-btn--primary"
          disabled={pending || text.trim() === ''}
          onClick={() => submit()}
        >
          {pending ? t('ask.sending') : t('ask.send')}
        </button>
      </div>
      {error !== null && (
        <p className="lol-error" role="alert">
          {t('ask.failed', { message: error })}
        </p>
      )}
    </div>
  );
}

interface DigestAskProps {
  t: Translate;
  today: TodayScope | null;
  stage: StageScope;
  onSubmit: (kind: 'today' | 'stage', question: string) => void;
  pending: boolean;
  error: string | null;
}

/** Tournament-level ask box: a day's results, or how a stage plays out from here. */
function DigestAsk({ t, today, stage, onSubmit, pending, error }: DigestAskProps) {
  const { useState } = getReact();
  const [scope, setScope] = useState(today === null ? 'stage' : 'today');
  const [text, setText] = useState('');
  const canToday = today !== null;
  const canStage = stage.stage !== '';
  if (!canToday && !canStage) return null;
  const active: 'today' | 'stage' = scope === 'today' && canToday ? 'today' : 'stage';
  const stageLabel = stageName(stage.stage, t);
  const quickKeys = active === 'today'
    ? ['ask.quick.today.1', 'ask.quick.today.2']
    : ['ask.quick.stage.1', 'ask.quick.stage.2'];
  const submit = (question?: string) => {
    const value = (question ?? text).trim();
    if (value === '' || pending) return;
    onSubmit(active, value);
  };
  const onKeyDown = (event: any) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setText('');
    }
  };
  return (
    <div className="lol-digest">
      <div className="lol-digestTop">
        <h3 className="lol-digestTitle">{t('ask.digest.title')}</h3>
        <div className="lol-digestScopes" role="group" aria-label={t('ask.digest.scope')}>
          {canToday && (
            <button
              type="button"
              className="lol-chip"
              aria-pressed={active === 'today'}
              onClick={() => setScope('today')}
            >
              {today.isToday ? t('ask.digest.today') : t('ask.digest.lastDay')}
            </button>
          )}
          {canStage && (
            <button
              type="button"
              className="lol-chip"
              aria-pressed={active === 'stage'}
              onClick={() => setScope('stage')}
            >
              {stageLabel}
            </button>
          )}
        </div>
      </div>
      <div className="lol-askQuick">
        {quickKeys.map(key => (
          <button
            key={key}
            type="button"
            className="lol-chip"
            disabled={pending}
            onClick={() => submit(t(key, { stage: stageLabel }))}
          >
            {t(key, { stage: stageLabel })}
          </button>
        ))}
      </div>
      <textarea
        className="lol-askInput"
        rows={2}
        value={text}
        placeholder={t('ask.placeholder')}
        disabled={pending}
        onChange={(event: any) => setText(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="lol-askFoot">
        <span className="lol-hint">{t('ask.digest.hint')}</span>
        <button
          type="button"
          className="lol-btn lol-btn--primary"
          disabled={pending || text.trim() === ''}
          onClick={() => submit()}
        >
          {pending ? t('ask.sending') : t('ask.send')}
        </button>
      </div>
      {error !== null && (
        <p className="lol-error" role="alert">
          {t('ask.failed', { message: error })}
        </p>
      )}
    </div>
  );
}

/** Per-match detail: watch links and the games that were actually played. */
function MatchDetail({ t, match, lang }: { t: Translate; match: MatchEvent; lang: string }) {
  const { useState, useEffect } = getReact();
  const [state, setState] = useState<{ status: string; detail: MatchDetailData | null; error: string | null }>({
    status: 'loading',
    detail: null,
    error: null,
  });
  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading', detail: null, error: null });
    loadDetail(match.id).then(detail => {
      if (!cancelled) setState({ status: 'ready', detail, error: null });
    }).catch((reason: unknown) => {
      if (!cancelled) setState({ status: 'error', detail: null, error: describe(reason) });
    });
    return () => { cancelled = true; };
  }, [match.id]);

  const detail = state.detail;
  const first = detail !== null && detail.games.length > 0 ? detail.games[0] : null;
  const linkLabel = (locale: string) => (localeGroup(locale) === 'en' ? t('links.replayEn') : t('links.replay'));
  const links: { href: string; label: string }[] = [];
  const seen = new Set<string>();
  const push = (href: string | null | undefined, label: string) => {
    if (typeof href !== 'string' || href === '' || seen.has(href)) return;
    seen.add(href);
    links.push({ href, label });
  };
  push(OFFICIAL_URL, t('links.official'));
  if (detail !== null && detail.streams.length > 0) {
    const stream = localizedTargets(detail.streams, lang)[0] ?? detail.streams[0];
    push(stream.url, t('links.live'));
  }
  if (first !== null) {
    for (const vod of localizedTargets(first.vods, lang)) push(vod.href, linkLabel(vod.locale));
  }

  return (
    <div className="lol-detail">
      <div className="lol-section">
        <h3 className="lol-sectionTitle">{t('links')}</h3>
        <div className="lol-links">
          {links.map(link => <LinkButton key={link.href} href={link.href} label={link.label} />)}
        </div>
        {state.status === 'error' && (
          <p className="lol-error" role="alert">
            {t('error')}
          </p>
        )}
      </div>
      {detail !== null && detail.games.length > 0 && (
        <div className="lol-section">
          <h3 className="lol-sectionTitle">{t('games')}</h3>
          <ul className="lol-games">
            {detail.games.map(game => (
              <li key={game.number} className="lol-game">
                <span className="lol-gameNo">{t('game', { n: game.number })}</span>
                <span className="lol-gameSides">
                  {game.sides.map(side => `${side.code} (${t(`side.${side.side}`)})`).join(' vs ')}
                </span>
                <span className="lol-gameLinks">
                  {localizedTargets(game.vods, lang).map(vod => (
                    <LinkButton key={vod.href} href={vod.href} label={linkLabel(vod.locale)} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** A value keyed by itself, so a changed number replays the roll animation. */
function Roll({ value }: { value: string | number }) {
  return (
    <span key={String(value)} className="lol-roll">
      {String(value)}
    </span>
  );
}

interface LiveState {
  status: 'loading' | 'ready' | 'empty';
  stats: LiveStats | null;
  teams?: TeamCode[];
}

/** In-game counters for the match being played, polled only while it is live. */
function LiveStrip({ t, match }: { t: Translate; match: MatchEvent }) {
  const { useState, useEffect } = getReact();
  const [state, setState] = useState<LiveState>({ status: 'loading', stats: null });

  useEffect(() => {
    if (match.state !== KIND_LIVE) return undefined;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const tick = async () => {
      try {
        const live = await loadLiveGameId(match.id);
        if (cancelled) return;
        if (live.gameId === null) {
          setState({ status: 'empty', stats: null, teams: live.teams });
          return;
        }
        const stats = await loadLiveStats(live.gameId);
        if (cancelled) return;
        setState(stats === null
          ? { status: 'empty', stats: null, teams: live.teams }
          : { status: 'ready', stats, teams: live.teams });
      } catch {
        if (!cancelled) setState({ status: 'empty', stats: null });
      }
    };
    void tick();
    timer = setInterval(() => { void tick(); }, LIVE_POLL);
    return () => {
      cancelled = true;
      if (timer !== null) clearInterval(timer);
    };
  }, [match.id, match.state]);

  /** The frame timestamp is fixed between polls, so tick to keep the lag honest. */
  const [, setClock] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setClock((value: number) => value + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (match.state !== KIND_LIVE) return null;
  if (state.status !== 'ready' || state.stats === null) return null;

  const { blue, red } = state.stats;
  const finished = state.stats.state === 'finished';
  const lag = finished || state.stats.at === null
    ? null
    : Math.max(0, Math.round((Date.now() - Date.parse(state.stats.at)) / 1000));
  /** Sides arrive as blue/red; the event details know the codes, so join on team id. */
  const codeOf = (teamId: string, fallbackKey: string) => {
    const team = (state.teams ?? []).find(item => item.id === teamId);
    return team === undefined || team.code === '' ? t(fallbackKey) : team.code;
  };
  const metric = (label: string, left: string | number, right: string | number) => (
    <span key={label} className="lol-liveMetric">
      {`${label} `}
      <b><Roll value={left} /> : <Roll value={right} /></b>
    </span>
  );
  const column = (players: LiveStats['blue']['players'], code: string) => (
    <div className="lol-liveTeam">
      {players.map(player => (
        <div key={player.id} className="lol-livePlayer">
          <span className="lol-liveName" title={player.champion === '' ? player.name : `${player.name} · ${player.champion}`}>
            {displayName(player.name, code)}
          </span>
          <span className="lol-liveKda">{`${player.kills}/${player.deaths}/${player.assists}`}</span>
          <span className="lol-liveCs" title={t('live.cs')}>{String(player.cs)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="lol-live">
      <div className="lol-liveTop">
        <div className="lol-liveKills">
          <span className="lol-liveKillLabel">{t('live.kills')}</span>
          <span className="lol-liveTeamCode">{codeOf(blue.teamId, 'side.blue')}</span>
          <b><Roll value={`${blue.kills} : ${red.kills}`} /></b>
          <span className="lol-liveTeamCode">{codeOf(red.teamId, 'side.red')}</span>
        </div>
        <div className="lol-liveMeta">
          {metric(t('live.gold'), formatGold(blue.gold), formatGold(red.gold))}
          {metric(t('live.towers'), blue.towers, red.towers)}
          {metric(t('live.dragons'), blue.dragons, red.dragons)}
          {metric(t('live.barons'), blue.barons, red.barons)}
          {finished
            ? <span className="lol-liveFinished" title={t('live.finishedHint')}>{t('live.finished')}</span>
            : lag === null
              ? null
              : <span className="lol-liveLag" title={t('live.lagHint')}>{t('live.lag', { seconds: lag })}</span>}
        </div>
      </div>
      <div className="lol-livePlayers">
        {column(blue.players, codeOf(blue.teamId, 'side.blue'))}
        {column(red.players, codeOf(red.teamId, 'side.red'))}
      </div>
    </div>
  );
}

interface CardProps {
  match: MatchEvent;
  t: Translate;
  lang: string;
  expanded: boolean;
  onToggle: () => void;
  askOpen: boolean;
  onAskOpen: (open: boolean) => void;
  onSubmitAsk: (question: string) => void;
  askPending: boolean;
  askError: string | null;
}

function MatchCard(props: CardProps) {
  const { match, t, lang, expanded, onToggle, askOpen, onAskOpen, onSubmitAsk, askPending, askError } = props;
  const home = match.teams[0];
  const away = match.teams[1];
  const done = match.state === KIND_DONE;
  const winner = done ? (home.score > away.score ? 0 : away.score > home.score ? 1 : -1) : -1;
  const tone = match.state === KIND_LIVE ? 'live' : done ? 'done' : 'upcoming';
  return (
    <article className="lol-card" data-state={match.state}>
      <div className="lol-cardTop">
        {match.stage !== '' && <span className="lol-stage">{stageName(match.stage, t)}</span>}
        <span className="lol-bo">{t('bo', { n: match.bestOf })}</span>
        <span className={`lol-badge lol-badge--${tone}`}>{stateLabel(match.state, t)}</span>
        <time className="lol-clock" dateTime={match.start.toISOString()}>{formatClock(match.start)}</time>
      </div>
      <div className="lol-cardMain">
        <div className="lol-sides">
          <div className={`lol-side lol-side--home${winner === 1 ? ' lol-side--lost' : ''}`}>
            <TeamMark team={home} />
            <span className="lol-teamText">
              <b className="lol-code">{home.code}</b>
            </span>
          </div>
          <div className="lol-score">
            {match.state === KIND_UPCOMING ? 'VS' : `${home.score} : ${away.score}`}
          </div>
          <div className={`lol-side lol-side--away${winner === 0 ? ' lol-side--lost' : ''}`}>
            <span className="lol-teamText">
              <b className="lol-code">{away.code}</b>
            </span>
            <TeamMark team={away} />
          </div>
        </div>
        <div className="lol-actions">
          <LinkButton href={done ? SITE_URL : OFFICIAL_URL} label={done ? t('links.official') : t('watch')} />
          <button type="button" className="lol-btn" aria-expanded={askOpen} onClick={() => onAskOpen(!askOpen)}>
            {t('ask')}
          </button>
          <button type="button" className="lol-btn" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? t('detail.hide') : t('detail')}
          </button>
        </div>
      </div>
      {match.state === KIND_LIVE && <LiveStrip t={t} match={match} />}
      {askOpen && <AskBox t={t} match={match} onSubmit={onSubmitAsk} pending={askPending} error={askError} />}
      {expanded && <MatchDetail t={t} match={match} lang={lang} />}
    </article>
  );
}

export interface PageProps {
  t: Translate;
  getLang: () => string;
  askMatch: (match: MatchEvent, question: string, year: number) => Promise<AskResult>;
  askText: (text: string) => Promise<AskResult>;
}

/** The panel: schedule and results, one card per match. */
export function WorldsPage(props: PageProps) {
  ensureStyles();
  const { t } = props;
  const { useState, useEffect, useCallback, useMemo, useRef } = getReact();
  /** Watch links follow the interface language, so read it on every render. */
  const lang = props.getLang();
  const mounted = useRef(true);
  const scroller = useRef<any>(null);
  const anchorSection = useRef<any>(null);
  const jumped = useRef(false);
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('loading');
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [askId, setAskId] = useState<string | null>(null);
  const [digestOpen, setDigestOpen] = useState(false);
  const [ask, setAsk] = useState<{ id: string | null; pending: boolean; error: string | null }>({
    id: null,
    pending: false,
    error: null,
  });

  useEffect(() => () => { mounted.current = false; }, []);

  const load = useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
    const opts = options ?? {};
    if (opts.silent !== true) {
      setStatus('loading');
      setError(null);
    }
    try {
      const next = await loadSchedule(opts.force === true);
      if (!mounted.current) return;
      setEvents(next);
      setStatus('ready');
      setError(null);
    } catch (reason) {
      if (!mounted.current) return;
      setStatus((current: string) => (current === 'ready' ? 'ready' : 'error'));
      setError(describe(reason));
    }
  }, []);

  useEffect(() => { void load({}); }, [load]);
  useEffect(() => {
    const timer = setInterval(() => { void load({ silent: true }); }, REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [load]);

  const edition = useMemo(() => currentEdition(events), [events]);
  const year = edition.length > 0 ? edition[0].start.getFullYear() : new Date().getFullYear();
  const stages = useMemo(() => {
    const seen: string[] = [];
    for (const event of edition) {
      if (event.stage !== '' && !seen.includes(event.stage)) seen.push(event.stage);
    }
    return seen;
  }, [edition]);

  const filtered = useMemo(
    () => (stage === '' ? edition : edition.filter((event: MatchEvent) => event.stage === stage)),
    [edition, stage],
  );
  const live = useMemo(() => filtered.filter((event: MatchEvent) => event.state === KIND_LIVE), [filtered]);
  const upcoming = useMemo(
    () => filtered.filter((event: MatchEvent) => event.state === KIND_UPCOMING)
      .sort((a: MatchEvent, b: MatchEvent) => a.start.getTime() - b.start.getTime()),
    [filtered],
  );
  const completed = useMemo(
    () => filtered.filter((event: MatchEvent) => event.state === KIND_DONE)
      .sort((a: MatchEvent, b: MatchEvent) => b.start.getTime() - a.start.getTime()),
    [filtered],
  );
  /**
   * One merged list: every match of the edition, grouped by day, with today's
   * group first whether or not those matches have been played. Upcoming days
   * follow in order, then earlier days newest-first.
   */
  const groups = useMemo(
    () => orderDayGroups(groupByDay([...filtered].sort((a: MatchEvent, b: MatchEvent) => a.start.getTime() - b.start.getTime()))),
    [filtered],
  );
  const todayScope = useMemo(() => resolveTodayScope(edition), [edition]);
  const stageScope = useMemo(() => resolveStageScope(edition, stage), [edition, stage]);
  const digestReady = todayScope !== null || stageScope.stage !== '';

  /** Open on today's group instead of the top of the timeline. */
  useEffect(() => {
    if (jumped.current || status !== 'ready') return;
    const el = scroller.current;
    const target = anchorSection.current;
    if (el === null || target === null) return;
    const delta = target.getBoundingClientRect().top - el.getBoundingClientRect().top;
    if (Number.isFinite(delta)) el.scrollTop += delta;
    jumped.current = true;
  }, [status, groups.length, stage]);

  useEffect(() => {
    jumped.current = false;
  }, [stage]);

  const submitAsk = useCallback(async (match: MatchEvent, question: string) => {
    setAsk({ id: match.id, pending: true, error: null });
    const result = await props.askMatch(match, question, year);
    if (!mounted.current) return;
    if (result.ok) {
      setAsk({ id: null, pending: false, error: null });
      setAskId(null);
      return;
    }
    setAsk({ id: match.id, pending: false, error: result.message ?? 'unknown' });
  }, [props.askMatch, year]);

  const submitDigest = useCallback(async (kind: 'today' | 'stage', question: string) => {
    const scope = kind === 'today' ? todayScope : stageScope;
    if (scope === null) return;
    setAsk({ id: DIGEST_ASK_ID, pending: true, error: null });
    const result = await props.askText(buildDigestPrompt(t, kind, scope, year, question));
    if (!mounted.current) return;
    if (result.ok) {
      setAsk({ id: null, pending: false, error: null });
      return;
    }
    setAsk({ id: DIGEST_ASK_ID, pending: false, error: result.message ?? 'unknown' });
  }, [props.askText, stageScope, t, todayScope, year]);

  const renderCard = (match: MatchEvent) => (
    <MatchCard
      key={match.id}
      match={match}
      t={t}
      lang={lang}
      expanded={expandedId === match.id}
      onToggle={() => setExpandedId((current: string | null) => (current === match.id ? null : match.id))}
      askOpen={askId === match.id}
      onAskOpen={(open: boolean) => setAskId(open ? match.id : null)}
      onSubmitAsk={(question: string) => { void submitAsk(match, question); }}
      askPending={ask.pending && ask.id === match.id}
      askError={ask.id === match.id ? ask.error : null}
    />
  );

  const anchorIndex = useMemo(() => anchorDayIndex(groups), [groups]);
  const summary = t('summary', { done: completed.length, open: upcoming.length + live.length });
  const noEdition = status === 'ready' && edition.length === 0;

  return (
    <div className="lol-page">
      <div className="lol-head">
        <div className="lol-headInner">
          <div className="lol-titleRow">
            <div className="lol-heading">
              <h1 className="lol-title">{t('title')}</h1>
              <p className="lol-sub">
                {edition.length > 0 ? `${t('edition', { year })} · ${summary}` : t('intro')}
              </p>
            </div>
            <div className="lol-toolbar">
              {digestReady && (
                <button
                  type="button"
                  className="lol-btn"
                  aria-expanded={digestOpen}
                  onClick={() => setDigestOpen((open: boolean) => !open)}
                >
                  {t('ask.digest.button')}
                </button>
              )}
              <button
                type="button"
                className="lol-btn"
                disabled={status === 'loading'}
                onClick={() => { void load({ force: true }); }}
              >
                {t('refresh')}
              </button>
            </div>
          </div>
          {stages.length > 1 && (
            <div className="lol-chips" role="group" aria-label={t('stage.label')}>
              {[{ key: '', label: t('stage.all') }]
                .concat(stages.map(value => ({ key: value, label: stageName(value, t) })))
                .map(item => (
                  <button
                    key={item.key === '' ? 'all' : item.key}
                    type="button"
                    className="lol-chip"
                    aria-pressed={stage === item.key}
                    onClick={() => setStage(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
      <div className="lol-scroll" ref={scroller}>
        <div className="lol-scrollInner">
          {digestOpen && (
            <DigestAsk
              t={t}
              today={todayScope}
              stage={stageScope}
              onSubmit={(kind: 'today' | 'stage', question: string) => { void submitDigest(kind, question); }}
              pending={ask.pending && ask.id === DIGEST_ASK_ID}
              error={ask.id === DIGEST_ASK_ID ? ask.error : null}
            />
          )}
          {status === 'loading' && <p className="lol-hint">{t('loading')}</p>}
          {error !== null && (
            <div className="lol-errorRow" role="alert">
              <span>{t('error')}</span>
              <button type="button" className="lol-btn" onClick={() => { void load({ force: true }); }}>
                {t('retry')}
              </button>
            </div>
          )}
          {groups.map((group, index) => (
            <section
              key={group.key}
              className="lol-day"
              ref={index === anchorIndex ? anchorSection : undefined}
            >
              <h2 className="lol-dayLabel">{formatDay(group.date, t)}</h2>
              {group.items.map(renderCard)}
            </section>
          ))}
          {status === 'ready' && groups.length === 0 && (
            <div className="lol-empty">
              <p className="lol-emptyTitle">{noEdition ? t('empty.offSeason') : t('empty')}</p>
              <a
                className="lol-btn"
                href={noEdition ? OFFICIAL_URL : SITE_URL}
                target="_blank"
                rel="noreferrer noopener"
              >
                {t('empty.official')}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
