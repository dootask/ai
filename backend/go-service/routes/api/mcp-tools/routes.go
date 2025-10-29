package mcptools

import (
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"time"

	"dootask-ai/go-service/global"
	"dootask-ai/go-service/routes/api/conversations"
	"dootask-ai/go-service/utils"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"
)

// RegisterRoutes 注册MCP工具管理路由
func RegisterRoutes(router *gin.RouterGroup) {
	// MCP工具管理
	mcpToolGroup := router.Group("/mcp-tools")
	{
		mcpToolGroup.GET("", ListMCPTools)                     // 获取工具列表
		mcpToolGroup.POST("", CreateMCPTool)                   // 创建工具
		mcpToolGroup.GET("/:id", GetMCPTool)                   // 获取工具详情
		mcpToolGroup.PUT("/:id", UpdateMCPTool)                // 更新工具
		mcpToolGroup.DELETE("/:id", DeleteMCPTool)             // 删除工具
		mcpToolGroup.PATCH("/:id/toggle", ToggleMCPToolActive) // 切换工具状态
		mcpToolGroup.POST("/:id/test", TestMCPTool)            // 测试工具
		mcpToolGroup.GET("/stats", GetMCPToolStats)            // 获取统计信息
	}
	InitMCPScheduler()
}

// ListMCPTools 获取MCP工具列表
func ListMCPTools(c *gin.Context) {
	var req utils.PaginationRequest

	// 绑定查询参数
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "查询参数格式错误",
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
			"message": "查询参数验证失败",
			"data":    err.Error(),
		})
		return
	}

	// 解析筛选条件
	var filters MCPToolFilters
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
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "VALIDATION_001",
				"message": "无效的排序字段: " + sort.Key,
				"data":    nil,
			})
			return
		}
	}

	// 构建查询
	query := global.DB.Model(&MCPTool{})

	// 设置默认筛选条件
	query = query.Where("user_id = ? OR category = ?", global.GetDooTaskUser(c).UserID, "dootask")

	// 应用筛选条件
	if filters.Search != "" {
		searchTerm := "%" + filters.Search + "%"
		query = query.Where("name ILIKE ? OR description ILIKE ?", searchTerm, searchTerm)
	}

	if filters.Category != "" {
		query = query.Where("category = ?", filters.Category)
	}

	if filters.IsActive != nil {
		query = query.Where("is_active = ?", *filters.IsActive)
	}

	// 获取总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询工具总数失败",
			"data":    nil,
		})
		return
	}

	// 分页和排序
	orderBy := req.GetOrderBy()

	var tools []MCPTool
	if err := query.
		Order(orderBy).
		Limit(req.PageSize).
		Offset(req.GetOffset()).
		Find(&tools).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询工具列表失败",
			"data":    nil,
		})
		return
	}

	// 统计工具总数
	var totalTools int64
	global.DB.Model(&MCPTool{}).Where("user_id = ?", global.GetDooTaskUser(c).UserID).Count(&totalTools)

	// 统计启用工具总数
	var activeTools int64
	global.DB.Model(&MCPTool{}).Where("user_id = ? AND is_active = ?", global.GetDooTaskUser(c).UserID, true).Count(&activeTools)

	// 统计对话消息中使用MCP工具的次数
	var messages []conversations.Message
	global.DB.Model(&conversations.Conversation{}).Joins(
		"LEFT JOIN messages ON conversations.id = messages.conversation_id",
	).Where("conversations.dootask_user_id = ?", strconv.Itoa(int(global.GetDooTaskUser(c).UserID))).
		Where("messages.mcp_used IS NOT NULL").Select("messages.*").Find(&messages)

	var stats MCPToolStatsResponse
	for _, message := range messages {
		if message.McpUsed != nil {
			var mcpUsed []string
			if err := json.Unmarshal(message.McpUsed, &mcpUsed); err == nil {
				stats.TotalCalls += int64(len(mcpUsed))
			}
		}
		if message.ResponseTimeMs != nil {
			stats.AvgResponseTime += float64(*message.ResponseTimeMs)
		}
	}

	if len(messages) > 0 {
		stats.AvgResponseTime = stats.AvgResponseTime / float64(len(messages)) / 1000
	}

	// 构造响应数据
	data := MCPToolListData{
		Items: tools,
		Stats: MCPToolStatsResponse{
			Total:           totalTools,
			Active:          activeTools,
			Inactive:        totalTools - activeTools,
			TotalCalls:      stats.TotalCalls,
			AvgResponseTime: stats.AvgResponseTime,
		},
	}

	// 使用统一分页响应格式
	response := utils.NewPaginationResponse(req.Page, req.PageSize, total, data)
	c.JSON(http.StatusOK, response)
}

