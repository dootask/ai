package agents

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dootask-ai/go-service/global"
	knowledgebases "dootask-ai/go-service/routes/api/knowledge-bases"
	mcp "dootask-ai/go-service/routes/api/mcp-tools"
	"dootask-ai/go-service/utils"

	dootask "github.com/dootask/tools/server/go"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// RegisterRoutes 注册智能体管理路由
func RegisterRoutes(router *gin.RouterGroup) {
	// 智能体管理 - 需要管理员权限
	agentGroup := router.Group("/agents")
	{
		agentGroup.GET("", ListAgents)                     // 获取智能体列表
		agentGroup.GET("/all", ListAgents)                 // 获取智能体列表
		agentGroup.POST("", CreateAgent)                   // 创建智能体
		agentGroup.GET("/:id", GetAgent)                   // 获取智能体详情
		agentGroup.PUT("/:id", UpdateAgent)                // 更新智能体
		agentGroup.DELETE("/:id", DeleteAgent)             // 删除智能体
		agentGroup.PATCH("/:id/toggle", ToggleAgentActive) // 切换智能体状态
	}
}

// ListAgents 获取智能体列表
func ListAgents(c *gin.Context) {
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
	var filters AgentFilters
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
	query := global.DB.Model(&Agent{})

	// 检查是否是 /all 路径，如果不是才应用 user_id 筛选
	if !strings.HasSuffix(c.Request.URL.Path, "/all") {
		// 设置默认筛选条件
		query = query.Where("user_id = ?", global.DooTaskUser.UserID)
	}
	// 应用筛选条件
	if filters.Search != "" {
		searchTerm := "%" + filters.Search + "%"
		query = query.Where("name ILIKE ? OR description ILIKE ?", searchTerm, searchTerm)
	}

	if filters.AIModelID != nil {
		query = query.Where("ai_model_id = ?", *filters.AIModelID)
	}

	if filters.IsActive != nil {
		query = query.Where("is_active = ?", *filters.IsActive)
	}

	if filters.CreateAT != nil {
		createTime := time.Unix(*filters.CreateAT/1000, (*filters.CreateAT%1000)*1000000)
		query = query.Where("created_at >= ?", createTime)
	}

	if filters.UpdateAT != nil {
		updateTime := time.Unix(*filters.UpdateAT/1000, (*filters.UpdateAT%1000)*1000000)
		query = query.Where("updated_at >= ?", updateTime)
	}

	// 获取总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询智能体总数失败",
			"data":    nil,
		})
		return
	}

	// 分页和排序
	orderBy := req.GetOrderBy()

	var agents []Agent
	if err := query.
		Preload("AIModel").
		Order(orderBy).
		Limit(req.PageSize).
		Offset(req.GetOffset()).
		Find(&agents).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询智能体列表失败",
			"data":    nil,
		})
		return
	}

	// 如果没有数据，直接返回
	if len(agents) == 0 {
		data := AgentListData{Items: agents}
		response := utils.NewPaginationResponse(req.Page, req.PageSize, total, data)
		c.JSON(http.StatusOK, response)
		return
	}

	// 优化后的平均响应时间查询
	var averageResponseTime sql.NullFloat64
	global.DB.Raw(`
		SELECT AVG(m.response_time_ms) 
		FROM agents a
		INNER JOIN conversations c ON c.agent_id = a.id AND c.is_active = true
		INNER JOIN messages m ON m.conversation_id = c.id AND m.response_time_ms > 0
		WHERE a.user_id = ? AND a.is_active = true
	`, global.DooTaskUser.UserID).Scan(&averageResponseTime)

	// 收集所有需要查询的ID
	var allKBIDs []int64
	var allToolIDs []int64
	agentKBMap := make(map[int64][]int64)
	agentToolMap := make(map[int64][]int64)

	for _, agent := range agents {
		var kbIDs []int64
		var toolIDs []int64

		if agent.KnowledgeBases != nil {
			json.Unmarshal(agent.KnowledgeBases, &kbIDs)
			agentKBMap[agent.ID] = kbIDs
			allKBIDs = append(allKBIDs, kbIDs...)
		}

		if agent.Tools != nil {
			json.Unmarshal(agent.Tools, &toolIDs)
			agentToolMap[agent.ID] = toolIDs
			allToolIDs = append(allToolIDs, toolIDs...)
		}
	}

	// 批量查询知识库名称
	kbNameMap := make(map[int64]string)
	if len(allKBIDs) > 0 {
		var kbResults []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		}
		global.DB.Model(&knowledgebases.KnowledgeBase{}).
			Select("id, name").
			Where("id IN (?)", allKBIDs).
			Find(&kbResults)

		for _, kb := range kbResults {
			kbNameMap[kb.ID] = kb.Name
		}
	}

	// 批量查询工具名称
	toolNameMap := make(map[int64]string)
	if len(allToolIDs) > 0 {
		var toolResults []struct {
			ID   int64  `json:"id"`
			Name string `json:"name"`
		}
		global.DB.Model(&mcp.MCPTool{}).
			Select("id, name").
			Where("id IN (?)", allToolIDs).
			Find(&toolResults)

		for _, tool := range toolResults {
			toolNameMap[tool.ID] = tool.Name
		}
	}

	// 批量查询会话统计（总数和本周数）
	conversationCountMap := make(map[int64]int64)
	weekConversationCountMap := make(map[int64]int64)
	if len(agents) > 0 {
		agentIDs := make([]int64, len(agents))
		for i, agent := range agents {
			agentIDs[i] = agent.ID
		}
		now := time.Now()
		weekStart := now.AddDate(0, 0, -int(now.Weekday())+1)
		weekStart = time.Date(weekStart.Year(), weekStart.Month(), weekStart.Day(), 0, 0, 0, 0, weekStart.Location())

		var conversationCounts []struct {
			AgentID   int64 `json:"agent_id"`
			Total     int64 `json:"total"`
			WeekCount int64 `json:"week_count"`
		}
		global.DB.Table("conversations").
			Select("agent_id, count(*) as total, sum(case when created_at >= ? then 1 else 0 end) as week_count", weekStart).
			Where("agent_id IN (?)", agentIDs).
			Where("is_active = true").
			Group("agent_id").
			Find(&conversationCounts)

		for _, cc := range conversationCounts {
			conversationCountMap[cc.AgentID] = cc.Total
			weekConversationCountMap[cc.AgentID] = cc.WeekCount
		}
	}

	// 组装数据
	for i, agent := range agents {
		// 设置知识库名称
		if kbIDs, exists := agentKBMap[agent.ID]; exists {
			var kbNames []string
			for _, kbID := range kbIDs {
				if name, found := kbNameMap[kbID]; found {
					kbNames = append(kbNames, name)
				}
			}
			agent.KBNames = kbNames
		}

		// 设置工具名称
		if toolIDs, exists := agentToolMap[agent.ID]; exists {
			var toolNames []string
			for _, toolID := range toolIDs {
				if name, found := toolNameMap[toolID]; found {
					toolNames = append(toolNames, name)
				}
			}
			agent.ToolNames = toolNames
		}

		// 设置统计信息
		totalMessages := conversationCountMap[agent.ID]
		weekMessages := weekConversationCountMap[agent.ID]
		agent.Statistics = &AgentStatistics{
			TotalMessages:       totalMessages,
			WeekMessages:        weekMessages,
			AverageResponseTime: averageResponseTime.Float64,
		}
		agents[i] = agent
	}

	// 构造响应数据
	data := AgentListData{
		Items: agents,
	}

	// 使用统一分页响应格式
	response := utils.NewPaginationResponse(req.Page, req.PageSize, total, data)
	c.JSON(http.StatusOK, response)
}

