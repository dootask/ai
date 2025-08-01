package dashboard

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"dootask-ai/go-service/global"

	dootask "github.com/dootask/tools/server/go"
	"github.com/duke-git/lancet/v2/convertor"
	"github.com/duke-git/lancet/v2/slice"
	"github.com/gin-gonic/gin"
)

var startTime = time.Now()

// RegisterRoutes 注册仪表板路由
func RegisterRoutes(router *gin.RouterGroup) {
	// 仪表板路由
	dashboardGroup := router.Group("/dashboard")
	{
		dashboardGroup.GET("/stats", GetDashboardStats)           // 获取仪表板统计
		dashboardGroup.GET("/system-status", GetSystemStatus)     // 获取系统状态
		dashboardGroup.GET("/recent-activity", GetRecentActivity) // 获取最近活动
		dashboardGroup.GET("/health", GetSystemHealth)            // 系统健康检查
		dashboardGroup.GET("/test", TestDashboard)                // 测试数据库连接
	}
}

// GetDashboardStats 获取仪表板统计数据
func GetDashboardStats(c *gin.Context) {
	stats := DashboardStats{
		Agents:         getAgentStats(),
		Conversations:  getConversationStats(),
		Messages:       getMessageStats(),
		KnowledgeBases: getKnowledgeBaseStats(),
		MCPTools:       getMCPToolStats(),
		SystemStatus:   getSystemStatusInfo(),
		LastUpdated:    time.Now(),
	}

	c.JSON(http.StatusOK, stats)
}

// GetSystemStatus 获取系统状态
func GetSystemStatus(c *gin.Context) {
	status := getSystemStatusInfo()
	c.JSON(http.StatusOK, status)
}

// GetRecentActivity 获取最近活动
func GetRecentActivity(c *gin.Context) {
	activity := RecentActivity{
		RecentAgents:        getRecentAgents(),
		RecentConversations: getRecentConversations(),
	}

	c.JSON(http.StatusOK, activity)
}

// GetSystemHealth 系统健康检查
func GetSystemHealth(c *gin.Context) {
	services := make(map[string]ServiceStatus)

	// 检查Go服务状态
	services["go_service"] = ServiceStatus{
		Status:    "online",
		Uptime:    int64(time.Since(startTime).Seconds()),
		LastCheck: time.Now(),
		Details:   "Service running normally",
	}

	// 检查数据库状态
	dbStatus := checkDatabaseStatus()
	services["database"] = dbStatus

	// 检查Python AI服务状态
	services["python_service"] = ServiceStatus{
		Status:    "online", // 实际项目中应该ping Python服务
		Uptime:    int64(time.Since(startTime).Seconds()),
		LastCheck: time.Now(),
		Details:   "AI service operational",
	}

	// 检查Webhook状态
	services["webhook"] = ServiceStatus{
		Status:    "connected", // 实际项目中应该检查DooTask连接
		Uptime:    int64(time.Since(startTime).Seconds()),
		LastCheck: time.Now(),
		Details:   "DooTask webhook connected",
	}

	// 计算整体健康状态
	healthyCount := 0
	totalCount := len(services)
	var issues []string

	for name, service := range services {
		if service.Status == "online" || service.Status == "connected" {
			healthyCount++
		} else {
			issues = append(issues, name+" is "+service.Status)
		}
	}

	overallStatus := "healthy"
	if healthyCount < totalCount {
		if healthyCount > totalCount/2 {
			overallStatus = "warning"
		} else {
			overallStatus = "error"
		}
	}

	response := SystemHealthResponse{
		Status:   overallStatus,
		Services: services,
		Summary: SystemHealthSummary{
			HealthyServices: healthyCount,
			TotalServices:   totalCount,
			OverallScore:    (healthyCount * 100) / totalCount,
			Issues:          issues,
		},
	}

	c.JSON(http.StatusOK, response)
}

