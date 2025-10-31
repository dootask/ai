import json
from core import get_model_by_provider, settings
from langchain_core.messages import BaseMessage,SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.func import entrypoint
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition
import logging
logger = logging.getLogger("uvicorn")

@entrypoint()
async def mcp_agent(
    inputs: dict[str, list[BaseMessage]],
    *,
    previous: dict[str, list[BaseMessage]],
    config: RunnableConfig,
):
    
    messages = inputs["messages"]
    # 1. 合并历史消息
    if previous:
       messages = previous["messages"] + messages
    configurable = config.get("configurable",{})
    
    # 2. 动态决定模型
    model = get_model_by_provider(
        configurable.get("provider", "openai"),
        configurable.get("model", settings.DEFAULT_MODEL),
        configurable.get("agent_config", None),
    )
    config_tuple = configurable.get("mcp_config", None)
    if config_tuple is None:
        config = {}
    mcp_config = json.loads(config_tuple) if config_tuple else {}
    logger.info(mcp_config)
    client = MultiServerMCPClient(
        mcp_config
    )
    tools = await client.get_tools()

    def call_model(state: MessagesState):
        response = model.bind_tools(tools).invoke(state["messages"])
        return {"messages": response}

    builder = StateGraph(MessagesState)
    builder.add_node(call_model)
    builder.add_node(ToolNode(tools))
    builder.add_edge(START, "call_model")
    builder.add_conditional_edges(
        "call_model",
        tools_condition,
    )
    builder.add_edge("tools", "call_model")
    graph = builder.compile()
    agent_config = json.loads(configurable.get("agent_config", None)) if configurable.get("agent_config", None) else {}
    messages = [SystemMessage(content=agent_config.get("prompt",""))] + messages
    response = await graph.ainvoke({"messages": messages})
    final_messages = response["messages"]
    logger.info(response)
    return entrypoint.final(
        value={"messages": final_messages}, save={"messages": final_messages}
    )
