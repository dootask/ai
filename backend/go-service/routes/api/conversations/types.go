package conversations

import (
	"encoding/json"
	"time"
)

// Conversation 对话模型
type Conversation struct {
	ID            int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	AgentID       int64           `gorm:"column:agent_id;not null" json:"agent_id"`
	DootaskChatID string          `gorm:"column:dootask_chat_id;type:varchar(255);not null" json:"dootask_chat_id"`
	DootaskUserID string          `gorm:"column:dootask_user_id;type:varchar(255);not null" json:"dootask_user_id"`
	Context       json.RawMessage `gorm:"type:jsonb;default:'{}'" json:"context"`
	IsActive      bool            `gorm:"column:is_active;default:true" json:"is_active"`
	CreatedAt     time.Time       `gorm:"column:created_at;autoCreateTime" json:"created_at"`
	UpdatedAt     time.Time       `gorm:"column:updated_at;autoUpdateTime" json:"updated_at"`

	// 关联模型
	Agent        *Agent    `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
	Messages     []Message `gorm:"foreignKey:ConversationID" json:"messages,omitempty"`
	MessageCount int64     `gorm:"-" json:"message_count,omitempty"`

	// 前端兼容字段
	AgentName   string   `gorm:"-" json:"agent_name,omitempty"`
	UserName    string   `gorm:"-" json:"user_name,omitempty"`
	LastMessage *Message `gorm:"-" json:"last_message,omitempty"`
}

// Message 消息模型
type Message struct {
	ID             int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	ConversationID int64           `gorm:"column:conversation_id;not null" json:"conversation_id"`
	SendID         int64           `gorm:"column:send_id;not null" json:"send_id"`
	Role           string          `gorm:"type:varchar(20);not null" json:"role"`
	Content        string          `gorm:"type:text;not null" json:"content"`
	Metadata       json.RawMessage `gorm:"type:jsonb;default:'{}'" json:"metadata"`
	TokensUsed     int             `gorm:"column:tokens_used;default:0" json:"tokens_used"`
	ModelUsed      *string         `gorm:"column:model_used;type:varchar(100)" json:"model_used"`
	McpUsed        json.RawMessage `gorm:"type:jsonb;default:'null" json:"mcp_used"`
	ResponseTimeMs *int            `gorm:"column:response_time_ms" json:"response_time_ms,omitempty"`
	Status         int             `gorm:"column:status;default:1" json:"status"`
	CreatedAt      time.Time       `gorm:"column:created_at;autoCreateTime" json:"created_at"`

	// 前端兼容字段
	ResponseTime *float64 `gorm:"-" json:"response_time,omitempty"`
}

// Agent 智能体简化模型
type Agent struct {
	ID   int64  `gorm:"primaryKey" json:"id"`
	Name string `json:"name"`
}

// TableName 指定表名
func (Conversation) TableName() string {
	return "conversations"
}

func (Message) TableName() string {
	return "messages"
}

// ConversationFilters 对话筛选条件
type ConversationFilters struct {
	Search    string  `json:"search" form:"search"`         // 搜索关键词
	AgentID   *int64  `json:"agent_id" form:"agent_id"`     // 智能体ID过滤
	IsActive  *bool   `json:"is_active" form:"is_active"`   // 状态过滤
	UserID    string  `json:"user_id" form:"user_id"`       // 用户ID过滤
	StartDate *string `json:"start_date" form:"start_date"` // 开始日期
	EndDate   *string `json:"end_date" form:"end_date"`     // 结束日期
}

// MessageFilters 消息筛选条件
type MessageFilters struct {
	Role string `json:"role" form:"role" validate:"omitempty,oneof=user assistant system"` // 角色过滤
}

// ConversationListData 对话列表数据结构
type ConversationListData struct {
	Items      []Conversation         `json:"items"`
	Statistics ConversationStatistics `json:"statistics"`
}

// MessageListData 消息列表数据结构
type MessageListData struct {
	Items []Message `json:"items"`
}

// ConversationDetailResponse 对话详情响应
type ConversationDetailResponse struct {
	*Conversation
	TotalMessages       int64     `json:"total_messages"`
	AverageResponseTime float64   `json:"average_response_time"`
	TotalTokensUsed     int64     `json:"total_tokens_used"`
	LastActivity        time.Time `json:"last_activity"`
}

// ConversationStatistics 对话统计信息
type ConversationStatistics struct {
	Total               int64   `json:"total"`
	Today               int64   `json:"today"`
	Active              int64   `json:"active"`
	AverageMessages     float64 `json:"average_messages"`
	AverageResponseTime float64 `json:"average_response_time"`
	SuccessRate         float64 `json:"success_rate"`
}

// GetAllowedConversationSortFields 获取对话允许的排序字段
func GetAllowedConversationSortFields() []string {
	return []string{"id", "agent_id", "created_at", "updated_at"}
}

// GetAllowedMessageSortFields 获取消息允许的排序字段
func GetAllowedMessageSortFields() []string {
	return []string{"id", "created_at", "updated_at"}
}
