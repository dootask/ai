# AI Agent Plugin

<div align="center">

# 🤖 AI Agent Plugin

**Empower DooTask with enterprise-grade AI assistant capabilities for an intelligent team experience**

[![Version Requirement](https://img.shields.io/badge/DooTask->=1.1.66-blue)](https://dootask.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

</div>

## ✨ Core Features

### 🤖 **Multi-Agent Management**
- **Role Customization**: Visual configuration of AI roles, expertise areas, and capabilities
- **Prompt Engineering**: Advanced prompt editor with template and variable support
- **Agent Marketplace**: Rich preset agent templates for quick deployment

### 💬 **Real-time Conversation System**
- **Streaming Responses**: SSE real-time updates for smooth, natural experience
- **Group Chat Support**: Perfect support for group conversations with intelligent context understanding
- **Image Recognition**: Support for image content recognition and understanding
- **Thinking Process**: Display AI thinking process, support for thinking models (e.g., DeepSeek)

### 🛠️ **MCP Tool Integration**
- **Internal Tools**: Deep integration with DooTask features (chat history, project management, task assignment)
- **External Tools**: Support for third-party services like weather queries, web search, email sending
- **Auto Association**: Automatic detection of MCP services and association with agents
- **Permission Control**: Fine-grained control over tool access permissions for different agents

### 📚 **Knowledge Base System**
- **Multi-format Support**: PDF, Word, Excel, Markdown, TXT, and other document formats
- **Vectorized Retrieval**: Semantic search based on AI Embedding for precise matching
- **Document Management**: Complete document upload, parsing, and version management mechanism
- **Smart Chunking**: Automatic optimization of document chunking strategy to improve retrieval effectiveness

### 📊 **Data Statistics & Monitoring**
- **Token Statistics**: Complete AI usage statistics and cost monitoring
- **Conversation Monitoring**: Real-time monitoring of conversation status and performance metrics
- **Usage Analytics**: Agent usage statistics and popular recommendations

### 🏢 **Enterprise Features**
- **Permission Management**: Role-based fine-grained access control
- **Audit Logging**: Complete operation and conversation audit trail
- **Multi-tenant Support**: Support for multiple enterprises to use independently

## 📖 User Guide

### Create Your First Agent

1. Visit the **Agent Management** page
2. Click the **Create Agent** button
3. Configure agent information:
   - **Name and Description**: Define basic information for the agent
   - **Role Prompt**: Set the AI's role and behavior patterns
   - **Model Selection**: Choose from GPT-4, Claude, DeepSeek, and other models
   - **Tool Permissions**: Select MCP tools the agent can use
   - **Knowledge Base Binding**: Associate relevant knowledge bases
4. Save and enable the agent

### Integrate DooTask Bot

1. Create a bot in DooTask
2. Configure the bot's Webhook address (e.g., `http://your-domain/api/webhook/message`)
3. Bind the bot ID and agent in the plugin
4. Start conversing with AI agents in DooTask

### Manage Knowledge Bases

1. Visit the **Knowledge Base Management** page
2. Create a knowledge base and configure the Embedding model
3. Upload documents (supports PDF, Word, Markdown, and other formats)
4. System automatically performs document parsing and vectorization
5. Bind the knowledge base to the corresponding agent

### Configure MCP Tools

1. Visit the **MCP Tool Management** page
2. Add MCP service address and configuration
3. System automatically detects available tools
4. Select required tools when creating an agent

## 🎯 Use Cases

### 💼 **Enterprise Customer Service Assistant**
- Quickly answer customer questions based on knowledge base
- Automatically handle common inquiries, improve service efficiency
- Support multiple languages and context understanding

### 📋 **Project Management Assistant**
- Intelligent task assignment and suggestions
- Project progress analysis and risk assessment
- Automatic generation of project reports and summaries

### 📚 **Knowledge Management**
- Enterprise document intelligent retrieval
- Knowledge graph construction and management
- Team knowledge sharing and collaboration

### 🤝 **Team Collaboration**
- Group chat intelligent assistant
- Meeting records and summaries
- Document collaboration and review

## 🔧 Technical Architecture

- **Frontend**: Next.js 15 + TypeScript + shadcn/ui
- **Backend**: Go (main service) + Python (AI engine)
- **Database**: PostgreSQL + pgvector (vector search)
- **Cache**: Redis
- **AI Framework**: LangChain + MCP Protocol

## 📝 Changelog

### Latest Version Features

- ✅ **Image Recognition**: Support for image content recognition and understanding
- ✅ **Group Chat Support**: Perfect support for group conversations
- ✅ **Thinking Process Display**: Display AI thinking process
- ✅ **MCP Auto Association**: Automatic detection of MCP services and association with agents
- ✅ **Multi-format Documents**: Support for PDF, Word, Excel, Markdown, TXT
- ✅ **Token Statistics**: Complete usage statistics and cost monitoring
- ✅ **Streaming Response Optimization**: Fixed handling issues with multiple concurrent requests
- ✅ **Session Management Optimization**: Fixed user ID identification issues

## 🤝 Contributing

We welcome all forms of contributions!

- 🐛 [Report Bug](https://github.com/dootask/ai/issues)
- 💡 [Feature Suggestion](https://github.com/dootask/ai/discussions)
- 🔧 [Submit PR](https://github.com/dootask/ai/pulls)

## 📄 License

This project is open source under the [MIT License](../LICENSE).

## 📞 Support

- 📖 [Full Documentation](https://github.com/dootask/ai/tree/main/docs)
- 💬 [Community Discussions](https://github.com/dootask/ai/discussions)
- 🐛 [Issue Feedback](https://github.com/dootask/ai/issues)

---

<div align="center">
  Made with ❤️ by <a href="https://dootask.com">DooTask Team</a>
</div>
