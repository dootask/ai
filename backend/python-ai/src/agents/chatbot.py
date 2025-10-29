import json
import re
import tempfile
import time
from io import BytesIO
from typing import Any

import httpx
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
        agent_config = json.loads(configurable.get("agent_config", None)) if configurable.get("agent_config", None) else {}
        messages = [SystemMessage(content=agent_config.get("prompt",""))] + messages

    response = await llm.ainvoke(messages)

    return entrypoint.final(
        value={"messages": [response]}, save={"messages": messages + [response]}
    )