// CreateMCPTool 创建MCP工具
func CreateMCPTool(c *gin.Context) {
	var req CreateMCPToolRequest
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
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    "VALIDATION_002",
			"message": "数据验证失败",
			"data":    err.Error(),
		})
		return
	}

	// 检查工具名称是否已存在
	var existingTool MCPTool
	if err := global.DB.Where("user_id = ? AND name = ?", global.GetDooTaskUser(c).UserID, req.Name).First(&existingTool).Error; err == nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    "MCP_TOOL_001",
			"message": "工具名称已存在",
			"data":    nil,
		})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "检查工具名称失败",
			"data":    nil,
		})
		return
	}

	// 检查MCP工具标识是否已存在
	if req.McpName != "" {
		if err := global.DB.Where("user_id = ? AND mcp_name = ?", global.GetDooTaskUser(c).UserID, req.McpName).First(&existingTool).Error; err == nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    "MCP_TOOL_003",
				"message": "MCP工具标识已存在",
				"data":    nil,
			})
			return
		} else if err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "检查MCP工具标识失败",
				"data":    nil,
			})
			return
		}
	}

	// 处理JSONB字段默认值
	if req.Config == nil {
		req.Config = []byte("{}")
	}

	// 设置默认配置类型
	configType := int8(ConfigTypeStreamableHTTP) // 默认为streamable_http配置
	if req.ConfigType != nil {
		configType = *req.ConfigType
	}

	// 创建工具
	tool := MCPTool{
		UserID:      int64(global.GetDooTaskUser(c).UserID),
		Name:        req.Name,
		McpName:     req.McpName, // 新增：MCP工具标识
		Description: req.Description,
		Category:    req.Category,
		ConfigType:  configType, // 新增：配置类型
		Config:      req.Config,
		IsActive:    true,
	}

	if err := global.DB.Create(&tool).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "创建工具失败",
			"data":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, tool)
}

// GetMCPTool 获取MCP工具详情
func GetMCPTool(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的工具ID",
			"data":    nil,
		})
		return
	}

	var tool MCPTool
	if err := global.DB.Where("id = ?", id).First(&tool).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "MCP_TOOL_002",
				"message": "工具不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询工具失败",
				"data":    nil,
			})
		}
		return
	}

	// 查询使用统计 (模拟数据，实际应该从调用日志表查询)
	var associatedAgents int64
	global.DB.Model(&struct {
		ID int64 `gorm:"primaryKey"`
	}{}).Table("agents").
		Where("tools::jsonb ? '" + idStr + "'").
		Count(&associatedAgents)

	// 处理配置信息
	var configInfo *ConfigInfo
	if tool.Config != nil {
		var configData map[string]interface{}
		if err := json.Unmarshal(tool.Config, &configData); err == nil {
			// 根据配置类型决定是否检查API密钥
			hasApiKeyValue := false
			if tool.ConfigType == ConfigTypeStreamableHTTP {
				hasApiKeyValue = hasApiKey(configData)
			}

			configInfo = &ConfigInfo{
				Type:       int8(tool.ConfigType),
				HasApiKey:  hasApiKeyValue,
				ConfigData: sanitizeConfigData(configData),
			}
		}
	}

	response := MCPToolResponse{
		MCPTool:             &tool,
		TotalCalls:          0,   // TODO: 从调用日志查询
		TodayCalls:          0,   // TODO: 从调用日志查询
		AverageResponseTime: 0.0, // TODO: 从调用日志计算
		SuccessRate:         1.0, // TODO: 从调用日志计算
		AssociatedAgents:    associatedAgents,
		ConfigInfo:          configInfo,
	}

	c.JSON(http.StatusOK, response)
}

