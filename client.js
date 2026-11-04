window.__ModuleLoader__.load({
  id: 'dsh-lol-esports',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useState, useEffect, useCallback, useMemo, useRef } = React;

    const NS = 'lol';
    const PANEL_ID = 'lol';
    /** Ask state id used by the tournament-level box, so it never collides with a match id. */
    const DIGEST_ASK_ID = '__digest__';

    /** Public lolesports web key; replace here if Riot rotates it. */
    const API_KEY = '0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z';
    const API_BASE = 'https://esports-api.lolesports.com/persisted/gw';
    const WORLDS_ID = '98767975604431411';
    const OFFICIAL_URL = 'https://lolesports.com/live/worlds';
    const SITE_URL = 'https://lolesports.com/en-US';
    const REQUEST_TIMEOUT = 12000;
    const SCHEDULE_TTL = 60 * 1000;
    const DETAIL_TTL = 10 * 60 * 1000;
    const REFRESH_INTERVAL = 60 * 1000;
    /** In-game counters come from the livestats feed, one window per game. */
    const LIVE_BASE = 'https://feed.lolesports.com/livestats/v1';
    const LIVE_POLL = 20 * 1000;
    const LIVE_GAME_TTL = 60 * 1000;
    const LIVE_TIMEOUT = 10000;
    /** Two Worlds editions are always months apart; stages inside one are days apart. */
    const EDITION_GAP = 14 * 24 * 60 * 60 * 1000;

    // ---------------------------------------------------------------- locales

    const zh = {
      'panel': 'S 赛',
      'title': 'S 赛观赛助手',
      'intro': '全球总决赛赛程与赛果，一键跳转观赛，也可以让我陪你聊比赛。',
      'tab.label': '视图',
      'tab.schedule': '赛程',
      'tab.result': '赛果',
      'stage.label': '阶段',
      'stage.all': '全部',
      'refresh': '刷新',
      'loading': '正在获取赛程…',
      'error': '赛程获取失败。',
      'retry': '重试',
      'empty': '这个阶段没有比赛。',
      'empty.offSeason': 'S 赛暂无进行中的赛程。',
      'empty.official': '打开官方赛事页',
      'summary': '{done} 场已结束 · {open} 场待打',
      'edition': 'S赛 {year}',
      'state.live': '进行中',
      'state.done': '已结束',
      'state.upcoming': '未开始',
      'stage.playin': '入围赛',
      'stage.swiss': '瑞士轮',
      'stage.quarter': '四分之一决赛',
      'stage.semi': '半决赛',
      'stage.final': '决赛',
      'bo': 'BO{n}',
      'watch': '观赛',
      'detail': '详情',
      'detail.hide': '收起',
      'ask': '问 AI',
      'games': '逐局',
      'game': '第 {n} 局',
      'side.blue': '蓝方',
      'side.red': '红方',
      'links': '观赛链接',
      'links.official': '官方赛事页',
      'links.live': '官方直播',
      'links.replay': '中文回放',
      'links.replayEn': '英文流',
      'live.kills': '击杀',
      'live.gold': '经济',
      'live.towers': '推塔',
      'live.dragons': '小龙',
      'live.barons': '男爵',
      'live.players': '选手',
      'live.cs': '补刀',
      'live.lag': '延迟 {seconds} 秒',
      'live.lagHint': 'Riot 的实时接口要求数据窗口的结束时间至少比当前早 50 秒，所以这里永远比直播慢一分钟左右。',
      'live.finished': '本局已结束',
      'live.finishedHint': '这一局的最后一帧已经到达，赛程状态还没翻过来；下一局开始后这里会自动接上。',
      'ask.title': '聊聊这场比赛',
      'ask.placeholder': '想了解什么？Enter 发送，Shift+Enter 换行',
      'ask.send': '发送',
      'ask.sending': '发送中…',
      'ask.failed': '发送失败：{message}',
      'ask.hint': '会在默认工作区新建一个会话，带上这场比赛的信息一起发送。',
      'ask.digest.button': '聊赛事',
      'ask.digest.title': '聊整届赛况',
      'ask.digest.scope': '聊哪一段',
      'ask.digest.today': '今天',
      'ask.digest.lastDay': '最近比赛日',
      'ask.digest.hint': '会在默认工作区新建会话，带上上面这段赛况的数据。',
      'ask.quick.today.1': '今天这些比赛说明了什么？',
      'ask.quick.today.2': '今天哪支队伍的 BP 或打法值得注意？',
      'ask.quick.stage.1': '{stage} 接下来会怎么走？',
      'ask.quick.stage.2': '按现在的战绩，谁最可能出线？',
      'digest.finished': '已结束 ',
      'digest.pending': '待打 ',
      'digest.count': ' 场：',
      'digest.records': '当前战绩：',
      'ask.quick.preview': '帮我做赛前前瞻，并给出比分预测',
      'ask.quick.recap': '复盘这场比赛，指出决定胜负的关键转折',
      'ask.quick.draft': '结合版本谈谈这场的 BP 思路和对位重点',
      'ask.quick.watch': '我第一次看这场比赛，给我观赛重点',
      'prompt.template': '你是我的英雄联盟赛事观赛助手。下面是我正在看的这场比赛的信息，请用中文回答我的问题；信息不足时直接说明，不要编造。\n\n赛事：{event}\n阶段：{stage}\n对阵：{home} vs {away}\n赛制：{format}\n时间：{time}\n状态：{state}\n比分：{score}\n观赛/回放：{link}\n\n我的问题：{question}',
      'prompt.today': '你是我的英雄联盟赛事观赛助手。下面是今天（{date}）S 赛的比赛安排与结果，请用中文回答我的问题；数据不足时直接说明，不要编造。\n\n{matches}\n\n我的问题：{question}',
      'prompt.stage': '你是我的英雄联盟赛事观赛助手。下面是 S赛 {year} 的{stage}赛况，包含已结束的比赛、待打的比赛和当前战绩。请用中文回答我的问题，对走势的判断要给出依据；数据不足时直接说明，不要编造。\n\n{matches}\n\n我的问题：{question}',
      'time.today': '今天',
      'time.tomorrow': '明天',
    };

    const en = {
      'panel': 'Worlds',
      'title': 'Worlds Companion',
      'intro': 'World Championship schedule and results, one click to the stream, and an AI that watches along with you.',
      'tab.label': 'Views',
      'tab.schedule': 'Schedule',
      'tab.result': 'Results',
      'stage.label': 'Stage',
      'stage.all': 'All',
      'refresh': 'Refresh',
      'loading': 'Loading the schedule…',
      'error': 'Could not load the schedule.',
      'retry': 'Retry',
      'empty': 'No matches in this stage.',
      'empty.offSeason': 'No Worlds matches are scheduled right now.',
      'empty.official': 'Open the official page',
      'summary': '{done} played · {open} to play',
      'edition': 'Worlds {year}',
      'state.live': 'Live',
      'state.done': 'Final',
      'state.upcoming': 'Upcoming',
      'stage.playin': 'Play-In',
      'stage.swiss': 'Swiss Stage',
      'stage.quarter': 'Quarterfinals',
      'stage.semi': 'Semifinals',
      'stage.final': 'Finals',
      'bo': 'BO{n}',
      'watch': 'Watch',
      'detail': 'Details',
      'detail.hide': 'Hide',
      'ask': 'Ask AI',
      'games': 'Games',
      'game': 'Game {n}',
      'side.blue': 'blue',
      'side.red': 'red',
      'links': 'Watch links',
      'links.official': 'Official page',
      'links.live': 'Official stream',
      'links.replay': 'Chinese VOD',
      'links.replayEn': 'English VOD',
      'live.kills': 'Kills',
      'live.gold': 'Gold',
      'live.towers': 'Towers',
      'live.dragons': 'Dragons',
      'live.barons': 'Barons',
      'live.players': 'Players',
      'live.cs': 'CS',
      'live.lag': '{seconds}s behind live',
      'live.lagHint': 'Riot rejects any live window whose end is newer than 50 seconds, so this panel always trails the broadcast by about a minute.',
      'live.finished': 'Game finished',
      'live.finishedHint': 'The final frame of this game has arrived while the schedule still calls it live; the next game picks up automatically.',
      'ask.title': 'Talk about this match',
      'ask.placeholder': 'What do you want to know? Enter sends, Shift+Enter breaks the line',
      'ask.send': 'Send',
      'ask.sending': 'Sending…',
      'ask.failed': 'Could not send: {message}',
      'ask.hint': 'Starts a new chat in your default workspace with this match attached.',
      'ask.digest.button': 'Discuss',
      'ask.digest.title': 'Ask about the tournament',
      'ask.digest.scope': 'Scope',
      'ask.digest.today': 'Today',
      'ask.digest.lastDay': 'Latest match day',
      'ask.digest.hint': 'Starts a new chat in your default workspace with the matches above attached.',
      'ask.quick.today.1': 'What do today’s results tell us?',
      'ask.quick.today.2': 'Whose draft or play stood out today?',
      'ask.quick.stage.1': 'How will the {stage} play out from here?',
      'ask.quick.stage.2': 'Based on the current records, who is most likely to advance?',
      'digest.finished': 'Finished: ',
      'digest.pending': 'To play: ',
      'digest.count': ' matches',
      'digest.records': 'Records: ',
      'ask.quick.preview': 'Preview both teams and predict the score',
      'ask.quick.recap': 'Recap this match and point out the turning point',
      'ask.quick.draft': 'Explain the draft and the key lane matchups',
      'ask.quick.watch': 'I am new to this match — what should I watch for?',
      'prompt.template': 'You are my League of Legends esports companion. Here is the match I am watching. Answer my question in English, and say so plainly when the information above is not enough.\n\nEvent: {event}\nStage: {stage}\nMatch: {home} vs {away}\nFormat: {format}\nTime: {time}\nStatus: {state}\nScore: {score}\nWatch / replay: {link}\n\nMy question: {question}',
      'prompt.today': 'You are my League of Legends esports companion. Here is today’s ({date}) Worlds schedule and results. Answer in English, and say plainly when the information above is not enough.\n\n{matches}\n\nMy question: {question}',
      'prompt.stage': 'You are my League of Legends esports companion. Here is the current state of the {stage} at Worlds {year}: finished matches, matches still to play, and current records. Answer in English; back any prediction with the data above, and say plainly when the information is not enough.\n\n{matches}\n\nMy question: {question}',
      'time.today': 'Today',
      'time.tomorrow': 'Tomorrow',
    };

    // ------------------------------------------------------------------ styles

    const CSS = [
      '.lol-page{box-sizing:border-box;display:flex;flex-direction:column;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6}',
      '.lol-head{flex:none;padding:28px clamp(24px,4vw,48px) 0}',
      '[data-platform=darwin] .lol-head{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}',
      '.lol-headInner{display:flex;flex-direction:column;gap:14px;max-width:960px;margin:0 auto}',
      '.lol-titleRow{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px}',
      '.lol-heading{min-width:0}',
      '.lol-title{margin:0;font-size:20px;line-height:28px;font-weight:500}',
      '.lol-sub{margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}',
      '.lol-toolbar{display:flex;align-items:center;gap:8px;margin-left:auto}',
      '.lol-tabs{display:flex;gap:4px}',
      '.lol-tab{font-family:inherit;font-size:13px;line-height:20px;padding:4px 12px;border-radius:var(--dsw-radius-sm);border:.5px solid transparent;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.lol-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}',
      '.lol-tab[aria-selected=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}',
      '.lol-chips{display:flex;flex-wrap:wrap;gap:6px;padding-bottom:4px}',
      '.lol-chip{font-family:inherit;font-size:12px;line-height:18px;padding:3px 9px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.lol-chip:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.lol-chip[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l3)}',
      '.lol-chip:disabled{opacity:.5;cursor:not-allowed}',
      '.lol-scroll{flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable;--dsh-scrollbar-width:9px;--dsh-scrollbar-thumb-border:2px}',
      '.lol-scrollInner{display:flex;flex-direction:column;gap:20px;max-width:960px;margin:0 auto;padding:20px clamp(24px,4vw,48px) 48px}',
      '.lol-day{display:flex;flex-direction:column;gap:8px}',
      '.lol-dayLabel{position:sticky;top:0;z-index:1;margin:0;padding:4px 0;background:var(--dsw-alias-bg-base);font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-tertiary)}',
      '.lol-card{display:flex;flex-direction:column;gap:10px;padding:12px 16px;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md)}',
      '.lol-card[data-state=inProgress]{border-color:var(--dsw-alias-state-error-primary)}',
      '.lol-cardTop{display:flex;align-items:center;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}',
      '.lol-bo{font-variant-numeric:tabular-nums}',
      '.lol-badge{display:inline-flex;align-items:center;gap:4px;padding:0 6px;border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-layer-2);font-size:11px;line-height:18px}',
      '.lol-badge--live{color:var(--dsw-alias-state-error-primary)}',
      '.lol-badge--live:before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;corner-shape:round;background:currentColor}',
      '.lol-clock{margin-left:auto;font-variant-numeric:tabular-nums}',
      '.lol-cardMain{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}',
      '.lol-sides{display:grid;grid-template-columns:minmax(0,150px) auto minmax(0,150px);align-items:center;gap:12px;min-width:0}',
      '.lol-side{display:flex;align-items:center;gap:8px;min-width:0}',
      '.lol-side--home{justify-content:flex-end;text-align:right}',
      '.lol-side--lost{opacity:.6}',
      '.lol-teamText{display:flex;flex-direction:column;min-width:0}',
      '.lol-code{font-size:14px;line-height:20px;font-weight:600;letter-spacing:.02em}',
      '.lol-name{max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}',
      '.lol-mark{flex:none;width:28px;height:28px;border-radius:50%;corner-shape:round;object-fit:contain;background:var(--dsw-alias-bg-layer-2)}',
      '.lol-mark--text{display:flex;align-items:center;justify-content:center;font-size:9px;line-height:12px;font-weight:600;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}',
      '.lol-score{min-width:56px;text-align:center;font-size:18px;line-height:26px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.lol-card[data-state=unstarted] .lol-score{font-size:12px;line-height:26px;color:var(--dsw-alias-label-tertiary)}',
      '.lol-actions{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;margin-left:auto}',
      '.lol-btn{display:inline-flex;align-items:center;gap:4px;font-family:inherit;font-size:12px;line-height:18px;padding:4px 10px;border-radius:var(--dsw-radius-sm);border:.5px solid var(--dsw-alias-border-l2);background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;text-decoration:none}',
      '.lol-btn:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}',
      '.lol-btn[aria-expanded=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l3)}',
      '.lol-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.lol-btn--primary{padding:4px 12px;background:var(--dsw-alias-button-primary-fill);border-color:transparent;color:var(--dsw-alias-label-primary-foreground)}',
      '.lol-btn--primary:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover);color:var(--dsw-alias-label-primary-foreground)}',
      '.lol-detail{display:flex;flex-direction:column;gap:12px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l3)}',
      '.lol-section{display:flex;flex-direction:column;gap:6px}',
      '.lol-sectionTitle{margin:0;font-size:12px;line-height:18px;font-weight:500;color:var(--dsw-alias-label-tertiary)}',
      '.lol-links{display:flex;flex-wrap:wrap;gap:6px}',
      '.lol-games{display:flex;flex-direction:column;gap:6px;margin:0;padding:0;list-style:none}',
      '.lol-game{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.lol-gameNo{min-width:64px;color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums}',
      '.lol-gameSides{font-variant-numeric:tabular-nums}',
      '.lol-gameLinks{display:flex;gap:6px;margin-left:auto}',
      '.lol-digest{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1)}',
      '.lol-digestTop{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.lol-digestTitle{margin:0;font-size:13px;line-height:20px;font-weight:500}',
      '.lol-digestScopes{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}',
      '.lol-ask{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2)}',
      '.lol-askQuick{display:flex;flex-wrap:wrap;gap:6px}',
      '.lol-askInput{box-sizing:border-box;width:100%;min-height:56px;padding:8px 10px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:20px;resize:vertical}',
      '.lol-askFoot{display:flex;flex-wrap:wrap;align-items:center;gap:8px}',
      '.lol-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);flex:1;min-width:160px}',
      '.lol-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}',
      '.lol-errorRow{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:13px;line-height:20px;color:var(--dsw-alias-state-error-primary)}',
      '.lol-empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:48px 20px;text-align:center;color:var(--dsw-alias-label-tertiary)}',
      '.lol-emptyTitle{margin:0;font-size:14px;line-height:22px;color:var(--dsw-alias-label-secondary)}',
      '.lol-tab:focus-visible,.lol-chip:focus-visible,.lol-btn:focus-visible,.lol-askInput:focus-visible{outline:2px solid var(--dsw-focus-ring-color);outline-offset:1px}',
      '.lol-live{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2)}',
      '.lol-liveTop{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px}',
      '.lol-liveKills{display:flex;align-items:baseline;gap:8px;font-size:20px;line-height:26px;font-weight:600;font-variant-numeric:tabular-nums}',
      '.lol-liveTeamCode{font-size:12px;line-height:18px;font-weight:500;letter-spacing:.02em;color:var(--dsw-alias-label-secondary)}',
      '.lol-liveMeta{display:flex;flex-wrap:wrap;gap:4px 14px;margin-left:auto;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}',
      '.lol-liveMetric b{font-weight:500;color:var(--dsw-alias-label-primary)}',
      '.lol-liveLag{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-tertiary)}',
      '.lol-liveFinished{color:var(--dsw-alias-label-tertiary)}',
      '.lol-roll{display:inline-block;animation:lol-roll-in .3s cubic-bezier(.22,.61,.36,1)}',
      '@keyframes lol-roll-in{from{transform:translateY(.42em);opacity:.2}to{transform:none;opacity:1}}',
      '.lol-livePlayers{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;padding-top:8px;border-top:.5px solid var(--dsw-alias-border-l3)}',
      '.lol-liveTeam{display:flex;flex-direction:column;gap:2px;min-width:0}',
      '.lol-liveKillLabel{font-size:11px;line-height:16px;letter-spacing:.02em;color:var(--dsw-alias-label-tertiary)}',
      '.lol-livePlayer{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}',
      '.lol-liveName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.lol-liveKda,.lol-liveCs{color:var(--dsw-alias-label-primary)}',
      '@media (max-width:640px){.lol-livePlayers{grid-template-columns:minmax(0,1fr)}}',
      '@media (prefers-reduced-motion:reduce){.lol-page *{transition:none!important;animation:none!important}}',
    ].join('');

    const STYLE_TAG_ID = 'dsh-lol-esports/page.css';
    if (
      typeof document !== 'undefined' &&
      document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_TAG_ID)}]`) === null
    ) {
      const tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-lol-esports';
      tag.dataset.pluginCss = STYLE_TAG_ID;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ------------------------------------------------------------------- data

    const scheduleCache = { at: 0, events: null };
    const detailCache = new Map();

    async function apiGet(path, params) {
      const url = new URL(`${API_BASE}/${path}`);
      url.searchParams.set('hl', 'zh-CN');
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
      let failure = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = controller === null ? null : setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
        try {
          const init = { headers: { 'x-api-key': API_KEY } };
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

    /** The API hands out http:// asset URLs; the app itself is served over https. */
    function httpsImage(url) {
      if (typeof url !== 'string' || url === '') return null;
      return url.startsWith('http://') ? `https://${url.slice(7)}` : url;
    }

    /** The API reports each team's tournament record; only the numbers matter here. */
    function normalizeRecord(record) {
      if (record === null || typeof record !== 'object') return null;
      const wins = record.wins;
      const losses = record.losses;
      if (typeof wins !== 'number' || typeof losses !== 'number') return null;
      return { wins, losses };
    }

    function normalizeTeam(team) {
      const value = team ?? {};
      const code = typeof value.code === 'string' && value.code !== '' ? value.code : 'TBD';
      return {
        code,
        name: typeof value.name === 'string' ? value.name : '',
        image: httpsImage(value.image),
        score: value.result?.gameWins ?? 0,
        record: normalizeRecord(value.record),
      };
    }

    function normalizeEvent(raw) {
      const match = raw.match ?? {};
      const rawTeams = Array.isArray(match.teams) ? match.teams : [];
      const bestOf = match.strategy?.count ?? 0;
      const teams = [normalizeTeam(rawTeams[0]), normalizeTeam(rawTeams[1])];
      /**
       * The schedule keeps a decided series on "inProgress" for a few minutes
       * after the last game, so settle it locally: a best-of is over as soon as
       * one side holds the wins it needs.
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

    async function loadSchedule(force) {
      if (!force && scheduleCache.events !== null && Date.now() - scheduleCache.at < SCHEDULE_TTL) {
        return scheduleCache.events;
      }
      const payload = await apiGet('getSchedule', { leagueId: WORLDS_ID });
      const raw = payload?.data?.schedule?.events;
      const events = (Array.isArray(raw) ? raw : [])
        .filter(item => item?.type === 'match' && item.match?.id !== undefined)
        .map(normalizeEvent)
        .sort((a, b) => a.start - b.start);
      scheduleCache.at = Date.now();
      scheduleCache.events = events;
      return events;
    }

    function vodUrl(vod) {
      if (vod.provider === 'twitch') return `https://www.twitch.tv/videos/${encodeURIComponent(vod.parameter)}`;
      if (vod.provider === 'youtube') {
        const base = `https://www.youtube.com/watch?v=${encodeURIComponent(vod.parameter)}`;
        const seconds = Math.floor((vod.startMillis ?? 0) / 1000);
        return seconds >= 5 ? `${base}&t=${seconds}s` : base;
      }
      return null;
    }

    function streamUrl(stream) {
      if (stream?.provider === 'twitch') return `https://www.twitch.tv/${encodeURIComponent(stream.parameter)}`;
      if (stream?.provider === 'youtube') return `https://www.youtube.com/watch?v=${encodeURIComponent(stream.parameter)}`;
      return null;
    }

    function localeGroup(locale) {
      const value = typeof locale === 'string' ? locale.toLowerCase() : '';
      if (value.startsWith('zh')) return 'zh';
      if (value.startsWith('en')) return 'en';
      return null;
    }

    /**
     * At most one Chinese and one English target, UI language first. A Chinese
     * interface surfaces the Chinese broadcast, an English one the English feed;
     * other feed locales are dropped because the panel cannot label them.
     */
    function localizedTargets(items, lang) {
      const zh = items.find(item => localeGroup(item.locale) === 'zh');
      const en = items.find(item => localeGroup(item.locale) === 'en');
      const ordered = localeGroup(lang) === 'zh' ? [zh, en] : [en, zh];
      return ordered.filter(item => item !== undefined);
    }

    /** Watch targets that survived URL building, de-duplicated by address. */
    function watchTargets(vods, url) {
      const seen = new Set();
      const targets = [];
      for (const vod of vods) {
        const href = url(vod);
        if (href === null || href === '' || seen.has(href)) continue;
        seen.add(href);
        targets.push({ href, locale: vod.locale });
      }
      return targets;
    }

    async function loadDetail(matchId) {
      const cached = detailCache.get(matchId);
      if (cached !== undefined && Date.now() - cached.at < DETAIL_TTL) return cached.detail;
      const payload = await apiGet('getEventDetails', { id: matchId });
      const event = payload?.data?.event;
      if (event === undefined || event === null) throw new Error('empty event');
      const teamById = new Map();
      for (const team of event.match?.teams ?? []) teamById.set(String(team.id), team);
      const games = Array.isArray(event.match?.games) ? event.match.games : [];
      const detail = {
        streams: (Array.isArray(event.streams) ? event.streams : [])
          .map(stream => ({ url: streamUrl(stream), locale: stream.locale ?? '' }))
          .filter(item => item.url !== null),
        games: games
          .filter(game => game.state === 'completed' || game.state === 'inProgress')
          .map(game => {
            const vods = Array.isArray(game.vods) ? game.vods : [];
            return {
              number: game.number,
              sides: (Array.isArray(game.teams) ? game.teams : []).map(side => ({
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

    // -------------------------------------------------------------- live stats

    const liveGameCache = new Map();
    const liveStatsCache = new Map();

    /** The in-game feed only knows games, so resolve the match's current game first. */
    async function loadLiveGameId(matchId) {
      const cached = liveGameCache.get(matchId);
      if (cached !== undefined && Date.now() - cached.at < LIVE_GAME_TTL) return cached;
      const payload = await apiGet('getEventDetails', { id: matchId });
      const event = payload?.data?.event;
      const games = event?.match?.games;
      const live = Array.isArray(games) ? games.find(game => game?.state === 'inProgress') : undefined;
      const gameId = live?.id === undefined || live?.id === null ? null : String(live.id);
      /** Schedule teams carry no ids, so the blue/red mapping has to come from here. */
      const teams = (Array.isArray(event?.match?.teams) ? event.match.teams : [])
        .filter(team => team?.id !== undefined && team?.id !== null)
        .map(team => ({ id: String(team.id), code: typeof team.code === 'string' ? team.code : '' }));
      const entry = { at: Date.now(), gameId, teams };
      liveGameCache.set(matchId, entry);
      return entry;
    }

    /**
     * Riot hands out summoner names with the team code glued on — "IG TheShy",
     * "TES 369". Strip that prefix only when it really is the team code, so a
     * two-word player name such as "Hans Sama" stays whole.
     */
    function displayName(name, code) {
      const value = typeof name === 'string' ? name : '';
      const prefix = typeof code === 'string' ? code.trim() : '';
      if (prefix === '' || value === '') return value;
      const cut = value.indexOf(' ');
      if (cut === -1) return value;
      if (value.slice(0, cut).toLowerCase() !== prefix.toLowerCase()) return value;
      const rest = value.slice(cut + 1).trim();
      return rest === '' ? value : rest;
    }

    function sumOf(players, key) {
      return players.reduce((total, player) => total + (Number(player[key]) || 0), 0);
    }

    /** 45210 -> "45.2k", small numbers left alone. */
    function formatGold(value) {
      const gold = Number(value) || 0;
      return gold >= 1000 ? `${(gold / 1000).toFixed(1)}k` : String(gold);
    }

    /** One side of a frame, joined with the participant metadata that names it. */
    function liveSide(team, metadata, metaKey) {
      const roster = new Map();
      for (const entry of metadata?.[metaKey]?.participantMetadata ?? []) roster.set(entry.participantId, entry);
      const players = (Array.isArray(team?.participants) ? team.participants : []).map(player => {
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
     * The newest frame of a window payload. Riot sometimes serves metadata with
     * every counter still at zero before the game produces stats; that is treated
     * as "no data yet" so the strip can stay out of the way.
     */
    function normalizeLive(payload) {
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
      /**
       * A game starts at 0/0 with everyone on level 1, so an all-zero frame is
       * real data while it is fresh. Riot's metadata-only frames keep the
       * game's start timestamp, so age is what tells the two apart.
       */
      const at = typeof frame.rfc460Timestamp === 'string' ? frame.rfc460Timestamp : null;
      const age = at === null ? Number.POSITIVE_INFINITY : Date.now() - Date.parse(at);
      if (idle && !(age >= 0 && age < 10 * 60 * 1000)) return null;
      return { blue, red, at, state: typeof frame.gameState === 'string' ? frame.gameState : null };
    }

    /** One window request; null when the feed has nothing for that range. */
    async function fetchWindow(gameId, startingTime) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = controller === null ? null : setTimeout(() => controller.abort(), LIVE_TIMEOUT);
      try {
        const init = controller === null ? {} : { signal: controller.signal };
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
     * The feed answers with a ten-second window that starts at an aligned stamp,
     * and rejects any window whose end is less than 50 seconds old (see its own
     * BAD_QUERY_PARAMETER text), so the newest pollable window sits about a minute
     * behind the live game. A bare call returns the game's opening frames instead,
     * which is the only thing available while that window does not exist yet.
     */
    async function loadLiveStats(gameId) {
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

    // --------------------------------------------------------------- formatting

    /** Two Worlds editions are months apart; take the last contiguous run. */
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
      if (typeof document !== 'undefined') {
        const lang = document.documentElement.getAttribute('lang');
        if (typeof lang === 'string' && lang !== '') return lang;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') return navigator.language;
      return 'zh-CN';
    }

    const dayFormatters = new Map();
    function formatDay(date, t) {
      const lang = uiLang();
      let formatter = dayFormatters.get(lang);
      if (formatter === undefined) {
        formatter = new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', weekday: 'short' });
        dayFormatters.set(lang, formatter);
      }
      const label = formatter.format(date);
      const offset = Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000);
      if (offset === 0) return `${t('time.today')} · ${label}`;
      if (offset === 1) return `${t('time.tomorrow')} · ${label}`;
      return label;
    }

    const clockFormatters = new Map();
    function formatClock(date) {
      const lang = uiLang();
      let formatter = clockFormatters.get(lang);
      if (formatter === undefined) {
        formatter = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' });
        clockFormatters.set(lang, formatter);
      }
      return formatter.format(date);
    }

    function formatFull(date) {
      return new Intl.DateTimeFormat(uiLang(), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
    }

    function describe(reason) {
      return reason instanceof Error ? reason.message : String(reason);
    }

    function mintRequestId() {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
      return `lol-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function stateLabel(state, t) {
      if (state === 'inProgress') return t('state.live');
      if (state === 'completed') return t('state.done');
      return t('state.upcoming');
    }

    /** Stage names arrive from the zh-CN feed; map the known ones for other locales. */
    const STAGE_KEYS = {
      '入围赛': 'stage.playin',
      '瑞士轮': 'stage.swiss',
      '四分之一决赛': 'stage.quarter',
      '半决赛': 'stage.semi',
      '决赛': 'stage.final',
    };

    function stageName(block, t) {
      const key = STAGE_KEYS[block];
      return key === undefined ? block : t(key);
    }

    function buildPrompt(t, match, question, year) {
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

    // ------------------------------------------------------------- digest scope

    /** "10/24 01:00" — compact local stamp for the text handed to the model. */
    const stampFormatters = new Map();
    function stamp(date) {
      const lang = uiLang();
      let formatter = stampFormatters.get(lang);
      if (formatter === undefined) {
        formatter = new Intl.DateTimeFormat(lang, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        stampFormatters.set(lang, formatter);
      }
      return formatter.format(date);
    }

    function formatDate(date) {
      return new Intl.DateTimeFormat(uiLang(), { dateStyle: 'medium' }).format(date);
    }

    function matchLine(match, t, withStage) {
      const home = match.teams[0];
      const away = match.teams[1];
      const score = match.state === 'unstarted' ? 'vs' : `${home.score}:${away.score}`;
      const tail = [t('bo', { n: match.bestOf })];
      if (match.state === 'inProgress') tail.push(t('state.live'));
      const stage = withStage && match.stage !== '' ? `${stageName(match.stage, t)} ` : '';
      return `- ${stamp(match.start)} ${stage}${home.code} ${score} ${away.code}（${tail.join('，')}）`;
    }

    /** Finished and pending matches as two labelled blocks, plus team records when asked. */
    function digestBlock(events, t, options) {
      const opts = options ?? {};
      const finished = events.filter(event => event.state === 'completed').sort((a, b) => a.start - b.start);
      const pending = events.filter(event => event.state !== 'completed').sort((a, b) => a.start - b.start);
      const lines = [];
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
    function recordsOf(events) {
      const byTeam = new Map();
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

    /** The local day to talk about: today when it has matches, else the last day that had any. */
    function resolveTodayScope(events) {
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

    /** The stage to talk about: the active filter, else the stage of the next match. */
    function resolveStageScope(events, stage) {
      const blocks = [];
      for (const event of events) if (event.stage !== '' && !blocks.includes(event.stage)) blocks.push(event.stage);
      let chosen = stage;
      if (chosen === '') {
        const next = events.filter(event => event.state !== 'completed').sort((a, b) => a.start - b.start)[0];
        chosen = next?.stage ?? blocks[blocks.length - 1] ?? '';
      }
      return { stage: chosen, events: chosen === '' ? events : events.filter(event => event.stage === chosen) };
    }

    function buildDigestPrompt(t, kind, scope, year, question) {
      if (kind === 'today') {
        return t('prompt.today', {
          date: formatDate(scope.date),
          matches: digestBlock(scope.events, t, { withStage: true }),
          question,
        });
      }
      return t('prompt.stage', {
        year,
        stage: stageName(scope.stage, t),
        matches: digestBlock(scope.events, t, { records: true }),
        question,
      });
    }

    // ---------------------------------------------------------------- components

    /** Sidebar glyph: the Worlds trophy at the size the sidebar asks for. */
    function WorldsIcon({ size, active }) {
      return h('svg', {
        viewBox: '0 0 24 24',
        width: size,
        height: size,
        'aria-hidden': true,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: active ? 1.6 : 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        style: { display: 'block' },
      },
        h('path', { d: 'M8.5 3.5h7V9a3.5 3.5 0 0 1-7 0V3.5z' }),
        h('path', { d: 'M8.5 5H5.5v1.5a3.5 3.5 0 0 0 3 3.46' }),
        h('path', { d: 'M15.5 5h3v1.5a3.5 3.5 0 0 1-3 3.46' }),
        h('path', { d: 'M12 12.5V16' }),
        h('path', { d: 'M8.5 20.5h7' }),
        h('path', { d: 'M9.5 20.5v-1.5a2.5 2.5 0 0 1 5 0v1.5' }),
      );
    }

    /** Team badge with a text fallback when the logo is missing or fails. */
    function TeamMark({ team }) {
      const [broken, setBroken] = useState(false);
      if (team.image === null || broken) {
        return h('span', { className: 'lol-mark lol-mark--text', 'aria-hidden': true }, team.code);
      }
      return h('img', {
        className: 'lol-mark',
        src: team.image,
        alt: '',
        loading: 'lazy',
        onError: () => setBroken(true),
      });
    }

    function LinkButton({ href, label }) {
      return h('a', {
        className: 'lol-btn',
        href,
        target: '_blank',
        rel: 'noreferrer noopener',
      }, label, h('span', { 'aria-hidden': true }, '↗'));
    }

    function AskBox({ t, match, onSubmit, pending, error }) {
      const [text, setText] = useState('');
      const quickKeys = [
        match.state === 'completed' ? 'ask.quick.recap' : 'ask.quick.preview',
        'ask.quick.draft',
        'ask.quick.watch',
      ];
      const submit = (question) => {
        const value = (question ?? text).trim();
        if (value === '' || pending) return;
        onSubmit(value);
      };
      const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          submit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setText('');
        }
      };
      return h('div', { className: 'lol-ask' },
        h('h3', { className: 'lol-sectionTitle' }, t('ask.title')),
        h('div', { className: 'lol-askQuick' },
          quickKeys.map(key => h('button', {
            key,
            type: 'button',
            className: 'lol-chip',
            disabled: pending,
            onClick: () => submit(t(key)),
          }, t(key))),
        ),
        h('textarea', {
          className: 'lol-askInput',
          rows: 2,
          value: text,
          placeholder: t('ask.placeholder'),
          disabled: pending,
          onChange: (event) => setText(event.target.value),
          onKeyDown,
        }),
        h('div', { className: 'lol-askFoot' },
          h('span', { className: 'lol-hint' }, t('ask.hint')),
          h('button', {
            type: 'button',
            className: 'lol-btn lol-btn--primary',
            disabled: pending || text.trim() === '',
            onClick: () => submit(),
          }, pending ? t('ask.sending') : t('ask.send')),
        ),
        error !== null && h('p', { className: 'lol-error', role: 'alert' }, t('ask.failed', { message: error })),
      );
    }

    /** Tournament-level ask box: a day's results, or how a stage plays out from here. */
    function DigestAsk({ t, today, stage, onSubmit, pending, error }) {
      const [scope, setScope] = useState(today === null ? 'stage' : 'today');
      const [text, setText] = useState('');
      const canToday = today !== null;
      const canStage = stage.stage !== '';
      if (!canToday && !canStage) return null;
      const active = scope === 'today' && canToday ? 'today' : 'stage';
      const stageLabel = stageName(stage.stage, t);
      const quickKeys = active === 'today'
        ? ['ask.quick.today.1', 'ask.quick.today.2']
        : ['ask.quick.stage.1', 'ask.quick.stage.2'];
      const submit = (question) => {
        const value = (question ?? text).trim();
        if (value === '' || pending) return;
        onSubmit(active, value);
      };
      const onKeyDown = (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          submit();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          setText('');
        }
      };
      return h('div', { className: 'lol-digest' },
        h('div', { className: 'lol-digestTop' },
          h('h3', { className: 'lol-digestTitle' }, t('ask.digest.title')),
          h('div', { className: 'lol-digestScopes', role: 'group', 'aria-label': t('ask.digest.scope') },
            canToday && h('button', {
              type: 'button',
              className: 'lol-chip',
              'aria-pressed': active === 'today',
              onClick: () => setScope('today'),
            }, today.isToday ? t('ask.digest.today') : t('ask.digest.lastDay')),
            canStage && h('button', {
              type: 'button',
              className: 'lol-chip',
              'aria-pressed': active === 'stage',
              onClick: () => setScope('stage'),
            }, stageLabel),
          ),
        ),
        h('div', { className: 'lol-askQuick' },
          quickKeys.map(key => h('button', {
            key,
            type: 'button',
            className: 'lol-chip',
            disabled: pending,
            onClick: () => submit(t(key, { stage: stageLabel })),
          }, t(key, { stage: stageLabel }))),
        ),
        h('textarea', {
          className: 'lol-askInput',
          rows: 2,
          value: text,
          placeholder: t('ask.placeholder'),
          disabled: pending,
          onChange: (event) => setText(event.target.value),
          onKeyDown,
        }),
        h('div', { className: 'lol-askFoot' },
          h('span', { className: 'lol-hint' }, t('ask.digest.hint')),
          h('button', {
            type: 'button',
            className: 'lol-btn lol-btn--primary',
            disabled: pending || text.trim() === '',
            onClick: () => submit(),
          }, pending ? t('ask.sending') : t('ask.send')),
        ),
        error !== null && h('p', { className: 'lol-error', role: 'alert' }, t('ask.failed', { message: error })),
      );
    }

    /** Per-match detail: watch links and the games that were actually played. */
    function MatchDetail({ t, match, lang }) {
      const [state, setState] = useState({ status: 'loading', detail: null, error: null });
      useEffect(() => {
        let cancelled = false;
        setState({ status: 'loading', detail: null, error: null });
        loadDetail(match.id).then(detail => {
          if (!cancelled) setState({ status: 'ready', detail, error: null });
        }).catch(reason => {
          if (!cancelled) setState({ status: 'error', detail: null, error: describe(reason) });
        });
        return () => { cancelled = true; };
      }, [match.id]);

      const detail = state.detail;
      const first = detail !== null && detail.games.length > 0 ? detail.games[0] : null;
      const linkLabel = (locale) => (localeGroup(locale) === 'en' ? t('links.replayEn') : t('links.replay'));
      const links = [];
      const seen = new Set();
      const push = (href, label) => {
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

      return h('div', { className: 'lol-detail' },
        h('div', { className: 'lol-section' },
          h('h3', { className: 'lol-sectionTitle' }, t('links')),
          h('div', { className: 'lol-links' },
            links.map(link => h(LinkButton, { key: link.href, href: link.href, label: link.label })),
          ),
          state.status === 'error' && h('p', { className: 'lol-error', role: 'alert' }, t('error')),
        ),
        detail !== null && detail.games.length > 0 && h('div', { className: 'lol-section' },
          h('h3', { className: 'lol-sectionTitle' }, t('games')),
          h('ul', { className: 'lol-games' },
            detail.games.map(game => h('li', { key: game.number, className: 'lol-game' },
              h('span', { className: 'lol-gameNo' }, t('game', { n: game.number })),
              h('span', { className: 'lol-gameSides' },
                game.sides.map(side => `${side.code} (${t(`side.${side.side}`)})`).join(' vs '),
              ),
              h('span', { className: 'lol-gameLinks' },
                localizedTargets(game.vods, lang).map(vod => h(LinkButton, {
                  key: vod.href,
                  href: vod.href,
                  label: linkLabel(vod.locale),
                })),
              ),
            )),
          ),
        ),
      );
    }

    /** A value keyed by itself, so a changed number replays the roll animation. */
    function Roll({ value }) {
      return h('span', { key: String(value), className: 'lol-roll' }, String(value));
    }

    /** In-game counters for the match being played, polled only while it is live. */
    function LiveStrip({ t, match }) {
      const [state, setState] = useState({ status: 'loading', stats: null });

      useEffect(() => {
        if (match.state !== 'inProgress') return undefined;
        let cancelled = false;
        let timer = null;
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
          } catch (reason) {
            if (!cancelled) setState({ status: 'empty', stats: null });
          }
        };
        tick();
        timer = setInterval(tick, LIVE_POLL);
        return () => {
          cancelled = true;
          if (timer !== null) clearInterval(timer);
        };
      }, [match.id, match.state]);

      /** The frame timestamp is fixed between polls, so tick to keep the lag honest. */
      const [, setClock] = useState(0);
      useEffect(() => {
        const id = setInterval(() => setClock(value => value + 1), 1000);
        return () => clearInterval(id);
      }, []);

      if (match.state !== 'inProgress') return null;
      if (state.status !== 'ready' || state.stats === null) return null;

      const { blue, red } = state.stats;
      const finished = state.stats.state === 'finished';
      const lag = finished || state.stats.at === null
        ? null
        : Math.max(0, Math.round((Date.now() - Date.parse(state.stats.at)) / 1000));
      /** Sides arrive as blue/red; the schedule knows the codes, so join on team id. */
      const codeOf = (teamId, fallbackKey) => {
        const team = (state.teams ?? []).find(item => item.id === teamId);
        return team === undefined || team.code === '' ? t(fallbackKey) : team.code;
      };
      const metric = (label, left, right) => h('span', { key: label, className: 'lol-liveMetric' },
        `${label} `,
        h('b', null, h(Roll, { value: left }), ' : ', h(Roll, { value: right })),
      );
      const column = (players, code) => h('div', { className: 'lol-liveTeam' },
        players.map(player => h('div', { key: player.id, className: 'lol-livePlayer' },
          h('span', {
            className: 'lol-liveName',
            title: player.champion === '' ? player.name : `${player.name} · ${player.champion}`,
          }, displayName(player.name, code)),
          h('span', { className: 'lol-liveKda' }, `${player.kills}/${player.deaths}/${player.assists}`),
          h('span', { className: 'lol-liveCs', title: t('live.cs') }, String(player.cs)),
        )),
      );

      return h('div', { className: 'lol-live' },
        h('div', { className: 'lol-liveTop' },
          h('div', { className: 'lol-liveKills' },
            h('span', { className: 'lol-liveKillLabel' }, t('live.kills')),
            h('span', { className: 'lol-liveTeamCode' }, codeOf(blue.teamId, 'side.blue')),
            h('b', null, h(Roll, { value: `${blue.kills} : ${red.kills}` })),
            h('span', { className: 'lol-liveTeamCode' }, codeOf(red.teamId, 'side.red')),
          ),
          h('div', { className: 'lol-liveMeta' },
            metric(t('live.gold'), formatGold(blue.gold), formatGold(red.gold)),
            metric(t('live.towers'), blue.towers, red.towers),
            metric(t('live.dragons'), blue.dragons, red.dragons),
            metric(t('live.barons'), blue.barons, red.barons),
            finished
              ? h('span', { className: 'lol-liveFinished', title: t('live.finishedHint') }, t('live.finished'))
              : lag === null
                ? null
                : h('span', { className: 'lol-liveLag', title: t('live.lagHint') }, t('live.lag', { seconds: lag })),
          ),
        ),
        h('div', { className: 'lol-livePlayers' },
          column(blue.players, codeOf(blue.teamId, 'side.blue')),
          column(red.players, codeOf(red.teamId, 'side.red')),
        ),
      );
    }

    function MatchCard({ match, t, lang, expanded, onToggle, askOpen, onAskOpen, onSubmitAsk, askPending, askError }) {
      const home = match.teams[0];
      const away = match.teams[1];
      const done = match.state === 'completed';
      const winner = done ? (home.score > away.score ? 0 : away.score > home.score ? 1 : -1) : -1;
      const tone = match.state === 'inProgress' ? 'live' : done ? 'done' : 'upcoming';
      return h('article', { className: 'lol-card', 'data-state': match.state },
        h('div', { className: 'lol-cardTop' },
          match.stage !== '' && h('span', { className: 'lol-stage' }, stageName(match.stage, t)),
          h('span', { className: 'lol-bo' }, t('bo', { n: match.bestOf })),
          h('span', { className: `lol-badge lol-badge--${tone}` }, stateLabel(match.state, t)),
          h('time', { className: 'lol-clock', dateTime: match.start.toISOString() }, formatClock(match.start)),
        ),
        h('div', { className: 'lol-cardMain' },
          h('div', { className: 'lol-sides' },
            h('div', { className: `lol-side lol-side--home${winner === 1 ? ' lol-side--lost' : ''}` },
              h(TeamMark, { team: home }),
              h('span', { className: 'lol-teamText' },
                h('b', { className: 'lol-code' }, home.code),
                home.name !== '' && h('span', { className: 'lol-name', title: home.name }, home.name),
              ),
            ),
            h('div', { className: 'lol-score' }, match.state === 'unstarted' ? 'VS' : `${home.score} : ${away.score}`),
            h('div', { className: `lol-side lol-side--away${winner === 0 ? ' lol-side--lost' : ''}` },
              h('span', { className: 'lol-teamText' },
                h('b', { className: 'lol-code' }, away.code),
                away.name !== '' && h('span', { className: 'lol-name', title: away.name }, away.name),
              ),
              h(TeamMark, { team: away }),
            ),
          ),
          h('div', { className: 'lol-actions' },
            h(LinkButton, { href: done ? SITE_URL : OFFICIAL_URL, label: done ? t('links.official') : t('watch') }),
            h('button', {
              type: 'button',
              className: 'lol-btn',
              'aria-expanded': askOpen,
              onClick: () => onAskOpen(!askOpen),
            }, t('ask')),
            h('button', {
              type: 'button',
              className: 'lol-btn',
              'aria-expanded': expanded,
              onClick: onToggle,
            }, expanded ? t('detail.hide') : t('detail')),
          ),
        ),
        match.state === 'inProgress' && h(LiveStrip, { t, match }),
        askOpen && h(AskBox, { t, match, onSubmit: onSubmitAsk, pending: askPending, error: askError }),
        expanded && h(MatchDetail, { t, match, lang }),
      );
    }

    /** The Worlds panel: schedule and results, one card per match. */
    function WorldsPage(props) {
      const { t } = props;
      /** Watch links follow the interface language, so read it on every render. */
      const lang = props.getLang();
      const mounted = useRef(true);
      const [tab, setTab] = useState('schedule');
      const [stage, setStage] = useState('');
      const [status, setStatus] = useState('loading');
      const [events, setEvents] = useState([]);
      const [error, setError] = useState(null);
      const [expandedId, setExpandedId] = useState(null);
      const [askId, setAskId] = useState(null);
      const [digestOpen, setDigestOpen] = useState(false);
      const [ask, setAsk] = useState({ id: null, pending: false, error: null });

      useEffect(() => () => { mounted.current = false; }, []);

      const load = useCallback(async (options) => {
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
          setStatus(current => (current === 'ready' ? 'ready' : 'error'));
          setError(describe(reason));
        }
      }, []);

      useEffect(() => { load({}); }, [load]);
      useEffect(() => {
        const timer = setInterval(() => { load({ silent: true }); }, REFRESH_INTERVAL);
        return () => clearInterval(timer);
      }, [load]);

      const edition = useMemo(() => currentEdition(events), [events]);
      const year = edition.length > 0 ? edition[0].start.getFullYear() : new Date().getFullYear();
      const stages = useMemo(() => {
        const seen = [];
        for (const event of edition) {
          if (event.stage !== '' && !seen.includes(event.stage)) seen.push(event.stage);
        }
        return seen;
      }, [edition]);

      const filtered = useMemo(
        () => (stage === '' ? edition : edition.filter(event => event.stage === stage)),
        [edition, stage],
      );
      const live = useMemo(() => filtered.filter(event => event.state === 'inProgress'), [filtered]);
      const upcoming = useMemo(
        () => filtered.filter(event => event.state === 'unstarted').sort((a, b) => a.start - b.start),
        [filtered],
      );
      const completed = useMemo(
        () => filtered.filter(event => event.state === 'completed').sort((a, b) => b.start - a.start),
        [filtered],
      );
      const groups = useMemo(
        () => groupByDay(tab === 'schedule' ? upcoming : completed),
        [tab, upcoming, completed],
      );
      const todayScope = useMemo(() => resolveTodayScope(edition), [edition]);
      const stageScope = useMemo(() => resolveStageScope(edition, stage), [edition, stage]);
      const digestReady = todayScope !== null || stageScope.stage !== '';

      const submitAsk = useCallback(async (match, question) => {
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

      const submitDigest = useCallback(async (kind, question) => {
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

      const renderCard = (match) => h(MatchCard, {
        key: match.id,
        match,
        t,
        lang,
        expanded: expandedId === match.id,
        onToggle: () => setExpandedId(current => (current === match.id ? null : match.id)),
        askOpen: askId === match.id,
        onAskOpen: (open) => setAskId(open ? match.id : null),
        onSubmitAsk: (question) => { void submitAsk(match, question); },
        askPending: ask.pending && ask.id === match.id,
        askError: ask.id === match.id ? ask.error : null,
      });

      const summary = t('summary', { done: completed.length, open: upcoming.length + live.length });
      const noEdition = status === 'ready' && edition.length === 0;

      return h('div', { className: 'lol-page' },
        h('div', { className: 'lol-head' },
          h('div', { className: 'lol-headInner' },
            h('div', { className: 'lol-titleRow' },
              h('div', { className: 'lol-heading' },
                h('h1', { className: 'lol-title' }, t('title')),
                h('p', { className: 'lol-sub' }, edition.length > 0 ? `${t('edition', { year })} · ${summary}` : t('intro')),
              ),
              h('div', { className: 'lol-toolbar' },
                h('div', { className: 'lol-tabs', role: 'tablist', 'aria-label': t('tab.label') },
                  ['schedule', 'result'].map(value => h('button', {
                    key: value,
                    type: 'button',
                    role: 'tab',
                    className: 'lol-tab',
                    'aria-selected': tab === value,
                    onClick: () => setTab(value),
                  }, t(`tab.${value}`))),
                ),
                digestReady && h('button', {
                  type: 'button',
                  className: 'lol-btn',
                  'aria-expanded': digestOpen,
                  onClick: () => setDigestOpen(open => !open),
                }, t('ask.digest.button')),
                h('button', {
                  type: 'button',
                  className: 'lol-btn',
                  disabled: status === 'loading',
                  onClick: () => { void load({ force: true }); },
                }, t('refresh')),
              ),
            ),
            stages.length > 1 && h('div', { className: 'lol-chips', role: 'group', 'aria-label': t('stage.label') },
              [{ key: '', label: t('stage.all') }]
                .concat(stages.map(value => ({ key: value, label: stageName(value, t) })))
                .map(item => h('button', {
                  key: item.key === '' ? 'all' : item.key,
                  type: 'button',
                  className: 'lol-chip',
                  'aria-pressed': stage === item.key,
                  onClick: () => setStage(item.key),
                }, item.label)),
            ),
          ),
        ),
        h('div', { className: 'lol-scroll' },
          h('div', { className: 'lol-scrollInner' },
            digestOpen && h(DigestAsk, {
              t,
              today: todayScope,
              stage: stageScope,
              onSubmit: (kind, question) => { void submitDigest(kind, question); },
              pending: ask.pending && ask.id === DIGEST_ASK_ID,
              error: ask.id === DIGEST_ASK_ID ? ask.error : null,
            }),
            status === 'loading' && h('p', { className: 'lol-hint' }, t('loading')),
            error !== null && h('div', { className: 'lol-errorRow', role: 'alert' },
              h('span', null, t('error')),
              h('button', {
                type: 'button',
                className: 'lol-btn',
                onClick: () => { void load({ force: true }); },
              }, t('retry')),
            ),
            tab === 'schedule' && live.length > 0 && h('section', { className: 'lol-day' },
              h('h2', { className: 'lol-dayLabel' }, t('state.live')),
              live.map(renderCard),
            ),
            groups.map(group => h('section', { key: group.key, className: 'lol-day' },
              h('h2', { className: 'lol-dayLabel' }, formatDay(group.date, t)),
              group.items.map(renderCard),
            )),
            status === 'ready' && groups.length === 0 && live.length === 0 && h('div', { className: 'lol-empty' },
              h('p', { className: 'lol-emptyTitle' }, noEdition ? t('empty.offSeason') : t('empty')),
              h('a', {
                className: 'lol-btn',
                href: noEdition ? OFFICIAL_URL : SITE_URL,
                target: '_blank',
                rel: 'noreferrer noopener',
              }, t('empty.official')),
            ),
          ),
        ),
      );
    }

    // ------------------------------------------------------------- registration

    return {
      inject: ['slots', 'locale', 'remote', 'remote.session', 'sessions', 'workspaces', 'uiWorkspace', 'layout'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-lol: dictionaries');
        const t = ctx.locale.bind(NS);

        /** Open a brand-new conversation in the default Workspace and ask there. */
        const send = async (text) => {
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

        const face = {
          /** Active interface locale, used to order watch links. */
          getLang: () => ctx.locale.getSnapshot().active,
          /** One match, with its score, stage and watch link attached. */
          askMatch: (match, question, year) => send(buildPrompt(t, match, question, year)),
          /** A ready-made prompt about a day or a stage. */
          askText: (text) => send(text),
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
      },
    };
  },
});
