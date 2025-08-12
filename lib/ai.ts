// Embedding 模型配置
export const embeddingModels = [
  // OpenAI 最新 Embedding 模型
  {
    value: 'text-embedding-3-large',
    label: 'OpenAI Embedding v3 Large',
    provider: 'openai',
    description: '最佳性能，支持可变维度输出，适合高精度场景',
    dimensions: 3072,
    maxDimensions: 3072,
    minDimensions: 256,
    maxTokens: 8191,
    cost: '高',
    costPer1M: 0.13,
    features: ['Matryoshka Representation Learning', '可变维度', '多语言支持'],
  },
  {
    value: 'text-embedding-3-small',
    label: 'OpenAI Embedding v3 Small',
    provider: 'openai',
    description: '性价比最佳，平衡性能与成本',
    dimensions: 1536,
    maxDimensions: 1536,
    minDimensions: 512,
    maxTokens: 8191,
    cost: '中',
    costPer1M: 0.02,
    features: ['Matryoshka Representation Learning', '可变维度', '多语言支持'],
  },
  {
    value: 'text-embedding-ada-002',
    label: 'OpenAI Ada-002 (Legacy)',
    provider: 'openai',
    description: '经典模型，成本较低，适合大部分场景',
    dimensions: 1536,
    maxTokens: 8191,
    cost: '低',
    costPer1M: 0.1,
    features: ['稳定可靠', '广泛兼容'],
    deprecated: true,
  },

  // Google Gemini Embedding 模型
  {
    value: 'gemini-embedding-001',
    label: 'Gemini Embedding v1',
    provider: 'google',
    description: 'Google最新embedding模型，MTEB排行榜第一',
    dimensions: 3072,
    maxDimensions: 3072,
    minDimensions: 768,
    maxTokens: 8192,
    cost: '中',
    costPer1M: 0.15,
    features: ['MTEB第一', 'Matryoshka Representation Learning', '100+语言支持', '多模态支持'],
  },
  {
    value: 'text-embedding-004',
    label: 'Google Text Embedding v4 (Legacy)',
    provider: 'google',
    description: 'Google上一代文本embedding模型',
    dimensions: 768,
    maxTokens: 3072,
    cost: '低',
    costPer1M: 0.1,
    features: ['多语言支持'],
    deprecated: true,
  },

  // Anthropic (注意：Anthropic目前没有专门的embedding模型)
  {
    value: 'claude-embedding-placeholder',
    label: 'Claude Embedding (暂未发布)',
    provider: 'anthropic',
    description: 'Anthropic计划中的embedding模型，暂未正式发布',
    dimensions: 1024,
    maxTokens: 8000,
    cost: '待定',
    costPer1M: 0,
    features: ['计划中'],
    available: false,
  },

  // Cohere Embedding 模型
  {
    value: 'embed-english-v3.0',
    label: 'Cohere Embed English v3',
    provider: 'cohere',
    description: 'Cohere英文embedding模型，企业级性能',
    dimensions: 1024,
    maxTokens: 512,
    cost: '中',
    costPer1M: 0.1,
    features: ['企业级', '高性能检索'],
  },
  {
    value: 'embed-multilingual-v3.0',
    label: 'Cohere Embed Multilingual v3',
    provider: 'cohere',
    description: 'Cohere多语言embedding模型',
    dimensions: 1024,
    maxTokens: 512,
    cost: '中',
    costPer1M: 0.1,
    features: ['100+语言支持', '跨语言检索'],
  },

  // Voyage AI Embedding 模型
  {
    value: 'voyage-large-2',
    label: 'Voyage Large v2',
    provider: 'voyage',
    description: '专业检索优化的embedding模型',
    dimensions: 1536,
    maxTokens: 16000,
    cost: '中',
    costPer1M: 0.12,
    features: ['检索优化', '长文本支持'],
  },
  {
    value: 'voyage-code-2',
    label: 'Voyage Code v2',
    provider: 'voyage',
    description: '专门为代码优化的embedding模型',
    dimensions: 1536,
    maxTokens: 16000,
    cost: '中',
    costPer1M: 0.12,
    features: ['代码优化', '语义搜索'],
  },

  // Azure OpenAI
  {
    value: 'text-embedding-3-large-azure',
    label: 'Azure OpenAI Embedding v3 Large',
    provider: 'azure',
    description: 'Azure版OpenAI Embedding v3 Large，企业级安全',
    dimensions: 3072,
    maxDimensions: 3072,
    minDimensions: 256,
    maxTokens: 8191,
    cost: '高',
    costPer1M: 0.13,
    features: ['企业安全', '合规性', 'Matryoshka Representation Learning'],
  },

  // 本地/开源 Embedding 模型
  {
    value: 'bge-large-en-v1.5',
    label: 'BGE Large English v1.5',
    provider: 'local',
    description: 'BAAI开源embedding模型，英文性能优秀',
    dimensions: 1024,
    maxTokens: 512,
    cost: '免费',
    costPer1M: 0,
    features: ['开源', '本地部署', '高性能'],
  },
  {
    value: 'bge-m3',
    label: 'BGE M3 Multilingual',
    provider: 'local',
    description: 'BAAI多语言embedding模型，支持100+语言',
    dimensions: 1024,
    maxTokens: 8192,
    cost: '免费',
    costPer1M: 0,
    features: ['开源', '多语言', '长文本', '密集检索'],
  },
  {
    value: 'sentence-transformers/all-MiniLM-L6-v2',
    label: 'Sentence-BERT MiniLM v2',
    provider: 'local',
    description: '轻量级开源embedding模型，快速部署',
    dimensions: 384,
    maxTokens: 256,
    cost: '免费',
    costPer1M: 0,
    features: ['开源', '轻量级', '快速', 'Hugging Face'],
  },
];

