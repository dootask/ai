import math
import re

import numexpr
from core import settings
# from langchain_openai import OpenAIEmbeddings
from langchain_core.embeddings import get_embeddings_by_provider
from langchain_core.tools import BaseTool, tool
from langchain_postgres import PGVector


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
    
    return f"postgresql://{settings.POSTGRES_USER}:{password}@{settings.POSTGRES_HOST}:{port}/{settings.POSTGRES_DB}"


def load_postgres_vectorstore(collection_name: str = "default_knowledge_base", embeddings_config: dict = None):
    """加载PostgreSQL向量存储"""
    try:
        if embeddings_config:
            # 使用传入的配置
            provider = embeddings_config.get("provider", "openai")
            model = embeddings_config.get("model", "text-embedding-3-small")
            config = embeddings_config.get("config", {})

        embeddings = get_embeddings_by_provider(provider, model, tuple(sorted(config.items())))
    except Exception as e:
        raise RuntimeError(
            "初始化Embeddings失败。请确保已设置相应的API密钥。"
        ) from e

    # 获取PostgreSQL连接字符串
    connection_string = get_postgres_connection_string()
    
    # 创建PGVector实例
    vectorstore = PGVector(
        embeddings=embeddings,
        connection=connection_string,
        collection_name=collection_name,
        use_jsonb=True,
    )
    
    retriever = vectorstore.as_retriever(search_kwargs={"k": 5})
    return retriever


def database_search_func(query: str, knowledge_base: str = "default_knowledge_base", embeddings_config: dict = None) -> str:
    """在指定的知识库中搜索信息。
    
    Args:
        query: 搜索查询
        knowledge_base: 知识库名称，默认为"default_knowledge_base"
        embeddings_config: embeddings配置，包含provider、model、config等
    """
    # 获取PostgreSQL检索器
    retriever = load_postgres_vectorstore(collection_name=knowledge_base, embeddings_config=embeddings_config)

    # 在数据库中搜索相关文档
    documents = retriever.invoke(query)

    # 将文档格式化为字符串
    context_str = format_contexts(documents)

    return context_str


# 创建动态知识库搜索工具
def create_database_search_tool(knowledge_base: str = "default_knowledge_base", embeddings_config: dict = None) -> BaseTool:
    """创建针对特定知识库的搜索工具"""
    
    def search_func(query: str) -> str:
        return database_search_func(query, knowledge_base, embeddings_config)
    
    search_func.__name__ = f"database_search_{knowledge_base}"
    search_func.__doc__ = f"在{knowledge_base}知识库中搜索信息。"
    
    tool_instance = tool(search_func)
    tool_instance.name = f"Database_Search_{knowledge_base}"
    return tool_instance


# 默认数据库搜索工具
database_search: BaseTool = create_database_search_tool()
database_search.name = "Database_Search"