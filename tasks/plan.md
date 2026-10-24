# 喵喵人气事务所 Implementation Plan

> **For agentic workers:** Execute inline using the incremental-implementation and test-driven-development workflows. Track checkpoints in `tasks/todo.md`.

**Goal:** 完成六只猫咪的可爱圆角风投票网页。

**Architecture:** 原生 JavaScript + Vite。纯函数处理本机投票记录，视图从同一状态推导卡片、榜单和剩余票数；原生 dialog 提供详情。

**Tech Stack:** JavaScript ESM、CSS、Vite、Lucide、Node 内置测试；Playwright 验证浏览器。

**Spec:** `SPEC.md`

> 以下原版任务已全部完成。当前用户已批准完整体验增强版，新的模块边界以 CAPABILITIES.md 与 SPEC-*.md 为准；
> 下方原版“无后端、仅本地计票”边界仅作历史记录，不再是当前约束。

## Global Constraints

- 每个浏览器每天三票，同一天每只猫咪最多一票。
- 初始票数是演示数据；不提供真实多人统计。
- 无账号、后端、支付或公开部署。
- 清晰猫咪位图、24px 卡片圆角、粉绿黄多色搭配。
- 本地存储失败可继续当前会话；安全回退损坏记录。
- 当前目录不是 Git 仓库，不创建工作树、不自动初始化或提交。

## Task 1: 本地投票闭环

Files: `package.json`, `src/voting.js`, `tests/voting.test.js`, `.gitignore`.

Produces:

- `dateKey(date = new Date()): string` 使用本地年月日。
- `parseState(raw: string | null): { version: 1, dailyVotes: Record<string, string[]> }`。
- `castVote(state, catId, day): { ok, reason?, state }`。
- `getDailyVotes(state, day): string[]` 与 `getVoteCount(state, catId): number`。

Steps:

- [x] 建立 ESM 和 `node --test` 测试命令。
- [x] 编写首次、重复、额度、跨日、累计、未知 ID、损坏记录测试。
- [x] 运行 `npm test`，确认模块不存在造成失败。
- [x] 实现不可变更新和输入校验，运行 `npm test` 至全部通过。

Example assertion:

```js
const result = castVote(parseState(null), 'toffee', '2026-10-24');
assert.equal(result.ok, true);
assert.deepEqual(getDailyVotes(result.state, '2026-10-24'), ['toffee']);
```

## Task 2: 可参与的猫咪候选人页

Depends on Task 1.

Files: `index.html`, `src/main.js`, `src/views.js`, `src/styles.css`, `src/cats.js`.

Consumes: Task 1 voting functions.
Produces: 卡片、日票余额、即时榜单、详情投票。

Steps:

- [x] 按生成提示词制作一张 3x2 猫咪肖像表，裁切为六张本地 WebP。
- [x] 安装锁定 Vite 与 Lucide，生成完整页面及候选人内容。
- [x] 从 `src/cats.js` 导出 `CATS`，含 ID、名字、种类、描述、初始票数、图片和颜色。
- [x] 事件委托处理 `data-vote`；成功后保存并更新全部视图。
- [x] 详情调用 `showModal()`；关闭恢复原触发器焦点。
- [x] `npm test` 和 `npm run build` 通过后，启动本地开发服务。

Voting UI contract:

```js
const result = castVote(state, catId, dateKey());
if (result.ok) {
  state = result.state;
  saveState();
  render();
}
```

## Task 3: 榜单、应援记录与容错

Depends on Task 2.

Files: `src/main.js`, `src/views.js`, `src/styles.css`, `tests/voting.test.js`.

Steps:

- [x] 添加排行榜视图和我的应援视图，保留底层投票状态。
- [x] 应援为空时显示返回候选人的按钮；投票成功使用 live region 播报。
- [x] try/catch 包裹存储访问，失败保留内存状态并显示警告。
- [x] 页面重新可见和午夜更新票额；监听跨标签页 storage 事件。
- [x] 剩余票额为零时禁用新增投票，已投状态不丢失。
- [x] 浏览器验证三个视图、详情、刷新与额度耗尽。

## Task 4: 响应式、可访问性与交付

Depends on Task 3.

Files: `src/styles.css`, `README.md`, `tests/browser.mjs`, `tasks/todo.md`.

Steps:

- [x] 在 320、390、768、1024、1440px 检查截图、横向溢出、文字与图片。
- [x] 检查键盘导航、Escape、焦点返回、reduced-motion。
- [x] 检查存储禁用、损坏记录、跨日及控制台错误。
- [x] 完成单元测试、生产构建和生产预览测试。
- [x] README 记录命令、素材出处、服务端未返回实际模型名及非线上防刷边界。
- [x] 保留可访问的本地开发服务，向用户提供 URL。

## Risks

- 生成图片比例不完全受请求参数控制：按真实像素裁切并人工检查六只猫。
- 浏览器禁用存储：仅内存运行，并显示不能持久化的提示。
- 多标签页投票：每次操作前重新读取已保存状态，监听同步事件；不声称跨进程防刷。

## 已确认增强：今日榜与应援纪念

构建顺序：本日统计纯函数 → 榜单切换 → 三票汇总 → 纪念卡生成与下载 → 端到端回归。

1. `src/voting.js` 提供今日排名数据，保留 v1 存储；单元测试覆盖空榜、历史隔离、并列与不可变性。
2. `src/views.js` 与 `src/main.js` 接入今日/累计分段切换和三票完成汇总；沿用累计侧边榜与候选人票数。
3. `src/souvenir.js` 负责快照与 Canvas PNG；原生弹窗负责加载、预览、下载、失败重试及 URL 回收。
4. `tests/browser.mjs` 验证新旧完整路径、五种屏宽、下载文件、跨日、跨页与可访问性；更新 README 与截图。

## 已确认完整体验增强版

1. 新增 SQLite 存储和 API，先用独立临时数据库验证额度、并发、时区和持久化。
2. 通过统一数据源接入页面，隔离个人历史与共享总票数；防止迟到响应、重复轮询与未知结果重投。
3. 趣味匹配与本命猫使用浏览器偏好；服务端月记录驱动日历和徽章；旧键只读。
4. 扩展既有纪念卡生成流程，保留旧的焦点、错误重试、下载和跨日快照要求。
5. 演示数据与偏好均在独立 sessionStorage 中；重置确认、模式世代号防止串数据。
6. 使用隔离 API 的开发/构建预览浏览器测试，不修改用户数据库；截图检查后更新 README 和展示材料。

验证命令：`npm test`、`npm run build`、`npm run test:browser`、`TEST_BUILD=1 npm run test:browser`。
实际任务状态持续记录于 tasks/todo.md。