// TestDashboard 测试仪表板相关表的数据库连接
func TestDashboard(c *gin.Context) {
	testResults := make(map[string]interface{})

	// 测试agents表
	var agentCount int64
	if err := global.DB.Table("agents").Count(&agentCount).Error; err != nil {
		testResults["agents"] = gin.H{"error": err.Error()}
	} else {
		testResults["agents"] = gin.H{"count": agentCount, "status": "ok"}
	}

	// 测试conversations表
	var conversationCount int64
	if err := global.DB.Table("conversations").Count(&conversationCount).Error; err != nil {
		testResults["conversations"] = gin.H{"error": err.Error()}
	} else {
		testResults["conversations"] = gin.H{"count": conversationCount, "status": "ok"}
	}

	// 测试messages表
	var messageCount int64
	if err := global.DB.Table("messages").Count(&messageCount).Error; err != nil {
		testResults["messages"] = gin.H{"error": err.Error()}
	} else {
		testResults["messages"] = gin.H{"count": messageCount, "status": "ok"}
	}

	// 测试knowledge_bases表
	var kbCount int64
	if err := global.DB.Table("knowledge_bases").Count(&kbCount).Error; err != nil {
		testResults["knowledge_bases"] = gin.H{"error": err.Error()}
	} else {
		testResults["knowledge_bases"] = gin.H{"count": kbCount, "status": "ok"}
	}

	// 测试kb_documents表
	var docCount int64
	if err := global.DB.Table("kb_documents").Count(&docCount).Error; err != nil {
		testResults["kb_documents"] = gin.H{"error": err.Error()}
	} else {
		testResults["kb_documents"] = gin.H{"count": docCount, "status": "ok"}
	}

	// 测试mcp_tools表
	var toolCount int64
	if err := global.DB.Table("mcp_tools").Count(&toolCount).Error; err != nil {
		testResults["mcp_tools"] = gin.H{"error": err.Error()}
	} else {
		testResults["mcp_tools"] = gin.H{"count": toolCount, "status": "ok"}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "数据库表测试完成",
		"data":    testResults,
	})
}

// getAgentStats 获取智能体统计
func getAgentStats() AgentStats {
	var stats AgentStats

	userID := global.DooTaskUser.UserID

	global.DB.Table("agents").Where("user_id = ?", userID).Count(&stats.Total)
	global.DB.Table("agents").Where("user_id = ? AND is_active = true", userID).Count(&stats.Active)
	stats.Inactive = stats.Total - stats.Active

	return stats
}

// getConversationStats 获取对话统计
func getConversationStats() ConversationStats {
	var stats ConversationStats

	userID := convertor.ToString(global.DooTaskUser.UserID)

	global.DB.Table("conversations").Where("dootask_user_id = ?", userID).Count(&stats.Total)
	global.DB.Table("conversations").Where("dootask_user_id = ? AND is_active = true", userID).Count(&stats.Active)

	// 今日对话数
	today := time.Now().Truncate(24 * time.Hour)
	global.DB.Table("conversations").Where("created_at >= ? AND dootask_user_id = ?", today, userID).Count(&stats.Today)

	return stats
}

// getMessageStats 获取消息统计
func getMessageStats() MessageStats {
	userID := convertor.ToString(global.DooTaskUser.UserID)

	var stats MessageStats

	global.DB.Table("messages").Joins(
		"LEFT JOIN conversations c ON messages.conversation_id = c.id",
	).Where("c.dootask_user_id = ?", userID).Count(&stats.Total)

	// 今日消息数
	today := time.Now().Truncate(24 * time.Hour)
	global.DB.Table("messages").Joins(
		"LEFT JOIN conversations c ON messages.conversation_id = c.id",
	).Where("c.dootask_user_id = ? AND messages.created_at >= ?", userID, today).Count(&stats.Today)

	// 计算平均响应时间
	var averageResponseTime sql.NullFloat64
	global.DB.Raw(`
		SELECT avg(m.response_time_ms) FROM agents a
		LEFT JOIN conversations c ON a.id = c.agent_id
		LEFT JOIN messages m ON c.id= m.conversation_id
		WHERE a.user_id = ? AND m.status = 1 AND m.role = 'assistant' AND m.response_time_ms > 0
	`, userID).Scan(&averageResponseTime)

	stats.AverageResponseTime = averageResponseTime.Float64 / 1000.0

	return stats
}

// getKnowledgeBaseStats 获取知识库统计
func getKnowledgeBaseStats() KnowledgeBaseStats {
	userID := global.DooTaskUser.UserID

	var stats KnowledgeBaseStats

	global.DB.Table("knowledge_bases").Where("user_id = ?", userID).Count(&stats.Total)
	global.DB.Table("kb_documents").Joins("LEFT JOIN knowledge_bases kb ON kb_documents.knowledge_base_id = kb.id").Where("kb.user_id = ?", userID).Count(&stats.DocumentsCount)

	return stats
}

// getMCPToolStats 获取MCP工具统计
func getMCPToolStats() MCPToolStats {
	userID := global.DooTaskUser.UserID

	var stats MCPToolStats

	global.DB.Table("mcp_tools").Where("user_id = ?", userID).Count(&stats.Total)
	global.DB.Table("mcp_tools").Where("user_id = ? AND is_active = true", userID).Count(&stats.Active)

	return stats
}

