package conversations

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"dootask-ai/go-service/global"
	"dootask-ai/go-service/pkg/utils"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"gorm.io/gorm"
)

// RegisterRoutes 注册对话管理路由
func RegisterRoutes(router *gin.RouterGroup) {
	// 对话管理路由
	conversationGroup := router.Group("/conversations")
	{
		conversationGroup.GET("", ListConversations)          // 获取对话列表
		conversationGroup.GET("/:id", GetConversation)        // 获取对话详情
		conversationGroup.GET("/:id/messages", GetMessages)   // 获取对话消息
		conversationGroup.GET("/stats", GetConversationStats) // 获取对话统计
		conversationGroup.GET("/test", TestConversations)     // 测试数据库连接
	}
}

// TestConversations 测试对话表查询
func TestConversations(c *gin.Context) {
	// 测试基本数据库连接
	var count int64
	if err := global.DB.Model(&Conversation{}).Count(&count).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "数据库连接失败",
			"data":    err.Error(),
		})
		return
	}

	// 测试基本查询
	var conversations []Conversation
	if err := global.DB.Limit(5).Find(&conversations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询对话表失败",
			"data":    err.Error(),
		})
		return
	}

	// 测试Agent表关联
	var agentCount int64
	if err := global.DB.Table("agents").Count(&agentCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询智能体表失败",
			"data":    err.Error(),
		})
		return
	}

	// 测试Message表关联
	var messageCount int64
	if err := global.DB.Table("messages").Count(&messageCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询消息表失败",
			"data":    err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "数据库连接正常",
		"data": gin.H{
			"conversations_count":  count,
			"agents_count":         agentCount,
			"messages_count":       messageCount,
			"sample_conversations": conversations,
		},
	})
}

