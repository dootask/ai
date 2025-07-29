package aimodels

import (
	"time"
)

// AIModel AI模型数据结构
type AIModel struct {
	ID          int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID      int64     `json:"user_id" gorm:"not null;index"`
	Name        string    `json:"name" gorm:"type:varchar(255);not null" validate:"required,min=1,max=255"`
	Provider    string    `json:"provider" gorm:"type:varchar(100);not null" validate:"required"`
	ModelName   string    `json:"model_name" gorm:"type:varchar(255);not null" validate:"required,min=1,max=255"`
	ApiKey      *string   `json:"api_key,omitempty" gorm:"type:text"`
	BaseURL     string    `json:"base_url" gorm:"type:varchar(500)" validate:"omitempty,url"`
	ProxyURL    *string   `json:"proxy_url,omitempty" gorm:"type:varchar(500)" validate:"omitempty,url"`
	MaxTokens   int       `json:"max_tokens" gorm:"default:4000" validate:"min=1"`
	Temperature float32   `json:"temperature" gorm:"type:decimal(3,2);default:0.7" validate:"min=0,max=2"`
	IsEnabled   *bool     `json:"is_enabled" gorm:"default:true"`
	IsDefault   bool      `json:"is_default" gorm:"default:false"`
	CreatedAt   time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"autoUpdateTime"`

	AgentCount        int64 `json:"agent_count" gorm:"-"`
	ConversationCount int64 `json:"conversation_count" gorm:"-"`
	TokenUsage        int64 `json:"token_usage" gorm:"-"`
}

// TableName 设置表名
func (AIModel) TableName() string {
	return "ai_models"
}

// CreateAIModelRequest 创建AI模型请求
type CreateAIModelRequest struct {
	Name        string  `json:"name" validate:"required,min=1,max=255"`
	Provider    string  `json:"provider" validate:"required"`
	ModelName   string  `json:"model_name" validate:"required,min=1,max=255"`
	ApiKey      *string `json:"api_key,omitempty"`
	BaseURL     string  `json:"base_url" validate:"omitempty,url"`
	ProxyURL    *string `json:"proxy_url,omitempty" validate:"omitempty"`
	MaxTokens   int     `json:"max_tokens" validate:"min=1"`
	Temperature float32 `json:"temperature" validate:"min=0,max=2"`
	IsEnabled   bool    `json:"is_enabled"`
	IsDefault   bool    `json:"is_default"`
}

// UpdateAIModelRequest 更新AI模型请求
type UpdateAIModelRequest struct {
	Name        *string  `json:"name,omitempty" validate:"omitempty,min=1,max=255"`
	Provider    *string  `json:"provider,omitempty" validate:"omitempty"`
	ModelName   *string  `json:"model_name,omitempty" validate:"omitempty,min=1,max=255"`
	ApiKey      *string  `json:"api_key,omitempty"`
	BaseURL     *string  `json:"base_url,omitempty" validate:"omitempty,url"`
	ProxyURL    *string  `json:"proxy_url,omitempty" validate:"omitempty"`
	MaxTokens   *int     `json:"max_tokens,omitempty" validate:"omitempty,min=1"`
	Temperature *float32 `json:"temperature,omitempty" validate:"omitempty,min=0,max=2"`
	IsEnabled   *bool    `json:"is_enabled,omitempty"`
	IsDefault   *bool    `json:"is_default,omitempty"`
}

// AIModelFilters AI模型筛选条件
type AIModelFilters struct {
	Provider  string `json:"provider" form:"provider"`     // 提供商过滤
	IsEnabled *bool  `json:"is_enabled" form:"is_enabled"` // 启用状态过滤
}

// AIModelListData AI模型列表数据结构
type AIModelListData struct {
	Items []AIModel `json:"items"`
}

// AIModelResponse 单个AI模型响应
type AIModelResponse struct {
	Success bool    `json:"success"`
	Data    AIModel `json:"data"`
}

// ErrorResponse 错误响应
type ErrorResponse struct {
	Success bool   `json:"success"`
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
}

// GetAllowedSortFields 获取允许的排序字段
func GetAllowedSortFields() []string {
	return []string{"id", "name", "provider", "is_default", "created_at", "updated_at"}
}
