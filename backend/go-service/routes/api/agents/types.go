package agents

import (
	"encoding/json"
	"time"

	"dootask-ai/go-service/routes/api/conversations"

	"gorm.io/datatypes"
)

// Agent 智能体模型
type Agent struct {
	ID             int64          `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID         int64          `gorm:"not null;index" json:"user_id"`
	Name           string         `gorm:"type:varchar(255);not null" json:"name" validate:"required,max=255"`
	Description    *string        `gorm:"type:text" json:"description"`
	Prompt         string         `gorm:"type:text;not null" json:"prompt"`
	BotID          *int64         `gorm:"column:bot_id" json:"bot_id"`
	AIModelID      *int64         `gorm:"column:ai_model_id" json:"ai_model_id"`
	Temperature    float64        `gorm:"type:decimal(3,2);default:0.7" json:"temperature" validate:"min=0,max=2"`
	Tools          datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"tools"`
	KnowledgeBases datatypes.JSON `gorm:"type:jsonb;default:'[]'" json:"knowledge_bases"`
	Metadata       datatypes.JSON `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	IsActive       bool           `gorm:"default:true" json:"is_active"`
	CreatedAt      time.Time      `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt      time.Time      `gorm:"autoUpdateTime" json:"updated_at"`

	// 关联模型
	AIModel       *AIModel                     `gorm:"foreignKey:AIModelID" json:"ai_model,omitempty"`
	Conversations []conversations.Conversation `gorm:"foreignKey:AgentID" json:"conversations,omitempty"`

	// 统计信息
	Statistics *AgentStatistics `gorm:"-" json:"statistics,omitempty"`

	// 其他信息
	KBNames   []string `gorm:"-" json:"kb_names,omitempty"`
	ToolNames []string `gorm:"-" json:"tool_names,omitempty"`
}

// AgentStatistics 智能体统计信息
type AgentStatistics struct {
	TotalMessages       int64   `json:"total_messages"`
	TodayMessages       int64   `json:"today_messages"`
	WeekMessages        int64   `json:"week_messages"`
	AverageResponseTime float64 `json:"average_response_time"`
	SuccessRate         float64 `json:"success_rate"`
}

// AIModel AI模型简化结构（用于关联查询）
type AIModel struct {
	ID       int64  `gorm:"primaryKey" json:"id"`
	Name     string `json:"name"`
	Provider string `json:"provider"`
}

// TableName 指定表名
func (Agent) TableName() string {
	return "agents"
}

// CreateAgentRequest 创建智能体请求
type CreateAgentRequest struct {
	Name           string          `json:"name" validate:"required,max=255"`
	Description    *string         `json:"description"`
	Prompt         string          `json:"prompt"`
	AIModelID      *int64          `json:"ai_model_id"`
	Temperature    float64         `json:"temperature" validate:"min=0,max=2"`
	Tools          json.RawMessage `json:"tools"`
	KnowledgeBases json.RawMessage `json:"knowledge_bases"`
	Metadata       json.RawMessage `json:"metadata"`
}

// UpdateAgentRequest 更新智能体请求
type UpdateAgentRequest struct {
	Name           *string         `json:"name" validate:"omitempty,max=255"`
	Description    *string         `json:"description"`
	Prompt         *string         `json:"prompt"`
	AIModelID      *int64          `json:"ai_model_id"`
	Temperature    *float64        `json:"temperature" validate:"omitempty,min=0,max=2"`
	Tools          json.RawMessage `json:"tools"`
	KnowledgeBases json.RawMessage `json:"knowledge_bases"`
	Metadata       json.RawMessage `json:"metadata"`
	IsActive       *bool           `json:"is_active"`
}

// AgentFilters 智能体筛选条件
type AgentFilters struct {
	Search    string `json:"search" form:"search"`           // 搜索关键词
	AIModelID *int64 `json:"ai_model_id" form:"ai_model_id"` // AI模型ID过滤
	IsActive  *bool  `json:"is_active" form:"is_active"`     // 状态过滤
	CreateAT  *int64 `json:"create_at" form:"create_at"`     // 创建时间过滤（时间戳）
	UpdateAT  *int64 `json:"update_at" form:"update_at"`     // 更新时间过滤（时间戳）
}

// AgentListData 智能体列表数据结构
type AgentListData struct {
	Items []Agent `json:"items"`
}

// AgentResponse 智能体详情响应
type AgentResponse struct {
	*Agent
	// 统计信息
	ConversationCount int64 `json:"conversation_count"`
	MessageCount      int64 `json:"message_count"`
	TokenUsage        int64 `json:"token_usage"`
}

// GetAllowedSortFields 获取允许的排序字段
func GetAllowedSortFields() []string {
	return []string{"id", "name", "created_at", "updated_at"}
}
