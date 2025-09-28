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
    print( previous["messages"])
    if isinstance(messages[0].content, str) and  messages[0].content.startswith("![]("):
        url = re.findall(r'\((.*?)\)', messages[0].content)[0]
        img_message=[HumanMessage(content=[{
                    "type": "image_url",
                    "image_url": {
                        "url": f"{url}"
                    }
                }])]
        if previous:
            msg = previous["messages"] + img_message
        else:
            msg = img_message
        return entrypoint.final(
            value={"messages": ""}, save={"messages": msg}
        )
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


    response = await llm.ainvoke(messages)
    # print(response)
    return entrypoint.final(
        value={"messages": [response]}, save={"messages": messages + [response]}
    )
