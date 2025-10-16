import logging

from api import encrypt, is_from_swagger, valid_content_length, verify_bearer
from fastapi import (APIRouter, Depends, File, Form, HTTPException, Query,
                     Request, UploadFile)
from schema import DeleteResponse, KnowledgeBaseResponse, UploadResponse
from service.document_service import DocumentService

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", dependencies=[Depends(verify_bearer),Depends(valid_content_length)],tags=["documents"])



@router.post("/upload", response_model=UploadResponse)
async def upload_documents(
    request: Request,
    files: list[UploadFile] = File(..., description="要上传的文件列表(支持PDF、TXT、MD、DOC、DOCX)"),
    knowledge_base: str = Form(default="default_knowledge_base",description="目标知识库名称"),
    provider: str = Form(default="openai", description="嵌入模型提供商名称"),
    model: str = Form(default="text-embedding-3-small", description="嵌入模型名称"),
    api_key: str = Form(default=None, description="API key for the embedding provider (if required)"),
    proxy_url: str = Form(default=None, description="proxy url (if required)"),
    chunk_size: int = Form(default=1000, description="Define the maximum length of each text block"),
    chunk_overlap: int = Form(default=200, description="Define the length of the overlap between two adjacent blocks"),
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
    # supported_extensions = {".pdf", ".txt", ".md", ".doc", ".docx"}
    # for file in files:
    #     if file.filename:
    #         file_extension = file.filename.split(".")[-1].lower()
    #         if f".{file_extension}" not in supported_extensions:
    #             raise HTTPException(
    #                 status_code=400,
    #                 detail=f"不支持的文件类型: {file_extension}。支持的类型: {', '.join(supported_extensions)}"
    #             )
    
    if is_from_swagger(request.headers.get("referer", "")):
        api_key = encrypt(api_key)
        
    try:
        document_service = DocumentService(chunk_size,chunk_overlap)
        result = await document_service.upload_documents(files, knowledge_base, provider, model, api_key, proxy_url)
        return UploadResponse(**result)
    except Exception as e:
        logger.exception(e)
        raise HTTPException(status_code=500, detail=f"文档上传失败: {str(e)}")


@router.get("/knowledge-bases", response_model=KnowledgeBaseResponse)
async def list_knowledge_bases(request: Request):
    """
    获取所有知识库列表
    
    Returns:
        知识库名称列表
    """
    try:
        document_service = DocumentService()
        result = await document_service.list_knowledge_bases()
        return KnowledgeBaseResponse(knowledge_bases=result)
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
        document_service = DocumentService()
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
        return {
            "status": "healthy",
            "supported_formats": [".pdf", ".txt", ".md", ".doc", ".docx"],
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