// ListConversations 获取对话列表
func ListConversations(c *gin.Context) {
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
	req.SetDefaultSort("created_at", true)

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

	// 解析筛选条件（兼容filters[xxx]=yyy嵌套参数）
	filtersMap := map[string]interface{}{}
	for key, values := range c.Request.URL.Query() {
		if strings.HasPrefix(key, "filters[") && strings.HasSuffix(key, "]") {
			field := key[len("filters[") : len(key)-1]
			if len(values) > 0 {
				filtersMap[field] = values[0]
			}
		}
	}

	// 兼容 agent_id 类型转换
	if v, ok := filtersMap["agent_id"]; ok {
		if s, ok := v.(string); ok {
			if id, err := strconv.ParseInt(s, 10, 64); err == nil {
				filtersMap["agent_id"] = id
			}
		}
	}

	var filters ConversationFilters
	if len(filtersMap) > 0 {
		filtersBytes, err := json.Marshal(filtersMap)
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
	allowedFields := GetAllowedConversationSortFields()
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

	// 构建基础查询
	query := global.DB.Model(&Conversation{})

	// 应用筛选条件
	if filters.Search != "" {
		searchTerm := "%" + filters.Search + "%"
		query = query.Joins("LEFT JOIN agents ON conversations.agent_id = agents.id").
			Where("agents.name ILIKE ? OR conversations.dootask_user_id ILIKE ?", searchTerm, searchTerm)
	}

	if filters.AgentID != nil {
		query = query.Where("conversations.agent_id = ?", *filters.AgentID)
	}

	if filters.IsActive != nil {
		query = query.Where("conversations.is_active = ?", *filters.IsActive)
	}

	if filters.UserID != "" {
		query = query.Where("conversations.dootask_user_id = ?", filters.UserID)
	}

	// 日期范围过滤
	if filters.StartDate != nil && *filters.StartDate != "" {
		if startTime, err := time.Parse("2006-01-02", *filters.StartDate); err == nil {
			query = query.Where("conversations.created_at >= ?", startTime)
		}
	}
	if filters.EndDate != nil && *filters.EndDate != "" {
		if endTime, err := time.Parse("2006-01-02", *filters.EndDate); err == nil {
			endTime = endTime.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			query = query.Where("conversations.created_at <= ?", endTime)
		}
	}

	// 获取总数（需要复制查询条件）
	var total int64
	countQuery := global.DB.Model(&Conversation{})
	if filters.Search != "" {
		searchTerm := "%" + filters.Search + "%"
		countQuery = countQuery.Joins("LEFT JOIN agents ON conversations.agent_id = agents.id").
			Where("agents.name ILIKE ? OR conversations.dootask_user_id ILIKE ?", searchTerm, searchTerm)
	}
	if filters.AgentID != nil {
		countQuery = countQuery.Where("conversations.agent_id = ?", *filters.AgentID)
	}
	if filters.IsActive != nil {
		countQuery = countQuery.Where("conversations.is_active = ?", *filters.IsActive)
	}
	if filters.UserID != "" {
		countQuery = countQuery.Where("conversations.dootask_user_id = ?", filters.UserID)
	}
	if filters.StartDate != nil && *filters.StartDate != "" {
		if startTime, err := time.Parse("2006-01-02", *filters.StartDate); err == nil {
			countQuery = countQuery.Where("conversations.created_at >= ?", startTime)
		}
	}
	if filters.EndDate != nil && *filters.EndDate != "" {
		if endTime, err := time.Parse("2006-01-02", *filters.EndDate); err == nil {
			endTime = endTime.Add(23*time.Hour + 59*time.Minute + 59*time.Second)
			countQuery = countQuery.Where("conversations.created_at <= ?", endTime)
		}
	}

	if err := countQuery.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询对话总数失败",
			"data":    err.Error(),
		})
		return
	}

	// 分页和排序
	orderBy := "conversations." + req.GetOrderBy()

	var conversations []Conversation
	if err := query.
		Preload("Agent").
		Order(orderBy).
		Limit(req.PageSize).
		Offset(req.GetOffset()).
		Find(&conversations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询对话列表失败",
			"data":    err.Error(),
		})
		return
	}

	// 填充额外信息
	for i := range conversations {
		if conversations[i].Agent != nil {
			conversations[i].AgentName = conversations[i].Agent.Name
		}
		conversations[i].UserName = "用户" + conversations[i].DootaskUserID

		// 获取消息数量
		var messageCount int64
		global.DB.Model(&Message{}).Where("conversation_id = ?", conversations[i].ID).Count(&messageCount)
		conversations[i].MessageCount = messageCount

		// 获取最后一条消息
		var lastMessage Message
		if err := global.DB.Where("conversation_id = ?", conversations[i].ID).
			Order("created_at DESC").
			First(&lastMessage).Error; err == nil {
			if lastMessage.Role == "assistant" {
				responseTime := 2.1
				lastMessage.ResponseTime = &responseTime
			}
			conversations[i].LastMessage = &lastMessage
		}
	}

	// 计算统计信息
	stats := calculateConversationStatistics()

	// 构造响应数据
	data := ConversationListData{
		Items:      conversations,
		Statistics: stats,
	}

	// 使用统一分页响应格式
	response := utils.NewPaginationResponse(req.Page, req.PageSize, total, data)
	c.JSON(http.StatusOK, response)
}

