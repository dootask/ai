import json
import re
from typing import Any

from core import get_model_by_provider, settings
from langchain_core.language_models.base import LanguageModelInput
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.runnables import (Runnable, RunnableConfig, RunnableLambda,
                                      RunnableSerializable)
from langgraph.func import entrypoint


@entrypoint()
async def chatbot(
    inputs: dict[str, list[BaseMessage]],
    *,
    previous: dict[str, list[BaseMessage]],
    config: RunnableConfig,
):
    messages = inputs["messages"]

    configurable = config.get("configurable",{})
    model = get_model_by_provider(
        configurable.get("provider"),
        configurable.get("model", settings.DEFAULT_MODEL),
        configurable.get("agent_config", None),
    )

    llm = model
    if previous:
        messages = previous["messages"] + messages
    else:
        agent_config = json.loads(configurable.get("agent_config")) if configurable.get("agent_config") else {}
        messages = [SystemMessage(content=agent_config.get("prompt",""))] + messages

    
    if isinstance(inputs["messages"][0].content, str) and "![](" in inputs["messages"][0].content:
        # 提取所有图片URL
        urls = re.findall(r'!\[\]\((.*?)\)', inputs["messages"][0].content)
        
        # 移除所有图片标记，获取纯文本
        text_content = re.sub(r'!\[\]\(.*?\)', '', inputs["messages"][0].content).strip()
        
        content_list = []
        
        # 添加所有图片
        for url in urls:
            content_list.append({
                "type": "image_url",
                "image_url": {"url": url}
            })
        
        # 添加文本（如果有的话）
        if text_content:
            content_list.append({
                "type": "text",
                "text": text_content
            })
        
        img_message = [HumanMessage(content=content_list)]
        messages = messages + img_message

    response = await llm.ainvoke(messages)
    # print(response)
    return entrypoint.final(
        value={"messages": [response]}, save={"messages": messages + [response]}
    )
