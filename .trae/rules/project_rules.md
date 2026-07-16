# 热血问答 - 项目记忆

> 本文件为 Trae 项目记忆，会被 IDE 自动加载，作为后续开发的上下文规则。
> 详细功能进度请查阅 [docs/功能列表.md](../../docs/功能列表.md)。
>
> **最后更新**：2026-07-17（批次 3 F-006/S-005/S-004 完成）

---

## 1. 项目概况

- **项目名称**：热血问答 - 无偿献血人群问卷调研系统
- **技术栈**：前端 React 18 + Vite + Ant Design 5 + ECharts + Zustand；后端 Node.js + Express + TypeScript + MongoDB (Mongoose 8)
- **文档位置**：所有产品/方案/进度文档统一存放于 `docs/`，包括 [PRD.md](../../docs/PRD.md)、[可行性方案.md](../../docs/可行性方案.md)、[功能列表.md](../../docs/功能列表.md)
- **当前总体进度**：约 81.4%（70 项功能中 55 完成、4 部分完成、11 未开始）

---

## 2. 里程碑状态

| 里程碑 | 状态 | 说明 |
|-------|------|------|
| M1 需求/方案/DB设计 | ✅ | 已完成 |
| M2 前端页面开发 | 🟡 85% | 题目级图表已完成；缺 Dashboard、词云/热力图等高级图表 |
| M3 后端 API 开发 | 🟡 90% | 导出+题目级统计+防重复提交+限流+IP 脱敏已完成；缺仪表盘接口、完成率字段、角色权限接口、逻辑跳转、筛选 |
| M4 测试通过 | 🟡 65% | 后端 API 测试 86 用例全通过；前端/E2E 待补 |
| M5 上线部署 | 🟡 | 部署配置已就绪，用户手册未交付 |

---

## 3. 与 PRD 的关键差异（开发时务必对照）

### 3.1 接口路径已调整（勿回退到 PRD 旧路径）

| PRD 定义 | 实际实现 |
|---------|---------|
| `POST /api/users/login` | `POST /api/auth/login` |
| `POST /api/answers` | `POST /api/answers/submit` |
| `GET /api/answers/:id` | `GET /api/answers/:questionnaireId/:answerId` |
| `GET /api/statistics/:id` | `GET /api/answers/statistics/:questionnaireId` |
| `GET /api/questionnaires/:id/publish` | `POST /api/questionnaires/:id/publish`（改为 POST 更合理） |

### 3.2 未实现的 PRD 接口（补齐时新增）

- `GET /api/answers/export` - 数据导出
- `GET /api/statistics/dashboard` - 仪表盘数据
- `GET /api/statistics/export` - 统计导出

### 3.3 数据模型缺失字段

| 字段 | 所属模型 | 说明 |
|-----|---------|-----|
| `isCompleted` | Answer | 完成率统计依赖 |
| `userId` / `anonymousId` | Answer | 区分登录/匿名用户 |
| `ipAddress` | Answer | 需脱敏存储 |
| `logicJump` | Question | 逻辑跳转 |
| `statistics` 表 | - | 预计算统计结果 |
| `role` 三角色 | User | PRD 要求 admin/analyst/editor，当前仅 admin/user |

---

## 4. 优先补齐项（按优先级）

**高优先级（影响核心流程）：**
1. 数据导出（Excel/CSV）- 后端接口 + 前端按钮；`xlsx` 依赖已安装但未使用
2. 仪表盘 Dashboard - 前端页面 + `/api/statistics/dashboard` 接口
3. 题目级统计分布 - 后端按题目选项聚合管道 + 前端柱状图
4. 防重复提交 - `express-rate-limit` + 前端防抖
5. 角色权限控制 - 三角色体系 + 接口角色级校验
6. 后端单元测试 - M4 里程碑关键交付物

**中优先级（影响体验与扩展性）：**
7. 进度保存/断点续填（localStorage）
8. 微信 JS-SDK 集成（当前仅 UA 检测）
9. 逻辑跳转功能
10. 矩阵题完整支持（前后端格式转换器当前把 matrix 默认转 text）
11. 词云图 / 热力图 / 雷达图
12. 时间/渠道筛选
13. 完成率字段与计算
14. 统计结果预计算缓存
15. IP 收集与脱敏

---

## 5. 功能列表维护规则

- **唯一来源**：[docs/功能列表.md](../../docs/功能列表.md) 是进度跟踪的唯一来源
- **状态取值**：✅ 已完成 / 🟡 部分完成 / ⬜ 未开始
- **更新时机**：每完成一项功能，立即更新对应行状态，并在"说明/验证依据"列填写代码位置
- **进度计算**：完成率 = (✅数 + 0.5×🟡数) / 总功能数 × 100%，同步刷新"一、总体进度概览"
- **新增功能**：分配编号（模块前缀+三位数字，如 Q-009）
- **里程碑同步**：完成里程碑关键交付物时，更新本文件第 2 节与功能列表第四章

---

## 6. 开发注意事项

