# 热血问答 - 项目记忆

> 本文件为 Trae 项目记忆，会被 IDE 自动加载，作为后续开发的上下文规则。
> 详细功能进度请查阅 [docs/功能列表.md](../../docs/功能列表.md)。
>
> **最后更新**：2026-07-16

---

## 1. 项目概况

- **项目名称**：热血问答 - 无偿献血人群问卷调研系统
- **技术栈**：前端 React 18 + Vite + Ant Design 5 + ECharts + Zustand；后端 Node.js + Express + TypeScript + MongoDB (Mongoose 8)
- **文档位置**：所有产品/方案/进度文档统一存放于 `docs/`，包括 [PRD.md](../../docs/PRD.md)、[可行性方案.md](../../docs/可行性方案.md)、[功能列表.md](../../docs/功能列表.md)
- **当前总体进度**：约 65.7%（70 项功能中 46 完成、9 部分完成、15 未开始）

---

## 2. 里程碑状态

| 里程碑 | 状态 | 说明 |
|-------|------|------|
| M1 需求/方案/DB设计 | ✅ | 已完成 |
| M2 前端页面开发 | 🟡 80% | 缺 Dashboard、可视化图表不全 |
| M3 后端 API 开发 | 🟡 75% | 缺导出、题目级统计聚合、防重复提交 |
| M4 测试通过 | ⬜ 0% | jest 已配置但零用例，主要风险 |
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

---

## 7. 变更记录

| 日期 | 变更内容 |
|-----|---------|
| 2026-07-16 | 初版项目记忆创建，记录功能核对结论、PRD 差异、优先补齐项 |