// hasApiKey 检查配置中是否有API密钥
func hasApiKey(configData map[string]interface{}) bool {
	// 检查常见的API密钥字段
	keyFields := []string{"api_key", "apiKey", "key", "token", "secret"}
	for _, field := range keyFields {
		if value, exists := configData[field]; exists {
			if str, ok := value.(string); ok && str != "" {
				return true
			}
		}
	}
	return false
}

// sanitizeConfigData 清理配置数据，移除敏感信息
func sanitizeConfigData(configData map[string]interface{}) map[string]interface{} {
	sanitized := make(map[string]interface{})

	// 敏感字段列表
	sensitiveFields := []string{"api_key", "apiKey", "key", "token", "secret", "password"}

	for key, value := range configData {
		isSensitive := slices.Contains(sensitiveFields, key)

		if !isSensitive {
			sanitized[key] = value
		}
	}

	return sanitized
}

// UpdateMCPTool 更新MCP工具
func UpdateMCPTool(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的工具ID",
			"data":    nil,
		})
		return
	}

	var req UpdateMCPToolRequest
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
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    "VALIDATION_002",
			"message": "数据验证失败",
			"data":    err.Error(),
		})
		return
	}

	// 检查工具是否存在
	var tool MCPTool
	if err := global.DB.Where("id = ? AND user_id = ?", id, global.GetDooTaskUser(c).UserID).First(&tool).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "MCP_TOOL_002",
				"message": "工具不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询工具失败",
				"data":    nil,
			})
		}
		return
	}

	// 检查工具名称是否已被其他工具使用
	if req.Name != nil && *req.Name != tool.Name {
		var existingTool MCPTool
		if err := global.DB.Where("user_id = ? AND name = ? AND id != ?", global.GetDooTaskUser(c).UserID, *req.Name, id).First(&existingTool).Error; err == nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    "MCP_TOOL_001",
				"message": "工具名称已存在",
				"data":    nil,
			})
			return
		} else if err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "检查工具名称失败",
				"data":    nil,
			})
			return
		}
	}

	// 检查MCP工具标识是否已被其他工具使用
	if req.McpName != nil && *req.McpName != tool.McpName {
		var existingTool MCPTool
		if err := global.DB.Where("user_id = ? AND mcp_name = ? AND id != ?", global.GetDooTaskUser(c).UserID, *req.McpName, id).First(&existingTool).Error; err == nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    "MCP_TOOL_003",
				"message": "MCP工具标识已存在",
				"data":    nil,
			})
			return
		} else if err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "检查MCP工具标识失败",
				"data":    nil,
			})
			return
		}
	}

	// 构建更新数据
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.McpName != nil {
		updates["mcp_name"] = *req.McpName
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.ConfigType != nil {
		updates["config_type"] = *req.ConfigType
	}
	if req.Config != nil {
		updates["config"] = req.Config
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	// 执行更新
	if err := global.DB.Model(&tool).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "更新工具失败",
			"data":    nil,
		})
		return
	}

	// 查询更新后的工具信息
	var updatedTool MCPTool
	if err := global.DB.Where("id = ?", id).First(&updatedTool).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询更新的工具失败",
			"data":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, updatedTool)
}

