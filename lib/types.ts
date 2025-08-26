// 通用API响应类型
export interface APIResponse<T> {
  code: string;
  message: string;
  data: T;
}

// 统一分页类型 - 与后端保持一致

// 排序字段
export interface SortField {
  key: string; // 排序字段名
  desc: boolean; // true: 降序, false: 升序
}

// 统一分页请求结构
export interface PaginationRequest {
  page: number; // 页码
  page_size: number; // 每页条数，默认12
  sorts?: SortField[]; // 排序字段数组
  filters?: Record<string, unknown>; // 筛选条件，每个接口可定义不同结构
}

export interface PaginationBase {
  current_page: number; // 当前页码
  page_size: number; // 每页条数
  total_items: number; // 总条数
  total_pages: number; // 总页数
}

// 统一分页响应结构
export interface PaginationResponse<T> extends PaginationBase {
  data: T; // 数据，使用泛型支持不同数据结构
}

// 各模块筛选条件接口

// 智能体筛选条件
export interface AgentFilters {
  search?: string;
  ai_model_id?: number;
  is_active?: boolean;
}

// 对话筛选条件
export interface ConversationFilters {
  search?: string;
  agent_id?: number;
  is_active?: boolean;
  user_id?: string;
  start_date?: string;
  end_date?: string;
}

// AI模型筛选条件
export interface AIModelFilters {
  provider?: string;
  is_enabled?: boolean;
}

// 知识库筛选条件
export interface KnowledgeBaseFilters {
  search?: string;
  embedding_model?: string;
  is_active?: boolean;
}

// MCP工具筛选条件
export interface MCPToolFilters {
  search?: string;
  category?: 'dootask' | 'external' | 'custom';
  type?: 'internal' | 'external';
  is_active?: boolean;
}

// 统一列表数据结构

// 智能体列表数据
export interface AgentListData {
  items: Agent[];
}

// 对话列表数据
export interface ConversationListData {
  items: Conversation[];
  statistics: ConversationStatistics;
}

// AI模型列表数据
export interface AIModelListData {
  items: AIModelConfig[];
}

// 知识库列表数据
export interface KnowledgeBaseListData {
  items: KnowledgeBase[];
}

// MCP工具列表数据
export interface MCPToolListData {
  items: MCPTool[];
  stats: MCPToolStatsResponse;
}

// 对话统计信息
export interface ConversationStatistics {
  total: number;
  today: number;
  active: number;
  average_messages: number;
  average_response_time: number;
  success_rate: number;
}

// 智能体相关类型
export interface Agent {
  id: number;
  name: string;
  description?: string | null;
  prompt: string;
  ai_model_id?: number | null;
  temperature: number;
  tools: number[]; // JSONB array
  knowledge_bases: number[]; // JSONB array
  metadata: Record<string, unknown>; // JSONB object
  is_active: boolean;
  created_at: string;
  updated_at: string;

  // 关联的AI模型对象
  ai_model?: AIModelConfig | null;

  // 统计信息
  statistics?: AgentStatistics | null;

  // 新增：知识库名称和工具名称
  kb_names?: string[];
  tool_names?: string[];
}

export interface AgentStatistics {
  total_messages: number;
  today_messages: number;
  week_messages: number;
  average_response_time: number;
  success_rate: number;
}

export interface CreateAgentRequest {
  name: string;
  description?: string | null;
  prompt: string;
  ai_model_id?: number | null;
  temperature: number;
  tools?: number[]; // JSONB array
  knowledge_bases?: number[]; // JSONB array
  metadata?: Record<string, unknown>; // JSONB object
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string | null;
  prompt?: string;
  ai_model_id?: number | null;
  temperature?: number;
  tools?: unknown; // JSONB array
  knowledge_bases?: unknown; // JSONB array
  metadata?: unknown; // JSONB object
  is_active?: boolean;
}

