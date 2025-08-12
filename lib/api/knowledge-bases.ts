import axiosInstance from '@/lib/axios';
import type {
  CreateKnowledgeBaseRequest,
  KnowledgeBase,
  KnowledgeBaseDocument,
  KnowledgeBaseFilters,
  KnowledgeBaseListData,
  PaginationRequest,
  PaginationResponse,
  UploadDocumentRequest,
} from '@/lib/types';

// 知识库响应类型
interface KnowledgeBaseResponse {
  id: number;
  name: string;
  description?: string | null;
  embedding_model: string;
  chunk_size: number;
  chunk_overlap: number;
  api_key?: string | null;
  provider: string; // 新增
  proxy_url?: string | null; // 新增
  metadata: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  documents_count: number;
  total_chunks: number;
  processed_chunks: number;
  last_document_upload?: string;
}

// 文档筛选条件
interface DocumentFilters {
  search?: string;
  file_type?: string;
  status?: string;
}

// 文档列表数据
interface DocumentListData {
  items: KnowledgeBaseDocument[];
}

// 文档表单数据类型
interface DocumentFormData {
  title: string;
  content: string;
  file_type: string;
  file_size: number;
  file_path?: string;
  metadata?: Record<string, unknown>;
}

// 知识库创建数据类型
interface KnowledgeBaseCreateData {
  name: string;
  description?: string;
  embedding_model: string;
  chunk_size?: number;
  chunk_overlap?: number;
  api_key?: string;
  provider: string;
  proxy_url?: string;
  metadata?: Record<string, unknown>;
  is_active?: boolean;
}

// 知识库更新数据类型
interface KnowledgeBaseUpdateData {
  name?: string;
  description?: string;
  embedding_model?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  api_key?: string;
  provider?: string;
  proxy_url?: string;
  metadata?: Record<string, unknown>;
  is_active?: boolean;
}

// 知识库管理API
export const knowledgeBasesApi = {
  // 获取知识库列表
  list: async (
    params: Partial<PaginationRequest> & { filters?: KnowledgeBaseFilters } = { page: 1, page_size: 12 }
  ): Promise<PaginationResponse<KnowledgeBaseListData>> => {
    const defaultParams: PaginationRequest = {
      page: 1,
      page_size: 12,
      sorts: [{ key: 'created_at', desc: true }],
      filters: params.filters || {},
    };

    const requestParams = { ...defaultParams, ...params };
    const response = await axiosInstance.get<PaginationResponse<KnowledgeBaseListData>>('/knowledge-bases', {
      params: requestParams,
    });
    return response.data;
  },

  // 获取知识库详情
  get: async (id: number): Promise<KnowledgeBaseResponse> => {
    const response = await axiosInstance.get<KnowledgeBaseResponse>(`/knowledge-bases/${id}`);
    return response.data;
  },

  // 创建知识库
  create: async (data: KnowledgeBaseCreateData): Promise<KnowledgeBase> => {
    const requestData = formatCreateRequestForAPI(data);
    const response = await axiosInstance.post<KnowledgeBase>('/knowledge-bases', requestData);
    return response.data;
  },

  // 更新知识库
  update: async (id: number, data: KnowledgeBaseUpdateData): Promise<KnowledgeBase> => {
    const requestData = formatUpdateRequestForAPI(data);
    const response = await axiosInstance.put<KnowledgeBase>(`/knowledge-bases/${id}`, requestData);
    return response.data;
  },

  // 删除知识库
  delete: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/knowledge-bases/${id}`);
  },

  // 获取文档列表
  getDocuments: async (
    id: number,
    params: Partial<PaginationRequest> & { filters?: DocumentFilters } = { page: 1, page_size: 12 }
  ): Promise<PaginationResponse<DocumentListData>> => {
    const defaultParams: PaginationRequest = {
      page: 1,
      page_size: 12,
      sorts: [{ key: 'created_at', desc: true }],
      filters: params.filters || {},
    };

    const requestParams = { ...defaultParams, ...params };
    const response = await axiosInstance.get<PaginationResponse<DocumentListData>>(`/knowledge-bases/${id}/documents`, {
      params: requestParams,
    });
    return response.data;
  },

  // 上传文档
  uploadDocument: async (id: number, data: DocumentFormData): Promise<KnowledgeBaseDocument> => {
    const requestData = formatDocumentRequestForAPI(data);
    const response = await axiosInstance.post<KnowledgeBaseDocument>(`/knowledge-bases/${id}/documents`, requestData);
    return response.data;
  },

  // 删除文档
  deleteDocument: async (id: number, docId: number): Promise<void> => {
    await axiosInstance.delete(`/knowledge-bases/${id}/documents/${docId}`);
  },
};

// 辅助函数

// 格式化创建请求数据
const formatCreateRequestForAPI = (data: KnowledgeBaseCreateData): CreateKnowledgeBaseRequest => ({
  name: data.name,
  description: data.description || null,
  embedding_model: data.embedding_model,
  chunk_size: data.chunk_size,
  chunk_overlap: data.chunk_overlap,
  api_key: data.api_key || null,
  provider: data.provider || '', // 从外部传入
  proxy_url: data.proxy_url || null,
  metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
});

// 格式化更新请求数据
const formatUpdateRequestForAPI = (data: KnowledgeBaseUpdateData) => ({
  name: data.name,
  description: data.description,
  embedding_model: data.embedding_model,
  chunk_size: data.chunk_size,
  chunk_overlap: data.chunk_overlap,
  api_key: data.api_key,
  provider: data.provider, // 从外部传入
  proxy_url: data.proxy_url,
  metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
  is_active: data.is_active,
});

// 格式化文档请求数据
const formatDocumentRequestForAPI = (data: DocumentFormData): UploadDocumentRequest => ({
  title: data.title,
  content: data.content,
  file_type: data.file_type,
  file_size: data.file_size,
  file_path: data.file_path || null,
  metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
});

// 创建分页请求参数的辅助函数
export const createKnowledgeBaseListRequest = (
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

export default knowledgeBasesApi;
