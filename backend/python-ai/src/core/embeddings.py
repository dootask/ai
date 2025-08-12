import json
import os
from functools import cache
from typing import Optional, TypeAlias

from core.crypto_aesgcm import decrypt
from langchain_cohere import CohereEmbeddings
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_ollama import OllamaEmbeddings
from langchain_openai import AzureOpenAIEmbeddings, OpenAIEmbeddings

EmbeddingsModelT: TypeAlias = (
    OpenAIEmbeddings
    | AzureOpenAIEmbeddings
    | GoogleGenerativeAIEmbeddings
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
            "dimensions": 512
        }
    },
    "google": {
        "class": GoogleGenerativeAIEmbeddings,
        "params": {},
        "required_fields": ["api_key"],
        "param_mapping": {
            "model": "model",
            "api_key": "api_key",
            "dimensions": 512
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
            "dimensions": 512
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
            "api_key": "api_key",
            "dimensions": 512
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
            "dimensions": 512
        }
    },
}

@cache
def get_embeddings_by_provider(
    provider_name: str, 
    model_name: str, 
    config_str: str | None = None
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
    if config_str is None:
        config = {}
    config = json.loads(config_str) if config_str else {}

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
    for config_key, _ in provider_config["param_mapping"].items():
        if config_key == "model":
            model_params[config_key] = model_name
        elif config_key == "azure_endpoint":
            model_params[config_key] = cfg("base_url", None)
        elif config_key == "deployment_name":
            model_params[config_key] = model_name
        elif config_key == "openai_proxy":
            model_params[config_key] = cfg("proxy_url")
        elif config_key == "api_key":
            model_params[config_key] = decrypt(cfg("api_key"))
        else:
            value = cfg(config_key)
            if value is not None:
                model_params[config_key] = value
    
    # 添加默认值
    if "default_values" in provider_config:
        for param, default_value in provider_config["default_values"].items():
            if param not in model_params:
                model_params[param] = cfg(param.replace("_", ""), default_value)

    # 创建并返回模型实例
    model_class = provider_config["class"]
    if cfg("proxy_url"):
        os.environ["all_proxy"] = cfg("proxy_url")
    try:
        model = model_class(**model_params)
    finally:
        if cfg("proxy_url"):
            del os.environ["all_proxy"]
    return model