// GetConversation 获取对话详情
func GetConversation(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的对话ID",
			"data":    nil,
		})
		return
	}

	var conversation Conversation
	if err := global.DB.
		Preload("Agent").
		Where("conversations.id = ?", id).
		First(&conversation).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"code":    "CONVERSATION_001",
				"message": "对话不存在",
				"data":    nil,
			})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"code":    "DATABASE_001",
				"message": "查询对话失败",
				"data":    nil,
			})
		}
		return
	}

	// 计算统计信息
	var totalMessages int64
	global.DB.Model(&Message{}).Where("conversation_id = ?", id).Count(&totalMessages)

	var totalTokensUsed int64
	global.DB.Model(&Message{}).
		Select("COALESCE(SUM(tokens_used), 0)").
		Where("conversation_id = ?", id).
		Scan(&totalTokensUsed)

	var lastActivity time.Time
	global.DB.Model(&Message{}).
		Select("MAX(created_at)").
		Where("conversation_id = ?", id).
		Scan(&lastActivity)

	// 计算平均响应时间（模拟）
	averageResponseTime := 2.1

	// 填充额外信息
	if conversation.Agent != nil {
		conversation.AgentName = conversation.Agent.Name
	}
	conversation.UserName = "用户" + conversation.DootaskUserID

	response := ConversationDetailResponse{
		Conversation:        &conversation,
		TotalMessages:       totalMessages,
		AverageResponseTime: averageResponseTime,
		TotalTokensUsed:     totalTokensUsed,
		LastActivity:        lastActivity,
	}

	c.JSON(http.StatusOK, response)
}

// GetMessages 获取对话消息列表
func GetMessages(c *gin.Context) {
	idStr := c.Param("id")
	conversationID, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "无效的对话ID",
			"data":    nil,
		})
		return
	}

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
	req.SetDefaultSort("created_at", false) // 消息默认升序排列

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
	var filters MessageFilters
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
	allowedFields := GetAllowedMessageSortFields()
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

	// 检查对话是否存在
	var conversationCount int64
	if err := global.DB.Model(&Conversation{}).Where("id = ?", conversationID).Count(&conversationCount).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询对话失败",
			"data":    nil,
		})
		return
	}
	if conversationCount == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"code":    "CONVERSATION_001",
			"message": "对话不存在",
			"data":    nil,
		})
		return
	}

	// 构建查询
	query := global.DB.Model(&Message{}).Where("conversation_id = ?", conversationID)

	// 角色过滤
	if filters.Role != "" {
		query = query.Where("role = ?", filters.Role)
	}

	// 获取总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询消息总数失败",
			"data":    nil,
		})
		return
	}

	// 分页和排序
	orderBy := req.GetOrderBy()

	var messages []Message
	if err := query.
		Order(orderBy).
		Limit(req.PageSize).
		Offset(req.GetOffset()).
		Find(&messages).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"code":    "DATABASE_001",
			"message": "查询消息列表失败",
			"data":    nil,
		})
		return
	}

	// 为assistant消息添加模拟响应时间
	for i := range messages {
		if messages[i].Role == "assistant" {
			responseTime := 2.1
			messages[i].ResponseTime = &responseTime
		}
	}

	// 构造响应数据
	data := MessageListData{
		Items: messages,
	}

	// 使用统一分页响应格式
	response := utils.NewPaginationResponse(req.Page, req.PageSize, total, data)
	c.JSON(http.StatusOK, response)
}

// GetConversationStats 获取对话统计信息
func GetConversationStats(c *gin.Context) {
	stats := calculateConversationStatistics()
	c.JSON(http.StatusOK, stats)
}

// calculateConversationStatistics 计算对话统计信息
func calculateConversationStatistics() ConversationStatistics {
	var stats ConversationStatistics

	// 获取对话总数
	global.DB.Model(&Conversation{}).Count(&stats.Total)

	// 获取今日对话数
	today := time.Now().Truncate(24 * time.Hour)
	global.DB.Model(&Conversation{}).Where("created_at >= ?", today).Count(&stats.Today)

	// 获取活跃对话数
	global.DB.Model(&Conversation{}).Where("is_active = true").Count(&stats.Active)

	// 计算平均消息数
	if stats.Total > 0 {
		var totalMessages int64
		global.DB.Model(&Message{}).Count(&totalMessages)
		stats.AverageMessages = float64(totalMessages) / float64(stats.Total)
	}

	// 模拟平均响应时间和成功率
	stats.AverageResponseTime = 2.1
	stats.SuccessRate = 98.5

	return stats
}
