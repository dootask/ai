import json
import logging
import os
from typing import Any

from core import get_model_by_provider, settings
from langchain_aws import AmazonKnowledgeBasesRetriever
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables import (RunnableConfig, RunnableLambda,
                                      RunnableSerializable)
from langchain_core.runnables.base import RunnableSequence
from langgraph.graph import END, MessagesState, StateGraph
from langgraph.managed import RemainingSteps
from langchain_postgres import PGVector
from langchain_core.runnables import RunnableConfig
from langchain.retrievers import MergerRetriever

from core.embeddings import get_embeddings_by_provider

logger = logging.getLogger(__name__)


# Define the state
class AgentState(MessagesState, total=False):
    """State for Knowledge Base agent."""

    remaining_steps: RemainingSteps
    retrieved_documents: list[dict[str, Any]]
    kb_documents: str


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
        embeddings = get_embeddings_by_provider(provider, model, json.dumps(config))
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
            async_mode=True
        )
        retriever = vectorstore.as_retriever(search_kwargs={"k": 1})
        retrievers.append(retriever)
    lotr = MergerRetriever(retrievers=retrievers)
    return lotr


def wrap_model(model: BaseChatModel, prompt: str | None) -> RunnableSerializable[AgentState, AIMessage]:
    """Wrap the model with a system prompt for the Knowledge Base agent."""

    def create_system_message(state):
        base_prompt = """You are a helpful assistant that provides accurate information based on retrieved documents.

        You will receive a query along with relevant documents retrieved from a knowledge base. Use these documents to inform your response.

        Follow these guidelines:
        1. Base your answer primarily on the retrieved documents
        2. If the documents contain the answer, provide it clearly and concisely
        3. If the documents are insufficient, state that you don't have enough information
        4. Never make up facts or information not present in the documents
        5. Always cite the source documents when referring to specific information
        6. If the documents contradict each other, acknowledge this and explain the different perspectives

        Format your response in a clear, conversational manner. Use markdown formatting when appropriate.
        """
        if prompt:
            base_prompt = prompt
        # Check if documents were retrieved
        if "kb_documents" in state:
            # Append document information to the system prompt
            document_prompt = f"\n\nI've retrieved the following documents that may be relevant to the query:\n\n{state['kb_documents']}\n\nPlease use these documents to inform your response to the user's query. Only use information from these documents and clearly indicate when you are unsure."
            return [SystemMessage(content=base_prompt + document_prompt)] + state[
                "messages"
            ]
        else:
            # No documents were retrieved
            no_docs_prompt = "\n\nNo relevant documents were found in the knowledge base for this query."
            return [SystemMessage(content=base_prompt + no_docs_prompt)] + state[
                "messages"
            ]

    preprocessor = RunnableLambda(
        create_system_message,
        name="StateModifier",
    )
    return RunnableSequence(preprocessor, model)


async def retrieve_documents(state: AgentState, config: RunnableConfig) -> AgentState:
    """Retrieve relevant documents from the knowledge base."""
    # Get the last human message
    human_messages = [msg for msg in state["messages"] if isinstance(msg, HumanMessage)]
    if not human_messages:
        # Include messages from original state
        return {"messages": [], "retrieved_documents": []}

    # Use the last human message as the query
    query = human_messages[-1].content

    try:
        # Initialize the retriever
        configurable = config.get("configurable").get("rag_config")
        configurable = json.loads(configurable) if configurable else {}
        # 获取PostgreSQL检索器
        retriever = load_postgres_vectorstore(knowledge_base=configurable.get("knowledge_base"), embeddings_config=configurable)
        # Retrieve documents
        retrieved_docs = await retriever.ainvoke(query)
        # print(retrieved_docs)
        # Create document summaries for the state
        document_summaries = []
        for i, doc in enumerate(retrieved_docs, 1):
            summary = {
                "id": doc.id,
                "source": doc.metadata.get("source", "Unknown"),
                "title": doc.metadata.get("filename", f"Document {i}"),
                "content": doc.page_content,
            }
            document_summaries.append(summary)

        logger.info(
            f"Retrieved {len(document_summaries)} documents for query: {query[:50]}..."
        )

        return {"retrieved_documents": document_summaries, "messages": []}

    except Exception as e:
        logger.error(f"Error retrieving documents: {str(e)}")
        return {"retrieved_documents": [], "messages": []}


async def prepare_augmented_prompt(
    state: AgentState, config: RunnableConfig
) -> AgentState:
    """Prepare a prompt augmented with retrieved document content."""
    # Get retrieved documents
    documents = state.get("retrieved_documents", [])

    if not documents:
        return {"messages": []}

    # Format retrieved documents for the model
    formatted_docs = "\n\n".join(
        [
            f"--- Document {i + 1} ---\n"
            f"Source: {doc.get('source', 'Unknown')}\n"
            f"Title: {doc.get('title', 'Unknown')}\n\n"
            f"{doc.get('content', '')}"
            for i, doc in enumerate(documents)
        ]
    )

    # Store formatted documents in the state
    return {"kb_documents": formatted_docs, "messages": []}


async def acall_model(state: AgentState, config: RunnableConfig) -> AgentState:
    """Generate a response based on the retrieved documents."""
    configurable = config.get("configurable",{})
    m = get_model_by_provider(
        configurable.get("provider"),
        configurable.get("model", settings.DEFAULT_MODEL),
        configurable.get("agent_config", None),
    )
    agent_config = json.loads(configurable.get("agent_config", None)) if configurable.get("agent_config", None) else {}
    model_runnable = wrap_model(m,agent_config.get("prompt"))
    response = await model_runnable.ainvoke(state, config)

    return {"messages": [response]}


# Define the graph
agent = StateGraph(AgentState)

# Add nodes
agent.add_node("retrieve_documents", retrieve_documents)
agent.add_node("prepare_augmented_prompt", prepare_augmented_prompt)
agent.add_node("model", acall_model)

# Set entry point
agent.set_entry_point("retrieve_documents")

# Add edges to define the flow
agent.add_edge("retrieve_documents", "prepare_augmented_prompt")
agent.add_edge("prepare_augmented_prompt", "model")
agent.add_edge("model", END)

# Compile the agent
kb_agent = agent.compile()