1. **前后端题型映射**：前端用 `single_choice`/`multiple_choice`，后端存储 `single`/`multiple`，转换逻辑在 [questionnaireController.ts](../../backend/src/controllers/questionnaireController.ts) 的 `convertFrontendToBackendQuestions` / `convertBackendToFrontendQuestions`。新增题型须同步更新这两个函数。
2. **问卷状态机**：`draft → published → closed`，仅草稿可编辑，仅已发布可提交答案，仅已发布可关闭。
3. **公开接口**：`GET /api/questionnaires/public/:id`、`POST /api/answers/submit`、`GET /api/templates` 无需认证，其余管理接口需 `authMiddleware`。
4. **密码安全**：bcrypt salt rounds=10，User 模型 `password` 字段 `select:false`，登录时用 `select('+password')` 显式取出。
5. **JWT**：有效期 7 天，payload 含 `userId` 与 `role`，密钥读 `process.env.JWT_SECRET`。
6. **响应格式**：统一 `{ success: boolean, data?, message?, error?(仅 dev) }`。
7. **错误处理**：不向客户端暴露内部错误细节，仅 `NODE_ENV=development` 时返回 `error.message`。
8. **修改已有代码前**：须与用户沟通确认，仅在用户允许后方可修改。
9. **新功能开发流程**：架构设计 → 接口 API 设计 → 测试用例设计 → 单元测试 → 编写目标代码。
10. **文档同步**：API/数据模型变更时，同步更新 [docs/功能列表.md](../../docs/功能列表.md) 的差异分析章节。

### 单元测试失败处理铁律

> 当单元测试失败时，**绝对禁止使用 `it.skip` / `describe.skip` / `@skip` 等方式跳过**。必须按以下流程处理：
>
> 1. **核对功能列表**：对照 `docs/功能列表.md`，判断该接口/功能是「必须（✅ 或 🟡）」还是「未规划（⬜）」。
>    - 若功能列表中标记为 ✅ 或 🟡 → 属于必须接口，测试失败 = 代码有 bug，需修复或确认。
>    - 若功能列表中标记为 ⬜ → 属于未实现功能，测试失败属预期，应**删除测试用例**而非 skip，待功能开发时再补。
> 2. **分析报错原因**：明确根因（路由顺序、数据格式、业务逻辑、边界条件等），形成结论。
> 3. **记录到项目记忆**：将 bug 编号、根因、影响范围、修复建议写入本文件第 8 节「已知缺陷与待修复清单」。
> 4. **测试用例保留为失败状态**：测试用例必须正常执行并失败（fail），不可 skip。失败是信号，skip 会掩盖问题。
> 5. **修复后再跑**：源码修复后运行测试通过，从清单中移除对应条目。

### Bug 修复分支管理铁律

> 每个 bug 修复必须遵循独立分支原则，禁止在主分支直接修改：
>
> 1. **分支命名规范**：`bugfix/fix-<编号>-<简述>-<月日>`
>    - 示例：`bugfix/fix-001-statistics-route-0717`
>    - 编号取自第 8 节「已知缺陷与待修复清单」中的 BUG-XXX
>    - 简述用小写英文短横线分隔（如 `statistics-route`、`login-token`）
>    - 月日取当前日期 MMDD 格式
> 2. **创建流程**：
>    - 从最新主分支（main / master）拉取：`git checkout main && git pull`
>    - 创建并切换分支：`git checkout -b bugfix/fix-001-statistics-route-0717`
> 3. **修复流程**：在独立分支上完成代码修改 + 测试用例修复 + 测试通过验证
> 4. **合并流程**：修复完成并通过全部测试后，发起 PR / MR 合并到主分支，禁止直接 push 主分支
> 5. **清理流程**：合并后删除本地与远程的修复分支，保持分支整洁
> 6. **记忆同步**：在第 8 节对应 bug 条目的「修复状态」字段记录分支名与合并状态

### 项目基本工作流程铁律

> 每次完成一个独立功能开发，必须严格按以下顺序执行，不可跳步：
>
> **步骤 1：自动单元测试**
> - 完成功能代码后，立即运行 `npm test` 进行单元测试。
> - 根据测试结果分流到步骤 2A（成功路径）或步骤 2B（失败路径）。
>
> **步骤 2A：测试全部通过 → 同步更新文档**
> - 更新所有受影响的文档：
>     - [docs/功能列表.md](../../docs/功能列表.md)：对应功能行状态、总体进度概览、里程碑章节
>     - [.trae/rules/project_rules.md](./project_rules.md)：里程碑状态、变更记录
>     - [docs/测试报告.md](../../docs/测试报告.md)：若涉及测试变更，更新执行摘要与覆盖率
>     - 其他文档（如 PRD 差异分析、API 文档等）按需同步
> - 文档同步完成后进入步骤 3。
>
> **步骤 2B：测试失败 → 记录报告 + 最小改动修复**
> - **记录测试报告**：将失败用例、报错信息、堆栈跟踪记入 [docs/测试报告.md](../../docs/测试报告.md)。
> - **分析错误原因**：明确根因（路由顺序、数据格式、业务逻辑、边界条件等）。
> - **最小改动修复**：遵循「精准手术」原则，diff 与任务一样小，只改与失败直接相关的代码，不顺手重构、不调整无关格式。
> - 修复后重新运行 `npm test`，通过后回到步骤 2A 同步文档。
> - 严禁使用 `it.skip` 等方式跳过失败用例（详见「单元测试失败处理铁律」）。
>
> **步骤 3：Git 提交 + Tag + 合并到 main**
> - **提交规范**：使用 Conventional Commits 格式（如 `feat(模块): 简述`、`fix(模块): 简述`），通过 HEREDOC 传递多行 message，详细记录 feature 内容（动机、改动点、影响范围、验证结果）。
> - **打 Tag**：为新功能打语义化版本 tag，格式 `v<主版本>.<次版本>.<修订号>-<功能简述>`（如 `v0.1.0-statistics-export`）；bug 修复递增修订号。
> - **合并到 main**：提交后立即合并到 main 分支（`git checkout main && git merge <分支>`），合并后删除临时开发分支，保持分支整洁。
> - **禁止直接 push main**：所有改动必须经过分支 → 提交 → 合并流程。

