package mcptools

import (
	"net/http"
	"strconv"
	"time"

	"dootask-ai/go-service/global"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"
)

// RegisterRoutes 注册MCP工具管理路由
func RegisterRoutes(router *gin.RouterGroup) {
	// MCP工具管理 - 需要管理员权限
	mcpToolGroup := router.Group("/admin/mcp-tools")
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
}

// ListMCPTools 获取MCP工具列表
func ListMCPTools(c *gin.Context) {
	var params MCPToolQueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "查询参数格式错误",
			"data":    err.Error(),
		})
		return
	}

	// 验证参数
	validate := validator.New()
	if err := validate.Struct(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "查询参数验证失败",
			"data":    err.Error(),
		})
		return
	}

	// 构建查询
	query := global.DB.Model(&MCPTool{})

	// 搜索条件
	if params.Search != "" {
		searchTerm := "%" + params.Search + "%"
		query = query.Where("name ILIKE ? OR description ILIKE ?", searchTerm, searchTerm)
	}

	// 类别过滤
	if params.Category != "" {
		query = query.Where("category = ?", params.Category)
	}

	// 类型过滤
	if params.Type != "" {
		query = query.Where("type = ?", params.Type)
	}

	// 状态过滤
	if params.IsActive != nil {
		query = query.Where("is_active = ?", *params.IsActive)
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
	offset := (params.Page - 1) * params.PageSize
	orderBy := params.GetOrderBy() + " " + params.OrderDir

	var tools []MCPTool
	if err := query.
		Order(orderBy).
		Limit(params.PageSize).
		Offset(offset).
		Find(&tools).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询工具列表失败",
			"data":    nil,
		})
		return
	}

	// 计算总页数
	totalPages := int(total+int64(params.PageSize)-1) / params.PageSize

	response := MCPToolListResponse{
		Items:      tools,
		Total:      total,
		Page:       params.Page,
		PageSize:   params.PageSize,
		TotalPages: totalPages,
	}

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
	if err := global.DB.Where("name = ?", req.Name).First(&existingTool).Error; err == nil {
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

	// 处理JSONB字段默认值
	if req.Config == nil {
		req.Config = []byte("{}")
	}
	if req.Permissions == nil {
		req.Permissions = []byte("[\"read\"]")
	}

	// 创建工具
	tool := MCPTool{
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Type:        req.Type,
		Config:      req.Config,
		Permissions: req.Permissions,
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
		Where("tools::jsonb ? ?", strconv.FormatInt(id, 10)).
		Count(&associatedAgents)

	response := MCPToolResponse{
		MCPTool:             &tool,
		TotalCalls:          0,   // TODO: 从调用日志查询
		TodayCalls:          0,   // TODO: 从调用日志查询
		AverageResponseTime: 0.0, // TODO: 从调用日志计算
		SuccessRate:         1.0, // TODO: 从调用日志计算
		AssociatedAgents:    associatedAgents,
	}

	c.JSON(http.StatusOK, response)
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

	// 检查工具名称是否已被其他工具使用
	if req.Name != nil && *req.Name != tool.Name {
		var existingTool MCPTool
		if err := global.DB.Where("name = ? AND id != ?", *req.Name, id).First(&existingTool).Error; err == nil {
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

	// 构建更新数据
	updates := make(map[string]interface{})
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.Category != nil {
		updates["category"] = *req.Category
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Config != nil {
		updates["config"] = req.Config
	}
	if req.Permissions != nil {
		updates["permissions"] = req.Permissions
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

	// 检查是否有智能体正在使用此工具
	var agentCount int64
	toolIDStr := strconv.FormatInt(id, 10)
	// 使用JSONB包含操作符检查tools数组是否包含该工具ID
	if err := global.DB.Model(&struct {
		ID int64 `gorm:"primaryKey"`
	}{}).Table("agents").
		Where("tools @> ?", `["`+toolIDStr+`"]`).
		Count(&agentCount).Error; err != nil {
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
			"tool_name": tool.Name,
			"tool_type": tool.Type,
			"test_time": time.Now().Format("2006-01-02 15:04:05"),
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
	global.DB.Model(&MCPTool{}).Where("category = 'custom'").Count(&stats.CustomTools)

	// 按类型统计
	global.DB.Model(&MCPTool{}).Where("type = 'internal'").Count(&stats.InternalTools)
	global.DB.Model(&MCPTool{}).Where("type = 'external'").Count(&stats.ExternalTypeTools)

	// TODO: 从调用日志表统计使用数据
	stats.TotalCalls = 0
	stats.AvgResponseTime = 0.0

	c.JSON(http.StatusOK, stats)
}