// CreateAgent 创建智能体
func CreateAgent(c *gin.Context) {
	var req CreateAgentRequest
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

	// 检查智能体名称是否已存在
	var existingAgent Agent
	if err := global.DB.Where("user_id = ? AND name = ?", global.DooTaskUser.UserID, req.Name).First(&existingAgent).Error; err == nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    "AGENT_001",
			"message": "智能体名称已存在",
			"data":    nil,
		})
		return
	} else if err != gorm.ErrRecordNotFound {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "检查智能体名称失败",
			"data":    nil,
		})
		return
	}

	// 验证AI模型是否存在
	if req.AIModelID == nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    "AI_MODEL_001",
			"message": "请选择AI模型",
			"data":    nil,
		})
		return
	}
	var modelCount int64
	if err := global.DB.Model(&struct {
		ID int64 `gorm:"primaryKey"`
	}{}).Table("ai_models").Where("id = ? AND user_id = ? AND is_enabled = true", *req.AIModelID, global.DooTaskUser.UserID).Count(&modelCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "验证AI模型失败",
			"data":    nil,
		})
		return
	}
	if modelCount == 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    "AI_MODEL_001",
			"message": "指定的AI模型不存在或未启用",
			"data":    nil,
		})
		return
	}

	// 处理JSONB字段值
	kbIDsJson := datatypes.JSON([]byte(`[]`))
	if req.KnowledgeBases != nil {
		kbIDsJson = datatypes.JSON(req.KnowledgeBases)
	}
	toolsJson := datatypes.JSON([]byte(`[]`))
	if req.Tools != nil {
		toolsJson = datatypes.JSON(req.Tools)
	}
	metadataJson := datatypes.JSON([]byte(`{}`))
	if req.Metadata != nil {
		metadataJson = datatypes.JSON(req.Metadata)
	}

	// 创建机器人
	bot, err := global.DooTaskClient.Client.CreateBot(dootask.CreateBotRequest{
		Name:       req.Name,
		Session:    1,
		ClearDay:   15,
		WebhookURL: fmt.Sprintf("%s/service/webhook?server_url=%s", "http://nginx", c.GetString("base_url")),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DOOTASK_001",
			"message": "创建机器人失败",
			"data":    nil,
		})
		return
	}
	botID := int64(bot.ID)

	// 创建智能体
	agent := Agent{
		UserID:         int64(global.DooTaskUser.UserID),
		Name:           req.Name,
		Description:    req.Description,
		Prompt:         req.Prompt,
		BotID:          &botID,
		AIModelID:      req.AIModelID,
		Temperature:    req.Temperature,
		Tools:          toolsJson,
		KnowledgeBases: kbIDsJson,
		Metadata:       metadataJson,
		IsActive:       true,
	}

	if err := global.DB.Create(&agent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "创建智能体失败",
			"data":    nil,
		})
		return
	}

	// 查询完整的智能体信息（包含关联数据）
	var createdAgent Agent
	if err := global.DB.
		Preload("AIModel").
		Where("agents.id = ?", agent.ID).
		First(&createdAgent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询创建的智能体失败",
			"data":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, createdAgent)
}

