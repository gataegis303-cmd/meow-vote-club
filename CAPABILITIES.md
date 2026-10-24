# 完整体验增强版能力图

用户已确认 2026-10-24 的实现计划。保留原生 JavaScript、六只猫咪和现有视觉。

| Module ID | 责任 | 依赖 | 规格 |
| --- | --- | --- | --- |
| shared-voting | 匿名身份、共享计票、个人记录 | 无 | SPEC-shared-voting.md |
| cat-affinity | 趣味测试、本命猫、本机偏好 | 无 | SPEC-cat-affinity.md |
| support-journal | 月历、徽章、只读旧历史 | shared-voting | SPEC-support-journal.md |
| souvenir-personalization | 个性 PNG、冻结快照 | shared-voting、cat-affinity | SPEC-souvenir-personalization.md |
| demo-mode | 临时样例、重置、隔离切换 | 前述四模块 | SPEC-demo-mode.md |

顺序：共享投票闭环 → 趣味匹配 → 日历与徽章 → 纪念卡 → 演示隔离 → 全量验收。
公共命令和数据边界见 README.md；执行进度见 tasks/todo.md。不初始化 Git，不公开部署。
