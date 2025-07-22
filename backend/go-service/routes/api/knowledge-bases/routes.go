package knowledgebases

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"dootask-ai/go-service/global"
	"dootask-ai/go-service/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"
)

// RegisterRoutes 注册知识库管理路由
func RegisterRoutes(router *gin.RouterGroup) {
	// 知识库管理 - 需要管理员权限
	kbGroup := router.Group("/admin/knowledge-bases")
	{
		kbGroup.GET("", ListKnowledgeBases)         // 获取知识库列表
		kbGroup.POST("", CreateKnowledgeBase)       // 创建知识库
		kbGroup.GET("/:id", GetKnowledgeBase)       // 获取知识库详情
		kbGroup.PUT("/:id", UpdateKnowledgeBase)    // 更新知识库
		kbGroup.DELETE("/:id", DeleteKnowledgeBase) // 删除知识库

		// 文档管理
		kbGroup.GET("/:id/documents", ListDocuments)            // 获取文档列表
		kbGroup.POST("/:id/documents", UploadDocument)          // 上传文档
		kbGroup.DELETE("/:id/documents/:docId", DeleteDocument) // 删除文档
	}
}

// ListKnowledgeBases 获取知识库列表
func ListKnowledgeBases(c *gin.Context) {
	var req utils.PaginationRequest

	// 绑定查询参数
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "参数验证失败",
			"data":    err.Error(),
		})
		return
	}

	// 设置默认排序
	req.SetDefaultSorts(map[string]bool{
		"created_at": true,
		"id":         true,
	})

	// 验证参数
	validate := validator.New()
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "参数验证失败",
			"data":    err.Error(),
		})
		return
	}

	// 解析筛选条件
	var filters KnowledgeBaseFilters
	if req.Filters != nil {
		filtersBytes, err := json.Marshal(req.Filters)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "VALIDATION_001",
				"message": "筛选条件格式错误",
				"data":    err.Error(),
			})
			return
		}
		if err := json.Unmarshal(filtersBytes, &filters); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "VALIDATION_001",
				"message": "筛选条件解析失败",
				"data":    err.Error(),
			})
			return
		}
	}

	// 验证排序字段
	allowedFields := GetAllowedKnowledgeBaseSortFields()
	for _, sort := range req.Sorts {
		if !utils.ValidateSortField(sort.Key, allowedFields) {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "VALIDATION_001",
				"message": "无效的排序字段: " + sort.Key,
				"data":    nil,
			})
			return
		}
	}

	// 构建查询
	query := global.DB.Model(&KnowledgeBase{})

	// 应用筛选条件
	if filters.Search != "" {
		searchTerm := "%" + strings.ToLower(filters.Search) + "%"
		query = query.Where("LOWER(name) LIKE ? OR LOWER(description) LIKE ?", searchTerm, searchTerm)
	}

	if filters.EmbeddingModel != "" {
		query = query.Where("embedding_model = ?", filters.EmbeddingModel)
	}
	if filters.IsActive != nil {
		query = query.Where("is_active = ?", *filters.IsActive)
	}

	// 获取总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询知识库总数失败",
			"data":    nil,
		})
		return
	}

	// 分页和排序
	orderBy := req.GetOrderBy()

	var knowledgeBases []KnowledgeBase
	if err := query.
		Select("knowledge_bases.*, (SELECT COUNT(*) FROM kb_documents WHERE knowledge_base_id = knowledge_bases.id AND is_active = true) as documents_count").
		Order(orderBy).
		Limit(req.PageSize).
		Offset(req.GetOffset()).
		Find(&knowledgeBases).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询知识库列表失败",
			"data":    nil,
		})
		return
	}

	// 构造响应数据
	data := KnowledgeBaseListData{
		Items: knowledgeBases,
	}

	// 使用统一分页响应格式
	response := utils.NewPaginationResponse(req.Page, req.PageSize, total, data)
	c.JSON(http.StatusOK, response)
}