// GetAgent 获取智能体详情
func GetAgent(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的智能体ID",
			"data":    nil,
		})
		return
	}

	var agent Agent
	if err := global.DB.
		Preload("AIModel").
		Where("agents.id = ?", id).
		First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "AGENT_002",
				"message": "智能体不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询智能体失败",
				"data":    nil,
			})
		}
		return
	}

	// 查询使用统计
	var conversationCount int64
	global.DB.Model(&struct {
		ID int64 `gorm:"primaryKey"`
	}{}).Table("conversations").Where("agent_id = ?", id).Count(&conversationCount)

	var messageCount int64
	global.DB.Model(&struct {
		ID int64 `gorm:"primaryKey"`
	}{}).Table("messages").
		Joins("JOIN conversations ON messages.conversation_id = conversations.id").
		Where("conversations.agent_id = ?", id).
		Count(&messageCount)

	var tokenUsage int64
	global.DB.Model(&struct {
		TokensUsed int64 `gorm:"column:tokens_used"`
	}{}).Table("messages").
		Select("COALESCE(SUM(tokens_used), 0)").
		Joins("JOIN conversations ON messages.conversation_id = conversations.id").
		Where("conversations.agent_id = ?", id).
		Scan(&tokenUsage)

	// 填充知识库名称和工具名称
	var kbIDs []int64
	var kbNames []string
	json.Unmarshal(agent.KnowledgeBases, &kbIDs)
	if len(kbIDs) > 0 {
		global.DB.Model(&knowledgebases.KnowledgeBase{}).Where("id IN (?)", kbIDs).Pluck("name", &kbNames)
	}
	agent.KBNames = kbNames

	var toolIDs []int64
	var toolNames []string
	json.Unmarshal(agent.Tools, &toolIDs)
	if len(toolIDs) > 0 {
		global.DB.Model(&mcp.MCPTool{}).Where("id IN (?)", toolIDs).Pluck("name", &toolNames)
	}
	agent.ToolNames = toolNames

	response := AgentResponse{
		Agent:             &agent,
		ConversationCount: conversationCount,
		MessageCount:      messageCount,
		TokenUsage:        tokenUsage,
	}

	c.JSON(http.StatusOK, response)
}