// 智能体列表响应类型
export interface AgentListResponse {
  items: Agent[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 智能体详情响应类型（包含统计信息）
export interface AgentResponse extends Agent {
  conversation_count: number;
  message_count: number;
  token_usage: number;
}

// 智能体查询参数类型
export interface AgentQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  ai_model_id?: number;
  is_active?: boolean;
  order_by?: string;
  order_dir?: 'asc' | 'desc';
}

// 对话相关类型
export interface Conversation {
  id: string;
  agent_id: string;
  agent_name: string;
  dootask_chat_id: string;
  dootask_user_id: string;
  user_id: string;
  user_name: string;
  context: Record<string, unknown>;
  message_count: number;
  created_at: string;
  updated_at: string;
  last_message?: Message;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown>;
  response_time?: number;
  created_at: string;
}

// 知识库相关类型
export interface KnowledgeBase {
  id: number; // 后端返回number类型
  name: string;
  description?: string | null;
  embedding_model: string; // 嵌入模型
  chunk_size: number;
  chunk_overlap: number;
  provider: string; // 新增
  proxy_url?: string | null; // 新增
  metadata: unknown; // JSONB字段
  is_active: boolean; // 是否激活
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
  documents_count?: number; // 文档数量
  api_key?: string | null; // 知识库API密钥
}

export interface Document {
  id: string;
  knowledgeBaseId: string;
  title: string;
  content: string;
  filePath?: string;
  fileType: 'pdf' | 'docx' | 'markdown' | 'text';
  fileSize: number;
  metadata: Record<string, unknown>;
  processed: boolean;
  createdAt: string;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description?: string | null;
  embedding_model: string; // 后端字段名
  chunk_size?: number;
  chunk_overlap?: number;
  api_key?: string | null; // 后端字段名
  provider: string; // 新增：必填
  proxy_url?: string | null; // 新增：非必填
  metadata?: string; // JSON字符串
}

export interface UploadDocumentRequest {
  title: string; // 修改为title而不是knowledgeBaseId
  content: string;
  file_type: string;
  file_size: number;
  file_path?: string | null;
  metadata?: string; // JSON字符串
}

// MCP工具相关类型
export interface MCPTool {
  id: string;
  name: string;
  mcpName: string; // 新增：MCP工具标识
  description: string;
  category: 'dootask' | 'external';
  config: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // 新增：配置类型 - 扩展为四种方式
  configType?: number; // 0-streamable_http 1-websocket 2-sse 3-stdio
  // 前端扩展字段（从config中提取）
  // 新增：配置方式
  configTypeName?: 'streamable_http' | 'websocket' | 'sse' | 'stdio';
  // 统一配置信息为JSON格式
  configJson?: string;
  statistics?: MCPToolStatistics;
  // 新增：配置信息
  configInfo?: {
    type: number;
    hasApiKey: boolean;
    configData: Record<string, unknown>;
  };
}

export interface MCPToolStatistics {
  totalCalls: number;
  todayCalls: number;
  averageResponseTime: number;
  successRate: number;
}

// MCP工具统计响应
export interface MCPToolStatsResponse {
  total: number;
  active: number;
  inactive: number;
  dootask_tools: number;
  external_tools: number;
  custom_tools: number;
  internal_tools: number;
  external_type_tools: number;
  total_calls: number;
  avg_response_time: number;
}

export interface CreateMCPToolRequest {
  name: string;
  mcp_name: string; // 修复：使用后端字段名mcp_name
  description: string;
  category: 'dootask' | 'external' | 'custom';
  type: 'internal' | 'external';
  config: Record<string, unknown>;
  permissions?: string[];
}

export interface UpdateMCPToolRequest extends Partial<CreateMCPToolRequest> {
  isActive?: boolean;
}

// 系统设置相关类型
export interface SystemSettings {
  id: string;
  aiModels: AIModelConfig[];
  dootaskIntegration: DooTaskIntegrationConfig;
  webhookConfig: WebhookConfig;
  generalSettings: GeneralSettings;
  updatedAt: string;
}

export interface AIModelConfig {
  id: number;
  name: string;
  provider: string;
  model_name: string;
  api_key?: string | null;
  base_url: string;
  proxy_url?: string;
  max_tokens: number;
  temperature: number;
  is_enabled: boolean;
  is_default: boolean;
  is_thinking: boolean; // 新增字段：是否为思考型模型
  created_at: string;
  updated_at: string;
  // 前端扩展字段（用于显示）
  displayName?: string;
  agent_count?: number;
  conversation_count?: number;
  token_usage?: number;
  lastUsedAt?: string;
  avgResponseTime?: string;
  successRate?: string;
  errorCount?: number;
}

export interface CreateAIModelRequest {
  name: string;
  provider: string;
  model_name: string;
  api_key?: string | null;
  base_url?: string;
  proxy_url?: string;
  max_tokens: number;
  temperature: number;
  is_enabled: boolean;
  is_default: boolean;
  is_thinking?: boolean; // 新增字段：是否为思考型模型
}

export interface UpdateAIModelRequest {
  name?: string;
  provider?: string;
  model_name?: string;
  api_key?: string | null;
  base_url?: string;
  proxy_url?: string;
  max_tokens?: number;
  temperature?: number;
  is_enabled?: boolean;
  is_default?: boolean;
  is_thinking?: boolean; // 新增字段：是否为思考型模型
}

export interface AIModelListResponse {
  success: boolean;
  data: {
    models: AIModelConfig[];
    total: number;
    page: number;
    size: number;
    total_pages: number;
  };
}

export interface AIModelResponse {
  success: boolean;
  data: AIModelConfig;
}

export interface DooTaskIntegrationConfig {
  apiBaseUrl: string;
  token: string;
  isConnected: boolean;
  lastSync: string;
}

export interface WebhookConfig {
  url: string;
  secret: string;
  isActive: boolean;
  lastReceived?: string;
}

export interface GeneralSettings {
  defaultLanguage: 'zh-CN' | 'en-US';
  timezone: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  maxConversationHistory: number;
  autoCleanupDays: number;
}

// 仪表板统计类型
export interface DashboardStats {
  agents: {
    total: number;
    active: number;
    inactive: number;
  };
  conversations: {
    total: number;
    today: number;
    active: number;
  };
  messages: {
    total: number;
    today: number;
    averageResponseTime: number;
  };
  knowledgeBases: {
    total: number;
    documentsCount: number;
  };
  mcpTools: {
    total: number;
    active: number;
  };
  systemStatus: {
    goService: 'online' | 'offline';
    pythonService: 'online' | 'offline';
    database: 'online' | 'offline';
    webhook: 'connected' | 'disconnected';
  };
}

// 系统状态类型
export interface SystemStatus {
  service: string;
  status: 'online' | 'offline' | 'error';
  uptime: number;
  lastCheck: string;
  details?: Record<string, unknown>;
}

// 分页相关类型
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

// 表单相关类型
export interface FormErrors {
  [key: string]: string[] | undefined;
}

// 操作结果类型
export interface OperationResult {
  success: boolean;
  message: string;
  data?: unknown;
}

// 智能体详情页面的扩展类型
export interface AgentDetail extends Agent {
  toolDetails: MCPTool[];
  knowledgeBaseDetails: KnowledgeBase[];
  conversationCount?: number;
  messageCount?: number;
  lastUsedAt?: string;
}

// 知识库文档类型
export interface KnowledgeBaseDocument {
  id: number; // 后端返回number类型
  knowledge_base_id: number; // 知识库ID
  title: string; // 文档标题
  content: string; // 文档内容
  file_path?: string | null; // 文件路径
  file_type: string; // 文件类型
  file_size: number; // 文件大小
  metadata: unknown; // 元数据
  chunk_index: number; // 分块索引
  parent_doc_id?: number | null; // 父文档ID
  status: 'processed' | 'processing' | 'failed'; // 处理状态
  is_active: boolean; // 是否激活
  created_at: string; // 创建时间
  updated_at: string; // 更新时间
  chunks_count?: number; // 分块数量
  api_key?: string | null; // 知识库API密钥
}