// CreateKnowledgeBase 创建知识库
func CreateKnowledgeBase(c *gin.Context) {
	var req CreateKnowledgeBaseRequest

	// 绑定JSON数据
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "请求数据格式错误",
			"data":    err.Error(),
		})
		return
	}

	// 验证请求数据
	validate := validator.New()
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "数据验证失败",
			"data":    err.Error(),
		})
		return
	}

	// 检查名称是否已存在
	var count int64
	if err := global.DB.Model(&KnowledgeBase{}).Where("name = ?", req.Name).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "检查名称唯一性失败",
			"data":    nil,
		})
		return
	}
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"code":    "KB_001",
			"message": "知识库名称已存在",
			"data":    nil,
		})
		return
	}

	// 设置默认值
	if req.ChunkSize == 0 {
		req.ChunkSize = 1000
	}
	if req.ChunkOverlap == 0 {
		req.ChunkOverlap = 200
	}
	if req.Metadata == nil {
		req.Metadata = []byte("{}")
	}

	// 创建知识库
	kb := KnowledgeBase{
		Name:           req.Name,
		Description:    req.Description,
		EmbeddingModel: req.EmbeddingModel,
		ChunkSize:      req.ChunkSize,
		ChunkOverlap:   req.ChunkOverlap,
		Metadata:       req.Metadata,
		IsActive:       true,
	}

	if err := global.DB.Create(&kb).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "创建知识库失败",
			"data":    nil,
		})
		return
	}

	// 查询完整的知识库信息
	var createdKB KnowledgeBase
	if err := global.DB.
		Select("knowledge_bases.*, (SELECT COUNT(*) FROM kb_documents WHERE knowledge_base_id = knowledge_bases.id AND is_active = true) as documents_count").
		Where("knowledge_bases.id = ?", kb.ID).
		First(&createdKB).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询创建的知识库失败",
			"data":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, createdKB)
}

// GetKnowledgeBase 获取知识库详情
func GetKnowledgeBase(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的知识库ID",
			"data":    nil,
		})
		return
	}

	var kb KnowledgeBase
	if err := global.DB.
		Select("knowledge_bases.*, (SELECT COUNT(*) FROM kb_documents WHERE knowledge_base_id = knowledge_bases.id AND is_active = true) as documents_count").
		Where("knowledge_bases.id = ?", id).
		First(&kb).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "KB_002",
				"message": "知识库不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询知识库失败",
				"data":    nil,
			})
		}
		return
	}

	// 查询使用统计
	var stats struct {
		TotalChunks     int `json:"total_chunks"`
		ProcessedChunks int `json:"processed_chunks"`
	}

	global.DB.Raw(`
		SELECT 
			COUNT(*) as total_chunks,
			COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as processed_chunks
		FROM kb_documents 
		WHERE knowledge_base_id = ? AND is_active = true
	`, id).Scan(&stats)

	// 查询最后上传时间
	var lastUpload *KBDocument
	global.DB.Where("knowledge_base_id = ? AND is_active = true", id).
		Order("created_at DESC").
		First(&lastUpload)

	// 构造响应
	response := KnowledgeBaseResponse{
		KnowledgeBase:      kb,
		DocumentsCount:     kb.DocumentsCount,
		TotalChunks:        stats.TotalChunks,
		ProcessedChunks:    stats.ProcessedChunks,
		LastDocumentUpload: nil,
	}

	if lastUpload != nil {
		response.LastDocumentUpload = &lastUpload.CreatedAt
	}

	c.JSON(http.StatusOK, response)
}

