"""
FastAPI 应用程序入口点
"""
import asyncio
import logging
import sys
import warnings
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import nltk
from agents import get_agent, get_all_agent_info
from api.chat_api import router as chat_router
from api.document_api import router as document_router
from core import settings
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Security
from langchain_core._api import LangChainBetaWarning
from langfuse import Langfuse  # type: ignore[import-untyped]
from langfuse.callback import CallbackHandler
from memory import initialize_database, initialize_store
from schema.schema import ServiceMetadata

# 下载 averaged_perceptron_tagger
nltk.download('averaged_perceptron_tagger')

# 下载 punkt
nltk.download('punkt')
load_dotenv()

warnings.filterwarnings("ignore", category=LangChainBetaWarning)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    应用程序生命周期管理，初始化数据库检查点和存储
    """
    try:
        if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
            langfuse_handler = CallbackHandler(settings.LANGFUSE_PUBLIC_KEY.get_secret_value(),settings.LANGFUSE_SECRET_KEY.get_secret_value(),settings.LANGFUSE_HOST)
            app.state.langfuse_handler = langfuse_handler        
        # 初始化检查点（短期内存）和存储（长期内存）
        async with initialize_database() as saver, initialize_store() as store:
            # 设置组件
            if hasattr(saver, "setup"):  # ignore: union-attr
                await saver.setup() # type: ignore
            # 只为 Postgres 设置存储，InMemoryStore 不需要设置
            if hasattr(store, "setup"):  # ignore: union-attr
                await store.setup() # type: ignore

            # 为代理配置内存组件
            agents = get_all_agent_info()
            for a in agents:
                agent = get_agent(a.key)
                # 设置检查点用于线程范围内存（对话历史）
                agent.checkpointer = saver
                # 设置存储用于长期内存（跨对话知识）
                agent.store = store
            yield
    except Exception as e:
        logger.error(f"数据库/存储初始化错误: {e}")
        raise


def create_app() -> FastAPI:
    """创建 FastAPI 应用程序实例"""
    app = FastAPI(
        title="AI 助手 API",
        description="基于 LangGraph 的智能助手服务",
        version="1.0.0",
        lifespan=lifespan,
    )
    
    # 注册路由
    app.include_router(chat_router)
    app.include_router(document_router)
    
    return app

app = create_app()

@app.get("/info")
async def info() -> ServiceMetadata:
    return ServiceMetadata(
        agents=get_all_agent_info(),
        default_agent="chatbot",
        default_model=settings.DEFAULT_MODEL,
    )

@app.get("/health")
async def health_check():
    """健康检查端点"""
    health_status = {"status": "ok"}

    if settings.LANGFUSE_TRACING:
        try:
            if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
                langfuse = Langfuse(settings.LANGFUSE_PUBLIC_KEY.get_secret_value(),settings.LANGFUSE_SECRET_KEY.get_secret_value(),settings.LANGFUSE_HOST)
                health_status["langfuse"] = (
                    "connected" if langfuse.auth_check() else "disconnected"
                )
        except Exception as e:
            logger.error(f"Langfuse 连接错误: {e}")
            health_status["langfuse"] = "disconnected"

    return health_status


if __name__ == "__main__":
    import uvicorn
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    uvicorn.run("main:app", host="127.0.0.1", port=8005,reload=settings.is_dev(),env_file="../.env", log_config="src/uvicorn_config.json")