---

## 8. 已知缺陷与待修复清单

> 所有未修复的 bug 统一记录在此，修复后删除。按优先级排序。
>
> **当前状态**：清单为空，所有已发现 bug 均已修复。

### 已修复历史（仅供追溯，不计入待修复清单）

- **BUG-001**（已修复，2026-07-17）：答案统计接口路由顺序错误
  - 修复分支：`bugfix/fix-001-statistics-route-0717`
  - 修复提交：`008f899 fix(answers): 修复统计接口路由顺序错误导致 404 (BUG-001)`
  - 修复内容：将 `/statistics/:questionnaireId` 路由移至 `/:questionnaireId` 与 `/:questionnaireId/:answerId` 之前
  - 验证结果：66 个单元测试全部通过，answerController 覆盖率从 61.01% 提升至 83.05%

- **BUG-002**（已修复，2026-07-17）：F-006/S-005 引入后破坏现有 D-001~D-005 连续提交测试
  - 修复分支：`feature/batch3-anti-spam-0717`（与功能开发同分支）
  - 修复内容：
    1. `routes/answer.ts` 为 rateLimit 添加 `keyGenerator: extractClientIp`，显式解析 X-Forwarded-For 头（兼容未配置 trust proxy 的场景）
    2. `test/answer.test.ts` 引入 `submitAnswer` 辅助函数，为每次提交分配唯一 IP（`10.0.${counter++}.2`），模拟不同用户提交
  - 验证结果：86 个单元测试全部通过，answerController 覆盖率从 83.05% 提升至 87.7%，rateLimit.ts 覆盖率 79.31%

---

## 9. 变更记录

| 日期 | 变更内容 |
|-----|---------|
| 2026-07-16 | 初版项目记忆创建，记录功能核对结论、PRD 差异、优先补齐项 |
| 2026-07-17 | 新增单元测试失败处理铁律 + 已知缺陷清单；记录 BUG-001 统计接口路由顺序错误 |
| 2026-07-17 | 新增 Bug 修复分支管理铁律；BUG-001 标注预期修复分支名 |
| 2026-07-17 | 修复 BUG-001（分支 bugfix/fix-001-statistics-route-0717），从待修复清单移至已修复历史 |
| 2026-07-17 | 新增项目基本工作流程铁律：单元测试→文档同步→Git提交+Tag+合并到 main |
| 2026-07-17 | 重构项目基本工作流程铁律为分步流程，明确测试失败的「记录报告+最小改动修复」分支 |
| 2026-07-17 | 批次 1：D-005 数据导出功能（CSV/Excel）完成，新增 `GET /api/answers/:questionnaireId/export` 接口及 7 个测试用例，整体进度 75% → 76.4%，M3 75% → 80%，M4 0% → 55% |
| 2026-07-17 | 批次 2：D-004 题目级统计分布 + V-004 题目级图表完成。后端 getStatistics 新增 questionStats 字段（按题型聚合：单选/多选选项计数+百分比、文本去重计数、评分平均分+分布），新增 6 个测试用例；前端修复 api.ts statistics 路径不一致 + fetchStatistics 字段映射 + QuestionStatCard 题型判断兼容 single/multiple。整体进度 76.4% → 77.9%，M2 80% → 85%，M3 80% → 85%，M4 55% → 60% |
| 2026-07-17 | 批次 3：F-006 防重复提交 + S-005 限流 + S-004 IP 脱敏完成。新增 `middleware/rateLimit.ts` 内存固定窗口限流（5 次/分钟），submitAnswer 内 DEDUP_WINDOW_MS=10s 业务级防重复；Answer 模型新增 ipAddress 字段（脱敏末段置 0）+ 复合索引；新增 7 个 F-006/S-005/S-004 专项测试用例；BUG-002 同步修复（answer.test.ts 引入 submitAnswer 辅助函数分配唯一 IP）。整体进度 77.9% → 81.4%，M3 85% → 90%，M4 60% → 65% |