// UpdateKnowledgeBase 更新知识库
func UpdateKnowledgeBase(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的知识库ID",
			"data":    nil,
		})
		return
	}

	var req UpdateKnowledgeBaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "请求数据格式错误",
			"data":    err.Error(),
		})
		return
	}

	// 验证请求数据
	validate := validator.New()
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "数据验证失败",
			"data":    err.Error(),
		})
		return
	}

	// 检查知识库是否存在
	var kb KnowledgeBase
	if err := global.DB.First(&kb, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "KB_002",
				"message": "知识库不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询知识库失败",
				"data":    nil,
			})
		}
		return
	}

	// 检查名称唯一性（如果要更新名称）
	if req.Name != nil && *req.Name != kb.Name {
		var count int64
		if err := global.DB.Model(&KnowledgeBase{}).Where("name = ? AND id != ?", *req.Name, id).Count(&count).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "检查名称唯一性失败",
				"data":    nil,
			})
			return
		}
		if count > 0 {
			c.JSON(http.StatusConflict, gin.H{
				"code":    "KB_001",
				"message": "知识库名称已存在",
				"data":    nil,
			})
			return
		}
	}

	// 构建更新数据
	updateData := make(map[string]interface{})
	if req.Name != nil {
		updateData["name"] = *req.Name
	}
	if req.Description != nil {
		updateData["description"] = *req.Description
	}
	if req.EmbeddingModel != nil {
		updateData["embedding_model"] = *req.EmbeddingModel
	}
	if req.ChunkSize != nil {
		updateData["chunk_size"] = *req.ChunkSize
	}
	if req.ChunkOverlap != nil {
		updateData["chunk_overlap"] = *req.ChunkOverlap
	}
	if req.Metadata != nil {
		updateData["metadata"] = req.Metadata
	}
	if req.IsActive != nil {
		updateData["is_active"] = *req.IsActive
	}

	// 更新知识库
	if err := global.DB.Model(&kb).Updates(updateData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "更新知识库失败",
			"data":    nil,
		})
		return
	}

	// 查询更新后的知识库信息
	var updatedKB KnowledgeBase
	if err := global.DB.
		Select("knowledge_bases.*, (SELECT COUNT(*) FROM kb_documents WHERE knowledge_base_id = knowledge_bases.id AND is_active = true) as documents_count").
		Where("knowledge_bases.id = ?", id).
		First(&updatedKB).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询更新的知识库失败",
			"data":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, updatedKB)
}

// DeleteKnowledgeBase 删除知识库
func DeleteKnowledgeBase(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的知识库ID",
			"data":    nil,
		})
		return
	}

	// 检查知识库是否存在
	var kb KnowledgeBase
	if err := global.DB.First(&kb, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "KB_002",
				"message": "知识库不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询知识库失败",
				"data":    nil,
			})
		}
		return
	}

	// 检查是否被智能体使用（简化版本，仅检查数量）
	var agentCount int64
	if err := global.DB.Model(&struct {
		ID int64 `gorm:"primaryKey"`
	}{}).Table("agents").Where("is_active = true").Count(&agentCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "检查知识库使用状态失败",
			"data":    nil,
		})
		return
	}

	// 暂时简化检查逻辑，直接允许删除
	// TODO: 实现更复杂的JSONB查询来检查具体的知识库使用情况

	if agentCount > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "KB_003",
			"message": "知识库正在被智能体使用，无法删除",
			"data": map[string]interface{}{
				"usage_count": agentCount,
			},
		})
		return
	}

	// 开始事务
	tx := global.DB.Begin()

	// 删除关联的文档
	if err := tx.Where("knowledge_base_id = ?", id).Delete(&KBDocument{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "删除知识库文档失败",
			"data":    nil,
		})
		return
	}

	// 删除知识库
	if err := tx.Delete(&kb).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "删除知识库失败",
			"data":    nil,
		})
		return
	}

	// 提交事务
	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"code":    "SUCCESS",
		"message": "知识库删除成功",
		"data":    nil,
	})
}

