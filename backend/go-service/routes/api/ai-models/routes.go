package aimodels

import (
	"database/sql"
	"dootask-ai/go-service/global"
	"dootask-ai/go-service/routes/api/agents"
	"dootask-ai/go-service/routes/api/conversations"
	"dootask-ai/go-service/utils"
	"net/http"

	"github.com/duke-git/lancet/v2/convertor"
	"github.com/duke-git/lancet/v2/cryptor"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"
)

// Handler AI模型管理处理器
type Handler struct{}

// RegisterRoutes 注册AI模型管理路由
func RegisterRoutes(router *gin.RouterGroup) {
	handler := &Handler{}

	// 创建管理员路由组
	aimodels := router.Group("/ai-models")
	{
		aimodels.GET("", handler.GetAIModels)          // 获取AI模型列表
		aimodels.GET("/:id", handler.GetAIModel)       // 获取单个AI模型
		aimodels.POST("", handler.CreateAIModel)       // 创建AI模型
		aimodels.PUT("/:id", handler.UpdateAIModel)    // 更新AI模型
		aimodels.DELETE("/:id", handler.DeleteAIModel) // 删除AI模型
	}
}

// GetAIModels 获取AI模型列表
func (h *Handler) GetAIModels(c *gin.Context) {
	var req utils.PaginationRequest

	// 绑定查询参数
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Error:   "查询参数格式错误",
			Code:    "VALIDATION_001",
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
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Error:   "查询参数验证失败",
			Code:    "VALIDATION_001",
		})
		return
	}

	// 解析筛选条件
	var filters AIModelFilters
	if err := req.ParseFiltersFromQuery(c, &filters); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "筛选条件解析失败",
			"data":    err.Error(),
		})
		return
	}

	// 验证排序字段
	allowedFields := GetAllowedSortFields()
	for _, sort := range req.Sorts {
		if !utils.ValidateSortField(sort.Key, allowedFields) {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Success: false,
				Error:   "无效的排序字段: " + sort.Key,
				Code:    "VALIDATION_001",
			})
			return
		}
	}

	// 构建查询
	db := global.DB.Model(&AIModel{})

	// 设置默认筛选条件
	db = db.Where("user_id = ?", global.DooTaskUser.UserID)

	// 应用筛选条件
	if filters.Provider != "" {
		db = db.Where("provider = ?", filters.Provider)
	}
	if filters.IsEnabled != nil {
		db = db.Where("is_enabled = ?", *filters.IsEnabled)
	}

	// 获取总数
	var total int64
	if err := db.Count(&total).Error; err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "查询AI模型列表失败",
			Code:    "AI_MODEL_001",
		})
		return
	}

	// 获取数据
	var models []AIModel
	orderBy := req.GetOrderBy()
	if err := db.Offset(req.GetOffset()).Limit(req.PageSize).Order(orderBy).Find(&models).Error; err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "查询AI模型列表失败",
			Code:    "AI_MODEL_001",
		})
		return
	}

	// 隐藏敏感信息
	for i := range models {
		if models[i].ApiKey != nil && *models[i].ApiKey != "" {
			masked := "***"
			models[i].ApiKey = &masked
		}
	}

	// 构造响应数据
	data := AIModelListData{
		Items: models,
	}

	// 使用统一分页响应格式
	response := utils.NewPaginationResponse(req.Page, req.PageSize, total, data)
	c.JSON(http.StatusOK, response)
}

