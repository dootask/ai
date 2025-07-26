import base64
import os
import time
from functools import cache
from typing import Optional, TypeAlias

from langchain_anthropic import ChatAnthropic
from langchain_aws import ChatBedrock
from langchain_cohere import ChatCohere
from langchain_community.chat_models import FakeListChatModel
from langchain_deepseek import ChatDeepSeek
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_vertexai import ChatVertexAI
from langchain_groq import ChatGroq
from langchain_ollama import ChatOllama
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from langchain_xai import ChatXAI


class FakeToolModel(FakeListChatModel):
    def __init__(self, responses: list[str]):
        super().__init__(responses=responses)

    def bind_tools(self, tools):
        return self


ModelT: TypeAlias = (
    AzureChatOpenAI
    | ChatOpenAI
    | ChatAnthropic
    | ChatGoogleGenerativeAI
    | ChatVertexAI
    | ChatGroq
    | ChatBedrock
    | ChatOllama
    | FakeToolModel
    | ChatXAI
)

# 提供商配置映射表
PROVIDER_MODEL_MAPPING = {
    "OpenAI": {
        "class": ChatOpenAI,
        "params": {
            "streaming": True,
        },
        "required_fields": ["api_key"],
        "param_mapping": {
            "model": "model",
            "api_key": "api_key",
            "temperature": "temperature",
            "openai_proxy": None,
        }
    },
    "Anthropic": {
        "class": ChatAnthropic,
        "params": {
            "streaming": True,
        },
        "required_fields": ["api_key"],
        "param_mapping": {
            "model": "model",
            "api_key": "api_key",
            "temperature": "temperature",
        }
    },
    "Google": {
        "class": ChatGoogleGenerativeAI,
        "params": {
            "streaming": True,
        },
        "required_fields": ["api_key"],
        "param_mapping": {
            "model": "model",
            "api_key": "api_key",
            "temperature": "temperature",
        }
    },
    "xAI (Grok)": {
        "class": ChatXAI,
        "params": {},
        "required_fields": ["api_key"],
        "param_mapping": {
            "model": "model",
            "api_key": "api_key",
            "openai_proxy": None,
            "temperature": "temperature",
        }
    },
    "DeepSeek": {
        "class": ChatDeepSeek,
        "params": {
            "streaming": True,
        },
        "required_fields": ["api_key"],
        "param_mapping": {
            "model": "model",
            "api_key": "api_key",
            "openai_proxy": None,
            "temperature": "temperature",
        }
    },
    "Azure OpenAI": {
        "class": AzureChatOpenAI,
        "params": {
            "streaming": True,
            "timeout": 60,
            "max_retries": 3,
        },
        "required_fields": ["api_key", "base_url"],
        "param_mapping": {
            "api_key": "api_key",
            "deployment_name": "model",
            "azure_endpoint": None,
            "api_version": "api_version",
            "temperature": "temperature",
            "openai_proxy": None,
        },
        "default_values": {
            "api_version": "2024-02-15-preview"
        }
    },
    "本地模型": {
        "class": ChatOllama,
        "params": {},
        "required_fields": [],
        "param_mapping": {
            "model": "model",
            "temperature": "temperature",
            "base_url": None,
            "api_key": None
        }
    },
    # OpenAI 兼容的提供商
    "Meta (Llama)": {
        "class": ChatOpenAI,
        "params": {
            "streaming": True,
        },
        "required_fields": ["api_key","base_url"],
        "param_mapping": {
            "model": "model",
            "base_url": None,
            "api_key": "api_key",
            "temperature": "temperature",
            "openai_proxy": None,
        }
    },
    "Alibaba (Qwen)": {
        "class": ChatOpenAI,
        "params": {
            "streaming": True,
        },
        "required_fields": ["api_key"],
        "param_mapping": {
            "model": "model",
            "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "api_key": "api_key",
            "temperature": "temperature",
            "openai_proxy": None,
        }
    },
    "Cohere": {
        "class": ChatCohere,
        "params": {
            "streaming": True,
        },
        "required_fields": ["cohere_api_key"],
        "param_mapping": {
            "model": "model",
            "base_url": None,
            "cohere_api_key": "api_key",
            "temperature": "temperature"
        }
    },
    "OpenRouter": {
        "class": ChatOpenAI,
        "params": {
            "streaming": True,
        },
        "required_fields": ["api_key"],
        "param_mapping": {
            "model": "model",
            "base_url": "https://openrouter.ai/api/v1/",
            "api_key": "api_key",
            "temperature": "temperature",
            "openai_proxy": None,
        }
    },
}

@cache
def get_model_by_provider(
    provider_name: str, 
    model_name: str, 
    config_tuple: Optional[dict] = None
) -> ModelT:
    """
    根据提供商名称直接返回对应的模型实例
    
    Args:
        provider_name: 提供商名称
        model_name: 模型名称
        config_tuple: 配置参数
    
    Returns:
        ModelT: 对应的模型实例
    """
    if config_tuple is None:
        config = {}
    config = dict(config_tuple) if config_tuple else {}

    def cfg(key: str, default=None):
        return config.get(key, default)

    # 获取提供商配置
    provider_config = PROVIDER_MODEL_MAPPING.get(provider_name)
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
        elif config_key == "deployment_name":
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
    print(model_params)
    if cfg("proxy_url"):
        os.environ["https_proxy"] = use_proxy
        os.environ["http_proxy"] = use_proxy
    try:
        model = model_class(**model_params)
    finally:
        os.environ.pop["https_proxy"]
        os.environ.pop["http_proxy"]
    return model
