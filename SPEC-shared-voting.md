# shared-voting

## 目标与边界
同一服务的多个浏览器看到共享榜单，各匿名身份额度独立。正式榜从零开始，不导入旧本地票数。
本机运行，不提供账号、恢复码或真实一人一身份保障。不记录姓名、联系方式或 IP。

## 契约
- `POST /api/session`：JSON `{}`，复用已签发身份或签发 HttpOnly、SameSite=Lax Cookie，有效期一年。
- `GET /api/snapshot`：返回 day、remaining、dailyVotes（仅今日）、totals、todayTotals、ownTotals、stats、mode。
- `POST /api/votes`：`{catId, expectedDay}`，返回最新快照；事务内校验每天三票、同猫一票和北京时间。
- `GET /api/me/history?month=YYYY-MM`：返回 `{month, dailyVotes}`，仅当前身份、指定月份。
- 错误统一 `{error: {code, message}}`。401 身份不可用，400 参数错误，409 额度/重复/跨日，403 来源错误。
- 不接受外部累计票数。提交只触发一次；响应丢失后查询，不自动重投。

## 实现
Node 24 内置 HTTP、SQLite，SQL 参数绑定，事务和唯一约束防止并发重复。
开发与预览通过 Vite 中间件使用同一接口，正式本地运行只服务 dist 静态资源和 API。
页面可见时三秒轮询，只允许一个同步请求在途；旧请求不能覆盖新投票或新模式。

## 验证
`npm test`、`npm run test:browser`：身份隔离、额度、并发、重启持久化、时区、失联与恢复。
数据库默认 data/votes.sqlite，不公开目录、不删除用户记录、不记录原始会话 Cookie。
