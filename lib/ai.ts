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
  // {
  //   value: 'voyage-large-2',
  //   label: 'Voyage Large v2',
  //   provider: 'voyage',
  //   description: '专业检索优化的embedding模型',
  //   dimensions: 1536,
  //   maxTokens: 16000,
  //   cost: '中',
  //   costPer1M: 0.12,
  //   features: ['检索优化', '长文本支持'],
  // },
  // {
  //   value: 'voyage-code-2',
  //   label: 'Voyage Code v2',
  //   provider: 'voyage',
  //   description: '专门为代码优化的embedding模型',
  //   dimensions: 1536,
  //   maxTokens: 16000,
  //   cost: '中',
  //   costPer1M: 0.12,
  //   features: ['代码优化', '语义搜索'],
  // },

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
export const providerOptions = [
  {
    value: 'openai' as const,
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      'gpt-5',             // 最新旗舰模型 :contentReference[oaicite:0]{index=0}
      'gpt-5-mini',        // 旗舰模型的更轻版本
      'gpt-4.1',            // 上一代旗舰多模态模型 :contentReference[oaicite:1]{index=1}
      'gpt-4.1-mini',       // 较为轻量化版本
      'gpt-4.1-nano',       // 更轻、低成本版本
      'gpt-4o',             // still supported 多模态旗舰（若有） :contentReference[oaicite:2]{index=2}
      'gpt-4o-mini',        // 其轻量版本
      'gpt-3.5-turbo',      // 较为经济实用版本
    ],
    description: '业界领先的 AI 模型提供商，OpenAI 最新 GPT-5 系列及衍生版本',
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
      'claude-opus-4.1',     // 最新 Opus 4.1 :contentReference[oaicite:3]{index=3}
      'claude-sonnet-4.5',   // 最新 Sonnet 4.5 :contentReference[oaicite:4]{index=4}
      'claude-haiku-4.5',    // 最新 Haiku 4.5 :contentReference[oaicite:5]{index=5}
      'claude-3.7-sonnet',   // 较早但仍在用
      'claude-3.5-sonnet',   // 经济版本
      'claude-3.5-haiku',    // 最轻量经济版
    ],
    description: '高质量对话 AI 模型，Claude 最新 4 系列具备卓越推理能力',
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
      'gemini-2.5-pro',      // 最新旗舰模型 :contentReference[oaicite:6]{index=6}
      'gemini-2.5-flash',    // 较为均衡版本 :contentReference[oaicite:7]{index=7}
      'gemini-2.5-flash-lite',// 轻量高吞吐版本 :contentReference[oaicite:8]{index=8}
      'gemini-2.5-flash-image',// 图像专用分支（如 Nano Banana） :contentReference[oaicite:9]{index=9}
    ],
    description: 'Google 最新 Gemini 2.5 系列，支持超长上下文与原生多模态能力',
    icon: '🔍',
    color: 'bg-blue-100 text-blue-800',
    maxTokens: 1048576,
    temperature: 0.7,
  },
  {
    value: 'xai' as const,
    name: 'xAI (Grok)',
    baseUrl: 'https://api.x.ai/v1',
    models: [
      'grok-4',             // 假定最新版本
      'grok-3',             // 次主流版本
      'grok-3-mini',        // 轻量版
      'grok-beta',          // 测试版
    ],
    description: 'xAI 最新 Grok 系列，具备实时信息获取能力',
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
      'llama-4-maverick',   // 最新 Multimodal 开源模型 :contentReference[oaicite:10]{index=10}
      'llama-4-scout',      // 同系列较轻版 :contentReference[oaicite:11]{index=11}
      'llama-3.3-70b-instruct', // 较旧版本仍可用
      'llama-3.2-90b-vision-instruct', // …
      'llama-3.1-405b-instruct',
      'llama-3.1-70b-instruct',
      'llama-3.1-8b-instruct',
    ],
    description: 'Meta 最新 Llama 4 系列，开源高性能大语言模型',
    icon: '🦙',
    color: 'bg-indigo-100 text-indigo-800',
    maxTokens: 128000,
    temperature: 0.7,
  },
  {
    value: 'deepseek' as const,
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      'deepseek-v3',         // 最新主版本
      'deepseek-r1',         // 较早版本
      'deepseek-coder-v2',   // 编程专用
      'deepseek-chat',       // 聊天专用
    ],
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
      'qwen3-235b',        // 最新旗舰中文模型
      'qwen2.5-72b-instruct',
      'qwen2.5-32b-instruct',
      'qwen2.5-14b-instruct',
      'qwen2.5-7b-instruct',
    ],
    description: '阿里云通义千问 3.0 系列，中文理解能力突出',
    icon: '🌟',
    color: 'bg-yellow-100 text-yellow-800',
    maxTokens: 128000,
    temperature: 0.7,
  },
  {
    value: 'cohere' as const,
    name: 'Cohere',
    baseUrl: 'https://api.cohere.ai/v1',
    models: [
      'command-a',        // 企业级通用模型
      'command-r-plus',   // 推理版本
      'command-r',        // 经济版本
      'command-nightly',  // 夜间实验版本
    ],
    description: 'Cohere 企业级 AI 模型，专注于企业应用场景',
    icon: '💼',
    color: 'bg-teal-100 text-teal-800',
    maxTokens: 256000,
    temperature: 0.7,
  },
  {
    value: 'azure' as const,
    name: 'Azure OpenAI',
    baseUrl: 'https://your-resource.openai.azure.com',
    models: [
      'gpt-5',             // 使用 Azure 托管的 OpenAI 最新版本
      'gpt-4o',            // 兼容旧版本
      'gpt-4-turbo',       // …
      'gpt-4',             // …
      'gpt-3.5-turbo',     // …
    ],
    description: '微软 Azure AI 服务，企业级安全和合规',
    icon: '☁️',
    color: 'bg-purple-100 text-purple-800',
    maxTokens: 128000,
    temperature: 0.7,
  },
  {
    value: 'local' as const,
    name: '本地模型',
    baseUrl: 'http://localhost:11434',
    models: [
      'llama3.2',           // 本地开源版本
      'llama3.1',           // …
      'qwen2.5',            // …
      'mistral-nemo',       // …
      'gemma2',             // …
      'codellama',          // 编程专用
      'deepseek-coder',     // 本地推理版
    ],
    description: '本地部署开源模型，支持 O llama 等本地服务',
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
    description: 'DooTask 内部工具(全部可见)',
    color: 'bg-blue-100 text-blue-800',
  },
  {
    value: 'external',
    label: '外部工具',
    description: '第三方服务和 API',
    color: 'bg-green-100 text-green-800',
  },
];
