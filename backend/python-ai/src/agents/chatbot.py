import json
import re
import tempfile
import time
from io import BytesIO
from typing import Any

import httpx
from core import get_model_by_provider, settings
from fastapi import UploadFile
from langchain_core.language_models.base import LanguageModelInput
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langchain_core.runnables import (Runnable, RunnableConfig, RunnableLambda,
                                      RunnableSerializable)
from langgraph.func import entrypoint
from service.document_service import DocumentService


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
        agent_config = parse_agent_config(configurable.get("agent_config"))
        messages = [SystemMessage(content=agent_config.get("prompt",""))] + messages


    if isinstance(inputs["messages"][0].content, str):
        original_text = inputs["messages"][0].content

        # 提取所有 Markdown 链接（含图片和普通链接）与纯 URL
        md_urls = re.findall(r'!?\[[^\]]*\]\((.*?)\)', original_text)
        text_without_images = re.sub(r'!?\[[^\]]*\]\(.*?\)', '', original_text)
        pure_urls = re.findall(r'https?://[^\s)]+', original_text)

        # 合并并去重
        candidate_urls = list({*md_urls, *pure_urls})

        # 按后缀区分为图片或文件
        image_ext = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'}
        supported_ext = {'.pdf', '.txt', '.md', '.doc', '.docx'}
        def get_ext(url: str) -> str:
            path = url.split('?', 1)[0].split('#', 1)[0]
            idx = path.rfind('.')
            return path[idx:].lower() if idx != -1 else ''

        image_urls = [u for u in candidate_urls if get_ext(u) in image_ext]
        file_urls = [u for u in candidate_urls if get_ext(u) in supported_ext and u not in set(image_urls)]

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
                        print(e)
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
            messages = messages + [HumanMessage(content=content_list)]


    response = await llm.ainvoke(messages)

    return entrypoint.final(
        value={"messages": [response]}, save={"messages": messages + [response]}
    )
