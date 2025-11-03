
# 🤖 DooTask AI 智能体插件

基于 **DooTask** 主程序的企业级 AI 智能体插件系统

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8)](https://golang.org/)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB)](https://python.org/)
[![LangChain](https://img.shields.io/badge/LangChain-Latest-green)](https://langchain.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org/)


## ✨ 核心功能

### 🤖 **多智能体管理**
- **角色定制**：可视化配置 AI 角色、专业领域和能力范围
- **提示词工程**：高级提示词编辑器，支持模板和变量
- **智能体市场**：丰富的预设智能体模板，快速部署

### 💬 **实时对话系统**
- **流式回复**：SSE 实时更新，体验流畅自然
- **群聊支持**：完美支持群组对话，智能理解上下文
- **图片识别**：支持图片内容识别和理解
- **思考过程**：显示 AI 的思考过程，支持思考型模型（如 DeepSeek）

### 🛠️ **MCP 工具集成**
- **内部工具**：深度集成 DooTask 功能（聊天记录、项目管理、任务分配）
- **外部工具**：支持天气查询、网页搜索、邮件发送等第三方服务
- **自动关联**：定时检测 MCP 服务，自动关联到智能体
- **权限控制**：精细化控制不同智能体的工具访问权限

### 📚 **知识库系统**
- **多格式支持**：PDF、Word、Excel、Markdown、TXT 等文档格式
- **向量化检索**：基于 AI Embedding 的语义搜索，精准匹配
- **文档管理**：完整的文档上传、解析、版本管理机制
- **智能分块**：自动优化文档分块策略，提升检索效果

### 📊 **数据统计与监控**
- **Token 统计**：完整的 AI 使用统计和成本监控
- **对话监控**：实时监控对话状态和性能指标
- **使用分析**：智能体使用情况统计和热门推荐

### 🏢 **企业级特性**
- **权限管理**：基于角色的精细访问控制
- **审计日志**：完整的操作和对话审计追踪
- **多租户支持**：支持多个企业独立使用

## 📖 使用指南

### 创建第一个智能体

1. 访问 **智能体管理** 页面
2. 点击 **创建智能体** 按钮
3. 配置智能体信息：
   - **名称和描述**：定义智能体的基本信息
   - **角色提示词**：设置 AI 的角色和行为模式
   - **模型选择**：选择 GPT-4、Claude、DeepSeek 等模型
   - **工具权限**：选择智能体可以使用的 MCP 工具
   - **知识库绑定**：关联相关的知识库
4. 保存并启用智能体

### 集成 DooTask 机器人

1. 在 DooTask 中创建机器人
2. 配置机器人的 Webhook 地址（如：`http://your-domain/api/webhook/message`）
3. 在插件中绑定机器人 ID 和智能体
4. 开始在 DooTask 中与 AI 智能体对话

### 管理知识库

1. 访问 **知识库管理** 页面
2. 创建知识库并配置 Embedding 模型
3. 上传文档（支持 PDF、Word、Markdown 等格式）
4. 系统自动进行文档解析和向量化
5. 将知识库绑定到相应的智能体

### 配置 MCP 工具

1. 访问 **MCP 工具管理** 页面
2. 添加 MCP 服务地址和配置
3. 系统会自动检测可用的工具
4. 在创建智能体时选择需要的工具

## 🎯 应用场景

### 💼 **企业客服助手**
- 基于知识库快速回答客户问题
- 自动处理常见咨询，提升服务效率
- 支持多语言和上下文理解

### 📋 **项目管理助手**
- 智能任务分配和建议
- 项目进度分析和风险评估
- 自动生成项目报告和总结

### 📚 **知识管理**
- 企业文档智能检索
- 知识图谱构建和管理
- 团队知识共享和协作

### 🤝 **团队协作**
- 群聊智能助手
- 会议记录和总结
- 文档协作和审阅

## 🔧 技术架构

- **前端**：Next.js 15 + TypeScript + shadcn/ui
- **后端**：Go（主服务）+ Python（AI 引擎）
- **数据库**：PostgreSQL + pgvector（向量搜索）
- **缓存**：Redis
- **AI 框架**：LangChain + MCP 协议


### 核心技术栈

#### 前端技术

- **[Next.js 15](https://nextjs.org/)** - React 全栈框架
- **[shadcn/ui](https://ui.shadcn.com/)** - 现代化组件库
- **[Tailwind CSS](https://tailwindcss.com/)** - 原子化 CSS 框架
- **[TypeScript](https://typescriptlang.org/)** - 类型安全的 JavaScript

#### 后端技术

- **[Go](https://golang.org/)** - 高性能 API 网关服务
- **[Python](https://python.org/)** - AI 引擎和 LangChain 服务
- **[LangChain](https://langchain.com/)** - AI 应用开发框架
- **[PostgreSQL](https://postgresql.org/)** - 主数据库（支持向量搜索）
- **[Redis](https://redis.io/)** - 缓存和会话存储

## 🚀 快速开始

### 环境要求

- Node.js 22+
- Go 1.21+
- Python 3.11+
- Docker & Docker Compose

### 一键启动

```bash
# 克隆项目
git clone https://github.com/dootask/ai.git
cd ai

# 快速启动（推荐）
npm install
npm run dev:all
```

### 访问应用

- **前端界面**: http://localhost:3000
- **API 文档**: http://localhost:8080/swagger (开发中)
- **数据库**: PostgreSQL (localhost:5432)


## 🛠️ 开发指南

### 项目结构

```
dootask-ai/                 # Next.js 前端项目根目录
├── app/                    # Next.js App Router 页面
├── components/             # 共享 React 组件
├── lib/                   # 前端工具库和 API 接口
├── public/                # 静态资源文件
├── backend/               # 后端服务
│   ├── go-service/        # Go 主服务
│   └── python-ai/         # Python AI 服务
├── mcp-tools/             # MCP 工具集
├── docker/                # Docker 配置
├── scripts/               # 部署和初始化脚本
├── docs/                  # 项目文档
├── package.json           # Node.js 依赖配置
└── next.config.ts         # Next.js 配置文件
```

### 开发命令

```bash
# 安装依赖
npm install

# 启动所有开发服务（前端 + Go后端 + Python AI）
npm run dev:all

# 停止所有开发服务
npm run stop:all
```

### 扩展开发

#### 添加新的 MCP 工具

1. 在 `mcp-tools/` 目录创建工具定义
2. 实现工具的接口和逻辑
3. 在智能体配置中启用该工具

#### 自定义智能体类型

1. 在 `backend/python-ai/agents/` 目录添加智能体类
2. 继承 `BaseAgent` 并实现特定逻辑
3. 在前端添加对应的配置界面

## 📚 文档链接

- [项目规划](./docs/PROJECT_PLAN.md) - 完整的项目规划和发展路线图
- [技术架构](./docs/ARCHITECTURE.md) - 详细的技术架构设计文档
- [开发指南](./docs/DEVELOPMENT.md) - 开发环境搭建和编码规范
- [部署指南](./docs/DEPLOYMENT.md) - 生产环境部署说明 (开发中)

## 🤝 贡献指南

我们欢迎所有形式的贡献！

### 如何贡献

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 开发规范

- 遵循 [代码规范](./docs/DEVELOPMENT.md#代码规范)
- 编写测试用例
- 更新相关文档
- 确保 CI 通过

## 📄 开源协议

本项目基于 [MIT 协议](./LICENSE) 开源。

## 🙏 致谢

感谢以下开源项目的贡献：

- [Next.js](https://nextjs.org/) - React 全栈框架
- [LangChain](https://langchain.com/) - AI 应用开发框架
- [shadcn/ui](https://ui.shadcn.com/) - 现代化 UI 组件库
- [OpenAI](https://openai.com/) - 强大的 AI 模型支持

## 📞 联系我们

- 项目主页：[https://github.com/dootask/ai](https://github.com/dootask/ai)
- 问题反馈：[Issues](https://github.com/dootask/ai/issues)
- 功能建议：[Discussions](https://github.com/dootask/ai/discussions)

