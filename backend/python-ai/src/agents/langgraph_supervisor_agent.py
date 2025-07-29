from core import get_model_by_provider, settings
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.runnables import RunnableConfig
from langgraph.func import entrypoint
from langgraph.prebuilt import create_react_agent
from langgraph_supervisor import create_supervisor


def add(a: float, b: float) -> float:
    """Add two numbers."""
    return a + b


def multiply(a: float, b: float) -> float:
    """Multiply two numbers."""
    return a * b


def web_search(query: str) -> str:
    """Search the web for information."""
    return (
        "Here are the headcounts for each of the FAANG companies in 2024:\n"
        "1. **Facebook (Meta)**: 67,317 employees.\n"
        "2. **Apple**: 164,000 employees.\n"
        "3. **Amazon**: 1,551,000 employees.\n"
        "4. **Netflix**: 14,000 employees.\n"
        "5. **Google (Alphabet)**: 181,269 employees."
    )


def build_supervisor(provider: str,model_name: str):
    """动态构建 supervisor workflow（每次调用都重新 compile）。"""
    model = get_model_by_provider(provider, model_name)

    math_agent = create_react_agent(
        model=model,
        tools=[add, multiply],
        name="math_expert",
        prompt="You are a math expert. Always use one tool at a time.",
    ).with_config(tags=["skip_stream"])

    research_agent = create_react_agent(
        model=model,
        tools=[web_search],
        name="research_expert",
        prompt="You are a world class researcher with access to web search. Do not do any math.",
    ).with_config(tags=["skip_stream"])

    workflow = create_supervisor(
        [research_agent, math_agent],
        model=model,
        prompt=(
            "You are a team supervisor managing a research expert and a math expert. "
            "For current events, use research_agent. "
            "For math problems, use math_agent."
        ),
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
    model_name = config.get("configurable",{}).get("model", settings.DEFAULT_MODEL)
    supervisor = build_supervisor(
        config.get("configurable",{}).get("provider"),
        model_name,
        config.get("configurable",{}).get("agent_config", None),
    )

    # 3. 运行 supervisor
    result = await supervisor.ainvoke({"messages": messages})

    # 4. 返回最终结果与要保存的状态
    return entrypoint.final(
        value={"messages": result["messages"][-1:]},  # 只把最终 AI 回答返回给前端
        save={"messages": result["messages"]},  # 把完整对话保存下来
    )
