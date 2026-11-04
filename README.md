# dsh-lol-worlds · S 赛观赛助手（本地分支）

> 这份代码是从 [Rustyibe/dsh-lol](https://github.com/Rustyibe/dsh-lol)（MIT）复制出来自己维护的**个人分支**，
> 不再跟随上游更新。安装方式为本地 `link:`，改完文件重启即生效，`pnpm install` 也不会覆盖。
>
> 相对上游的改动：
>
> - 局内**实时数据条**：击杀、经济、推塔、小龙、男爵，加十名选手的 K/D/A 与补刀
> - **延迟读数**：显示数据落后直播多少秒；本局结束后换成「本局已结束」
> - 数值变化时的**滚动动效**
> - **本地判定系列赛结束**：任一方达到 BO 所需胜场就不再显示「进行中」（上游接口会滞后几分钟）
> - 选手名去掉队伍 code 前缀（`IG TheShy` → `TheShy`），只在该前缀确实等于队伍 code 时剥
> - 无数据时不显示任何占位提示
>
> 上游原版说明保留在下方，安装/更新章节已按本地分支改写。
>
> 版权与许可见 `LICENSE`（MIT，原始版权归 Rustyibe）。


[DSH (DeepSeek Harness)](https://www.npmjs.com/package/@deepseek-ai/dsh) Web 端的 S 赛观赛面板：左栏点一个奖杯，赛程、赛果、观赛链接一页看完；想聊的时候，单场比赛、某一天的赛果、整个阶段的走势都能直接扔给 AI。

| 赛程 | 赛果、逐局回放与单场提问 |
|:---:|:---:|
| ![赛程面板](assets/screenshot-schedule.png) | ![赛果、逐局回放与单场提问](assets/screenshot-detail.png) |

除了单场，也可以直接聊一整天或整个阶段：

![聊整届赛况](assets/screenshot-digest.png)

## 功能

- **赛程**：进入面板即拉取当前届 S 赛全部赛程，按本地日期分组；进行中的比赛置顶并高亮，面板打开时每 60 秒静默刷新
- **赛果**：按时间倒序列出已结束比赛，显示阶段、BO 数与大比分
- **阶段筛选**：入围赛 / 瑞士轮 / 四分之一决赛 / 半决赛 / 决赛，只列出当前届真实存在的阶段
- **观赛链接**：官方直播页；逐局中文回放（YouTube 直接跳到该局开始时间）、英文流、Twitch 直播流
- **按语言取流**：界面是中文就优先中文流与中文回放，英文界面优先英文；按钮上的语言标签始终和实际链接一致
- **单场 AI**：点「问 AI」选一个快捷问题或自己写，会把赛事、阶段、对阵、BO、时间、比分、观赛链接带进**新建的会话**
- **整届 AI**：面板顶部「聊赛事」可以选「今天」或某个阶段，把这天/这个阶段**已结束的比赛、待打的比赛和当前战绩**一起带进新会话，用来聊当天赛果说明了什么、瑞士轮后面怎么走、谁最可能出线
- **双语**：文案跟随 DSH 的语言设置（中文 / English），比赛时间按本地时区显示

## 环境要求

| 项 | 要求 |
| --- | --- |
| DSH | ≥ `0.2.1-rc.2`（`package.json` 里 `engines.dsh` 已声明，不满足会被拒绝安装/激活） |
| 构建 | 不需要。无依赖、无 `prepare`、无打包步骤 |
| 网络 | 能访问 `esports-api.lolesports.com`（赛程与详情）、`static.lolesports.com`（队标）；回放与直播链接点开后才访问 `youtube.com` / `twitch.tv` / `lolesports.com` |

## 安装

```bash
dsh plugin --profile web add github:Rustyibe/dsh-lol
# 然后重启 dsh web 并刷新页面
```

从 tarball 装（适合离线分发）：

```bash
npm pack                                    # 得到 local-dsh-lol-1.0.0.tgz
dsh plugin --profile web add ./local-dsh-lol-1.0.0.tgz
```

也可以在 DSH 的 Plugins 页面里填 `github:Rustyibe/dsh-lol` 安装。装完左栏会多出第 4 个图标（奖杯），排在「插件」「自动化任务」之后。

验证安装：

```bash
dsh --profile web --dump-config | grep dsh-lol
```

## 使用

1. 左栏点奖杯图标打开面板：「赛程」看接下来要打的，「赛果」看已经打完的
2. 顶部一排按钮按阶段过滤，右上角「刷新」手动拉取
3. 每场比赛右侧：「观赛」跳官方直播页；「详情」展开逐局与中文/英文回放；「问 AI」展开提问框
4. 提问框里有三个快捷问题（复盘、BP、观赛重点），也可以自己写；发送后会新建会话并切过去
5. 顶部「聊赛事」是整届视角：选「今天」聊当天赛果，或选某个阶段（默认瑞士轮）聊走势与出线形势

## 架构

```
index.js            host 半边：空 apply（纯前端插件，不注册工具/路由）
client.js           全部逻辑：Riot 赛事 API 客户端、面板组件、槽位注册、AI 提问
cordis.patch.yml    插入 dsh-lol 这一层
locale/{zh,en}.json 插件管理页里的标题与描述
icon.svg            插件管理页图标（侧栏 glyph 是 client.js 里的内联 SVG）
```

- 面板注册两个槽位：`main`（面板主体）与 `sidebar.panellist`（侧栏图标），两者 id 都是 `lol`
- 数据链路：浏览器直连 Riot 赛事接口 `esports-api.lolesports.com/persisted/gw`（`getSchedule` / `getEventDetails`，Worlds 的 `leagueId`），公开 `x-api-key`，CORS 全开，中间没有代理
- 只展示当前届：按相邻比赛间隔 > 14 天切段，取最后一段，自动剔除上一届残留在返回里的比赛
- 队标地址是 `http://static.lolesports.com/...`，统一改写成 https，避免混合内容被拦
- 赛程缓存 60s、单场详情缓存 10min；只有展开详情时才请求 `getEventDetails`
- 提问：`ctx.sessions.create({ workspaceId })` 新建会话 → `ctx.remote.session.prompt` 发送 → `openSession` + 切回对话
- 提示词分两种：单场（比分/阶段/观赛链接）与整届（某天的全部结果，或某阶段的已结束+待打+队伍战绩），都由浏览器侧拼好后走同一条发送链路

## 安全与权限

- **纯前端**：只注册 `main` 和 `sidebar.panellist` 两个槽位；除往 `<head>` 注入一个带 `data-plugin` 标记的 `<style>`（面板自身样式）外，不改页面上的其它 DOM/CSS
- **没有 Host 端代码**：不注册模型工具、不开 HTTP 路由、不读写本地文件、不做本地持久化
- **网络只读**：只对 Riot 赛事接口发 GET，用公开 key，不带账号、cookie 或本地数据；无遥测
- 提问内容走你自己的 DSH 模型配置，消息会留在对应会话里，和手动打字没有区别

## 已知限制

- **只支持 S 赛**（Worlds）。想盯别的联赛要改 `client.js` 里的 `WORLDS_ID`
- 官方赛事页 `lolesports.com` 现在强制跳 `en-US`，所以只有回放/直播流能按语言取，官网链接本身没法中文化
- 阶段名来自 Riot 的中文赛事数据；不认识的阶段直接显示原文
- 回放是否齐全取决于 Riot 返回的 VOD 列表，较早的比赛可能缺中文 VOD
- 接口用的是 lolesports 前端的公开 key，Riot 若轮换，需要更新 `client.js` 顶部的 `API_KEY`
- 本项目与 Riot Games 无关，非官方产品

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 左栏没有奖杯图标 | 确认已重启 `dsh web`；`dsh --profile web --dump-config \| grep dsh-lol` 查不到说明没进 profile；版本被 `engines.dsh` 拒绝时启动日志会写明 |
| 面板一直「赛程获取失败」 | 网络不通或接口返回 401（key 轮换）→ 点「重试」，改 key 见 `API_KEY` |
| 详情里只有「官方赛事页」 | 这场 Riot 没返回中文/英文 VOD，属数据缺失 |
| 点「问 AI」报错 | 错误会显示在提问框里；多半是还没有默认工作区，或没配模型 / API Key |
| 想装旧版本或锁版本 | `dsh plugin --profile web add github:Rustyibe/dsh-lol#v1.0.0` |

## 更新与卸载

```bash
# 这个分支装在本地目录，改代码不用重新安装
cd ~/CodeProjects/dsh-lol-worlds && git log --oneline

# 卸载
dsh plugin --profile desktop remove dsh-lol-worlds
```

改完都要重启 `dsh web`；本地 `link:` 安装则直接改文件、重启即可（客户端 bundle 按文件 mtime 取新 rev）。

## 二次开发

| 想改什么 | 改哪里 |
| --- | --- |
| 换成别的联赛 | `WORLDS_ID`（Worlds = `98767975604431411`，其它联赛 id 从 `getLeagues` 取） |
| 刷新/缓存节奏 | `REFRESH_INTERVAL`、`SCHEDULE_TTL`、`DETAIL_TTL` |
| 侧栏图标位置 | `sidebar.panellist` 注册里的 `order: 30` |
| 接口 key | `API_KEY` |
| 文案 | `zh` / `en` 两个字典（键必须一一对应） |
| 提问模板 | 字典里的 `prompt.template`，占位符由 `buildPrompt` 填 |

## 开发与测试

```bash
node --check client.js          # 单文件、无构建，语法检查就够
npm pack --dry-run              # 看打包内容
```

改完不想装进正式 profile、先临时看效果：

```bash
cat >/tmp/dsh-lol-dev.yml <<EOF
- insert:
    - id: dsh-lol
      name: $PWD/index.js
EOF
DSH_HOME=/tmp/dsh-lol-dev dsh --profile web --patch /tmp/dsh-lol-dev.yml --port 7788
```

用独立的 `DSH_HOME` 起临时实例，不会碰 `~/.dsh/profiles/web`，也不会和正在跑的 `dsh web` 抢存储。

## License

[MIT](LICENSE) © 2026 Rustyibe —— 可自由使用、修改、再分发，保留版权声明即可。
