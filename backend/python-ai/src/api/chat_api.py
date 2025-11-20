import logging
from typing import Any

from agents import DEFAULT_AGENT
from api import encrypt, is_from_swagger, verify_bearer
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from langsmith import Client as LangsmithClient
from schema import (ChatHistory, ChatHistoryInput, ChatMessage, Feedback,
                    FeedbackResponse, StreamInput, UserInput)
from service.chat_service import ChatService

logger = logging.getLogger("uvicorn")


# 应用认证依赖到所有路由
router = APIRouter(dependencies=[Depends(verify_bearer)], tags=["chatbot"])

# 初始化聊天服务
chat_service = ChatService()


@router.post("/{agent_id}/invoke")
@router.post("/invoke")
async def invoke(request: Request, user_input: UserInput, agent_id: str = DEFAULT_AGENT) -> ChatMessage:
    """
    调用代理获取最终响应
    
    如果未提供 agent_id，将使用默认代理。
    使用 thread_id 来持久化和继续多轮对话。run_id 参数也会附加到消息中用于记录反馈。
    使用 user_id 来在多个线程间持久化和继续对话。
    """
    if is_from_swagger(request.headers.get("referer", "")):
        user_input.agent_config["api_key"] = encrypt(user_input.agent_config.get("api_key"))
        for rag_config in user_input.rag_config:
            if rag_config.get("api_key"):
                rag_config["api_key"] = encrypt(rag_config.get("api_key"))
        
    try:
        callback = None
        if getattr(request.app.state, 'langfuse_handler', None):
            callback = request.app.state.langfuse_handler
        return await chat_service.invoke_agent(callback, user_input, agent_id)
    except Exception as e:
        logger.exception(f"An exception occurred: {e}")
        raise HTTPException(status_code=500, detail="Unexpected error")

def _sse_response_example() -> dict[int | str, Any]:
    return {
        status.HTTP_200_OK: {
            "description": "Server Sent Event Response",
            "content": {
                "text/event-stream": {
                    "example": "data: {'type': 'token', 'content': 'Hello'}\n\ndata: {'type': 'token', 'content': ' World'}\n\ndata: [DONE]\n\n",
                    "schema": {"type": "string"},
                }
            },
        }
    }

@router.post(
    "/{agent_id}/stream",
    response_class=StreamingResponse,
    responses=_sse_response_example(),
)
@router.post(
    "/stream", 
    response_class=StreamingResponse,
)
async def stream(
    request: Request, user_input: StreamInput, agent_id: str = DEFAULT_AGENT
) -> StreamingResponse:
    """
    流式传输代理对用户输入的响应，包括中间消息和令牌
    
    如果未提供 agent_id，将使用默认代理。
    使用 thread_id 来持久化和继续多轮对话。run_id 参数会附加到所有消息中用于记录反馈。
    使用 user_id 来在多个线程间持久化和继续对话。
    
    设置 `stream_tokens=false` 来返回中间消息但不逐令牌返回。
    """
    if is_from_swagger(request.headers.get("referer", "")):
        user_input.agent_config["api_key"] = encrypt(user_input.agent_config.get("api_key"))
        for rag_config in user_input.rag_config:
            if rag_config.get("api_key"):
                rag_config["api_key"] = encrypt(rag_config.get("api_key"))
        
    callback = None
    if getattr(request.app.state, 'langfuse_handler', None):
        callback = request.app.state.langfuse_handler
    return StreamingResponse(
        chat_service.message_generator(callback, user_input, agent_id),
        media_type="text/event-stream",
    )


@router.post("/feedback")
async def feedback(feedback: Feedback) -> FeedbackResponse:
    """
    向 LangSmith 记录运行反馈
    
    这是 LangSmith create_feedback API 的简单包装器，因此凭据可以在服务中存储和管理，而不是在客户端。
    参见: https://api.smith.langchain.com/redoc#tag/feedback/operation/create_feedback_api_v1_feedback_post
    """
    client = LangsmithClient()
    kwargs = feedback.kwargs or {}
    client.create_feedback(
        run_id=feedback.run_id,
        key=feedback.key,
        score=feedback.score,
        **kwargs,
    )
    return FeedbackResponse()


@router.post("/history")
def history(input: ChatHistoryInput) -> ChatHistory:
    """获取聊天历史"""
    try:
        return chat_service.get_chat_history(input.thread_id)
    except Exception as e:
        logger.error(f"An exception occurred: {e}")
        raise HTTPException(status_code=500, detail="Unexpected error")
