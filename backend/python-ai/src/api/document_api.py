from typing import Any, Optional

from api import verify_bearer
from fastapi import (APIRouter, Depends, File, Form, HTTPException, Query,
                     UploadFile)
from pydantic import BaseModel
from schema import DocumentInput
from service.document_service import document_service

router = APIRouter(prefix="/documents", dependencies=[Depends(verify_bearer)],tags=["documents"])

class KnowledgeBaseResponse(BaseModel):
    """知识库响应模型"""
    knowledge_bases: list[str]


class UploadResponse(BaseModel):
    """文档上传响应模型"""
    knowledge_base: str
    total_files: int
    total_chunks: int
    processed_files: list[dict[str, Any]]


class DeleteResponse(BaseModel):
    """删除响应模型"""
    knowledge_base: str
    status: str


@router.post("/upload", response_model=UploadResponse)
async def upload_documents(
    files: list[UploadFile] = File(..., description="要上传的文件列表(支持PDF、TXT、MD、DOC、DOCX)"),
    knowledge_base: str = Form(default="default_knowledge_base",description="目标知识库名称"),
    provider: str = Form(default="openai", description="嵌入模型提供商名称"),
    model: str = Form(default="text-embedding-3-small", description="嵌入模型名称"),
    api_key: str = Form(default=None, description="API key for the embedding provider (if required)")
):
    """
    上传文档到指定知识库
    
    Args:
        files: 要上传的文件列表(支持PDF、TXT、MD、DOC、DOCX)
        knowledge_base: 目标知识库名称
        provider: 嵌入模型提供商名称
        model: 嵌入模型名称
        api_key: 嵌入模型提供商的API密钥(如果需要)
    Returns:
        上传结果信息
    """
    if not files:
        raise HTTPException(status_code=400, detail="没有提供文件")
    
    # 检查文件类型
    supported_extensions = {".pdf", ".txt", ".md", ".doc", ".docx"}
    for file in files:
        if file.filename:
            file_extension = file.filename.split(".")[-1].lower()
            if f".{file_extension}" not in supported_extensions:
                raise HTTPException(
                    status_code=400,
                    detail=f"不支持的文件类型: {file_extension}。支持的类型: {', '.join(supported_extensions)}"
                )
    
    try:
        result = await document_service.upload_documents(files, knowledge_base, provider, model, api_key)
        return UploadResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文档上传失败: {str(e)}")


@router.get("/knowledge-bases", response_model=KnowledgeBaseResponse)
async def list_knowledge_bases():
    """
    获取所有知识库列表
    
    Returns:
        知识库名称列表
    """
    try:
        knowledge_bases = document_service.list_knowledge_bases()
        return KnowledgeBaseResponse(knowledge_bases=knowledge_bases)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取知识库列表失败: {str(e)}")


@router.delete("/knowledge-bases/{knowledge_base}", response_model=DeleteResponse)
async def delete_knowledge_base(knowledge_base: str):
    """
    删除指定知识库
    
    Args:
        knowledge_base: 要删除的知识库名称
    
    Returns:
        删除结果
    """
    try:
        result = await document_service.delete_knowledge_base(knowledge_base)
        return DeleteResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除知识库失败: {str(e)}")


@router.get("/health")
async def document_service_health():
    """
    文档服务健康检查
    
    Returns:
        服务状态
    """
    try:
        # 测试PostgreSQL连接
        connection_string = document_service.get_postgres_connection_string()
        return {
            "status": "healthy",
            "postgres_configured": bool(connection_string),
            "supported_formats": [".pdf", ".txt", ".md", ".doc", ".docx"],
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