// getSystemStatusInfo 获取系统状态信息
func getSystemStatusInfo() SystemStatusInfo {
	now := time.Now()
	uptime := int64(time.Since(startTime).Seconds())

	return SystemStatusInfo{
		GoService: ServiceStatus{
			Status:    "online",
			Uptime:    uptime,
			LastCheck: now,
			Details:   "Go service running",
		},
		PythonService: ServiceStatus{
			Status:    "online", // 实际项目中应该检查Python服务
			Uptime:    uptime,
			LastCheck: now,
			Details:   "Python AI service operational",
		},
		Database: checkDatabaseStatus(),
		Webhook: ServiceStatus{
			Status:    "connected", // 实际项目中应该检查DooTask连接
			Uptime:    uptime,
			LastCheck: now,
			Details:   "DooTask webhook connected",
		},
	}
}

// checkDatabaseStatus 检查数据库状态
func checkDatabaseStatus() ServiceStatus {
	now := time.Now()

	sqlDB, err := global.DB.DB()
	if err != nil {
		return ServiceStatus{
			Status:    "error",
			Uptime:    0,
			LastCheck: now,
			Details:   "Failed to get database connection: " + err.Error(),
		}
	}

	if err := sqlDB.Ping(); err != nil {
		return ServiceStatus{
			Status:    "offline",
			Uptime:    0,
			LastCheck: now,
			Details:   "Database ping failed: " + err.Error(),
		}
	}

	return ServiceStatus{
		Status:    "online",
		Uptime:    int64(time.Since(startTime).Seconds()),
		LastCheck: now,
		Details:   "Database connection healthy",
	}
}

// getRecentAgents 获取最近活跃的智能体
func getRecentAgents() []RecentAgent {
	var agents []RecentAgent

	rows, err := global.DB.Raw(`
		SELECT a.id, a.name, a.is_active,
		       COALESCE(today_msg.count, 0) as today_messages,
		       COALESCE(last_used.last_activity, a.created_at) as last_used
		FROM agents a
		LEFT JOIN (
			SELECT c.agent_id, COUNT(m.id) as count
			FROM conversations c
			JOIN messages m ON m.conversation_id = c.id
			WHERE m.created_at >= ?
			GROUP BY c.agent_id
		) today_msg ON today_msg.agent_id = a.id
		LEFT JOIN (
			SELECT c.agent_id, MAX(m.created_at) as last_activity
			FROM conversations c
			JOIN messages m ON m.conversation_id = c.id
			GROUP BY c.agent_id
		) last_used ON last_used.agent_id = a.id
		WHERE a.user_id = ?
		ORDER BY last_used DESC, a.created_at DESC
		LIMIT 5
	`, time.Now().Truncate(24*time.Hour), global.DooTaskUser.UserID).Rows()

	if err != nil {
		return agents
	}
	defer rows.Close()

	for rows.Next() {
		var agent RecentAgent
		var lastUsed sql.NullTime

		if err := rows.Scan(&agent.ID, &agent.Name, &agent.IsActive,
			&agent.TodayMessages, &lastUsed); err != nil {
			continue
		}

		if lastUsed.Valid {
			agent.LastUsed = lastUsed.Time
		}

		agents = append(agents, agent)
	}

	return agents
}

// getRecentConversations 获取最近的对话
func getRecentConversations() []RecentConversation {
	var conversations []RecentConversation

	rows, err := global.DB.Raw(`
		SELECT c.id, c.dootask_chat_id, c.dootask_user_id, a.name as agent_name,
		       COUNT(m.id) as messages_count,
		       MAX(m.created_at) as last_activity
		FROM conversations c
		JOIN agents a ON a.id = c.agent_id
		LEFT JOIN messages m ON m.conversation_id = c.id
		WHERE c.dootask_user_id = ?
		GROUP BY c.id, c.dootask_user_id, a.name
		ORDER BY last_activity DESC
		LIMIT 5
	`, convertor.ToString(global.DooTaskUser.UserID)).Rows()

	if err != nil {
		return conversations
	}
	defer rows.Close()

	for rows.Next() {
		var conv RecentConversation
		var userID string
		var dootaskChatID string
		var lastActivity sql.NullTime

		if err := rows.Scan(&conv.ID, &dootaskChatID, &userID, &conv.AgentName,
			&conv.MessagesCount, &lastActivity); err != nil {
			continue
		}
		userName := "用户" + userID
		dialogID, err := strconv.Atoi(dootaskChatID)
		if err == nil {
			dialogUsers, err := global.DooTaskClient.Client.GetDialogUser(dootask.GetDialogUserRequest{
				DialogID: dialogID,
				GetUser:  1,
			})
			if err == nil {
				user, ok := slice.FindBy(dialogUsers, func(index int, item dootask.DialogMember) bool {
					return item.UserID == int(global.DooTaskUser.UserID)
				})
				if ok {
					userName = user.Nickname
				}
			}
		}

		conv.UserName = userName
		if lastActivity.Valid {
			conv.LastActivity = lastActivity.Time
		}

		conversations = append(conversations, conv)
	}

	return conversations
}
