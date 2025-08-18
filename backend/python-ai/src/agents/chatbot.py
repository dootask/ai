import json
from typing import Any

from core import get_model_by_provider, settings
from langchain_core.language_models.base import LanguageModelInput
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, SystemMessage
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
    configurable = config.get("configurable",{})
    model = get_model_by_provider(
        configurable.get("provider"),
        configurable.get("model", settings.DEFAULT_MODEL),
        configurable.get("agent_config", None),
    )
    messages = inputs["messages"]
    llm = model
    if previous:
        messages = previous["messages"] + messages
    else:
        agent_config = json.loads(configurable.get("agent_config")) if configurable.get("agent_config") else {}
        messages = [SystemMessage(content=agent_config.get("prompt",""))] + messages

    response = await llm.ainvoke(messages)
    # print(response)
    return entrypoint.final(
        value={"messages": [response]}, save={"messages": messages + [response]}
    )
