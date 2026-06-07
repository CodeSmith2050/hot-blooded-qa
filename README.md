# 热血问答 - 目录结构

## 项目结构

```
hot-blooded-qa/
├── docs/                      # 项目文档
│   ├── PRD.md                # 产品需求文档
│   └── 可行性方案.md          # 可行性方案
├── backend/                   # 后端代码
│   ├── controllers/           # 控制器层（处理请求逻辑）
│   │   ├── questionnaire.js   # 问卷相关接口
│   │   ├── answer.js         # 答案相关接口
│   │   └── user.js           # 用户相关接口
│   ├── models/               # 数据模型（MongoDB Schema）
│   │   ├── Questionnaire.js   # 问卷模型
│   │   ├── Answer.js         # 答案模型
│   │   └── User.js           # 用户模型
│   ├── routes/                # 路由配置
│   │   └── index.js          # 路由入口
│   ├── middleware/            # 中间件
│   │   └── auth.js           # 认证中间件
│   ├── utils/                 # 工具函数
│   │   └── excel.js          # Excel处理工具
│   ├── src/                   # 源代码
│   │   └── app.js            # 应用入口
│   └── package.json           # 依赖配置
├── frontend/                  # 前端代码
│   ├── src/
│   │   ├── components/        # 通用组件
│   │   │   ├── QuestionItem.jsx    # 问题组件
│   │   │   ├── Chart.jsx           # 图表组件
│   │   │   └── Layout.jsx          # 布局组件
│   │   ├── pages/             # 页面组件
│   │   │   ├── Admin/         # 管理后台
│   │   │   │   ├── Dashboard.jsx   # 仪表盘
│   │   │   │   ├── QuestionnaireList.jsx  # 问卷列表
│   │   │   │   ├── QuestionnaireEdit.jsx  # 问卷编辑
│   │   │   │   └── DataAnalysis.jsx       # 数据分析
│   │   │   └── Public/        # 公共页面
│   │   │       └── QuestionnaireFill.jsx  # 问卷填写
│   │   ├── services/          # API服务
│   │   │   └── api.js         # API封装
│   │   ├── store/             # 状态管理
│   │   │   └── index.js       # 状态配置
│   │   └── styles/            # 样式文件
│   ├── public/                # 静态资源
│   ├── index.html             # HTML入口
│   └── package.json           # 依赖配置
└── README.md                  # 项目说明
```

## 技术栈

### 后端
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT

### 前端
- **Framework**: React 18
- **Build Tool**: Vite
- **UI Library**: Ant Design
- **Charts**: ECharts
- **State Management**: Zustand

## 开发指南

### 后端启动
```bash
cd backend
npm install
npm run dev
```

### 前端启动
```bash
cd frontend
npm install
npm run dev
```
