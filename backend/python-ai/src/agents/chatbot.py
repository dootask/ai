from core import get_model_by_provider, settings
from langchain_core.messages import BaseMessage
from langchain_core.runnables import RunnableConfig
from langgraph.func import entrypoint


@entrypoint()
async def chatbot(
    inputs: dict[str, list[BaseMessage]],
    *,
    previous: dict[str, list[BaseMessage]],
    config: RunnableConfig,
):
    messages = inputs["messages"]
    if previous:
        messages = previous["messages"] + messages

    model = get_model_by_provider(
        config["configurable"].get("provider"),
        config["configurable"].get("model", settings.DEFAULT_MODEL),
        config["configurable"].get("agent_config", None),
    )
    response = await model.ainvoke(messages)
    print(response)
    return entrypoint.final(
        value={"messages": [response]}, save={"messages": messages + [response]}
    )
