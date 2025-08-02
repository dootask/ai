import axiosInstance from '@/lib/axios';
import type {
    CreateMCPToolRequest,
    MCPTool,
    MCPToolFilters,
    MCPToolListData,
    PaginationRequest,
    PaginationResponse,
    UpdateMCPToolRequest,
} from '@/lib/types';

// MCP工具查询参数（保留兼容性）
interface MCPToolQueryParams {
  page?: number;
  page_size?: number;
  search?: string;
  category?: 'dootask' | 'external' | 'custom';
  type?: 'internal' | 'external';
  is_active?: boolean;
  order_by?: string;
  order_dir?: 'asc' | 'desc';
}

// 测试工具请求
interface TestMCPToolRequest {
  test_data?: Record<string, unknown>;
}

// 测试工具响应
interface TestMCPToolResponse {
  success: boolean;
  message: string;
  response_time: number;
  test_result?: Record<string, unknown>;
}

// MCP工具统计响应
interface MCPToolStatsResponse {
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

// API响应类型定义（后端实际返回的原始格式）
interface MCPToolResponse {
  id: number; // 后端BIGSERIAL类型返回number
  name: string;
  description?: string | null;
  category: 'dootask' | 'external' | 'custom';
  type: 'internal' | 'external';
  config: Record<string, unknown>;
  permissions: string[];
  is_active: boolean; // 后端返回的字段名
  created_at: string; // 后端返回的字段名
  updated_at: string; // 后端返回的字段名
  mcp_name?: string; // 新增：MCP工具标识
  config_type?: number; // 新增：配置类型 0-streamable_http 1-websocket 2-sse 3-stdio
  // 统计信息
  total_calls?: number;
  today_calls?: number;
  average_response_time?: number;
  success_rate?: number;
  associated_agents?: number;
  // 新增：配置信息
  config_info?: {
    type: number;
    has_api_key: boolean;
    config_data: Record<string, unknown>;
  };
}

// 前端表单数据类型
interface MCPToolFormData {
  name: string;
  mcpName: string; // 新增：MCP工具标识
  description?: string;
  category: 'dootask' | 'external' | 'custom';
  type: 'internal' | 'external';
  config?: Record<string, unknown>;
  permissions?: string[];
  isActive?: boolean;
  // 配置方式 - 扩展为四种方式
  configType: 'streamable_http' | 'websocket' | 'sse' | 'stdio';
  // 统一配置信息为JSON格式
  configJson?: string; // JSON格式的配置信息
}

// 数据转换函数：后端格式 → 前端格式
const transformToFrontendFormat = (tool: MCPToolResponse): MCPTool => {
  // 从config中提取配置信息
  const config = tool.config || {};
  
  // 根据后端的config_type字段判断配置方式
  // config_type: 0-streamable_http 1-websocket 2-sse 3-stdio
  let configType: 'streamable_http' | 'websocket' | 'sse' | 'stdio';
  switch (tool.config_type) {
    case 1:
      configType = 'websocket';
      break;
    case 2:
      configType = 'sse';
      break;
    case 3:
      configType = 'stdio';
      break;
    default:
      configType = 'streamable_http';
  }
  
  // 生成配置JSON字符串
  const configJson = Object.keys(config).length > 0 ? JSON.stringify(config, null, 2) : '{}';
  
  return {
    id: tool.id.toString(), // 转换为string类型
    name: tool.name,
    mcpName: tool.mcp_name || '', // 新增：MCP工具标识
    description: tool.description || '',
    category: tool.category,
    type: tool.type,
    config: config,
    permissions: tool.permissions,
    isActive: tool.is_active, // 转换字段名
    createdAt: tool.created_at, // 转换字段名
    updatedAt: tool.updated_at, // 转换字段名
    // 新增：配置类型
    configType: tool.config_type || 0,
    // 配置方式
    configTypeName: configType,
    // 统一配置信息为JSON格式
    configJson: configJson,
    // 新增：配置信息
    configInfo: tool.config_info ? {
      type: tool.config_info.type,
      hasApiKey: tool.config_info.has_api_key,
      configData: tool.config_info.config_data,
    } : undefined,
    statistics:
      tool.total_calls !== undefined
        ? {
            totalCalls: tool.total_calls,
            todayCalls: tool.today_calls || 0,
            averageResponseTime: tool.average_response_time || 0,
            successRate: tool.success_rate || 1,
          }
        : undefined,
  };
};

// 数据转换函数：前端格式 → 后端格式
const transformToBackendFormat = (data: MCPToolFormData): CreateMCPToolRequest | UpdateMCPToolRequest => {
  // 直接使用前端传递的config，因为前端已经解析了JSON
  const config: Record<string, unknown> = data.config || {};
  
  // 根据配置方式设置config_type
  let configType: number;
  switch (data.configType) {
    case 'websocket':
      configType = 1;
      break;
    case 'sse':
      configType = 2;
      break;
    case 'stdio':
      configType = 3;
      break;
    default:
      configType = 0; // streamable_http
  }

  // 构建基础请求对象
  const baseRequest = {
    name: data.name,
    mcp_name: data.mcpName, // 修复：使用后端字段名mcp_name
    description: data.description || '',
    category: data.category,
    type: data.type,
    config: config, // 使用前端传递的config
    permissions: data.permissions || [],
    config_type: configType, // 设置配置类型
  };

  // 如果是更新请求，添加isActive字段
  if (data.isActive !== undefined) {
    return {
      ...baseRequest,
      isActive: data.isActive,
    } as UpdateMCPToolRequest;
  }

  return baseRequest as CreateMCPToolRequest;
};

// MCP工具管理API
export const mcpToolsApi = {
  // 获取工具列表
  list: async (
    params: Partial<PaginationRequest> & { filters?: MCPToolFilters } = { page: 1, page_size: 12 }
  ): Promise<PaginationResponse<MCPToolListData>> => {
    const defaultParams: PaginationRequest = {
      page: 1,
      page_size: 12,
      sorts: [{ key: 'created_at', desc: true }],
      filters: params.filters || {},
    };

    const requestParams = { ...defaultParams, ...params };

    // 定义后端实际返回的响应类型
    interface BackendResponse {
      current_page: number;
      page_size: number;
      total_items: number;
      total_pages: number;
      data: {
        items: MCPToolResponse[];
        stats: MCPToolStatsResponse;
      };
    }

    const response = await axiosInstance.get<BackendResponse>('/mcp-tools', {
      params: requestParams,
    });

    // 转换后端数据格式为前端格式
    const transformedData: MCPToolListData = {
      items: response.data.data.items.map((tool: MCPToolResponse) => transformToFrontendFormat(tool)),
      stats: response.data.data.stats,
    };

    return {
      current_page: response.data.current_page,
      page_size: response.data.page_size,
      total_items: response.data.total_items,
      total_pages: response.data.total_pages,
      data: transformedData,
    };
  },

  // 获取工具详情
  get: async (id: string): Promise<MCPTool> => {
    const response = await axiosInstance.get<MCPToolResponse>(`/mcp-tools/${id}`);
    return transformToFrontendFormat(response.data);
  },

  // 创建工具
  create: async (data: MCPToolFormData): Promise<MCPTool> => {
    const backendData = transformToBackendFormat(data);
    const response = await axiosInstance.post<MCPToolResponse>('/mcp-tools', backendData);
    return transformToFrontendFormat(response.data);
  },

  // 更新工具
  update: async (id: string, data: Partial<MCPToolFormData>): Promise<MCPTool> => {
    const backendData = transformToBackendFormat(data as MCPToolFormData);
    const response = await axiosInstance.put<MCPToolResponse>(`/mcp-tools/${id}`, backendData);
    return transformToFrontendFormat(response.data);
  },

  // 删除工具
  delete: async (id: string): Promise<{ message: string }> => {
    const response = await axiosInstance.delete(`/mcp-tools/${id}`);
    return response.data;
  },

  // 切换工具状态
  toggle: async (id: string, isActive: boolean): Promise<MCPTool> => {
    const response = await axiosInstance.patch<MCPToolResponse>(`/mcp-tools/${id}/toggle`, {
      is_active: isActive,
    });
    return transformToFrontendFormat(response.data);
  },

  // 测试工具
  test: async (id: string, testData?: Record<string, unknown>): Promise<TestMCPToolResponse> => {
    const response = await axiosInstance.post<TestMCPToolResponse>(`/mcp-tools/${id}/test`, {
      test_data: testData || {},
    });
    return response.data;
  },

  // 获取统计信息
  getStats: async (): Promise<MCPToolStatsResponse> => {
    const response = await axiosInstance.get<MCPToolStatsResponse>('/mcp-tools/stats');
    return response.data;
  },
};

// 创建分页请求参数的辅助函数
export const createMCPToolListRequest = (
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

// 导出类型供其他文件使用
export type { MCPToolFormData, MCPToolQueryParams, MCPToolStatsResponse, TestMCPToolRequest, TestMCPToolResponse };

export default mcpToolsApi;
