from typing import Any, Literal, NotRequired

from pydantic import BaseModel, Field, SerializeAsAny
from typing_extensions import TypedDict


class AgentInfo(BaseModel):
    """Info about an available agent."""

    key: str = Field(
        description="Agent key.",
        examples=["research-assistant"],
    )
    description: str = Field(
        description="Description of the agent.",
        examples=["A research assistant for generating research papers."],
    )


class ServiceMetadata(BaseModel):
    """Metadata about the service including available agents and models."""

    agents: list[AgentInfo] = Field(
        description="List of available agents.",
    )
    models: list[str] = Field(
        description="List of available LLMs.",
    )
    default_agent: str = Field(
        description="Default agent used when none is specified.",
        examples=["research-assistant"],
    )
    default_model: str = Field(default="gpt-4o-mini",
        description="Default model used when none is specified.",
    )

class DocumentInput(BaseModel):
    """Input for document processing."""

    knowledge_base: str = Field(
        description="Knowledge base to store the processed documents.",
        examples=["default_knowledge_base"],
    )
    provider: str = Field(
        description="Provider of the embedding model.",
        default="openai",
        examples=["openai", "cohere", "google"],
    )
    model: str = Field(
        description="Embedding model to use.",
        default="text-embedding-3-small",
        examples=["text-embedding-3-small", "text-embedding-ada-002"],
    )
    api_key: str | None = Field(
        description="API key for the embedding provider (if required).",
        default=None,
        examples=["sk-xxxxxx"],
    )

class UserInput(BaseModel):
    """Basic user input for the agent."""

    message: str = Field(
        description="User input to the agent.",
        examples=["What is the weather in Tokyo?"],
    )
    provider: str | None = Field(
        description="Provider of the user input.",
        examples=["OpenAI", "Anthropic", "Google", "xAI (Grok)"],
    )
    model: SerializeAsAny[str] | None = Field(
        title="Model",
        description="LLM Model to use for the agent.",
        default="gpt-4o-mini",
        examples=["gpt-4o-mini", "claude-3.5-sonnet"],
    )
    thread_id: str | None = Field(
        description="Thread ID to persist and continue a multi-turn conversation.",
        default=None,
        examples=["847c6285-8fc9-4560-a83f-4e6285809254"],
    )
    user_id: str | None = Field(
        description="User ID to persist and continue a conversation across multiple threads.",
        default=None,
        examples=["847c6285-8fc9-4560-a83f-4e6285809254"],
    )
    agent_config: dict[str, Any] = Field(
        description="Additional configuration to pass through to the agent",
        default={},
        examples=[
            {
                "spicy_level": 0.8,
                "api_key": "xxxx",
                "base_url": "https://example.com",
                "api_version": "azure的model版本号",
                "proxy_url": "http://proxy.com",
                "temperature": 0.7,
            }
        ],
    )
    mcp_config: dict[str, Any] = Field(
        description="Additional configuration to pass through to the mcp agent",
        default={},
        examples=[
            {
                "math": {
                    "url": "http://localhost:8003/mcp/",
                    "transport": "streamable_http",
                },
                "weather": {
                    # make sure you start your weather server on port 8000
                    "url": "http://localhost:8000/mcp/",
                    "transport": "streamable_http",
                },
            }
        ],
    )

class StreamInput(UserInput):
    """User input for streaming the agent's response."""

    stream_tokens: bool = Field(
        description="Whether to stream LLM tokens to the client.",
        default=True,
    )


class ToolCall(TypedDict):
    """Represents a request to call a tool."""

    name: str
    """The name of the tool to be called."""
    args: dict[str, Any]
    """The arguments to the tool call."""
    id: str | None
    """An identifier associated with the tool call."""
    type: NotRequired[Literal["tool_call"]]


class ChatMessage(BaseModel):
    """Message in a chat."""

    type: Literal["human", "ai", "tool", "custom"] = Field(
        description="Role of the message.",
        examples=["human", "ai", "tool", "custom"],
    )
    content: str = Field(
        description="Content of the message.",
        examples=["Hello, world!"],
    )
    tool_calls: list[ToolCall] = Field(
        description="Tool calls in the message.",
        default=[],
    )
    tool_call_id: str | None = Field(
        description="Tool call that this message is responding to.",
        default=None,
        examples=["call_Jja7J89XsjrOLA5r!MEOW!SL"],
    )
    run_id: str | None = Field(
        description="Run ID of the message.",
        default=None,
        examples=["847c6285-8fc9-4560-a83f-4e6285809254"],
    )
    response_metadata: dict[str, Any] = Field(
        description="Response metadata. For example: response headers, logprobs, token counts.",
        default={},
    )
    custom_data: dict[str, Any] = Field(
        description="Custom message data.",
        default={},
    )
    usage_metadata: dict[str, Any] = Field(
        description="Usage metadata for the message.",
        default={},
    )

    def pretty_repr(self) -> str:
        """Get a pretty representation of the message."""
        base_title = self.type.title() + " Message"
        padded = " " + base_title + " "
        sep_len = (80 - len(padded)) // 2
        sep = "=" * sep_len
        second_sep = sep + "=" if len(padded) % 2 else sep
        title = f"{sep}{padded}{second_sep}"
        return f"{title}\n\n{self.content}"

    def pretty_print(self) -> None:
        print(self.pretty_repr())  # noqa: T201


class Feedback(BaseModel):  # type: ignore[no-redef]
    """Feedback for a run, to record to LangSmith."""

    run_id: str = Field(
        description="Run ID to record feedback for.",
        examples=["847c6285-8fc9-4560-a83f-4e6285809254"],
    )
    key: str = Field(
        description="Feedback key.",
        examples=["human-feedback-stars"],
    )
    score: float = Field(
        description="Feedback score.",
        examples=[0.8],
    )
    kwargs: dict[str, Any] = Field(
        description="Additional feedback kwargs, passed to LangSmith.",
        default={},
        examples=[{"comment": "In-line human feedback"}],
    )


class FeedbackResponse(BaseModel):
    status: Literal["success"] = "success"


class ServiceMetadata(BaseModel):
    """服务元数据，包括名称、版本等信息"""
    
    name: str = Field(
        description="服务名称",
        examples=["AI 助手服务"]
    )
    version: str = Field(
        description="服务版本",
        examples=["1.0.0"]
    )
    description: str = Field(
        description="服务描述",
        examples=["基于 LangGraph 的智能助手服务"]
    )
    available_agents: list[str] = Field(
        description="可用的代理列表",
        default=[]
    )


class ChatHistoryInput(BaseModel):
    """Input for retrieving chat history."""

    thread_id: str = Field(
        description="Thread ID to persist and continue a multi-turn conversation.",
        examples=["847c6285-8fc9-4560-a83f-4e6285809254"],
    )


class ChatHistory(BaseModel):
    messages: list[ChatMessage]
