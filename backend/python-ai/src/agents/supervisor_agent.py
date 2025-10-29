import json
from core import get_model_by_provider, settings
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.runnables import RunnableConfig
from langgraph.func import entrypoint
from langgraph.prebuilt import create_react_agent
from langgraph_supervisor import create_supervisor
from agents.knowledge_base_agent import kb_agent
from agents.mcp_agent import mcp_agent

# def add(a: float, b: float) -> float:
#     """Add two numbers."""
#     return a + b


# def multiply(a: float, b: float) -> float:
#     """Multiply two numbers."""
#     return a * b


# def web_search(query: str) -> str:
#     """Search the web for information."""
#     return (
#         "Here are the headcounts for each of the FAANG companies in 2024:\n"
#         "1. **Facebook (Meta)**: 67,317 employees.\n"
#         "2. **Apple**: 164,000 employees.\n"
#         "3. **Amazon**: 1,551,000 employees.\n"
#         "4. **Netflix**: 14,000 employees.\n"
#         "5. **Google (Alphabet)**: 181,269 employees."
#     )


def build_supervisor(provider: str,model_name: str, agent_config: str):
    base_prompt = (
        "你是一个任务路由中枢。请根据以下规则，将用户请求精准地分配给最合适的代理：\n\n"
        "- **如果**问题明确指向内部知识、公司文档、项目资料或特定产品信息，**则**路由给 `knowledge_base_expert`。\n"
        "- **对于**所有其他通用问题、需要网络搜索、或需要获取实时数据的请求，**则**路由给 `multi_tool_specialist`。\n\n"
        "你的回答必须且只能是所选代理的名称。"
    )
    model = get_model_by_provider(provider, model_name, agent_config)
    # math_agent = create_react_agent(
    #     model=model,
    #     tools=[add, multiply],
    #     name="math_expert",
    #     prompt="You are a math expert. Always use one tool at a time.",
    # ).with_config(tags=["skip_stream"])

    # research_agent = create_react_agent(
    #     model=model,
    #     tools=[web_search],
    #     name="research_expert",
    #     prompt="You are a world class researcher with access to web search. Do not do any math.",
    # ).with_config(tags=["skip_stream"])

    kb_agent.name = "knowledge_base_expert"
    kb_agent.prompt = "你是一位专门从内部知识库中检索信息并回答问题的专家。当用户的提问涉及到公司内部政策、产品手册、项目资料或任何存储在私有知识库中的特定知识时，应该选择你。你的所有回答都必须严格基于检索到的文档，不能使用外部知识或进行网络搜索。"
    
    mcp_agent.name = "multi_tool_specialist"
    mcp_agent.prompt = "你是一位能够调用多种外部工具来执行通用任务的专家。当用户的请求不属于内部知识库查询，而是需要执行实时操作（如网页搜索、查询天气、调用计算器）或与任何外部API交互时，应该选择你。你是处理开放性问题和动态任务的最佳选择。"
    prompt = json.loads(agent_config).get("prompt")
    if prompt:
        base_prompt=(prompt)
    workflow = create_supervisor(
        [kb_agent, mcp_agent],
        model=model,
        prompt=base_prompt,
        add_handoff_back_messages=False,
    )
    return workflow.compile()


@entrypoint()
async def supervisor_agent(
    inputs: dict[str, list[BaseMessage]],
    *,
    previous: dict[str, list[BaseMessage]],
    config: RunnableConfig,
):
    # 1. 合并历史消息
    messages = inputs["messages"]
    if previous:
        messages = previous["messages"] + messages

    # 2. 动态决定模型并构建 supervisor
    configurable = config.get("configurable",{})
    supervisor = build_supervisor(
        configurable.get("provider"),
        configurable.get("model", settings.DEFAULT_MODEL),
        configurable.get("agent_config", None),
    )

    # 3. 运行 supervisor
    result = await supervisor.ainvoke({"messages": messages})

    # 4. 返回最终结果与要保存的状态
    return entrypoint.final(
        value={"messages": result["messages"][-1:]},  # 只把最终 AI 回答返回给前端
        save={"messages": result["messages"]},  # 把完整对话保存下来
    )