// ListDocuments 获取文档列表
func ListDocuments(c *gin.Context) {
	idStr := c.Param("id")
	kbId, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的知识库ID",
			"data":    nil,
		})
		return
	}

	var req utils.PaginationRequest

	// 绑定查询参数
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "参数验证失败",
			"data":    err.Error(),
		})
		return
	}

	// 设置默认排序
	req.SetDefaultSorts(map[string]bool{
		"created_at": true,
		"id":         true,
	})

	// 验证参数
	validate := validator.New()
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "参数验证失败",
			"data":    err.Error(),
		})
		return
	}

	// 解析筛选条件
	var filters DocumentFilters
	if req.Filters != nil {
		filtersBytes, err := json.Marshal(req.Filters)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "VALIDATION_001",
				"message": "筛选条件格式错误",
				"data":    err.Error(),
			})
			return
		}
		if err := json.Unmarshal(filtersBytes, &filters); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "VALIDATION_001",
				"message": "筛选条件解析失败",
				"data":    err.Error(),
			})
			return
		}
	}

	// 验证排序字段
	allowedFields := GetAllowedDocumentSortFields()
	for _, sort := range req.Sorts {
		if !utils.ValidateSortField(sort.Key, allowedFields) {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "VALIDATION_001",
				"message": "无效的排序字段: " + sort.Key,
				"data":    nil,
			})
			return
		}
	}

	// 检查知识库是否存在
	var kb KnowledgeBase
	if err := global.DB.First(&kb, kbId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "KB_002",
				"message": "知识库不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询知识库失败",
				"data":    nil,
			})
		}
		return
	}

	// 构建查询
	query := global.DB.Model(&KBDocument{}).Where("knowledge_base_id = ? AND is_active = true", kbId)

	// 应用筛选条件
	if filters.Search != "" {
		searchTerm := "%" + strings.ToLower(filters.Search) + "%"
		query = query.Where("LOWER(title) LIKE ?", searchTerm)
	}

	if filters.FileType != "" {
		query = query.Where("file_type = ?", filters.FileType)
	}

	// 获取总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询文档总数失败",
			"data":    nil,
		})
		return
	}

	// 分页和排序
	orderBy := req.GetOrderBy()

	var documents []KBDocument
	if err := query.
		Select("kb_documents.*, (SELECT COUNT(*) FROM kb_documents child WHERE child.parent_doc_id = kb_documents.id AND child.is_active = true) as chunks_count").
		Order(orderBy).
		Limit(req.PageSize).
		Offset(req.GetOffset()).
		Find(&documents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询文档列表失败",
			"data":    nil,
		})
		return
	}

	// 设置处理状态
	for i := range documents {
		if documents[i].ChunksCount > 0 {
			documents[i].ProcessStatus = "processed"
		} else {
			documents[i].ProcessStatus = "processing"
		}
	}

	// 构造响应数据
	data := DocumentListData{
		Items: documents,
	}

	// 使用统一分页响应格式
	response := utils.NewPaginationResponse(req.Page, req.PageSize, total, data)
	c.JSON(http.StatusOK, response)
}

// UploadDocument 上传文档
func UploadDocument(c *gin.Context) {
	idStr := c.Param("id")
	kbId, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的知识库ID",
			"data":    nil,
		})
		return
	}

	var req UploadDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "请求数据格式错误",
			"data":    err.Error(),
		})
		return
	}

	// 验证请求数据
	validate := validator.New()
	if err := validate.Struct(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "数据验证失败",
			"data":    err.Error(),
		})
		return
	}

	// 检查知识库是否存在
	var kb KnowledgeBase
	if err := global.DB.First(&kb, kbId).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "KB_002",
				"message": "知识库不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询知识库失败",
				"data":    nil,
			})
		}
		return
	}

	// 设置默认值
	if req.Metadata == nil {
		req.Metadata = []byte("{}")
	}

	// 创建文档
	doc := KBDocument{
		KnowledgeBaseID: kbId,
		Title:           req.Title,
		Content:         req.Content,
		FilePath:        req.FilePath,
		FileType:        req.FileType,
		FileSize:        req.FileSize,
		Metadata:        req.Metadata,
		ChunkIndex:      0,
		IsActive:        true,
	}

	if err := global.DB.Create(&doc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "上传文档失败",
			"data":    nil,
		})
		return
	}

	// TODO: 这里应该异步启动文档处理和向量化任务
	// 现在只是返回创建的文档信息

	// 设置处理状态
	doc.ProcessStatus = "processing"
	doc.ChunksCount = 0

	c.JSON(http.StatusOK, doc)
}

// DeleteDocument 删除文档
func DeleteDocument(c *gin.Context) {
	idStr := c.Param("id")
	kbId, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的知识库ID",
			"data":    nil,
		})
		return
	}

	docIdStr := c.Param("docId")
	docId, err := strconv.ParseInt(docIdStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的文档ID",
			"data":    nil,
		})
		return
	}

	// 检查文档是否存在且属于指定的知识库
	var doc KBDocument
	if err := global.DB.Where("id = ? AND knowledge_base_id = ?", docId, kbId).First(&doc).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "DOC_001",
				"message": "文档不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询文档失败",
				"data":    nil,
			})
		}
		return
	}

	// 开始事务
	tx := global.DB.Begin()

	// 删除子文档块
	if err := tx.Where("parent_doc_id = ?", docId).Delete(&KBDocument{}).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "删除文档块失败",
			"data":    nil,
		})
		return
	}

	// 删除主文档
	if err := tx.Delete(&doc).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "删除文档失败",
			"data":    nil,
		})
		return
	}

	// 提交事务
	tx.Commit()

	c.JSON(http.StatusOK, gin.H{
		"code":    "SUCCESS",
		"message": "文档删除成功",
		"data":    nil,
	})
}
