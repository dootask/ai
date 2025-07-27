import os
from functools import cache
from typing import Optional, TypeAlias

from langchain_cohere import CohereEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_google_vertexai import VertexAIEmbeddings
from langchain_ollama import OllamaEmbeddings
from langchain_openai import AzureOpenAIEmbeddings, OpenAIEmbeddings

EmbeddingsModelT: TypeAlias = (
    OpenAIEmbeddings
    | AzureOpenAIEmbeddings
    | GoogleGenerativeAIEmbeddings
    | VertexAIEmbeddings
    | OllamaEmbeddings
    | CohereEmbeddings
)

# 提供商配置映射表
EMBEDDINGS_PROVIDER_MAPPING = {
    "openai": {
        "class": OpenAIEmbeddings,
        "params": {},
        "required_fields": ["api_key"],
        "param_mapping": {
            "model": "model",
            "api_key": "api_key",
            "openai_proxy": "openai_proxy",
        }
    },
    "google": {
        "class": GoogleGenerativeAIEmbeddings,
        "params": {},
        "required_fields": ["api_key"],
        "param_mapping": {
            "model": "model",
            "api_key": "api_key",
        }
    },
    "azure": {
        "class": AzureOpenAIEmbeddings,
        "params": {
            "timeout": 60,
            "max_retries": 3,
        },
        "required_fields": ["api_key", "base_url"],
        "param_mapping": {
            "api_key": "api_key",
            "deployment": "model",
            "azure_endpoint": "azure_endpoint",
            "api_version": "api_version",
            "openai_proxy": "openai_proxy",
        },
        "default_values": {
            "api_version": "2024-02-15-preview"
        }
    },
    "local": {
        "class": OllamaEmbeddings,
        "params": {},
        "required_fields": ["base_url"],
        "param_mapping": {
            "model": "model",
            "base_url": "base_url",
            "api_key": "api_key"
        }
    },
    "cohere": {
        "class": CohereEmbeddings,
        "params": {},
        "required_fields": ["cohere_api_key"],
        "param_mapping": {
            "model": "model",
            "base_url": "base_url",
            "cohere_api_key": "api_key",
        }
    },
}

@cache
def get_embeddings_by_provider(
    provider_name: str, 
    model_name: str, 
    config_tuple: dict | None = None
) -> EmbeddingsModelT:
    """
    根据提供商名称直接返回对应的嵌入模型实例
    
    Args:
        provider_name: 提供商名称
        model_name: 模型名称
        config_tuple: 配置参数
    
    Returns:
        EmbeddingsModelT: 对应的嵌入模型实例
    """
    if config_tuple is None:
        config = {}
    config = dict(config_tuple) if config_tuple else {}

    def cfg(key: str, default=None):
        return config.get(key, default)

    # 获取提供商配置
    provider_config = EMBEDDINGS_PROVIDER_MAPPING.get(provider_name)
    if not provider_config:
        raise ValueError(f"不支持的提供商: {provider_name}")

    # 检查必需字段
    for required_field in provider_config["required_fields"]:
        if not cfg(required_field):
            raise ValueError(f"{provider_name} 需要 '{required_field}' 参数")

    # 构建模型参数
    model_params = {}
    
    # 添加固定参数
    model_params.update(provider_config["params"])
    
    # 添加映射参数
    for model_param, config_key in provider_config["param_mapping"].items():
        if config_key == "model":
            model_params[model_param] = model_name
        elif config_key == "azure_endpoint":
            model_params[model_param] = cfg("base_url", None)
        elif config_key == "deployment":
            model_params[model_param] = model_name
        elif config_key == "openai_proxy":
            model_params[model_param] = cfg("proxy_url")
        else:
            value = cfg(config_key)
            if value is not None:
                model_params[model_param] = value
    
    # 添加默认值
    if "default_values" in provider_config:
        for param, default_value in provider_config["default_values"].items():
            if param not in model_params:
                model_params[param] = cfg(param.replace("_", ""), default_value)

    # 创建并返回模型实例
    model_class = provider_config["class"]
    print(f"创建 {provider_name} 嵌入模型: {model_name}")
    if cfg("proxy_url"):
        os.environ["https_proxy"] = cfg("proxy_url")
        os.environ["http_proxy"] = cfg("proxy_url")
    try:
        model = model_class(**model_params)
    finally:
        if cfg("proxy_url"):
            os.environ.pop("https_proxy", None)
            os.environ.pop("http_proxy", None)
    return model