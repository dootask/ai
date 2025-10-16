import json
import os
import tempfile
import time
from uuid import uuid4

from core import get_embeddings_by_provider, settings
from fastapi import HTTPException, UploadFile
from langchain_community.document_loaders import (
    CSVLoader, PyMuPDFLoader, PyPDFLoader, TextLoader, UnstructuredExcelLoader,
    UnstructuredWordDocumentLoader)
from langchain_core.documents import Document
from langchain_postgres import PGVector
from langchain_text_splitters import RecursiveCharacterTextSplitter
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool


class DocumentService:
    """文档处理服务"""
    
    def __init__(self,chunk_size: int = 1000, chunk_overlap: int = 200):
        """
        初始化文档处理服务
        
        Args:
            provider_name: 嵌入模型提供商名称
            model_name: 嵌入模型名称
            config: 嵌入模型配置
        """
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )

    
    def get_postgres_connection_string(self) -> str:
        """获取PostgreSQL连接字符串"""
        if not all([settings.POSTGRES_HOST, settings.POSTGRES_USER, settings.POSTGRES_DB]):
            raise ValueError("PostgreSQL配置不完整，请检查环境变量")
        
        password = settings.POSTGRES_PASSWORD.get_secret_value() if settings.POSTGRES_PASSWORD else ""
        port = settings.POSTGRES_PORT or 5432
        
        return f"postgresql+psycopg://{settings.POSTGRES_USER}:{password}@{settings.POSTGRES_HOST}:{port}/{settings.POSTGRES_DB}"
    
    def get_vectorstore(self, provider="openai", model="text-embedding-3-small", config=None, collection_name: str = "default_knowledge_base") -> PGVector:
        """获取向量存储实例"""
        connection_string = self.get_postgres_connection_string()

        embeddings = get_embeddings_by_provider(provider, model, json.dumps(config))
        
        return PGVector(
            embeddings=embeddings,
            connection=connection_string,
            collection_name=collection_name,
            use_jsonb=True,
            async_mode=True
        )
        
    async def load_document(self, file: UploadFile,knowledge_base) -> list[Document]:
        """加载文档并返回Document对象列表"""
        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp_file:
            content = await file.read()
            tmp_file.write(content)
            tmp_file_path = tmp_file.name
        
        try:
            # 根据文件类型选择加载器
            file_extension = os.path.splitext(file.filename or "")[1].lower()
            st = time.time()
            if file_extension == ".pdf":
                loader = PyMuPDFLoader(file_path=tmp_file_path,mode="single",extract_tables="markdown")
            elif file_extension in [".txt", ".md", ".json"]:
                loader = TextLoader(file_path=tmp_file_path, encoding="utf-8")
            elif file_extension in [".doc", ".docx"]:
                loader  = UnstructuredWordDocumentLoader(file_path=tmp_file_path)
            elif file_extension in [".csv"]:
                loader = CSVLoader(file_path=tmp_file_path)
            elif file_extension in [".xls", ".xlsx"]:
                loader = UnstructuredExcelLoader(file_path=tmp_file_path,mode="single")
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"不支持的文件类型: {file_extension}"
                )
            # 加载文档
            documents = loader.load()

            # 添加元数据
            for doc in documents:
                doc.metadata.update({
                    "filename": file.filename,
                    "file_type": file_extension,
                    "upload_id": str(uuid4()),
                    "source": knowledge_base,
                })
            
            return documents
            
        finally:
            # 清理临时文件
            if os.path.exists(tmp_file_path):
                os.unlink(tmp_file_path)
    
    def split_documents(self, documents: list[Document]) -> list[Document]:
        """分割文档为较小的块"""
        return self.text_splitter.split_documents(documents)
    
    async def upload_documents(
        self, 
        files: list[UploadFile], 
        knowledge_base: str = "default_knowledge_base",
        provider: str = "openai", 
        model: str = "text-embedding-3-small",
        api_key: str = None,
        proxy_url: str | None = None
    ) -> dict:
        """上传并处理多个文档到指定知识库"""
        all_documents = []
        processed_files = []
        
        # 处理每个文件
        for file in files:
            try:
                documents = await self.load_document(file, knowledge_base)
                split_docs = self.split_documents(documents)
                all_documents.extend(split_docs)
                processed_files.append({
                    "filename": file.filename,
                    "chunks": len(split_docs),
                    "status": "success"
                })
            except Exception as e:
                processed_files.append({
                    "filename": file.filename,
                    "chunks": 0,
                    "status": "error",
                    "error": str(e)
                })
        
        # 如果有成功处理的文档，添加到向量存储
        if all_documents:
            vectorstore = self.get_vectorstore(provider=provider, model=model, config={"api_key": api_key, "proxy_url": proxy_url}, collection_name=knowledge_base)
            await vectorstore.aadd_documents(all_documents)
        
        return {
            "knowledge_base": knowledge_base,
            "total_files": len(files),
            "total_chunks": len(all_documents),
            "processed_files": processed_files
        }
    
    async def list_knowledge_bases(self) -> list[str]:
        """列出所有知识库"""
        # 这里需要查询PostgreSQL获取所有collection名称
        password = settings.POSTGRES_PASSWORD.get_secret_value() if settings.POSTGRES_PASSWORD else ""
        port = settings.POSTGRES_PORT or 5432
        async with AsyncConnectionPool(
            f"postgresql://{settings.POSTGRES_USER}:{password}@{settings.POSTGRES_HOST}:{port}/{settings.POSTGRES_DB}",
            min_size=settings.POSTGRES_MIN_CONNECTIONS_PER_POOL,
            max_size=settings.POSTGRES_MAX_CONNECTIONS_PER_POOL,
            kwargs={"autocommit": True, "row_factory": dict_row, "application_name": settings.POSTGRES_APPLICATION_NAME},
            check=AsyncConnectionPool.check_connection,
        ) as pool:
            async with pool.connection() as conn:
                async with conn.cursor() as cur:
                    # 示例：执行一个查询语句
                    await cur.execute("SELECT name FROM langchain_pg_collection")
                    results = await cur.fetchall()
                    return [ item.get("name") for item in results ]
    
    async def delete_knowledge_base(self, knowledge_base: str) -> dict:
        """删除指定知识库"""
        vectorstore = self.get_vectorstore("local", "local", {"base_url":"http://127.0.0.1"}, knowledge_base)
        # PGVector没有直接的删除collection方法，需要手动实现
        _ = await vectorstore.adelete_collection()
        # 这里返回成功状态
        return {
            "knowledge_base": knowledge_base,
            "status": "deleted"
        }