// GetAIModel 获取单个AI模型
func (h *Handler) GetAIModel(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Error:   "AI模型ID不能为空",
			Code:    "FORMAT_001",
		})
		return
	}

	var model AIModel
	if err := global.DB.First(&model, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Success: false,
				Error:   "AI模型不存在",
				Code:    "AI_MODEL_002",
			})
		} else {
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Success: false,
				Error:   "查询AI模型失败",
				Code:    "AI_MODEL_001",
			})
		}
		return
	}

	// 获取关联的智能体数量
	var agentCount int64
	if err := global.DB.Model(&agents.Agent{}).Where("ai_model_id = ?", model.ID).Count(&agentCount).Error; err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "查询关联智能体数量失败",
			Code:    "AI_MODEL_001",
		})
		return
	}
	model.AgentCount = agentCount

	// 获取关联的对话数量
	var conversationCount int64
	if err := global.DB.Model(&agents.Agent{}).Joins(
		"LEFT JOIN conversations ON conversations.agent_id = agents.id",
	).Where("ai_model_id = ?", model.ID).Count(&conversationCount).Error; err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "查询关联对话数量失败",
			Code:    "AI_MODEL_001",
		})
		return
	}
	model.ConversationCount = conversationCount

	// 获取关联的token使用量
	var tokenUsage sql.NullInt64
	if err := global.DB.Model(&conversations.Message{}).Joins(
		"LEFT JOIN conversations ON conversations.id = messages.conversation_id",
	).Joins(
		"LEFT JOIN agents ON agents.id = conversations.agent_id",
	).Where("agents.ai_model_id = ?", model.ID).Select("SUM(messages.tokens_used)").Scan(&tokenUsage).Error; err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "查询关联token使用量失败",
			Code:    "AI_MODEL_001",
		})
		return
	}
	model.TokenUsage = tokenUsage.Int64

	// 隐藏敏感信息
	if model.ApiKey != nil && *model.ApiKey != "" {
		masked := "***"
		model.ApiKey = &masked
	}

	c.JSON(http.StatusOK, AIModelResponse{
		Success: true,
		Data:    model,
	})
}

// CreateAIModel 创建AI模型
func (h *Handler) CreateAIModel(c *gin.Context) {
	var req CreateAIModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Error:   "请求数据格式错误",
			Code:    "FORMAT_001",
		})
		return
	}

	// 验证请求数据
	if err := global.Validator.Struct(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "数据验证失败: " + err.Error(),
			Code:    "VALIDATION_001",
		})
		return
	}

	// 检查名称是否已存在
	var existingModel AIModel
	if err := global.DB.Where("user_id = ? AND name = ?", global.DooTaskUser.UserID, req.Name).First(&existingModel).Error; err == nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "AI模型名称已存在",
			Code:    "AI_MODEL_003",
		})
		return
	}

	// 如果设置为默认模型，需要将其他模型的默认状态取消
	if req.IsDefault {
		if err := global.DB.Model(&AIModel{}).Where("user_id = ? AND is_default = true", global.DooTaskUser.UserID).Update("is_default", false).Error; err != nil {
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Success: false,
				Error:   "更新默认模型状态失败",
				Code:    "AI_MODEL_004",
			})
			return
		}
	}

	// 加密api_key
	apiKey := *req.ApiKey
	appKey := utils.GetEnvWithDefault("API_KEY", "")
	if appKey != "" {
		apiKey = convertor.ToStdBase64(string(cryptor.AesGcmEncrypt([]byte(*req.ApiKey), []byte(appKey))))
	}

	// 创建模型
	model := AIModel{
		UserID:      int64(global.DooTaskUser.UserID),
		Name:        req.Name,
		Provider:    req.Provider,
		ModelName:   req.ModelName,
		ApiKey:      &apiKey,
		BaseURL:     req.BaseURL,
		ProxyURL:    req.ProxyURL,
		MaxTokens:   req.MaxTokens,
		Temperature: req.Temperature,
		IsEnabled:   &req.IsEnabled,
		IsDefault:   req.IsDefault,
		IsThinking:  req.IsThinking, // 新增字段：是否为思考型模型
	}

	if err := global.DB.Create(&model).Error; err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "创建AI模型失败",
			Code:    "AI_MODEL_004",
		})
		return
	}

	// 隐藏敏感信息
	if model.ApiKey != nil && *model.ApiKey != "" {
		masked := "***"
		model.ApiKey = &masked
	}

	c.JSON(http.StatusOK, AIModelResponse{
		Success: true,
		Data:    model,
	})
}