// DeleteMCPTool 删除MCP工具
func DeleteMCPTool(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的工具ID",
			"data":    nil,
		})
		return
	}

	// 检查工具是否存在
	var tool MCPTool
	if err := global.DB.Where("id = ? AND user_id = ?", id, global.GetDooTaskUser(c).UserID).First(&tool).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "MCP_TOOL_002",
				"message": "工具不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询工具失败",
				"data":    nil,
			})
		}
		return
	}

	// 检查是否有智能体正在使用此工具
	var agentCount int64
	toolIDStr := strconv.FormatInt(id, 10)
	// 使用JSONB包含操作符检查tools数组是否包含该工具ID
	if err := global.DB.Model(&struct {
		ID int64 `gorm:"primaryKey"`
	}{}).Table("agents").Where("tools @> ?", `[`+toolIDStr+`]`).Count(&agentCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "检查关联智能体失败",
			"data":    nil,
		})
		return
	}
	if agentCount > 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    "MCP_TOOL_003",
			"message": "工具被智能体使用中，无法删除",
			"data":    map[string]int64{"associated_agents": agentCount},
		})
		return
	}

	// 删除工具
	if err := global.DB.Delete(&tool).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "删除工具失败",
			"data":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "工具删除成功",
	})
}

// ToggleMCPToolActive 切换MCP工具活跃状态
func ToggleMCPToolActive(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的工具ID",
			"data":    nil,
		})
		return
	}

	var req ToggleMCPToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "请求数据格式错误",
			"data":    err.Error(),
		})
		return
	}

	// 检查工具是否存在
	var tool MCPTool
	if err := global.DB.Where("id = ? AND user_id = ?", id, global.GetDooTaskUser(c).UserID).First(&tool).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "MCP_TOOL_002",
				"message": "工具不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询工具失败",
				"data":    nil,
			})
		}
		return
	}

	// 更新状态
	if err := global.DB.Model(&tool).Update("is_active", req.IsActive).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "更新工具状态失败",
			"data":    nil,
		})
		return
	}

	// 返回更新后的工具
	var updatedTool MCPTool
	if err := global.DB.Where("id = ?", id).First(&updatedTool).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询更新的工具失败",
			"data":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, updatedTool)
}

// TestMCPTool 测试MCP工具
func TestMCPTool(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的工具ID",
			"data":    nil,
		})
		return
	}

	var req TestMCPToolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "请求数据格式错误",
			"data":    err.Error(),
		})
		return
	}

	// 检查工具是否存在
	var tool MCPTool
	if err := global.DB.Where("id = ?", id).First(&tool).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "MCP_TOOL_002",
				"message": "工具不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询工具失败",
				"data":    nil,
			})
		}
		return
	}

	// 模拟工具测试 (实际实现应该根据工具类型进行真实测试)
	startTime := time.Now()

	// TODO: 根据工具类型执行实际测试逻辑
	time.Sleep(100 * time.Millisecond) // 模拟测试耗时

	responseTime := float64(time.Since(startTime).Nanoseconds()) / 1000000.0 // 转换为毫秒

	response := TestMCPToolResponse{
		Success:      true,
		Message:      "工具测试成功",
		ResponseTime: responseTime,
		TestResult: map[string]interface{}{
			"tool_name":     tool.Name,
			"tool_category": tool.Category,
			"test_time":     time.Now().Format("2006-01-02 15:04:05"),
		},
	}

	c.JSON(http.StatusOK, response)
}

// GetMCPToolStats 获取MCP工具统计信息
func GetMCPToolStats(c *gin.Context) {
	var stats MCPToolStatsResponse

	// 总数统计
	global.DB.Model(&MCPTool{}).Count(&stats.Total)
	global.DB.Model(&MCPTool{}).Where("is_active = true").Count(&stats.Active)
	global.DB.Model(&MCPTool{}).Where("is_active = false").Count(&stats.Inactive)

	// 按类别统计
	global.DB.Model(&MCPTool{}).Where("category = 'dootask'").Count(&stats.DooTaskTools)
	global.DB.Model(&MCPTool{}).Where("category = 'external'").Count(&stats.ExternalTools)

	// TODO: 从调用日志表统计使用数据
	stats.TotalCalls = 0
	stats.AvgResponseTime = 0.0

	c.JSON(http.StatusOK, stats)
}
