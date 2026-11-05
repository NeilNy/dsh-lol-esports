"use strict";
(() => {
  // src/constants.ts
  var API_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";
  var API_BASE = "https://esports-api.lolesports.com/persisted/gw";
  var LIVE_BASE = "https://feed.lolesports.com/livestats/v1";
  var WORLDS_ID = "98767975604431411";
  var PANEL_ID = "lol";
  var DIGEST_ASK_ID = "__digest__";
  var OFFICIAL_URL = "https://lolesports.com/live/worlds";
  var SITE_URL = "https://lolesports.com/en-US";
  var REQUEST_TIMEOUT = 12e3;
  var SCHEDULE_TTL = 60 * 1e3;
  var DETAIL_TTL = 10 * 60 * 1e3;
  var REFRESH_INTERVAL = 60 * 1e3;
  var LIVE_POLL = 20 * 1e3;
  var LIVE_GAME_TTL = 60 * 1e3;
  var LIVE_TIMEOUT = 1e4;
  var EDITION_GAP = 14 * 24 * 60 * 60 * 1e3;

  // src/format.ts
  function currentEdition(events) {
    let start = 0;
    for (let index = events.length - 1; index > 0; index -= 1) {
      if (events[index].start.getTime() - events[index - 1].start.getTime() > EDITION_GAP) {
        start = index;
        break;
      }
    }
    return events.slice(start);
  }
  function dayKey(date) {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }
  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
  function orderDayGroups(groups, now = /* @__PURE__ */ new Date()) {
    const todayStart = startOfDay(now).getTime();
    const stamped = groups.map((group) => ({ group, day: startOfDay(group.date).getTime() }));
    const today = stamped.filter((item) => item.day === todayStart);
    const future = stamped.filter((item) => item.day > todayStart).sort((a, b) => a.day - b.day);
    const past = stamped.filter((item) => item.day < todayStart).sort((a, b) => b.day - a.day);
    return [...today, ...future, ...past].map((item) => item.group);
  }
  function groupByDay(events) {
    const groups = [];
    let current = null;
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
  function uiLang() {
    if (typeof document !== "undefined") {
      const lang = document.documentElement.getAttribute("lang");
      if (typeof lang === "string" && lang !== "") return lang;
    }
    if (typeof navigator !== "undefined" && typeof navigator.language === "string") return navigator.language;
    return "zh-CN";
  }
  var dayFormatters = /* @__PURE__ */ new Map();
  function formatDay(date, t) {
    const lang = uiLang();
    let formatter = dayFormatters.get(lang);
    if (formatter === void 0) {
      formatter = new Intl.DateTimeFormat(lang, { month: "short", day: "numeric", weekday: "short" });
      dayFormatters.set(lang, formatter);
    }
    const label = formatter.format(date);
    const offset = Math.round((startOfDay(date).getTime() - startOfDay(/* @__PURE__ */ new Date()).getTime()) / 864e5);
    if (offset === 0) return `${t("time.today")} \xB7 ${label}`;
    if (offset === 1) return `${t("time.tomorrow")} \xB7 ${label}`;
    return label;
  }
  var clockFormatters = /* @__PURE__ */ new Map();
  function formatClock(date) {
    const lang = uiLang();
    let formatter = clockFormatters.get(lang);
    if (formatter === void 0) {
      formatter = new Intl.DateTimeFormat(lang, { hour: "2-digit", minute: "2-digit" });
      clockFormatters.set(lang, formatter);
    }
    return formatter.format(date);
  }
  function formatFull(date) {
    return new Intl.DateTimeFormat(uiLang(), { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  function describe(reason) {
    return reason instanceof Error ? reason.message : String(reason);
  }
  function mintRequestId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `lol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function stateLabel(state, t) {
    if (state === "inProgress") return t("state.live");
    if (state === "completed") return t("state.done");
    return t("state.upcoming");
  }
  var STAGE_KEYS = {
    "\u5165\u56F4\u8D5B": "stage.playin",
    "\u745E\u58EB\u8F6E": "stage.swiss",
    "\u56DB\u5206\u4E4B\u4E00\u51B3\u8D5B": "stage.quarter",
    "\u534A\u51B3\u8D5B": "stage.semi",
    "\u51B3\u8D5B": "stage.final"
  };
  function stageName(block, t) {
    const key = STAGE_KEYS[block];
    return key === void 0 ? block : t(key);
  }
  function displayName(name, code) {
    const value = typeof name === "string" ? name : "";
    const prefix = typeof code === "string" ? code.trim() : "";
    if (prefix === "" || value === "") return value;
    const cut = value.indexOf(" ");
    if (cut === -1) return value;
    if (value.slice(0, cut).toLowerCase() !== prefix.toLowerCase()) return value;
    const rest = value.slice(cut + 1).trim();
    return rest === "" ? value : rest;
  }
  function formatGold(value) {
    const gold = Number(value) || 0;
    return gold >= 1e3 ? `${(gold / 1e3).toFixed(1)}k` : String(gold);
  }
  function buildPrompt(t, match, question, year) {
    const home = match.teams[0];
    const away = match.teams[1];
    return t("prompt.template", {
      event: t("edition", { year }),
      stage: match.stage === "" ? "-" : stageName(match.stage, t),
      home: home.name === "" ? home.code : `${home.name} (${home.code})`,
      away: away.name === "" ? away.code : `${away.name} (${away.code})`,
      format: t("bo", { n: match.bestOf }),
      time: formatFull(match.start),
      state: stateLabel(match.state, t),
      score: match.state === "unstarted" ? "-" : `${home.score} : ${away.score}`,
      link: OFFICIAL_URL,
      question
    });
  }
  var stampFormatters = /* @__PURE__ */ new Map();
  function stamp(date) {
    const lang = uiLang();
    let formatter = stampFormatters.get(lang);
    if (formatter === void 0) {
      formatter = new Intl.DateTimeFormat(lang, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
      stampFormatters.set(lang, formatter);
    }
    return formatter.format(date);
  }
  function formatDate(date) {
    return new Intl.DateTimeFormat(uiLang(), { dateStyle: "medium" }).format(date);
  }
  function matchLine(match, t, withStage) {
    const home = match.teams[0];
    const away = match.teams[1];
    const score = match.state === "unstarted" ? "vs" : `${home.score}:${away.score}`;
    const tail = [t("bo", { n: match.bestOf })];
    if (match.state === "inProgress") tail.push(t("state.live"));
    const stage = withStage && match.stage !== "" ? `${stageName(match.stage, t)} ` : "";
    return `- ${stamp(match.start)} ${stage}${home.code} ${score} ${away.code}\uFF08${tail.join("\uFF0C")}\uFF09`;
  }
  function digestBlock(events, t, options) {
    const opts = options ?? {};
    const finished = events.filter((event) => event.state === "completed").sort((a, b) => a.start.getTime() - b.start.getTime());
    const pending = events.filter((event) => event.state !== "completed").sort((a, b) => a.start.getTime() - b.start.getTime());
    const lines = [];
    if (finished.length > 0) {
      lines.push(`${t("digest.finished")}${finished.length}${t("digest.count")}`);
      for (const match of finished) lines.push(matchLine(match, t, opts.withStage === true));
    }
    if (pending.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push(`${t("digest.pending")}${pending.length}${t("digest.count")}`);
      for (const match of pending) lines.push(matchLine(match, t, opts.withStage === true));
    }
    if (opts.records === true) {
      const records = recordsOf(events);
      if (records.length > 0) {
        lines.push("");
        lines.push(`${t("digest.records")}${records.map(([code, record]) => `${code} ${record.wins}-${record.losses}`).join("\uFF0C")}`);
      }
    }
    return lines.join("\n");
  }
  function recordsOf(events) {
    const byTeam = /* @__PURE__ */ new Map();
    for (const event of events) {
      for (const team of event.teams) {
        if (team.record === null || team.code === "TBD") continue;
        byTeam.set(team.code, team.record);
      }
    }
    return [...byTeam.entries()].sort((a, b) => b[1].wins - a[1].wins || a[1].losses - b[1].losses || a[0].localeCompare(b[0])).slice(0, 24);
  }
  function resolveTodayScope(events) {
    if (events.length === 0) return null;
    const today = dayKey(/* @__PURE__ */ new Date());
    const todayEvents = events.filter((event) => dayKey(event.start) === today);
    if (todayEvents.length > 0) {
      return { events: todayEvents, date: todayEvents[0].start, isToday: true };
    }
    const days = [...new Set(events.map((event) => dayKey(event.start)))].sort();
    const latest = days[days.length - 1];
    if (latest === void 0) return null;
    const latestEvents = events.filter((event) => dayKey(event.start) === latest);
    return { events: latestEvents, date: latestEvents[0].start, isToday: false };
  }
  function resolveStageScope(events, stage) {
    const blocks = [];
    for (const event of events) if (event.stage !== "" && !blocks.includes(event.stage)) blocks.push(event.stage);
    let chosen = stage;
    if (chosen === "") {
      const next = events.filter((event) => event.state !== "completed").sort((a, b) => a.start.getTime() - b.start.getTime())[0];
      chosen = next?.stage ?? blocks[blocks.length - 1] ?? "";
    }
    return { stage: chosen, events: chosen === "" ? events : events.filter((event) => event.stage === chosen) };
  }
  function buildDigestPrompt(t, kind, scope, year, question) {
    if (kind === "today") {
      const today = scope;
      return t("prompt.today", {
        date: formatDate(today.date),
        matches: digestBlock(today.events, t, { withStage: true }),
        question
      });
    }
    const stage = scope;
    return t("prompt.stage", {
      year,
      stage: stageName(stage.stage, t),
      matches: digestBlock(stage.events, t, { records: true }),
      question
    });
  }

  // src/i18n.ts
  var NS = "lol";
  var zh = {
    "panel": "\u6BD4\u8D5B",
    "title": "\u6BD4\u8D5B",
    "intro": "\u5168\u7403\u603B\u51B3\u8D5B\u8D5B\u7A0B\u4E0E\u8D5B\u679C\uFF0C\u4E00\u952E\u8DF3\u8F6C\u89C2\u8D5B\uFF0C\u4E5F\u53EF\u4EE5\u8BA9\u6211\u966A\u4F60\u804A\u6BD4\u8D5B\u3002",
    "tab.label": "\u89C6\u56FE",
    "tab.schedule": "\u8D5B\u7A0B",
    "tab.result": "\u8D5B\u679C",
    "stage.label": "\u9636\u6BB5",
    "stage.all": "\u5168\u90E8",
    "refresh": "\u5237\u65B0",
    "loading": "\u6B63\u5728\u83B7\u53D6\u8D5B\u7A0B\u2026",
    "error": "\u8D5B\u7A0B\u83B7\u53D6\u5931\u8D25\u3002",
    "retry": "\u91CD\u8BD5",
    "empty": "\u8FD9\u4E2A\u9636\u6BB5\u6CA1\u6709\u6BD4\u8D5B\u3002",
    "empty.offSeason": "S \u8D5B\u6682\u65E0\u8FDB\u884C\u4E2D\u7684\u8D5B\u7A0B\u3002",
    "empty.official": "\u6253\u5F00\u5B98\u65B9\u8D5B\u4E8B\u9875",
    "summary": "{done} \u573A\u5DF2\u7ED3\u675F \xB7 {open} \u573A\u5F85\u6253",
    "edition": "S\u8D5B {year}",
    "state.live": "\u8FDB\u884C\u4E2D",
    "state.done": "\u5DF2\u7ED3\u675F",
    "state.upcoming": "\u672A\u5F00\u59CB",
    "stage.playin": "\u5165\u56F4\u8D5B",
    "stage.swiss": "\u745E\u58EB\u8F6E",
    "stage.quarter": "\u56DB\u5206\u4E4B\u4E00\u51B3\u8D5B",
    "stage.semi": "\u534A\u51B3\u8D5B",
    "stage.final": "\u51B3\u8D5B",
    "bo": "BO{n}",
    "watch": "\u89C2\u8D5B",
    "detail": "\u8BE6\u60C5",
    "detail.hide": "\u6536\u8D77",
    "ask": "\u95EE AI",
    "games": "\u9010\u5C40",
    "game": "\u7B2C {n} \u5C40",
    "side.blue": "\u84DD\u65B9",
    "side.red": "\u7EA2\u65B9",
    "links": "\u89C2\u8D5B\u94FE\u63A5",
    "links.official": "\u5B98\u65B9\u8D5B\u4E8B\u9875",
    "links.live": "\u5B98\u65B9\u76F4\u64AD",
    "links.replay": "\u4E2D\u6587\u56DE\u653E",
    "links.replayEn": "\u82F1\u6587\u6D41",
    "live.kills": "\u51FB\u6740",
    "live.gold": "\u7ECF\u6D4E",
    "live.towers": "\u63A8\u5854",
    "live.dragons": "\u5C0F\u9F99",
    "live.barons": "\u7537\u7235",
    "live.players": "\u9009\u624B",
    "live.cs": "\u8865\u5200",
    "live.lag": "\u5EF6\u8FDF {seconds} \u79D2",
    "live.lagHint": "Riot \u7684\u5B9E\u65F6\u63A5\u53E3\u8981\u6C42\u6570\u636E\u7A97\u53E3\u7684\u7ED3\u675F\u65F6\u95F4\u81F3\u5C11\u6BD4\u5F53\u524D\u65E9 50 \u79D2\uFF0C\u6240\u4EE5\u8FD9\u91CC\u6C38\u8FDC\u6BD4\u76F4\u64AD\u6162\u4E00\u5206\u949F\u5DE6\u53F3\u3002",
    "live.finished": "\u672C\u5C40\u5DF2\u7ED3\u675F",
    "live.finishedHint": "\u8FD9\u4E00\u5C40\u7684\u6700\u540E\u4E00\u5E27\u5DF2\u7ECF\u5230\u8FBE\uFF0C\u8D5B\u7A0B\u72B6\u6001\u8FD8\u6CA1\u7FFB\u8FC7\u6765\uFF1B\u4E0B\u4E00\u5C40\u5F00\u59CB\u540E\u8FD9\u91CC\u4F1A\u81EA\u52A8\u63A5\u4E0A\u3002",
    "ask.title": "\u804A\u804A\u8FD9\u573A\u6BD4\u8D5B",
    "ask.placeholder": "\u60F3\u4E86\u89E3\u4EC0\u4E48\uFF1FEnter \u53D1\u9001\uFF0CShift+Enter \u6362\u884C",
    "ask.send": "\u53D1\u9001",
    "ask.sending": "\u53D1\u9001\u4E2D\u2026",
    "ask.failed": "\u53D1\u9001\u5931\u8D25\uFF1A{message}",
    "ask.hint": "\u4F1A\u5728\u9ED8\u8BA4\u5DE5\u4F5C\u533A\u65B0\u5EFA\u4E00\u4E2A\u4F1A\u8BDD\uFF0C\u5E26\u4E0A\u8FD9\u573A\u6BD4\u8D5B\u7684\u4FE1\u606F\u4E00\u8D77\u53D1\u9001\u3002",
    "ask.digest.button": "\u804A\u8D5B\u4E8B",
    "ask.digest.title": "\u804A\u6574\u5C4A\u8D5B\u51B5",
    "ask.digest.scope": "\u804A\u54EA\u4E00\u6BB5",
    "ask.digest.today": "\u4ECA\u5929",
    "ask.digest.lastDay": "\u6700\u8FD1\u6BD4\u8D5B\u65E5",
    "ask.digest.hint": "\u4F1A\u5728\u9ED8\u8BA4\u5DE5\u4F5C\u533A\u65B0\u5EFA\u4F1A\u8BDD\uFF0C\u5E26\u4E0A\u4E0A\u9762\u8FD9\u6BB5\u8D5B\u51B5\u7684\u6570\u636E\u3002",
    "ask.quick.today.1": "\u4ECA\u5929\u8FD9\u4E9B\u6BD4\u8D5B\u8BF4\u660E\u4E86\u4EC0\u4E48\uFF1F",
    "ask.quick.today.2": "\u4ECA\u5929\u54EA\u652F\u961F\u4F0D\u7684 BP \u6216\u6253\u6CD5\u503C\u5F97\u6CE8\u610F\uFF1F",
    "ask.quick.stage.1": "{stage} \u63A5\u4E0B\u6765\u4F1A\u600E\u4E48\u8D70\uFF1F",
    "ask.quick.stage.2": "\u6309\u73B0\u5728\u7684\u6218\u7EE9\uFF0C\u8C01\u6700\u53EF\u80FD\u51FA\u7EBF\uFF1F",
    "digest.finished": "\u5DF2\u7ED3\u675F ",
    "digest.pending": "\u5F85\u6253 ",
    "digest.count": " \u573A\uFF1A",
    "digest.records": "\u5F53\u524D\u6218\u7EE9\uFF1A",
    "ask.quick.preview": "\u5E2E\u6211\u505A\u8D5B\u524D\u524D\u77BB\uFF0C\u5E76\u7ED9\u51FA\u6BD4\u5206\u9884\u6D4B",
    "ask.quick.recap": "\u590D\u76D8\u8FD9\u573A\u6BD4\u8D5B\uFF0C\u6307\u51FA\u51B3\u5B9A\u80DC\u8D1F\u7684\u5173\u952E\u8F6C\u6298",
    "ask.quick.draft": "\u7ED3\u5408\u7248\u672C\u8C08\u8C08\u8FD9\u573A\u7684 BP \u601D\u8DEF\u548C\u5BF9\u4F4D\u91CD\u70B9",
    "ask.quick.watch": "\u6211\u7B2C\u4E00\u6B21\u770B\u8FD9\u573A\u6BD4\u8D5B\uFF0C\u7ED9\u6211\u89C2\u8D5B\u91CD\u70B9",
    "prompt.template": "\u4F60\u662F\u6211\u7684\u82F1\u96C4\u8054\u76DF\u8D5B\u4E8B\u89C2\u8D5B\u52A9\u624B\u3002\u4E0B\u9762\u662F\u6211\u6B63\u5728\u770B\u7684\u8FD9\u573A\u6BD4\u8D5B\u7684\u4FE1\u606F\uFF0C\u8BF7\u7528\u4E2D\u6587\u56DE\u7B54\u6211\u7684\u95EE\u9898\uFF1B\u4FE1\u606F\u4E0D\u8DB3\u65F6\u76F4\u63A5\u8BF4\u660E\uFF0C\u4E0D\u8981\u7F16\u9020\u3002\n\n\u8D5B\u4E8B\uFF1A{event}\n\u9636\u6BB5\uFF1A{stage}\n\u5BF9\u9635\uFF1A{home} vs {away}\n\u8D5B\u5236\uFF1A{format}\n\u65F6\u95F4\uFF1A{time}\n\u72B6\u6001\uFF1A{state}\n\u6BD4\u5206\uFF1A{score}\n\u89C2\u8D5B/\u56DE\u653E\uFF1A{link}\n\n\u6211\u7684\u95EE\u9898\uFF1A{question}",
    "prompt.today": "\u4F60\u662F\u6211\u7684\u82F1\u96C4\u8054\u76DF\u8D5B\u4E8B\u89C2\u8D5B\u52A9\u624B\u3002\u4E0B\u9762\u662F\u4ECA\u5929\uFF08{date}\uFF09S \u8D5B\u7684\u6BD4\u8D5B\u5B89\u6392\u4E0E\u7ED3\u679C\uFF0C\u8BF7\u7528\u4E2D\u6587\u56DE\u7B54\u6211\u7684\u95EE\u9898\uFF1B\u6570\u636E\u4E0D\u8DB3\u65F6\u76F4\u63A5\u8BF4\u660E\uFF0C\u4E0D\u8981\u7F16\u9020\u3002\n\n{matches}\n\n\u6211\u7684\u95EE\u9898\uFF1A{question}",
    "prompt.stage": "\u4F60\u662F\u6211\u7684\u82F1\u96C4\u8054\u76DF\u8D5B\u4E8B\u89C2\u8D5B\u52A9\u624B\u3002\u4E0B\u9762\u662F S\u8D5B {year} \u7684{stage}\u8D5B\u51B5\uFF0C\u5305\u542B\u5DF2\u7ED3\u675F\u7684\u6BD4\u8D5B\u3001\u5F85\u6253\u7684\u6BD4\u8D5B\u548C\u5F53\u524D\u6218\u7EE9\u3002\u8BF7\u7528\u4E2D\u6587\u56DE\u7B54\u6211\u7684\u95EE\u9898\uFF0C\u5BF9\u8D70\u52BF\u7684\u5224\u65AD\u8981\u7ED9\u51FA\u4F9D\u636E\uFF1B\u6570\u636E\u4E0D\u8DB3\u65F6\u76F4\u63A5\u8BF4\u660E\uFF0C\u4E0D\u8981\u7F16\u9020\u3002\n\n{matches}\n\n\u6211\u7684\u95EE\u9898\uFF1A{question}",
    "time.today": "\u4ECA\u5929",
    "time.tomorrow": "\u660E\u5929"
  };
  var en = {
    "panel": "Matches",
    "title": "Matches",
    "intro": "World Championship schedule and results, one click to the stream, and an AI that watches along with you.",
    "tab.label": "Views",
    "tab.schedule": "Schedule",
    "tab.result": "Results",
    "stage.label": "Stage",
    "stage.all": "All",
    "refresh": "Refresh",
    "loading": "Loading the schedule\u2026",
    "error": "Could not load the schedule.",
    "retry": "Retry",
    "empty": "No matches in this stage.",
    "empty.offSeason": "No Worlds matches are scheduled right now.",
    "empty.official": "Open the official page",
    "summary": "{done} played \xB7 {open} to play",
    "edition": "Worlds {year}",
    "state.live": "Live",
    "state.done": "Final",
    "state.upcoming": "Upcoming",
    "stage.playin": "Play-In",
    "stage.swiss": "Swiss Stage",
    "stage.quarter": "Quarterfinals",
    "stage.semi": "Semifinals",
    "stage.final": "Finals",
    "bo": "BO{n}",
    "watch": "Watch",
    "detail": "Details",
    "detail.hide": "Hide",
    "ask": "Ask AI",
    "games": "Games",
    "game": "Game {n}",
    "side.blue": "blue",
    "side.red": "red",
    "links": "Watch links",
    "links.official": "Official page",
    "links.live": "Official stream",
    "links.replay": "Chinese VOD",
    "links.replayEn": "English VOD",
    "live.kills": "Kills",
    "live.gold": "Gold",
    "live.towers": "Towers",
    "live.dragons": "Dragons",
    "live.barons": "Barons",
    "live.players": "Players",
    "live.cs": "CS",
    "live.lag": "{seconds}s behind live",
    "live.lagHint": "Riot rejects any live window whose end is newer than 50 seconds, so this panel always trails the broadcast by about a minute.",
    "live.finished": "Game finished",
    "live.finishedHint": "The final frame of this game has arrived while the schedule still calls it live; the next game picks up automatically.",
    "ask.title": "Talk about this match",
    "ask.placeholder": "What do you want to know? Enter sends, Shift+Enter breaks the line",
    "ask.send": "Send",
    "ask.sending": "Sending\u2026",
    "ask.failed": "Could not send: {message}",
    "ask.hint": "Starts a new chat in your default workspace with this match attached.",
    "ask.digest.button": "Discuss",
    "ask.digest.title": "Ask about the tournament",
    "ask.digest.scope": "Scope",
    "ask.digest.today": "Today",
    "ask.digest.lastDay": "Latest match day",
    "ask.digest.hint": "Starts a new chat in your default workspace with the matches above attached.",
    "ask.quick.today.1": "What do today\u2019s results tell us?",
    "ask.quick.today.2": "Whose draft or play stood out today?",
    "ask.quick.stage.1": "How will the {stage} play out from here?",
    "ask.quick.stage.2": "Based on the current records, who is most likely to advance?",
    "digest.finished": "Finished: ",
    "digest.pending": "To play: ",
    "digest.count": " matches",
    "digest.records": "Records: ",
    "ask.quick.preview": "Preview both teams and predict the score",
    "ask.quick.recap": "Recap this match and point out the turning point",
    "ask.quick.draft": "Explain the draft and the key lane matchups",
    "ask.quick.watch": "I am new to this match \u2014 what should I watch for?",
    "prompt.template": "You are my League of Legends esports companion. Here is the match I am watching. Answer my question in English, and say so plainly when the information above is not enough.\n\nEvent: {event}\nStage: {stage}\nMatch: {home} vs {away}\nFormat: {format}\nTime: {time}\nStatus: {state}\nScore: {score}\nWatch / replay: {link}\n\nMy question: {question}",
    "prompt.today": "You are my League of Legends esports companion. Here is today\u2019s ({date}) Worlds schedule and results. Answer in English, and say plainly when the information above is not enough.\n\n{matches}\n\nMy question: {question}",
    "prompt.stage": "You are my League of Legends esports companion. Here is the current state of the {stage} at Worlds {year}: finished matches, matches still to play, and current records. Answer in English; back any prediction with the data above, and say plainly when the information is not enough.\n\n{matches}\n\nMy question: {question}",
    "time.today": "Today",
    "time.tomorrow": "Tomorrow"
  };

  // src/css.ts
  var CSS = [
    ".lol-page{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6}",
    ".lol-head{flex:none;padding:28px clamp(24px,4vw,48px) 0}",
    "[data-platform=darwin] .lol-head{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}",
    ".lol-headInner{display:flex;flex-direction:column;gap:14px;max-width:960px;margin:0 auto}",
    ".lol-titleRow{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px}",
    ".lol-heading{min-width:0}",
    ".lol-title{margin:0;font-size:20px;line-height:28px;font-weight:500}",
    ".lol-sub{margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
    ".lol-toolbar{display:flex;align-items:center;gap:8px;margin-left:auto}",
    ".lol-tabs{display:flex;gap:4px}",
    ".lol-tab{font-family:inherit;font-size:13px;line-height:20px;padding:4px 12px;border-radius:var(--dsw-radius-sm);border:.5px solid transparent;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer}",
    ".lol-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}",
    ".lol-tab[aria-selected=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}",
    ".lol-chips{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:4px}",
    ".lol-chip{font-family:inherit;font-size:12px;line-height:18px;padding:3px 9px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer}",
    ".lol-chip:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
    ".lol-chip[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l3)}",
    ".lol-chip:disabled{opacity:.5;cursor:not-allowed}",
    ".lol-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable;--dsh-scrollbar-width:9px;--dsh-scrollbar-thumb-border:2px}",
    ".lol-scrollInner{display:flex;flex-direction:column;gap:20px;max-width:960px;margin:0 auto;padding:20px clamp(24px,4vw,48px) 48px}",
    ".lol-day{display:flex;flex-direction:column;gap:8px}",
    ".lol-dayLabel{position:sticky;top:0;z-index:1;margin:0;padding:4px 0;background:var(--dsw-alias-bg-base);font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-tertiary)}",
    ".lol-card{display:flex;flex-direction:column;gap:10px;padding:12px 16px;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md)}",
    ".lol-card[data-state=inProgress]{border-color:var(--dsw-alias-state-error-primary)}",
    ".lol-cardTop{display:flex;align-items:center;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}",
    ".lol-bo{font-variant-numeric:tabular-nums}",
    ".lol-badge{display:inline-flex;align-items:center;gap:4px;padding:0 6px;border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-layer-2);font-size:11px;line-height:18px}",
    ".lol-badge--live{color:var(--dsw-alias-state-error-primary)}",
    '.lol-badge--live:before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;corner-shape:round;background:currentColor}',
    ".lol-clock{margin-left:auto;font-variant-numeric:tabular-nums}",
    ".lol-cardMain{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}",
    ".lol-sides{display:grid;grid-template-columns:minmax(0,150px) auto minmax(0,150px);align-items:center;gap:12px;min-width:0}",
    ".lol-side{display:flex;align-items:center;gap:8px;min-width:0}",
    ".lol-side--home{justify-content:flex-end;text-align:right}",
    ".lol-side--lost{opacity:.6}",
    ".lol-teamText{display:flex;flex-direction:column;min-width:0}",
    ".lol-code{font-size:14px;line-height:20px;font-weight:600;letter-spacing:.02em}",
    ".lol-mark{flex:none;width:28px;height:28px;border-radius:50%;corner-shape:round;object-fit:contain;background:var(--dsw-alias-bg-layer-2)}",
    ".lol-mark--text{display:flex;align-items:center;justify-content:center;font-size:9px;line-height:12px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}",
    ".lol-score{min-width:56px;text-align:center;font-size:18px;line-height:26px;font-weight:600;font-variant-numeric:tabular-nums}",
    ".lol-card[data-state=unstarted] .lol-score{font-size:12px;line-height:26px;color:var(--dsw-alias-label-tertiary)}",
    ".lol-actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;margin-left:auto}",
    ".lol-btn{display:inline-flex;align-items:center;gap:4px;font-family:inherit;font-size:12px;line-height:18px;padding:4px 10px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;text-decoration:none}",
    ".lol-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}",
    ".lol-btn[aria-expanded=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l3)}",
    ".lol-btn:disabled{opacity:.5;cursor:not-allowed}",
    ".lol-btn--primary{padding:4px 12px;background:var(--dsw-alias-button-primary-fill);border-color:transparent;color:var(--dsw-alias-label-primary-foreground)}",
    ".lol-btn--primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover);color:var(--dsw-alias-label-primary-foreground)}",
    ".lol-detail{display:flex;flex-direction:column;gap:12px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l3)}",
    ".lol-section{display:flex;flex-direction:column;gap:6px}",
    ".lol-sectionTitle{margin:0;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-tertiary)}",
    ".lol-links{display:flex;flex-wrap:wrap;gap:6px}",
    ".lol-games{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}",
    ".lol-game{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
    ".lol-gameNo{min-width:64px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}",
    ".lol-gameSides{font-variant-numeric:tabular-nums}",
    ".lol-gameLinks{display:flex;gap:6px;margin-left:auto}",
    ".lol-digest{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1)}",
    ".lol-digestTop{display:flex;flex-wrap:wrap;align-items:center;gap:8px}",
    ".lol-digestTitle{margin:0;font-size:13px;line-height:20px;font-weight:500}",
    ".lol-digestScopes{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}",
    ".lol-ask{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2)}",
    ".lol-askQuick{display:flex;flex-wrap:wrap;gap:6px}",
    ".lol-askInput{box-sizing:border-box;width:100%;min-height:56px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px;resize:vertical}",
    ".lol-askFoot{display:flex;flex-wrap:wrap;align-items:center;gap:8px}",
    ".lol-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);flex:1;min-width:160px}",
    ".lol-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}",
    ".lol-errorRow{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:13px;line-height:20px;color:var(--dsw-alias-state-error-primary)}",
    ".lol-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:48px 20px;text-align:center;color:var(--dsw-alias-label-tertiary)}",
    ".lol-emptyTitle{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-secondary)}",
    ".lol-tab:focus-visible,.lol-chip:focus-visible,.lol-btn:focus-visible,.lol-askInput:focus-visible{outline:2px solid var(--dsw-focus-ring-color);outline-offset:1px}",
    ".lol-live{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2)}",
    ".lol-liveTop{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px}",
    ".lol-liveKills{display:flex;align-items:baseline;gap:8px;font-size:20px;line-height:26px;font-weight:600;font-variant-numeric:tabular-nums}",
    ".lol-liveTeamCode{font-size:12px;line-height:18px;font-weight:500;letter-spacing:.02em;color:var(--dsw-alias-label-secondary)}",
    ".lol-liveMeta{display:flex;flex-wrap:wrap;gap:4px 14px;margin-left:auto;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}",
    ".lol-liveMetric b{font-weight:500;color:var(--dsw-alias-label-primary)}",
    ".lol-liveLag{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}",
    ".lol-liveFinished{color:var(--dsw-alias-label-tertiary)}",
    ".lol-roll{display:inline-block;animation:lol-roll-in .3s cubic-bezier(.22,.61,.36,1)}",
    "@keyframes lol-roll-in{from{transform:translateY(.42em);opacity:.2}to{transform:none;opacity:1}}",
    ".lol-livePlayers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l3)}",
    ".lol-liveTeam{display:flex;flex-direction:column;gap:2px;min-width:0}",
    ".lol-liveKillLabel{font-size:11px;line-height:16px;letter-spacing:.02em;color:var(--dsw-alias-label-tertiary)}",
    ".lol-livePlayer{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
    ".lol-liveName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".lol-liveKda,.lol-liveCs{color:var(--dsw-alias-label-primary)}",
    "@media (max-width:640px){.lol-livePlayers{grid-template-columns:minmax(0,1fr)}}",
    "@media (prefers-reduced-motion:reduce){.lol-page *{transition:none!important;animation:none!important}}"
  ].join("");

  // src/styles.ts
  var STYLE_ID = "dsh-lol-esports-css";
  function ensureStyles() {
    if (typeof document === "undefined") return;
    const existing = document.getElementById(STYLE_ID);
    if (existing !== null) {
      if (existing.textContent !== CSS) existing.textContent = CSS;
      return;
    }
    const tag = document.createElement("style");
    tag.id = STYLE_ID;
    tag.textContent = CSS;
    const host = document.head ?? document.documentElement;
    if (host !== void 0 && host !== null) host.appendChild(tag);
  }

  // src/links.ts
  function localeGroup(locale) {
    const value = typeof locale === "string" ? locale.toLowerCase() : "";
    if (value.startsWith("zh")) return "zh";
    if (value.startsWith("en")) return "en";
    return null;
  }
  function vodUrl(vod) {
    if (vod.provider === "twitch") return `https://www.twitch.tv/videos/${encodeURIComponent(vod.parameter)}`;
    if (vod.provider === "youtube") {
      const base = `https://www.youtube.com/watch?v=${encodeURIComponent(vod.parameter)}`;
      const seconds = Math.floor((vod.startMillis ?? 0) / 1e3);
      return seconds >= 5 ? `${base}&t=${seconds}s` : base;
    }
    return null;
  }
  function streamUrl(stream) {
    if (stream?.provider === "twitch") return `https://www.twitch.tv/${encodeURIComponent(stream.parameter)}`;
    if (stream?.provider === "youtube") return `https://www.youtube.com/watch?v=${encodeURIComponent(stream.parameter)}`;
    return null;
  }
  function localizedTargets(items, lang) {
    const zh2 = items.find((item) => localeGroup(item.locale) === "zh");
    const en2 = items.find((item) => localeGroup(item.locale) === "en");
    const ordered = localeGroup(lang) === "zh" ? [zh2, en2] : [en2, zh2];
    return ordered.filter((item) => item !== void 0);
  }
  function watchTargets(vods, url) {
    const seen = /* @__PURE__ */ new Set();
    const targets = [];
    for (const vod of vods) {
      const href = url(vod);
      if (href === null || href === "" || seen.has(href)) continue;
      seen.add(href);
      targets.push({ href, locale: vod.locale });
    }
    return targets;
  }

  // src/api.ts
  var scheduleCache = { at: 0, events: null };
  var detailCache = /* @__PURE__ */ new Map();
  async function apiGet(path, params) {
    const url = new URL(`${API_BASE}/${path}`);
    url.searchParams.set("hl", "zh-CN");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    let failure = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller === null ? null : setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      try {
        const init = { headers: { "x-api-key": API_KEY } };
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
  function normalizeRecord(record) {
    if (record === null || typeof record !== "object") return null;
    const wins = record.wins;
    const losses = record.losses;
    if (typeof wins !== "number" || typeof losses !== "number") return null;
    return { wins, losses };
  }
  function httpsImage(url) {
    if (typeof url !== "string" || url === "") return null;
    return url.startsWith("http://") ? `https://${url.slice(7)}` : url;
  }
  function normalizeTeam(team) {
    const value = team ?? {};
    const code = typeof value.code === "string" && value.code !== "" ? value.code : "TBD";
    return {
      id: value.id === void 0 || value.id === null ? "" : String(value.id),
      code,
      name: typeof value.name === "string" ? value.name : "",
      image: httpsImage(value.image),
      score: value.result?.gameWins ?? 0,
      record: normalizeRecord(value.record)
    };
  }
  function normalizeEvent(raw) {
    const match = raw.match ?? {};
    const rawTeams = Array.isArray(match.teams) ? match.teams : [];
    const bestOf = match.strategy?.count ?? 0;
    const teams = [normalizeTeam(rawTeams[0]), normalizeTeam(rawTeams[1])];
    const winsNeeded = bestOf > 0 ? Math.ceil(bestOf / 2) : 0;
    const decided = winsNeeded > 0 && (teams[0].score >= winsNeeded || teams[1].score >= winsNeeded);
    return {
      id: String(match.id),
      start: new Date(raw.startTime),
      state: decided ? "completed" : typeof raw.state === "string" ? raw.state : "unstarted",
      stage: typeof raw.blockName === "string" ? raw.blockName : "",
      bestOf: bestOf > 0 ? bestOf : 1,
      teams
    };
  }
  async function loadSchedule(force) {
    if (!force && scheduleCache.events !== null && Date.now() - scheduleCache.at < SCHEDULE_TTL) {
      return scheduleCache.events;
    }
    const payload = await apiGet("getSchedule", { leagueId: WORLDS_ID });
    const raw = payload?.data?.schedule?.events;
    const events = (Array.isArray(raw) ? raw : []).filter((item) => item?.type === "match" && item.match?.id !== void 0).map(normalizeEvent).sort((a, b) => a.start.getTime() - b.start.getTime());
    scheduleCache.at = Date.now();
    scheduleCache.events = events;
    return events;
  }
  async function loadDetail(matchId) {
    const cached = detailCache.get(matchId);
    if (cached !== void 0 && Date.now() - cached.at < DETAIL_TTL) return cached.detail;
    const payload = await apiGet("getEventDetails", { id: matchId });
    const event = payload?.data?.event;
    if (event === void 0 || event === null) throw new Error("empty event");
    const teamById = /* @__PURE__ */ new Map();
    for (const team of event.match?.teams ?? []) teamById.set(String(team.id), team);
    const games = Array.isArray(event.match?.games) ? event.match.games : [];
    const detail = {
      streams: (Array.isArray(event.streams) ? event.streams : []).map((stream) => ({ url: streamUrl(stream), locale: stream.locale ?? "" })).filter((item) => item.url !== null),
      games: games.filter((game) => game.state === "completed" || game.state === "inProgress").map((game) => {
        const vods = Array.isArray(game.vods) ? game.vods : [];
        return {
          number: game.number,
          sides: (Array.isArray(game.teams) ? game.teams : []).map((side) => ({
            side: side.side,
            code: teamById.get(String(side.id))?.code ?? "?"
          })),
          vods: watchTargets(vods, vodUrl)
        };
      })
    };
    detailCache.set(matchId, { at: Date.now(), detail });
    return detail;
  }
  var liveGameCache = /* @__PURE__ */ new Map();
  var liveStatsCache = /* @__PURE__ */ new Map();
  async function loadLiveGameId(matchId) {
    const cached = liveGameCache.get(matchId);
    if (cached !== void 0 && Date.now() - cached.at < LIVE_GAME_TTL) return cached;
    const payload = await apiGet("getEventDetails", { id: matchId });
    const event = payload?.data?.event;
    const games = event?.match?.games;
    const live = Array.isArray(games) ? games.find((game) => game?.state === "inProgress") : void 0;
    const gameId = live?.id === void 0 || live?.id === null ? null : String(live.id);
    const teams = (Array.isArray(event?.match?.teams) ? event.match.teams : []).filter((team) => team?.id !== void 0 && team?.id !== null).map((team) => ({ id: String(team.id), code: typeof team.code === "string" ? team.code : "" }));
    const entry = { at: Date.now(), gameId, teams };
    liveGameCache.set(matchId, entry);
    return entry;
  }
  function sumOf(players, key) {
    return players.reduce((total, player) => total + (Number(player[key]) || 0), 0);
  }
  function liveSide(team, metadata, metaKey) {
    const roster = /* @__PURE__ */ new Map();
    for (const entry of metadata?.[metaKey]?.participantMetadata ?? []) roster.set(entry.participantId, entry);
    const players = (Array.isArray(team?.participants) ? team.participants : []).map((player) => {
      const info = roster.get(player.participantId) ?? {};
      return {
        id: player.participantId,
        name: typeof info.summonerName === "string" && info.summonerName !== "" ? info.summonerName : `#${player.participantId}`,
        champion: typeof info.championId === "string" ? info.championId : "",
        kills: Number(player.kills) || 0,
        deaths: Number(player.deaths) || 0,
        assists: Number(player.assists) || 0,
        cs: Number(player.creepScore) || 0
      };
    });
    const meta = metadata?.[metaKey] ?? {};
    return {
      teamId: meta.esportsTeamId === void 0 || meta.esportsTeamId === null ? "" : String(meta.esportsTeamId),
      kills: Number(team?.totalKills) || sumOf(players, "kills"),
      gold: Number(team?.totalGold) || 0,
      towers: Number(team?.towers) || 0,
      dragons: Array.isArray(team?.dragons) ? team.dragons.length : 0,
      barons: Number(team?.barons) || 0,
      players
    };
  }
  function normalizeLive(payload) {
    const frames = Array.isArray(payload?.frames) ? payload.frames : [];
    const frame = frames[frames.length - 1];
    if (frame === void 0 || frame === null) return null;
    const metadata = payload.gameMetadata ?? {};
    const blue = liveSide(frame.blueTeam, metadata, "blueTeamMetadata");
    const red = liveSide(frame.redTeam, metadata, "redTeamMetadata");
    if (blue.players.length === 0 && red.players.length === 0) return null;
    const idle = blue.kills === 0 && red.kills === 0 && blue.gold === 0 && red.gold === 0 && blue.towers === 0 && red.towers === 0 && sumOf(blue.players, "cs") === 0 && sumOf(red.players, "cs") === 0;
    const at = typeof frame.rfc460Timestamp === "string" ? frame.rfc460Timestamp : null;
    const age = at === null ? Number.POSITIVE_INFINITY : Date.now() - Date.parse(at);
    if (idle && !(age >= 0 && age < 10 * 60 * 1e3)) return null;
    return { blue, red, at, state: typeof frame.gameState === "string" ? frame.gameState : null };
  }
  async function fetchWindow(gameId, startingTime) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller === null ? null : setTimeout(() => controller.abort(), LIVE_TIMEOUT);
    try {
      const init = controller === null ? {} : { signal: controller.signal };
      const url = new URL(`${LIVE_BASE}/window/${encodeURIComponent(gameId)}`);
      if (startingTime !== null) url.searchParams.set("startingTime", startingTime);
      const response = await fetch(url, init);
      if (response.status === 204 || !response.ok) return null;
      return await response.json();
    } finally {
      if (timer !== null) clearTimeout(timer);
    }
  }
  async function loadLiveStats(gameId) {
    const cached = liveStatsCache.get(gameId);
    if (cached !== void 0 && Date.now() - cached.at < LIVE_POLL) return cached.stats;
    const step = 10 * 1e3;
    const latest = Math.floor((Date.now() - 70 * 1e3) / step) * step;
    const startingTime = new Date(latest).toISOString().replace(/\.\d{3}Z$/, "Z");
    let payload = await fetchWindow(gameId, startingTime);
    if (payload === null) payload = await fetchWindow(gameId, null);
    const stats = payload === null ? null : normalizeLive(payload);
    liveStatsCache.set(gameId, { at: Date.now(), stats });
    return stats;
  }

  // src/runtime.ts
  var react = null;
  function setReact(api) {
    react = api;
  }
  function getReact() {
    if (react === null) throw new Error("dsh-lol-esports: React is not bound yet");
    return react;
  }
  function h(type, props, ...children) {
    const create = getReact().createElement;
    return create(type, props, ...children);
  }

  // src/ui.tsx
  var KIND_LIVE = "inProgress";
  var KIND_DONE = "completed";
  var KIND_UPCOMING = "unstarted";
  function WorldsIcon({ size, active }) {
    ensureStyles();
    return /* @__PURE__ */ h(
      "svg",
      {
        viewBox: "0 0 24 24",
        width: size,
        height: size,
        "aria-hidden": "true",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: active ? 1.6 : 1.3,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { display: "block" }
      },
      /* @__PURE__ */ h("path", { d: "M8.5 3.5h7V9a3.5 3.5 0 0 1-7 0V3.5z" }),
      /* @__PURE__ */ h("path", { d: "M8.5 5H5.5v1.5a3.5 3.5 0 0 0 3 3.46" }),
      /* @__PURE__ */ h("path", { d: "M15.5 5h3v1.5a3.5 3.5 0 0 1-3 3.46" }),
      /* @__PURE__ */ h("path", { d: "M12 12.5V16" }),
      /* @__PURE__ */ h("path", { d: "M8.5 20.5h7" }),
      /* @__PURE__ */ h("path", { d: "M9.5 20.5v-1.5a2.5 2.5 0 0 1 5 0v1.5" })
    );
  }
  function TeamMark({ team }) {
    const { useState } = getReact();
    const [broken, setBroken] = useState(false);
    if (team.image === null || broken) {
      return /* @__PURE__ */ h("span", { className: "lol-mark lol-mark--text", "aria-hidden": "true" }, team.code);
    }
    return /* @__PURE__ */ h("img", { className: "lol-mark", src: team.image, alt: "", loading: "lazy", onError: () => setBroken(true) });
  }
  function LinkButton({ href, label }) {
    return /* @__PURE__ */ h("a", { className: "lol-btn", href, target: "_blank", rel: "noreferrer noopener" }, label, /* @__PURE__ */ h("span", { "aria-hidden": "true" }, "\u2197"));
  }
  function AskBox({ t, match, onSubmit, pending, error }) {
    const { useState } = getReact();
    const [text, setText] = useState("");
    const quickKeys = [
      match.state === KIND_DONE ? "ask.quick.recap" : "ask.quick.preview",
      "ask.quick.draft",
      "ask.quick.watch"
    ];
    const submit = (question) => {
      const value = (question ?? text).trim();
      if (value === "" || pending) return;
      onSubmit(value);
    };
    const onKeyDown = (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setText("");
      }
    };
    return /* @__PURE__ */ h("div", { className: "lol-ask" }, /* @__PURE__ */ h("h3", { className: "lol-sectionTitle" }, t("ask.title")), /* @__PURE__ */ h("div", { className: "lol-askQuick" }, quickKeys.map((key) => /* @__PURE__ */ h("button", { key, type: "button", className: "lol-chip", disabled: pending, onClick: () => submit(t(key)) }, t(key)))), /* @__PURE__ */ h(
      "textarea",
      {
        className: "lol-askInput",
        rows: 2,
        value: text,
        placeholder: t("ask.placeholder"),
        disabled: pending,
        onChange: (event) => setText(event.target.value),
        onKeyDown
      }
    ), /* @__PURE__ */ h("div", { className: "lol-askFoot" }, /* @__PURE__ */ h("span", { className: "lol-hint" }, t("ask.hint")), /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "lol-btn lol-btn--primary",
        disabled: pending || text.trim() === "",
        onClick: () => submit()
      },
      pending ? t("ask.sending") : t("ask.send")
    )), error !== null && /* @__PURE__ */ h("p", { className: "lol-error", role: "alert" }, t("ask.failed", { message: error })));
  }
  function DigestAsk({ t, today, stage, onSubmit, pending, error }) {
    const { useState } = getReact();
    const [scope, setScope] = useState(today === null ? "stage" : "today");
    const [text, setText] = useState("");
    const canToday = today !== null;
    const canStage = stage.stage !== "";
    if (!canToday && !canStage) return null;
    const active = scope === "today" && canToday ? "today" : "stage";
    const stageLabel = stageName(stage.stage, t);
    const quickKeys = active === "today" ? ["ask.quick.today.1", "ask.quick.today.2"] : ["ask.quick.stage.1", "ask.quick.stage.2"];
    const submit = (question) => {
      const value = (question ?? text).trim();
      if (value === "" || pending) return;
      onSubmit(active, value);
    };
    const onKeyDown = (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setText("");
      }
    };
    return /* @__PURE__ */ h("div", { className: "lol-digest" }, /* @__PURE__ */ h("div", { className: "lol-digestTop" }, /* @__PURE__ */ h("h3", { className: "lol-digestTitle" }, t("ask.digest.title")), /* @__PURE__ */ h("div", { className: "lol-digestScopes", role: "group", "aria-label": t("ask.digest.scope") }, canToday && /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "lol-chip",
        "aria-pressed": active === "today",
        onClick: () => setScope("today")
      },
      today.isToday ? t("ask.digest.today") : t("ask.digest.lastDay")
    ), canStage && /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "lol-chip",
        "aria-pressed": active === "stage",
        onClick: () => setScope("stage")
      },
      stageLabel
    ))), /* @__PURE__ */ h("div", { className: "lol-askQuick" }, quickKeys.map((key) => /* @__PURE__ */ h(
      "button",
      {
        key,
        type: "button",
        className: "lol-chip",
        disabled: pending,
        onClick: () => submit(t(key, { stage: stageLabel }))
      },
      t(key, { stage: stageLabel })
    ))), /* @__PURE__ */ h(
      "textarea",
      {
        className: "lol-askInput",
        rows: 2,
        value: text,
        placeholder: t("ask.placeholder"),
        disabled: pending,
        onChange: (event) => setText(event.target.value),
        onKeyDown
      }
    ), /* @__PURE__ */ h("div", { className: "lol-askFoot" }, /* @__PURE__ */ h("span", { className: "lol-hint" }, t("ask.digest.hint")), /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "lol-btn lol-btn--primary",
        disabled: pending || text.trim() === "",
        onClick: () => submit()
      },
      pending ? t("ask.sending") : t("ask.send")
    )), error !== null && /* @__PURE__ */ h("p", { className: "lol-error", role: "alert" }, t("ask.failed", { message: error })));
  }
  function MatchDetail({ t, match, lang }) {
    const { useState, useEffect } = getReact();
    const [state, setState] = useState({
      status: "loading",
      detail: null,
      error: null
    });
    useEffect(() => {
      let cancelled = false;
      setState({ status: "loading", detail: null, error: null });
      loadDetail(match.id).then((detail2) => {
        if (!cancelled) setState({ status: "ready", detail: detail2, error: null });
      }).catch((reason) => {
        if (!cancelled) setState({ status: "error", detail: null, error: describe(reason) });
      });
      return () => {
        cancelled = true;
      };
    }, [match.id]);
    const detail = state.detail;
    const first = detail !== null && detail.games.length > 0 ? detail.games[0] : null;
    const linkLabel = (locale) => localeGroup(locale) === "en" ? t("links.replayEn") : t("links.replay");
    const links = [];
    const seen = /* @__PURE__ */ new Set();
    const push = (href, label) => {
      if (typeof href !== "string" || href === "" || seen.has(href)) return;
      seen.add(href);
      links.push({ href, label });
    };
    push(OFFICIAL_URL, t("links.official"));
    if (detail !== null && detail.streams.length > 0) {
      const stream = localizedTargets(detail.streams, lang)[0] ?? detail.streams[0];
      push(stream.url, t("links.live"));
    }
    if (first !== null) {
      for (const vod of localizedTargets(first.vods, lang)) push(vod.href, linkLabel(vod.locale));
    }
    return /* @__PURE__ */ h("div", { className: "lol-detail" }, /* @__PURE__ */ h("div", { className: "lol-section" }, /* @__PURE__ */ h("h3", { className: "lol-sectionTitle" }, t("links")), /* @__PURE__ */ h("div", { className: "lol-links" }, links.map((link) => /* @__PURE__ */ h(LinkButton, { key: link.href, href: link.href, label: link.label }))), state.status === "error" && /* @__PURE__ */ h("p", { className: "lol-error", role: "alert" }, t("error"))), detail !== null && detail.games.length > 0 && /* @__PURE__ */ h("div", { className: "lol-section" }, /* @__PURE__ */ h("h3", { className: "lol-sectionTitle" }, t("games")), /* @__PURE__ */ h("ul", { className: "lol-games" }, detail.games.map((game) => /* @__PURE__ */ h("li", { key: game.number, className: "lol-game" }, /* @__PURE__ */ h("span", { className: "lol-gameNo" }, t("game", { n: game.number })), /* @__PURE__ */ h("span", { className: "lol-gameSides" }, game.sides.map((side) => `${side.code} (${t(`side.${side.side}`)})`).join(" vs ")), /* @__PURE__ */ h("span", { className: "lol-gameLinks" }, localizedTargets(game.vods, lang).map((vod) => /* @__PURE__ */ h(LinkButton, { key: vod.href, href: vod.href, label: linkLabel(vod.locale) }))))))));
  }
  function Roll({ value }) {
    return /* @__PURE__ */ h("span", { key: String(value), className: "lol-roll" }, String(value));
  }
  function LiveStrip({ t, match }) {
    const { useState, useEffect } = getReact();
    const [state, setState] = useState({ status: "loading", stats: null });
    useEffect(() => {
      if (match.state !== KIND_LIVE) return void 0;
      let cancelled = false;
      let timer = null;
      const tick = async () => {
        try {
          const live = await loadLiveGameId(match.id);
          if (cancelled) return;
          if (live.gameId === null) {
            setState({ status: "empty", stats: null, teams: live.teams });
            return;
          }
          const stats = await loadLiveStats(live.gameId);
          if (cancelled) return;
          setState(stats === null ? { status: "empty", stats: null, teams: live.teams } : { status: "ready", stats, teams: live.teams });
        } catch {
          if (!cancelled) setState({ status: "empty", stats: null });
        }
      };
      void tick();
      timer = setInterval(() => {
        void tick();
      }, LIVE_POLL);
      return () => {
        cancelled = true;
        if (timer !== null) clearInterval(timer);
      };
    }, [match.id, match.state]);
    const [, setClock] = useState(0);
    useEffect(() => {
      const id = setInterval(() => setClock((value) => value + 1), 1e3);
      return () => clearInterval(id);
    }, []);
    if (match.state !== KIND_LIVE) return null;
    if (state.status !== "ready" || state.stats === null) return null;
    const { blue, red } = state.stats;
    const finished = state.stats.state === "finished";
    const lag = finished || state.stats.at === null ? null : Math.max(0, Math.round((Date.now() - Date.parse(state.stats.at)) / 1e3));
    const codeOf = (teamId, fallbackKey) => {
      const team = (state.teams ?? []).find((item) => item.id === teamId);
      return team === void 0 || team.code === "" ? t(fallbackKey) : team.code;
    };
    const metric = (label, left, right) => /* @__PURE__ */ h("span", { key: label, className: "lol-liveMetric" }, `${label} `, /* @__PURE__ */ h("b", null, /* @__PURE__ */ h(Roll, { value: left }), " : ", /* @__PURE__ */ h(Roll, { value: right })));
    const column = (players, code) => /* @__PURE__ */ h("div", { className: "lol-liveTeam" }, players.map((player) => /* @__PURE__ */ h("div", { key: player.id, className: "lol-livePlayer" }, /* @__PURE__ */ h("span", { className: "lol-liveName", title: player.champion === "" ? player.name : `${player.name} \xB7 ${player.champion}` }, displayName(player.name, code)), /* @__PURE__ */ h("span", { className: "lol-liveKda" }, `${player.kills}/${player.deaths}/${player.assists}`), /* @__PURE__ */ h("span", { className: "lol-liveCs", title: t("live.cs") }, String(player.cs)))));
    return /* @__PURE__ */ h("div", { className: "lol-live" }, /* @__PURE__ */ h("div", { className: "lol-liveTop" }, /* @__PURE__ */ h("div", { className: "lol-liveKills" }, /* @__PURE__ */ h("span", { className: "lol-liveKillLabel" }, t("live.kills")), /* @__PURE__ */ h("span", { className: "lol-liveTeamCode" }, codeOf(blue.teamId, "side.blue")), /* @__PURE__ */ h("b", null, /* @__PURE__ */ h(Roll, { value: `${blue.kills} : ${red.kills}` })), /* @__PURE__ */ h("span", { className: "lol-liveTeamCode" }, codeOf(red.teamId, "side.red"))), /* @__PURE__ */ h("div", { className: "lol-liveMeta" }, metric(t("live.gold"), formatGold(blue.gold), formatGold(red.gold)), metric(t("live.towers"), blue.towers, red.towers), metric(t("live.dragons"), blue.dragons, red.dragons), metric(t("live.barons"), blue.barons, red.barons), finished ? /* @__PURE__ */ h("span", { className: "lol-liveFinished", title: t("live.finishedHint") }, t("live.finished")) : lag === null ? null : /* @__PURE__ */ h("span", { className: "lol-liveLag", title: t("live.lagHint") }, t("live.lag", { seconds: lag })))), /* @__PURE__ */ h("div", { className: "lol-livePlayers" }, column(blue.players, codeOf(blue.teamId, "side.blue")), column(red.players, codeOf(red.teamId, "side.red"))));
  }
  function MatchCard(props) {
    const { match, t, lang, expanded, onToggle, askOpen, onAskOpen, onSubmitAsk, askPending, askError } = props;
    const home = match.teams[0];
    const away = match.teams[1];
    const done = match.state === KIND_DONE;
    const winner = done ? home.score > away.score ? 0 : away.score > home.score ? 1 : -1 : -1;
    const tone = match.state === KIND_LIVE ? "live" : done ? "done" : "upcoming";
    return /* @__PURE__ */ h("article", { className: "lol-card", "data-state": match.state }, /* @__PURE__ */ h("div", { className: "lol-cardTop" }, match.stage !== "" && /* @__PURE__ */ h("span", { className: "lol-stage" }, stageName(match.stage, t)), /* @__PURE__ */ h("span", { className: "lol-bo" }, t("bo", { n: match.bestOf })), /* @__PURE__ */ h("span", { className: `lol-badge lol-badge--${tone}` }, stateLabel(match.state, t)), /* @__PURE__ */ h("time", { className: "lol-clock", dateTime: match.start.toISOString() }, formatClock(match.start))), /* @__PURE__ */ h("div", { className: "lol-cardMain" }, /* @__PURE__ */ h("div", { className: "lol-sides" }, /* @__PURE__ */ h("div", { className: `lol-side lol-side--home${winner === 1 ? " lol-side--lost" : ""}` }, /* @__PURE__ */ h(TeamMark, { team: home }), /* @__PURE__ */ h("span", { className: "lol-teamText" }, /* @__PURE__ */ h("b", { className: "lol-code" }, home.code))), /* @__PURE__ */ h("div", { className: "lol-score" }, match.state === KIND_UPCOMING ? "VS" : `${home.score} : ${away.score}`), /* @__PURE__ */ h("div", { className: `lol-side lol-side--away${winner === 0 ? " lol-side--lost" : ""}` }, /* @__PURE__ */ h("span", { className: "lol-teamText" }, /* @__PURE__ */ h("b", { className: "lol-code" }, away.code)), /* @__PURE__ */ h(TeamMark, { team: away }))), /* @__PURE__ */ h("div", { className: "lol-actions" }, /* @__PURE__ */ h(LinkButton, { href: done ? SITE_URL : OFFICIAL_URL, label: done ? t("links.official") : t("watch") }), /* @__PURE__ */ h("button", { type: "button", className: "lol-btn", "aria-expanded": askOpen, onClick: () => onAskOpen(!askOpen) }, t("ask")), /* @__PURE__ */ h("button", { type: "button", className: "lol-btn", "aria-expanded": expanded, onClick: onToggle }, expanded ? t("detail.hide") : t("detail")))), match.state === KIND_LIVE && /* @__PURE__ */ h(LiveStrip, { t, match }), askOpen && /* @__PURE__ */ h(AskBox, { t, match, onSubmit: onSubmitAsk, pending: askPending, error: askError }), expanded && /* @__PURE__ */ h(MatchDetail, { t, match, lang }));
  }
  function WorldsPage(props) {
    ensureStyles();
    const { t } = props;
    const { useState, useEffect, useCallback, useMemo, useRef } = getReact();
    const lang = props.getLang();
    const mounted = useRef(true);
    const [stage, setStage] = useState("");
    const [status, setStatus] = useState("loading");
    const [events, setEvents] = useState([]);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [askId, setAskId] = useState(null);
    const [digestOpen, setDigestOpen] = useState(false);
    const [ask, setAsk] = useState({
      id: null,
      pending: false,
      error: null
    });
    useEffect(() => () => {
      mounted.current = false;
    }, []);
    const load = useCallback(async (options) => {
      const opts = options ?? {};
      if (opts.silent !== true) {
        setStatus("loading");
        setError(null);
      }
      try {
        const next = await loadSchedule(opts.force === true);
        if (!mounted.current) return;
        setEvents(next);
        setStatus("ready");
        setError(null);
      } catch (reason) {
        if (!mounted.current) return;
        setStatus((current) => current === "ready" ? "ready" : "error");
        setError(describe(reason));
      }
    }, []);
    useEffect(() => {
      void load({});
    }, [load]);
    useEffect(() => {
      const timer = setInterval(() => {
        void load({ silent: true });
      }, REFRESH_INTERVAL);
      return () => clearInterval(timer);
    }, [load]);
    const edition = useMemo(() => currentEdition(events), [events]);
    const year = edition.length > 0 ? edition[0].start.getFullYear() : (/* @__PURE__ */ new Date()).getFullYear();
    const stages = useMemo(() => {
      const seen = [];
      for (const event of edition) {
        if (event.stage !== "" && !seen.includes(event.stage)) seen.push(event.stage);
      }
      return seen;
    }, [edition]);
    const filtered = useMemo(
      () => stage === "" ? edition : edition.filter((event) => event.stage === stage),
      [edition, stage]
    );
    const live = useMemo(() => filtered.filter((event) => event.state === KIND_LIVE), [filtered]);
    const upcoming = useMemo(
      () => filtered.filter((event) => event.state === KIND_UPCOMING).sort((a, b) => a.start.getTime() - b.start.getTime()),
      [filtered]
    );
    const completed = useMemo(
      () => filtered.filter((event) => event.state === KIND_DONE).sort((a, b) => b.start.getTime() - a.start.getTime()),
      [filtered]
    );
    const groups = useMemo(
      () => orderDayGroups(groupByDay([...filtered].sort((a, b) => a.start.getTime() - b.start.getTime()))),
      [filtered]
    );
    const todayScope = useMemo(() => resolveTodayScope(edition), [edition]);
    const stageScope = useMemo(() => resolveStageScope(edition, stage), [edition, stage]);
    const digestReady = todayScope !== null || stageScope.stage !== "";
    const submitAsk = useCallback(async (match, question) => {
      setAsk({ id: match.id, pending: true, error: null });
      const result = await props.askMatch(match, question, year);
      if (!mounted.current) return;
      if (result.ok) {
        setAsk({ id: null, pending: false, error: null });
        setAskId(null);
        return;
      }
      setAsk({ id: match.id, pending: false, error: result.message ?? "unknown" });
    }, [props.askMatch, year]);
    const submitDigest = useCallback(async (kind, question) => {
      const scope = kind === "today" ? todayScope : stageScope;
      if (scope === null) return;
      setAsk({ id: DIGEST_ASK_ID, pending: true, error: null });
      const result = await props.askText(buildDigestPrompt(t, kind, scope, year, question));
      if (!mounted.current) return;
      if (result.ok) {
        setAsk({ id: null, pending: false, error: null });
        return;
      }
      setAsk({ id: DIGEST_ASK_ID, pending: false, error: result.message ?? "unknown" });
    }, [props.askText, stageScope, t, todayScope, year]);
    const renderCard = (match) => /* @__PURE__ */ h(
      MatchCard,
      {
        key: match.id,
        match,
        t,
        lang,
        expanded: expandedId === match.id,
        onToggle: () => setExpandedId((current) => current === match.id ? null : match.id),
        askOpen: askId === match.id,
        onAskOpen: (open) => setAskId(open ? match.id : null),
        onSubmitAsk: (question) => {
          void submitAsk(match, question);
        },
        askPending: ask.pending && ask.id === match.id,
        askError: ask.id === match.id ? ask.error : null
      }
    );
    const summary = t("summary", { done: completed.length, open: upcoming.length + live.length });
    const noEdition = status === "ready" && edition.length === 0;
    return /* @__PURE__ */ h("div", { className: "lol-page" }, /* @__PURE__ */ h("div", { className: "lol-head" }, /* @__PURE__ */ h("div", { className: "lol-headInner" }, /* @__PURE__ */ h("div", { className: "lol-titleRow" }, /* @__PURE__ */ h("div", { className: "lol-heading" }, /* @__PURE__ */ h("h1", { className: "lol-title" }, t("title")), /* @__PURE__ */ h("p", { className: "lol-sub" }, edition.length > 0 ? `${t("edition", { year })} \xB7 ${summary}` : t("intro"))), /* @__PURE__ */ h("div", { className: "lol-toolbar" }, digestReady && /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "lol-btn",
        "aria-expanded": digestOpen,
        onClick: () => setDigestOpen((open) => !open)
      },
      t("ask.digest.button")
    ), /* @__PURE__ */ h(
      "button",
      {
        type: "button",
        className: "lol-btn",
        disabled: status === "loading",
        onClick: () => {
          void load({ force: true });
        }
      },
      t("refresh")
    ))), stages.length > 1 && /* @__PURE__ */ h("div", { className: "lol-chips", role: "group", "aria-label": t("stage.label") }, [{ key: "", label: t("stage.all") }].concat(stages.map((value) => ({ key: value, label: stageName(value, t) }))).map((item) => /* @__PURE__ */ h(
      "button",
      {
        key: item.key === "" ? "all" : item.key,
        type: "button",
        className: "lol-chip",
        "aria-pressed": stage === item.key,
        onClick: () => setStage(item.key)
      },
      item.label
    ))))), /* @__PURE__ */ h("div", { className: "lol-scroll" }, /* @__PURE__ */ h("div", { className: "lol-scrollInner" }, digestOpen && /* @__PURE__ */ h(
      DigestAsk,
      {
        t,
        today: todayScope,
        stage: stageScope,
        onSubmit: (kind, question) => {
          void submitDigest(kind, question);
        },
        pending: ask.pending && ask.id === DIGEST_ASK_ID,
        error: ask.id === DIGEST_ASK_ID ? ask.error : null
      }
    ), status === "loading" && /* @__PURE__ */ h("p", { className: "lol-hint" }, t("loading")), error !== null && /* @__PURE__ */ h("div", { className: "lol-errorRow", role: "alert" }, /* @__PURE__ */ h("span", null, t("error")), /* @__PURE__ */ h("button", { type: "button", className: "lol-btn", onClick: () => {
      void load({ force: true });
    } }, t("retry"))), groups.map((group) => /* @__PURE__ */ h("section", { key: group.key, className: "lol-day" }, /* @__PURE__ */ h("h2", { className: "lol-dayLabel" }, formatDay(group.date, t)), group.items.map(renderCard))), status === "ready" && groups.length === 0 && /* @__PURE__ */ h("div", { className: "lol-empty" }, /* @__PURE__ */ h("p", { className: "lol-emptyTitle" }, noEdition ? t("empty.offSeason") : t("empty")), /* @__PURE__ */ h(
      "a",
      {
        className: "lol-btn",
        href: noEdition ? OFFICIAL_URL : SITE_URL,
        target: "_blank",
        rel: "noreferrer noopener"
      },
      t("empty.official")
    )))));
  }

  // src/panel.ts
  var inject = [
    "slots",
    "locale",
    "remote",
    "remote.session",
    "sessions",
    "workspaces",
    "uiWorkspace",
    "layout"
  ];
  function apply(ctx) {
    ensureStyles();
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-lol: dictionaries");
    const t = ctx.locale.bind(NS);
    const send = async (text) => {
      try {
        const workspace = await ctx.workspaces.initializeDefault();
        const sessionId = await ctx.sessions.create(
          workspace === void 0 ? {} : { workspaceId: workspace.workspaceId }
        );
        const result = await ctx.remote.session.prompt({
          requestId: mintRequestId(),
          sessionId,
          mode: "queue",
          content: [{ type: "text", text }]
        });
        if (!result.ok) return { ok: false, message: result.error?.message ?? "unknown error" };
        ctx.uiWorkspace.openSession(sessionId);
        ctx.layout.selectPanel(null);
        return { ok: true };
      } catch (reason) {
        return { ok: false, message: describe(reason) };
      }
    };
    const face = {
      /** Active interface locale, used to order watch links. */
      getLang: () => ctx.locale.getSnapshot().active,
      /** One match, with its score, stage and watch link attached. */
      askMatch: (match, question, year) => send(buildPrompt(t, match, question, year)),
      /** A ready-made prompt about a day or a stage. */
      askText: (text) => send(text)
    };
    ctx.slots.inject("main", () => ctx.slots.register({
      name: "main",
      key: PANEL_ID,
      locale: NS,
      inject: () => face
    }, WorldsPage));
    ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
      name: "sidebar.panellist",
      id: PANEL_ID,
      order: 30,
      locale: NS,
      label: () => t("panel")
    }, WorldsIcon));
  }

  // src/main.ts
  window.__ModuleLoader__.load({
    id: "dsh-lol-esports",
    factory(require2) {
      setReact(require2("react"));
      return { inject, apply };
    }
  });
})();
