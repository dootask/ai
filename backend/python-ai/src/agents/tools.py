import json
import math
import re
import time
st= time.time()
import numexpr
from core import settings
# from langchain_openai import OpenAIEmbeddings
from core.embeddings import get_embeddings_by_provider
from langchain_core.tools import BaseTool, tool
from langchain_postgres import PGVector
from langchain_core.runnables import RunnableConfig
import asyncio
from langchain.retrievers import (
    MergerRetriever,
)
def calculator_func(expression: str) -> str:
    """Calculates a math expression using numexpr.

    Useful for when you need to answer questions about math using numexpr.
    This tool is only for math questions and nothing else. Only input
    math expressions.

    Args:
        expression (str): A valid numexpr formatted math expression.

    Returns:
        str: The result of the math expression.
    """

    try:
        local_dict = {"pi": math.pi, "e": math.e}
        output = str(
            numexpr.evaluate(
                expression.strip(),
                global_dict={},  # restrict access to globals
                local_dict=local_dict,  # add common mathematical functions
            )
        )
        return re.sub(r"^\[|\]$", "", output)
    except Exception as e:
        raise ValueError(
            f'calculator("{expression}") raised error: {e}.'
            " Please try again with a valid numerical expression"
        )


calculator: BaseTool = tool(calculator_func)
calculator.name = "Calculator"



# 格式化检索到的文档
def format_contexts(docs):
    return "\n\n".join(doc.page_content for doc in docs)


def get_postgres_connection_string() -> str:
    """获取PostgreSQL连接字符串"""
    if not all([settings.POSTGRES_HOST, settings.POSTGRES_USER, settings.POSTGRES_DB]):
        raise ValueError("PostgreSQL配置不完整，请检查环境变量")
    
    password = settings.POSTGRES_PASSWORD.get_secret_value() if settings.POSTGRES_PASSWORD else ""
    port = settings.POSTGRES_PORT or 5432
    
    return f"postgresql+psycopg://{settings.POSTGRES_USER}:{password}@{settings.POSTGRES_HOST}:{port}/{settings.POSTGRES_DB}"


def load_postgres_vectorstore(knowledge_base: list[str] = ["default_knowledge_base"], embeddings_config: dict = None):
    """加载PostgreSQL向量存储"""
    try:
        if embeddings_config:
            # 使用传入的配置
            provider = embeddings_config.get("provider", "openai")
            model = embeddings_config.get("model", "text-embedding-3-small")
            config = {
                "api_key": embeddings_config.get("api_key"),
                "proxy_url": embeddings_config.get("proxy_url"),
                "dimensions": embeddings_config.get("dimensions", None)
            }
        embeddings = get_embeddings_by_provider(provider, model, tuple(sorted(config.items())))
    except Exception as e:
        raise RuntimeError( "初始化Embeddings失败。请确保已设置相应的API密钥。" ) from e

    # 获取PostgreSQL连接字符串
    connection_string = get_postgres_connection_string()
    retrievers = []
    for item in knowledge_base:
        # 创建PGVector实例
        vectorstore = PGVector(
            embeddings=embeddings,
            connection=connection_string,
            collection_name=item,
            use_jsonb=True,
        )
        retriever = vectorstore.as_retriever(search_kwargs={"k": 3})
        retrievers.append(retriever)
    lotr = MergerRetriever(retrievers=retrievers)
    return lotr


def database_search_func(query: str, config: RunnableConfig ) -> str:
    """
    根据用户提供的查询内容，在指定的知识库中执行语义搜索。
    适用于用户需要从知识库中检索相关信息、背景资料或支持文档的场景。

    Args:
        query (str): 用户的搜索查询，例如 "张三的研究项目" 或 "产品A的发布时间"。

    Returns:
        str: 向量检索器对象或检索结果，取决于调用方式。
    """
    if not config:
        raise ValueError("config not found")
    
    configurable = config.get("configurable").get("rag_config")
    configurable = json.loads(configurable) if configurable else {}
    # 获取PostgreSQL检索器
    retriever = load_postgres_vectorstore(knowledge_base=configurable.get("knowledge_base"), embeddings_config=configurable)
    # # 在数据库中搜索相关文档
    documents = retriever.invoke(query)
    # 将文档格式化为字符串
    context_str = format_contexts(documents)

    return context_str



# # 默认数据库搜索工具
database_search: BaseTool = tool(database_search_func)
database_search.name = "Database_Search"
