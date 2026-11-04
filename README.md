# dsh-lol-esports

英雄联盟赛事观赛面板，挂在 [DeepSeek Harness](https://www.npmjs.com/package/@deepseek-ai/dsh)（DSH）Web 端的左栏：赛程、赛果、直播/回放链接一页看完，正在打的那场还能看到**局内实时数据**。

> A League of Legends esports viewer panel for the DeepSeek Harness web UI, forked from [`Rustyibe/dsh-lol`](https://github.com/Rustyibe/dsh-lol) with an in-game live-stats strip.

## 这是上游的什么版本

本项目 fork 自 [Rustyibe/dsh-lol](https://github.com/Rustyibe/dsh-lol)（MIT），**不跟随上游更新**，按自己的节奏改。

相对上游新增/修改：

| 改动 | 说明 |
|---|---|
| **局内实时条** | 击杀、经济、推塔、小龙、男爵，加十名选手的 K/D/A 与补刀 |
| **延迟读数** | 显示数据落后直播多少秒；本局结束后换成「本局已结束」 |
| **滚动动效** | 数值变化时滑入，值不变不闪 |
| **本地判定 BO 结束** | 任一方达到赛制所需胜场就判为已结束，不等接口翻状态（Riot 会滞后几分钟） |
| **选手名去前缀** | `IG TheShy` → `TheShy`，仅当首段确实等于队伍 code 时才剥（`Hans Sama` 不受影响） |
| **空态静默** | 拿不到实时数据时整块不渲染，不留占位 |
| 面板名 | 侧栏与标题改为「比赛」/「Matches」 |

## 功能

- **赛程**：拉取当前届 S 赛全部赛程，按本地日期分组；进行中的比赛置顶高亮，面板打开时每 60 秒静默刷新
- **赛果**：按时间倒序，显示阶段、BO 数与大比分
- **阶段筛选**：入围赛 / 瑞士轮 / 四分之一决赛 / 半决赛 / 决赛，只列当前届真实存在的阶段
- **观赛链接**：官方直播页；逐局中文回放（YouTube 直接跳到该局开始时间）、英文流、Twitch 直播流
- **按语言取流**：界面是中文就优先中文流与中文回放，英文界面优先英文
- **单场 AI**：点「问 AI」把这场的赛事、阶段、对阵、BO、时间、比分、观赛链接带进新建会话
- **整届 AI**：顶部「聊赛事」按「今天」或某个阶段，把已结束、待打和当前战绩一起带进新会话
- **双语**：跟随 DSH 语言设置，时间按本地时区

## 环境要求

| 项 | 要求 |
|---|---|
| DSH | `>= 0.2.1-rc.2 < 0.3.0`（`engines.dsh` 已声明，不满足会被拒绝安装/激活） |
| 构建 | 不需要，无依赖、无 `prepare`、无打包步骤 |
| 网络 | 能访问 `esports-api.lolesports.com`、`feed.lolesports.com`（数据）、`static.lolesports.com`（队标）；直播/回放链接点开后才访问 `youtube.com` / `twitch.tv` / `lolesports.com` |

## 安装

```bash
# 桌面版
dsh plugin --profile desktop add github:NeilNy/dsh-lol-esports

# 或 web 版
dsh plugin --profile web add github:NeilNy/dsh-lol-esports
```

装完重启 DSH（桌面版 ⌘Q 后重开），左栏会多出一个奖杯图标。

本地开发安装（改文件即生效，不经过 npm/GitHub）：

```bash
git clone https://github.com/NeilNy/dsh-lol-esports.git
dsh plugin --profile desktop add link:$PWD/dsh-lol-esports
```

## 数据来源与隐私

- 赛程/详情：`https://esports-api.lolesports.com/persisted/gw/{getSchedule,getEventDetails}`，带 lolesports 前端的公开 `x-api-key`
- 局内实时：`https://feed.lolesports.com/livestats/v1/window/{gameId}`（10 秒窗口）
- 全部是**浏览器直连**的公开 GET，不经代理、不带账号、不读写本地文件、无遥测
- 面板是纯前端插件：只注册 `main` 与 `sidebar.panellist` 两个槽位，Host 半侧是空 `apply`

## 已知限制

- **只支持 S 赛**（Worlds）。想看别的联赛要改 `client.js` 里的 `WORLDS_ID`（Worlds = `98767975604431411`）
- **实时数据永远慢一分钟左右**：Riot 的 feed 要求窗口结束时间至少比当前早 50 秒，且 `startingTime` 必须对齐 10 秒；插件取 `now - 65s`，轮询 20 秒
- 无中文/英文 VOD 的对局，详情里只有「官方赛事页」
- 官网 `lolesports.com` 强制跳 `en-US`，官网链接没法本地化
- 公开 key 若被轮换，需更新 `client.js` 顶部的 `API_KEY`

## 开发

```bash
node --check client.js     # 单文件、无构建，语法检查就够
```

目录：`index.js`（Host 半侧，空实现）、`client.js`（全部逻辑：接口、面板、槽位注册）、`cordis.patch.yml`（插入 bundle 层）、`locale/*.json`（插件页文案）。

## 许可与致谢

MIT。原始版权归 [Rustyibe](https://github.com/Rustyibe/dsh-lol)（见 `LICENSE`），本分支的修改同以 MIT 发布。

**本项目与 Riot Games 无关，不是官方产品。** 队标等素材由 `static.lolesports.com` 直接提供，未在本仓库内分发。