// UpdateAgent 更新智能体
func UpdateAgent(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的智能体ID",
			"data":    nil,
		})
		return
	}

	var req UpdateAgentRequest
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

	// 检查智能体是否存在
	var agent Agent
	if err := global.DB.Where("id = ? AND user_id = ?", id, global.DooTaskUser.UserID).First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "AGENT_002",
				"message": "智能体不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询智能体失败",
				"data":    nil,
			})
		}
		return
	}

	// 检查智能体名称是否已被其他智能体使用
	if req.Name != nil && *req.Name != agent.Name {
		var existingAgent Agent
		if err := global.DB.Where("user_id = ? AND name = ? AND id != ?", global.DooTaskUser.UserID, *req.Name, id).First(&existingAgent).Error; err == nil {
			c.JSON(http.StatusUnprocessableEntity, gin.H{
				"code":    "AGENT_001",
				"message": "智能体名称已存在",
				"data":    nil,
			})
			return
		} else if err != gorm.ErrRecordNotFound {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "检查智能体名称失败",
				"data":    nil,
			})
			return
		}
	}

	// 验证AI模型是否存在
	if req.AIModelID == nil {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    "AI_MODEL_001",
			"message": "请选择AI模型",
			"data":    nil,
		})
		return
	}
	var modelCount int64
	if err := global.DB.Model(&struct {
		ID int64 `gorm:"primaryKey"`
	}{}).Table("ai_models").Where("id = ? AND user_id = ? AND is_enabled = true", *req.AIModelID, global.DooTaskUser.UserID).Count(&modelCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "验证AI模型失败",
			"data":    nil,
		})
		return
	}
	if modelCount == 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    "AI_MODEL_001",
			"message": "指定的AI模型不存在或未启用",
			"data":    nil,
		})
		return
	}

	// 检查知识库是否存在
	if req.KnowledgeBases != nil {
		var kbIDs []int64
		if err := json.Unmarshal(req.KnowledgeBases, &kbIDs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "VALIDATION_001",
				"message": "知识库ID格式错误",
				"data":    nil,
			})
			return
		}
		if len(kbIDs) > 0 {
			var knowledgeBaseCount int64
			if err := global.DB.Model(&struct {
				ID int64 `gorm:"primaryKey"`
			}{}).Table("knowledge_bases").Where("id IN (?) AND user_id = ?", kbIDs, global.DooTaskUser.UserID).Count(&knowledgeBaseCount).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"code":    "DATABASE_001",
					"message": "验证知识库失败",
					"data":    nil,
				})
				return
			}
			if knowledgeBaseCount == 0 {
				c.JSON(http.StatusUnprocessableEntity, gin.H{
					"code":    "KNOWLEDGE_BASE_001",
					"message": "指定的知识库不存在",
					"data":    nil,
				})
				return
			}
		}
	}

	// 检查工具是否存在
	if req.Tools != nil {
		var toolIDs []int64
		if err := json.Unmarshal(req.Tools, &toolIDs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"code":    "VALIDATION_001",
				"message": "工具ID格式错误",
				"data":    nil,
			})
			return
		}
		if len(toolIDs) > 0 {
			var toolCount int64
			if err := global.DB.Model(&struct {
				ID int64 `gorm:"primaryKey"`
			}{}).Table("mcp_tools").Where("id IN (?) AND user_id = ?", toolIDs, global.DooTaskUser.UserID).Count(&toolCount).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"code":    "DATABASE_001",
					"message": "验证工具失败",
					"data":    nil,
				})
				return
			}
			if toolCount == 0 {
				c.JSON(http.StatusUnprocessableEntity, gin.H{
					"code":    "MCP_TOOL_001",
					"message": "指定的工具不存在",
					"data":    nil,
				})
				return
			}
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
	if req.Prompt != nil {
		updates["prompt"] = *req.Prompt
	}
	if req.AIModelID != nil {
		updates["ai_model_id"] = *req.AIModelID
	}
	if req.Temperature != nil {
		updates["temperature"] = *req.Temperature
	}
	if req.Tools != nil {
		updates["tools"] = req.Tools
	}
	if req.KnowledgeBases != nil {
		updates["knowledge_bases"] = req.KnowledgeBases
	}
	if req.Metadata != nil {
		updates["metadata"] = req.Metadata
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	// 更新机器人
	if agent.BotID != nil && req.Name != nil {
		_, err = global.DooTaskClient.Client.UpdateBot(dootask.EditBotRequest{
			ID:         int(*agent.BotID),
			Name:       *req.Name,
			WebhookURL: fmt.Sprintf("%s/service/webhook?server_url=%s", "http://nginx", c.GetString("base_url")),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DOOTASK_002",
				"message": "更新机器人失败",
				"data":    nil,
			})
			return
		}
	}

	// 执行更新
	if err := global.DB.Model(&agent).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "更新智能体失败",
			"data":    nil,
		})
		return
	}

	// 查询更新后的智能体信息
	var updatedAgent Agent
	if err := global.DB.
		Preload("AIModel").
		Where("agents.id = ?", id).
		First(&updatedAgent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询更新的智能体失败",
			"data":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, updatedAgent)
}

