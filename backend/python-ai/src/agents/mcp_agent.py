from core import get_model_by_provider, settings
from langchain.chat_models import init_chat_model
from langchain_core.messages import BaseMessage
from langchain_core.runnables import RunnableConfig
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.func import entrypoint
from langgraph.graph import START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode, tools_condition


@entrypoint()
async def mcp_agent(
    inputs: dict[str, list[BaseMessage]],
    *,
    previous: dict[str, list[BaseMessage]],
    config: RunnableConfig,
):
    
    messages = inputs["messages"]
    # 1. 合并历史消息
    # if previous:
    #     messages = previous["messages"] + messages

    # 2. 动态决定模型
    model = get_model_by_provider(
        config["configurable"].get("provider", "openai"),
        config["configurable"].get("model", settings.DEFAULT_MODEL),
        config["configurable"].get("agent_config", None),
    )
    config_tuple = config["configurable"].get("mcp_config", None)
    if config_tuple is None:
        config = {}
    mcp_config = dict(config_tuple) if config_tuple else {}
    print(mcp_config)
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
    response = await graph.ainvoke({"messages": messages})
    final_messages = response["messages"]
    print(response)
    return entrypoint.final(
        value={"messages": final_messages}, save={"messages": final_messages}
    )
