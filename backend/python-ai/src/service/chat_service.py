import inspect
import json
import logging
from collections.abc import AsyncGenerator
from typing import Any
from uuid import UUID, uuid4
import re
import tempfile
import time
from io import BytesIO

from agents import DEFAULT_AGENT, AgentGraph, get_agent
from core import settings
from fastapi import HTTPException
from langchain_core.messages import (AIMessage, AIMessageChunk, AnyMessage,
                                     HumanMessage, ToolMessage)
from langchain_core.runnables import RunnableConfig
from langfuse.callback import CallbackHandler  # type: ignore[import-untyped]
from langgraph.types import Command, Interrupt
from schema import ChatHistory, ChatMessage, StreamInput, UserInput
from service.utils import (convert_message_content_to_string,
                           langchain_to_chat_message, remove_tool_calls)
from service.document_service import DocumentService
from fastapi import UploadFile

logger = logging.getLogger(__name__)

def parse_agent_config(value) -> dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value:
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}

class ChatService:
    """聊天服务类，处理与代理的交互逻辑"""

    async def _handle_input(
        self, user_input: UserInput, agent: AgentGraph, agent_id: str, langfuse_handler: CallbackHandler | None
    ) -> tuple[dict[str, Any], UUID]:
        """
        Parse user input and handle any required interrupt resumption.
        Returns kwargs for agent invocation and the run_id.
        """
        run_id = uuid4()
        thread_id = f"{user_input.thread_id or str(uuid4())}"
        user_id = user_input.user_id or str(uuid4())

        configurable = {
            "thread_id": thread_id,
            "provider": user_input.provider,
            "model": user_input.model,
            "user_id": user_id,
        }

        callbacks = []
        metadata = {}
        if settings.LANGFUSE_TRACING and langfuse_handler:
            # Initialize Langfuse CallbackHandler for Langchain (tracing)
            # langfuse_handler = CallbackHandler()
            # print(f"Using Langfuse for tracing with run_id: {run_id}")
            callbacks.append(langfuse_handler)
            metadata = {
                "langfuse_user_id": user_id,
                "langfuse_session_id": thread_id,
                "langfuse_tags": [agent_id]
            }

        if user_input.agent_config:
            if overlap := configurable.keys() & user_input.agent_config.keys():
                raise HTTPException(
                    status_code=422,
                    detail=f"agent_config contains reserved keys: {overlap}",
                )
            configurable.update(user_input.agent_config)
            configurable["agent_config"] = json.dumps(user_input.agent_config)

        if user_input.mcp_config:
            configurable["mcp_config"] = json.dumps(user_input.mcp_config)
        if user_input.rag_config:
            # if not user_input.rag_config.get("knowledge_base") or len(user_input.rag_config.get("knowledge_base") or []) > 3:
            #     raise HTTPException(
            #         status_code=422,
            #         detail=f"knowledge_base only supports 3 at most",
            #     )
            configurable["rag_config"] = json.dumps(user_input.rag_config)

        config = RunnableConfig(
            configurable=configurable,
            run_id=run_id,
            callbacks=callbacks,
            metadata=metadata
        )

        # Check for interrupts that need to be resumed
        state = await agent.aget_state(config=config)
        interrupted_tasks = [
            task for task in state.tasks if hasattr(task, "interrupts") and task.interrupts
        ]

        input: Command | dict[str, Any]
        if interrupted_tasks:
            # assume user input is response to resume agent execution from interrupt
            input = Command(resume=user_input.message)
        else:
            input = {"messages": [HumanMessage(content=user_input.message)]}

        if isinstance(user_input.message, str):
            original_text = user_input.message

            # 提取所有 Markdown 链接（含图片和普通链接）与纯 URL
            md_urls = re.findall(r'!?\[[^\]]*\]\((.*?)\)', original_text)
            text_without_images = re.sub(r'!?\[[^\]]*\]\(.*?\)', '', original_text)
            pure_urls = re.findall(r'https?://[^\s)]+', original_text)

            # 合并并去重
            candidate_urls = list({*md_urls, *pure_urls})

            # 按后缀区分为图片或文件
            image_ext = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'}

            def get_ext(url: str) -> str:
                path = url.split('?', 1)[0].split('#', 1)[0]
                idx = path.rfind('.')
                return path[idx:].lower() if idx != -1 else ''

            image_urls = [u for u in candidate_urls if get_ext(u) in image_ext]
            file_urls = [u for u in candidate_urls if  u not in set(image_urls)]

            # 构造图片消息内容
            content_list = []
            for url in image_urls:
                content_list.append({
                    "type": "image_url",
                    "image_url": {"url": url.replace('.png_thumb', '')}
                })

            # 下载并解析文件，注入解析出的文本
            parsed_texts: list[str] = []
            if file_urls:
                agent_config = parse_agent_config(configurable.get("agent_config"))
                knowledge_base = agent_config.get("knowledge_base", "default_knowledge_base")
                doc_service = DocumentService()

                async with httpx.AsyncClient() as client:
                    for url in file_urls:
                        try:
                            resp = await client.get(url)
                            if resp.status_code != 200:
                                continue
                            data = resp.content
                            # 尝试从 URL 获取文件名
                            filename = url.split('/')[-1].split('?')[0]
                            upload = UploadFile(file=BytesIO(data), filename=filename)
                            docs = await doc_service.load_document(upload, knowledge_base)
                            if docs:
                                # 拼接文档内容
                                joined = "\n\n".join([d.page_content for d in docs if getattr(d, 'page_content', '')])
                                if joined:
                                    parsed_texts.append(f"[来自文件 {filename} 的内容]\n" + joined)
                        except Exception as e:
                            logger.exception(f"Error in message generator: {e}")
                            continue

            # 纯文本（移除图片与文件链接标记）
            text_without_files = re.sub(r'(?<!\!)\[[^\]]*\]\(.*?\)', '', text_without_images)
            text_without_files = re.sub(r'https?://[^\s)]+', '', text_without_files).strip()

            # 将文本与解析出的文档内容合并
            final_text_parts = []
            if text_without_files:
                final_text_parts.append(text_without_files)
            if parsed_texts:
                final_text_parts.append("\n\n".join(parsed_texts))
            if final_text_parts:
                content_list.append({
                    "type": "text",
                    "text": "\n\n".join(final_text_parts)
                })

            if content_list:
                input["messages"] = input["messages"] + [HumanMessage(content=content_list)]

        kwargs = {
            "input": input,
            "config": config,
        }

        return kwargs, run_id

    async def invoke_agent(self, callback: CallbackHandler | None, user_input: UserInput, agent_id: str = DEFAULT_AGENT) -> ChatMessage:
        """
        Invoke an agent with user input to retrieve a final response.

        If agent_id is not provided, the default agent will be used.
        Use thread_id to persist and continue a multi-turn conversation. run_id kwarg
        is also attached to messages for recording feedback.
        Use user_id to persist and continue a conversation across multiple threads.
        """
        # NOTE: Currently this only returns the last message or interrupt.
        # In the case of an agent outputting multiple AIMessages (such as the background step
        # in interrupt-agent, or a tool step in research-assistant), it's omitted. Arguably,
        # you'd want to include it. You could update the API to return a list of ChatMessages
        # in that case.
        agent: AgentGraph = get_agent(agent_id)
        kwargs, run_id = await self._handle_input(user_input, agent, agent_id, callback)

        response_events: list[tuple[str, Any]] = await agent.ainvoke(**kwargs, stream_mode=["updates", "values"])  # type: ignore # fmt: skip
        response_type, response = response_events[-1]
        if response_type == "values":
            # Normal response, the agent completed successfully
            output = langchain_to_chat_message(response["messages"][-1])
        elif response_type == "updates" and "__interrupt__" in response:
            # The last thing to occur was an interrupt
            # Return the value of the first interrupt as an AIMessage
            output = langchain_to_chat_message(
                AIMessage(content=response["__interrupt__"][0].value)
            )
        else:
            raise ValueError(f"Unexpected response type: {response_type}")

        output.run_id = str(run_id)
        return output

    async def message_generator(
        self, callback: CallbackHandler | None, user_input: StreamInput, agent_id: str = DEFAULT_AGENT
    ) -> AsyncGenerator[str, None]:
        """
        Generate a stream of messages from the agent.

        This is the workhorse method for the /stream endpoint.
        """
        agent: AgentGraph = get_agent(agent_id)
        kwargs, run_id = await self._handle_input(user_input, agent, agent_id, callback)

        try:
            # Process streamed events from the graph and yield messages over the SSE stream.
            async for stream_event in agent.astream(
                **kwargs, stream_mode=["updates", "messages", "custom"], subgraphs=True
            ):

                if not isinstance(stream_event, tuple):
                    continue
                # Handle different stream event structures based on subgraphs
                if len(stream_event) == 3:
                    # With subgraphs=True: (node_path, stream_mode, event)
                    _, stream_mode, event = stream_event
                else:
                    # Without subgraphs: (stream_mode, event)
                    stream_mode, event = stream_event
                new_messages = []
                if stream_mode == "updates":
                    for node, updates in event.items():
                        # A simple approach to handle agent interrupts.
                        # In a more sophisticated implementation, we could add
                        # some structured ChatMessage type to return the interrupt value.
                        if node == "__interrupt__":
                            interrupt: Interrupt
                            for interrupt in updates:
                                new_messages.append(AIMessage(content=interrupt.value))
                            continue
                        updates = updates or {}
                        update_messages = updates.get("messages", [])
                        # special cases for using langgraph-supervisor library
                        if node == "supervisor":
                            # Get only the last ToolMessage since is it added by the
                            # langgraph lib and not actual AI output so it won't be an
                            # independent event
                            if isinstance(update_messages[-1], ToolMessage):
                                update_messages = [update_messages[-1]]
                            else:
                                update_messages = []
                        # print("0-------->",node)
                        if node in ("research_expert", "math_expert", "mcp_agent"):
                            update_messages = []
                        new_messages.extend(update_messages)

                if stream_mode == "custom":
                    new_messages = [event]

                # LangGraph streaming may emit tuples: (field_name, field_value)
                # e.g. ('content', <str>), ('tool_calls', [ToolCall,...]), ('additional_kwargs', {...}), etc.
                # We accumulate only supported fields into `parts` and skip unsupported metadata.
                # More info at: https://langchain-ai.github.io/langgraph/cloud/how-tos/stream_messages/
                processed_messages = []
                current_message: dict[str, Any] = {}
                for message in new_messages:
                    if isinstance(message, tuple):
                        key, value = message
                        # Store parts in temporary dict
                        current_message[key] = value
                    else:
                        # Add complete message if we have one in progress
                        if current_message:
                            processed_messages.append(self._create_ai_message(current_message))
                            current_message = {}
                        processed_messages.append(message)

                # Add any remaining message parts
                if current_message:
                    processed_messages.append(self._create_ai_message(current_message))

                for message in processed_messages:
                    try:
                        chat_message = langchain_to_chat_message(message)
                        chat_message.run_id = str(run_id)
                    except Exception as e:
                        logger.error(f"Error parsing message: {e}")
                        yield f"data: {json.dumps({'type': 'error', 'content': 'Unexpected error'})}\n\n"
                        continue
                    # LangGraph re-sends the input message, which feels weird, so drop it
                    if (
                        chat_message.type == "human"
                        and chat_message.content == user_input.message
                    ):
                        continue
                    yield f"data: {json.dumps({'type': 'message', 'content': chat_message.model_dump()})}\n\n"

                if stream_mode == "messages":
                    if not user_input.stream_tokens:
                        continue
                    msg, metadata = event
                    if "skip_stream" in metadata.get("tags", []):
                        continue
                    # For some reason, astream("messages") causes non-LLM nodes to send extra messages.
                    # Drop them.
                    if not isinstance(msg, AIMessageChunk):
                        continue

                    reasoning_content = msg.additional_kwargs.get("reasoning_content")
                    if reasoning_content:
                        yield f"data: {json.dumps({'type': 'thinking', 'content': convert_message_content_to_string(reasoning_content)})}\n\n"
                        
                    content = remove_tool_calls(msg.content)
                    if content:
                        # Empty content in the context of OpenAI usually means
                        # that the model is asking for a tool to be invoked.
                        # So we only print non-empty content.
                        yield f"data: {json.dumps({'type': 'token', 'content': convert_message_content_to_string(content)})}\n\n"
        except Exception as e:
            logger.exception(f"Error in message generator: {e}")
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"


    def _create_ai_message(self, parts: dict) -> AIMessage:
        """从部分创建 AI 消息"""
        sig = inspect.signature(AIMessage)
        valid_keys = set(sig.parameters)
        filtered = {k: v for k, v in parts.items() if k in valid_keys}
        return AIMessage(**filtered)

    def get_chat_history(self, thread_id: str) -> ChatHistory:
        """获取聊天历史"""
        # TODO: 在这里硬编码 DEFAULT_AGENT 是不合适的
        agent: AgentGraph = get_agent(DEFAULT_AGENT)
        state_snapshot = agent.get_state(
            config=RunnableConfig(configurable={"thread_id": thread_id})
        )
        messages: list[AnyMessage] = state_snapshot.values["messages"]
        chat_messages: list[ChatMessage] = [
            langchain_to_chat_message(m) for m in messages
        ]
        return ChatHistory(messages=chat_messages)