// UpdateAIModel 更新AI模型
func (h *Handler) UpdateAIModel(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Error:   "AI模型ID不能为空",
			Code:    "FORMAT_001",
		})
		return
	}

	var req UpdateAIModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Error:   "请求数据格式错误",
			Code:    "FORMAT_001",
		})
		return
	}

	// 验证请求数据
	if err := global.Validator.Struct(&req); err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "数据验证失败: " + err.Error(),
			Code:    "VALIDATION_001",
		})
		return
	}

	// 检查模型是否存在
	var model AIModel
	if err := global.DB.Where("user_id = ?", global.DooTaskUser.UserID).First(&model, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Success: false,
				Error:   "AI模型不存在",
				Code:    "AI_MODEL_002",
			})
		} else {
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Success: false,
				Error:   "查询AI模型失败",
				Code:    "AI_MODEL_001",
			})
		}
		return
	}

	// 检查名称是否冲突（如果更新了名称）
	if req.Name != nil && *req.Name != model.Name {
		var existingModel AIModel
		if err := global.DB.Where("user_id = ? AND name = ? AND id != ?", global.DooTaskUser.UserID, *req.Name, id).First(&existingModel).Error; err == nil {
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Success: false,
				Error:   "AI模型名称已存在",
				Code:    "AI_MODEL_003",
			})
			return
		}
	}

	// 如果设置为默认模型，需要将其他模型的默认状态取消
	if req.IsDefault != nil && *req.IsDefault {
		if err := global.DB.Model(&AIModel{}).Where("user_id = ? AND is_default = true AND id != ?", global.DooTaskUser.UserID, id).Update("is_default", false).Error; err != nil {
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Success: false,
				Error:   "更新默认模型状态失败",
				Code:    "AI_MODEL_004",
			})
			return
		}
	}

	// 构建更新数据
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Provider != nil {
		updates["provider"] = *req.Provider
	}
	if req.ModelName != nil {
		updates["model_name"] = *req.ModelName
	}
	if req.ApiKey != nil {
		apiKey := *req.ApiKey
		appKey := utils.GetEnvWithDefault("API_KEY", "")
		if appKey != "" {
			apiKey = convertor.ToStdBase64(string(cryptor.AesGcmEncrypt([]byte(*req.ApiKey), []byte(appKey))))
		}
		updates["api_key"] = &apiKey
	}
	if req.BaseURL != nil {
		updates["base_url"] = *req.BaseURL
	}
	if req.ProxyURL != nil {
		updates["proxy_url"] = *req.ProxyURL
	}
	if req.MaxTokens != nil {
		updates["max_tokens"] = *req.MaxTokens
	}
	if req.Temperature != nil {
		updates["temperature"] = *req.Temperature
	}
	if req.IsEnabled != nil {
		updates["is_enabled"] = *req.IsEnabled
	}
	if req.IsDefault != nil {
		updates["is_default"] = *req.IsDefault
	}
	if req.IsThinking != nil {
		updates["is_thinking"] = *req.IsThinking
	}

	// 执行更新
	if err := global.DB.Model(&model).Updates(updates).Error; err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "更新AI模型失败",
			Code:    "AI_MODEL_004",
		})
		return
	}

	// 重新获取更新后的数据
	if err := global.DB.First(&model, id).Error; err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "查询更新后的AI模型失败",
			Code:    "AI_MODEL_001",
		})
		return
	}

	// 隐藏敏感信息
	if model.ApiKey != nil && *model.ApiKey != "" {
		masked := "***"
		model.ApiKey = &masked
	}

	c.JSON(http.StatusOK, AIModelResponse{
		Success: true,
		Data:    model,
	})
}

// DeleteAIModel 删除AI模型
func (h *Handler) DeleteAIModel(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Success: false,
			Error:   "AI模型ID不能为空",
			Code:    "FORMAT_001",
		})
		return
	}

	// 检查模型是否存在
	var model AIModel
	if err := global.DB.Where("user_id = ?", global.DooTaskUser.UserID).First(&model, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Success: false,
				Error:   "AI模型不存在",
				Code:    "AI_MODEL_002",
			})
		} else {
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Success: false,
				Error:   "查询AI模型失败",
				Code:    "AI_MODEL_001",
			})
		}
		return
	}

	// 检查是否有关联的智能体在使用
	var agentCount int64
	if err := global.DB.Table("agents").Where("user_id = ? AND ai_model_id = ?", global.DooTaskUser.UserID, id).Count(&agentCount).Error; err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "检查关联智能体失败",
			Code:    "AI_MODEL_005",
		})
		return
	}

	if agentCount > 0 {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "该AI模型正在被智能体使用，无法删除",
			Code:    "AI_MODEL_006",
		})
		return
	}

	// 执行删除
	if err := global.DB.Delete(&model).Error; err != nil {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Success: false,
			Error:   "删除AI模型失败",
			Code:    "AI_MODEL_005",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"message": "AI模型删除成功",
		},
	})
}