// AI提供商配置
export const providerOptions = [
  {
    value: 'openai' as const,
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4o',
      'gpt-4o-mini',
      'o3-mini',
      'o1',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
    ],
    description: '业界领先的AI模型提供商，2025年最新GPT-4.1系列',
    icon: '🤖',
    color: 'bg-green-100 text-green-800',
    maxTokens: 128000,
    temperature: 0.7,
  },
  {
    value: 'anthropic' as const,
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: [
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-3-7-sonnet-20250219',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-5-sonnet-20240620',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
    description: '高质量对话AI模型，Claude 4系列具备卓越推理能力',
    icon: '🧠',
    color: 'bg-orange-100 text-orange-800',
    maxTokens: 200000,
    temperature: 0.7,
  },
  {
    value: 'google' as const,
    name: 'Google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
      'gemini-pro',
      'gemini-pro-vision',
    ],
    description: 'Google最新Gemini 2.5系列，支持超长上下文和多模态',
    icon: '🔍',
    color: 'bg-blue-100 text-blue-800',
    maxTokens: 1048576,
    temperature: 0.7,
  },
  {
    value: 'xai' as const,
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    models: ['grok-4', 'grok-3', 'grok-3-mini', 'grok-beta'],
    description: 'xAI最新Grok系列，具备实时信息获取能力',
    icon: '🚀',
    color: 'bg-purple-100 text-purple-800',
    maxTokens: 256000,
    temperature: 0.7,
  },
  {
    value: 'meta' as const,
    name: 'Meta (Llama)',
    baseUrl: 'https://api.llama-api.com/v1',
    models: [
      'llama-4-maverick',
      'llama-4-scout',
      'llama-3.3-70b-instruct',
      'llama-3.2-90b-vision-instruct',
      'llama-3.1-405b-instruct',
      'llama-3.1-70b-instruct',
      'llama-3.1-8b-instruct',
    ],
    description: 'Meta最新Llama 4系列，开源高性能大语言模型',
    icon: '🦙',
    color: 'bg-indigo-100 text-indigo-800',
    maxTokens: 128000,
    temperature: 0.7,
  },
  {
    value: 'deepseek' as const,
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-r1', 'deepseek-v3', 'deepseek-coder-v2', 'deepseek-chat'],
    description: '深度求索最新推理模型，在数学和编程方面表现卓越',
    icon: '🔬',
    color: 'bg-cyan-100 text-cyan-800',
    maxTokens: 128000,
    temperature: 0.7,
  },
  {
    value: 'alibaba' as const,
    name: 'Alibaba (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    models: [
      'qwen3-235b',
      'qwen2.5-72b-instruct',
      'qwen2.5-32b-instruct',
      'qwen2.5-14b-instruct',
      'qwen2.5-7b-instruct',
    ],
    description: '阿里云通义千问3.0系列，中文理解能力突出',
    icon: '🌟',
    color: 'bg-yellow-100 text-yellow-800',
    maxTokens: 128000,
    temperature: 0.7,
  },
  {
    value: 'cohere' as const,
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v1',
    models: ['command-a', 'command-r-plus', 'command-r', 'command-nightly'],
    description: 'Cohere企业级AI模型，专注于企业应用场景',
    icon: '💼',
    color: 'bg-teal-100 text-teal-800',
    maxTokens: 256000,
    temperature: 0.7,
  },
  {
    value: 'azure' as const,
    name: 'Azure OpenAI',
    baseUrl: 'https://your-resource.openai.azure.com',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-4', 'gpt-35-turbo', 'gpt-4-32k'],
    description: '微软Azure AI服务，企业级安全和合规',
    icon: '☁️',
    color: 'bg-purple-100 text-purple-800',
    maxTokens: 128000,
    temperature: 0.7,
  },
  {
    value: 'local' as const,
    name: '本地模型',
    baseUrl: 'http://localhost:11434',
    models: ['llama3.2', 'llama3.1', 'qwen2.5', 'mistral-nemo', 'gemma2', 'codellama', 'deepseek-coder'],
    description: '本地部署开源模型，支持Ollama等本地服务',
    icon: '🏠',
    color: 'bg-gray-100 text-gray-800',
    maxTokens: 32000,
    temperature: 0.7,
  },
];

// 工具函数 - 从 providerOptions 读取数据
export const getProviderInfo = (provider: string) => {
  const providerConfig = providerOptions.find(p => p.value === provider);

  if (providerConfig) {
    return {
      name: providerConfig.name,
      color: providerConfig.color,
      icon: providerConfig.icon,
    };
  }

  // fallback for unknown providers
  return {
    name: provider,
    color: 'bg-gray-100 text-gray-800',
    icon: '❓',
  };
};

// 根据提供商获取推荐的默认配置 - 从 providerOptions 读取数据
export const getProviderDefaults = (provider: string) => {
  const providerConfig = providerOptions.find(p => p.value === provider);

  if (providerConfig) {
    return {
      maxTokens: providerConfig.maxTokens,
      temperature: providerConfig.temperature,
      baseUrl: providerConfig.baseUrl,
    };
  }

  // fallback for unknown providers
  return {
    maxTokens: 4000,
    temperature: 0.7,
    baseUrl: '',
  };
};

// 工具分类
export const toolCategories = [
  {
    value: 'dootask',
    label: 'DooTask',
    description: 'DooTask 内部工具',
    color: 'bg-blue-100 text-blue-800',
  },
  {
    value: 'external',
    label: '外部工具',
    description: '第三方服务和 API',
    color: 'bg-green-100 text-green-800',
  },
];
