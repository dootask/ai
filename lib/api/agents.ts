import axiosInstance from '@/lib/axios';
import type {
  Agent,
  AgentFilters,
  AgentListData,
  AgentResponse,
  CreateAgentRequest,
  PaginationRequest,
  PaginationResponse,
  UpdateAgentRequest,
} from '@/lib/types';

// 前端表单数据类型
interface AgentFormData {
  name: string;
  description?: string;
  prompt?: string;
  ai_model_id?: number | null;
  aiModelId?: number | null; // 兼容字段
  temperature: number;
  tools?: number[] | unknown;
  knowledgeBases?: number[] | unknown;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
  is_active?: boolean;
}

// 智能体管理API
export const agentsApi = {
  // 获取智能体列表
  list: async (
    params: Partial<PaginationRequest> & { filters?: AgentFilters } = { page: 1, page_size: 12 }
  ): Promise<PaginationResponse<AgentListData>> => {
    const defaultParams: PaginationRequest = {
      page: 1,
      page_size: 12,
      sorts: [{ key: 'created_at', desc: true }],
      filters: params.filters || {},
    };

    const requestParams = { ...defaultParams, ...params };
    const response = await axiosInstance.get<PaginationResponse<AgentListData>>('/agents', {
      params: requestParams,
    });
    return response.data;
  },
  // 获取全部智能体列表
  listAll: async (
    params: Partial<PaginationRequest> & { filters?: AgentFilters } = { page: 1, page_size: 12 }
  ): Promise<PaginationResponse<AgentListData>> => {
    const defaultParams: PaginationRequest = {
      page: 1,
      page_size: 12,
      sorts: [{ key: 'created_at', desc: true }],
      filters: params.filters || {},
    };

    const requestParams = { ...defaultParams, ...params };
    const response = await axiosInstance.get<PaginationResponse<AgentListData>>('/agents/all', {
      params: requestParams,
    });
    return response.data;
  },
  // 获取智能体详情
  get: async (id: number): Promise<AgentResponse> => {
    const response = await axiosInstance.get<AgentResponse>(`/agents/${id}`);
    return response.data;
  },

  // 创建智能体
  create: async (data: CreateAgentRequest): Promise<Agent> => {
    const response = await axiosInstance.post<Agent>('/agents', data);
    return response.data;
  },

  // 更新智能体
  update: async (id: number, data: UpdateAgentRequest): Promise<Agent> => {
    const response = await axiosInstance.put<Agent>(`/agents/${id}`, data);
    return response.data;
  },

  // 删除智能体
  delete: async (id: number): Promise<{ message: string }> => {
    const response = await axiosInstance.delete<{ message: string }>(`/agents/${id}`);
    return response.data;
  },

  // 切换智能体状态
  toggle: async (id: number, isActive: boolean): Promise<Agent> => {
    const response = await axiosInstance.patch<Agent>(`/agents/${id}/toggle`, {
      is_active: isActive,
    });
    return response.data;
  },

  // 设置用户配置
  setSettings: async (settings: Record<string, unknown>): Promise<{ message: string }> => {
    const response = await axiosInstance.post<{ message: string }>('/agents/settings', settings);
    return response.data;
  },
  // 获取用户配置
  getSettings: async (): Promise<Record<string, unknown>> => {
    const response = await axiosInstance.get<{
      message: string;
      data: Array<{ key: string; value: unknown }>;
    }>('/agents/settings');
  
    // 1. 告诉 TS “以后随便加 key”
    const configObject: Record<string, unknown> = {};
  
    // 2.  item 已经带有具体类型，无需 any
    response.data.data.forEach(item => {
      configObject[item.key] = item.value;
    });
  
    return configObject;
  }
};

// 辅助函数 - 格式化智能体数据（从后端格式转换为前端兼容格式）
export const formatAgentForUI = (agent: Agent): Agent & { model: string; isActive: boolean } => {
  return {
    ...agent,
    // 映射字段以兼容现有UI
    model: agent.ai_model?.name || 'unknown',
    isActive: agent.is_active,
  };
};

// 辅助函数 - 格式化创建请求数据（从前端格式转换为后端格式）
export const formatCreateRequestForAPI = (data: AgentFormData): CreateAgentRequest => {
  const tools = data.tools || [];
  const knowledgeBases = data.knowledgeBases || [];

  return {
    name: data.name,
    description: data.description || null,
    prompt: data.prompt || undefined,
    ai_model_id: data.ai_model_id || data.aiModelId || null,
    temperature: data.temperature,
    tools: tools as unknown as number[],
    knowledge_bases: knowledgeBases as unknown as number[],
    metadata: data.metadata || {},
  };
};

// 辅助函数 - 格式化更新请求数据（从前端格式转换为后端格式）
export const formatUpdateRequestForAPI = (data: Partial<AgentFormData>): UpdateAgentRequest => {
  const result: UpdateAgentRequest = {};

  if (data.name !== undefined) result.name = data.name;
  if (data.description !== undefined) result.description = data.description || null;
  if (data.prompt !== undefined) result.prompt = data.prompt;
  if (data.ai_model_id !== undefined || data.aiModelId !== undefined) {
    result.ai_model_id = data.ai_model_id || data.aiModelId || null;
  }
  if (data.temperature !== undefined) result.temperature = data.temperature;
  if (data.tools !== undefined) {
    result.tools = data.tools as unknown as number[];
  }
  if (data.knowledgeBases !== undefined) {
    result.knowledge_bases = data.knowledgeBases as unknown as number[];
  }
  if (data.metadata !== undefined) {
    result.metadata = data.metadata as unknown as Record<string, unknown>;
  }
  if (data.isActive !== undefined) result.is_active = data.isActive;
  if (data.is_active !== undefined) result.is_active = data.is_active;

  return result;
};

// 辅助函数 - 解析JSONB字段
export const parseAgentJSONBFields = (agent: Agent) => {
  try {
    return {
      ...agent,
      tools: typeof agent.tools === 'string' ? JSON.parse(agent.tools as string) : agent.tools || [],
      knowledge_bases:
        typeof agent.knowledge_bases === 'string'
          ? JSON.parse(agent.knowledge_bases as string)
          : agent.knowledge_bases || [],
      metadata: typeof agent.metadata === 'string' ? JSON.parse(agent.metadata as string) : agent.metadata || {},
      // 兼容字段映射
      knowledgeBases:
        typeof agent.knowledge_bases === 'string'
          ? JSON.parse(agent.knowledge_bases as string)
          : agent.knowledge_bases || [],
    };
  } catch (error) {
    console.error('解析智能体JSONB字段失败:', error);
    return {
      ...agent,
      tools: [],
      knowledge_bases: [],
      knowledgeBases: [],
      metadata: {},
    };
  }
};

// 创建分页请求参数的辅助函数
export const createAgentListRequest = (
  page = 1,
  pageSize = 12,
  filters: Record<string, unknown> = {},
  sorts: { key: string; desc: boolean }[] = []
): PaginationRequest => {
  return {
    page,
    page_size: pageSize,
    sorts: sorts.length > 0 ? sorts : [{ key: 'created_at', desc: true }],
    filters,
  };
};

// 导出默认API对象
export default agentsApi;