// DeleteAgent 删除智能体
func DeleteAgent(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的智能体ID",
			"data":    nil,
		})
		return
	}

	// 检查智能体是否存在
	var agent Agent
	if err := global.DB.Where("id = ? AND user_id = ?", id, global.DooTaskUser.UserID).First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "AGENT_002",
				"message": "智能体不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询智能体失败",
				"data":    nil,
			})
		}
		return
	}

	// 检查是否有关联的对话记录
	var conversationCount int64
	if err := global.DB.Model(&struct {
		ID int64 `gorm:"primaryKey"`
	}{}).Table("conversations").Where("agent_id = ?", id).Count(&conversationCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "检查关联对话失败",
			"data":    nil,
		})
		return
	}

	if conversationCount > 0 {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"code":    "AGENT_003",
			"message": "智能体有关联的对话记录，无法删除",
			"data":    map[string]int64{"conversation_count": conversationCount},
		})
		return
	}

	// 删除机器人
	if agent.BotID != nil {
		err = global.DooTaskClient.Client.DeleteBot(dootask.DeleteBotRequest{
			ID:     int(*agent.BotID),
			Remark: "删除智能体",
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DOOTASK_003",
				"message": "删除机器人失败",
				"data":    nil,
			})
			return
		}
	}

	// 删除智能体
	if err := global.DB.Delete(&agent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "删除智能体失败",
			"data":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "智能体删除成功",
	})
}

// ToggleAgentActive 切换智能体活跃状态
func ToggleAgentActive(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的智能体ID",
			"data":    nil,
		})
		return
	}

	var req struct {
		IsActive bool `json:"is_active" validate:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "请求数据格式错误",
			"data":    err.Error(),
		})
		return
	}

	// 检查智能体是否存在
	var agent Agent
	if err := global.DB.Where("id = ? AND user_id = ?", id, global.DooTaskUser.UserID).First(&agent).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "AGENT_002",
				"message": "智能体不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询智能体失败",
				"data":    nil,
			})
		}
		return
	}

	// 更新状态
	if err := global.DB.Model(&agent).Update("is_active", req.IsActive).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_002",
			"message": "更新智能体状态失败",
			"data":    nil,
		})
		return
	}

	// 返回更新后的智能体
	var updatedAgent Agent
	if err := global.DB.
		Preload("AIModel").
		Where("agents.id = ?", id).
		First(&updatedAgent).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询更新的智能体失败",
			"data":    nil,
		})
		return
	}

	c.JSON(http.StatusOK, updatedAgent)
}
