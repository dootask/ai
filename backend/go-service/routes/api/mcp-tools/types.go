package mcptools

import (
	"encoding/json"
	"time"
)

// 配置类型常量 - 扩展为四种方式
const (
	ConfigTypeStreamableHTTP = 0 // Streamable HTTP配置
	ConfigTypeWebSocket      = 1 // WebSocket配置
	ConfigTypeSSE            = 2 // Server-Sent Events配置
	ConfigTypeSTDIO          = 3 // Standard I/O配置
)

// 配置信息结构体
type ConfigInfo struct {
	Type       int8                   `json:"type"`        // 配置类型：0-streamable_http 1-websocket 2-sse 3-stdio
	HasApiKey  bool                   `json:"has_api_key"` // 是否有API密钥
	ConfigData map[string]interface{} `json:"config_data"` // 配置数据（不包含敏感信息）
}

// MCPTool MCP工具模型
type MCPTool struct {
	ID          int64           `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      int64           `gorm:"not null;index" json:"user_id"`
	Name        string          `gorm:"type:varchar(255);not null;unique" json:"name" validate:"required,max=255"`
	McpName     string          `gorm:"type:varchar(100);not null;default:''" json:"mcp_name"`
	Description *string         `gorm:"type:text" json:"description"`
	Category    string          `gorm:"type:varchar(50);not null;default:'external'" json:"category" validate:"required,oneof=dootask external custom"`
	Type        string          `gorm:"type:varchar(20);not null;default:'external'" json:"type" validate:"required,oneof=internal external"`
	ConfigType  int8            `gorm:"type:smallint;default:0" json:"config_type"`
	Config      json.RawMessage `gorm:"type:jsonb;default:'{}'" json:"config"`
	Permissions json.RawMessage `gorm:"type:jsonb;default:'[\"read\"]'" json:"permissions"`
	IsActive    bool            `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time       `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt   time.Time       `gorm:"autoUpdateTime" json:"updated_at"`
}

// TableName 指定表名
func (MCPTool) TableName() string {
	return "mcp_tools"
}

// CreateMCPToolRequest 创建MCP工具请求
type CreateMCPToolRequest struct {
	Name        string          `json:"name" validate:"required,max=255"`
	McpName     string          `json:"mcp_name" validate:"required,max=100,alphanum"`
	Description *string         `json:"description"`
	Category    string          `json:"category" validate:"required,oneof=dootask external custom"`
	Type        string          `json:"type" validate:"required,oneof=internal external"`
	ConfigType  *int8           `json:"config_type" validate:"omitempty,min=0,max=3"` // 配置类型：0-streamable_http 1-websocket 2-sse 3-stdio
	Config      json.RawMessage `json:"config"`
	Permissions json.RawMessage `json:"permissions"`
}

// UpdateMCPToolRequest 更新MCP工具请求
type UpdateMCPToolRequest struct {
	Name        *string         `json:"name" validate:"omitempty,max=255"`
	McpName     *string         `json:"mcp_name" validate:"omitempty,max=100,alphanum"`
	Description *string         `json:"description"`
	Category    *string         `json:"category" validate:"omitempty,oneof=dootask external custom"`
	Type        *string         `json:"type" validate:"omitempty,oneof=internal external"`
	ConfigType  *int8           `json:"config_type" validate:"omitempty,min=0,max=3"` // 配置类型：0-streamable_http 1-websocket 2-sse 3-stdio
	Config      json.RawMessage `json:"config"`
	Permissions json.RawMessage `json:"permissions"`
	IsActive    *bool           `json:"is_active"`
}

// MCPToolFilters MCP工具筛选条件
type MCPToolFilters struct {
	Search   string `json:"search" form:"search"`                                                        // 搜索关键词
	Category string `json:"category" form:"category" validate:"omitempty,oneof=dootask external custom"` // 类别过滤
	Type     string `json:"type" form:"type" validate:"omitempty,oneof=internal external"`               // 类型过滤
	IsActive *bool  `json:"is_active" form:"is_active"`                                                  // 状态过滤
}

// MCPToolListData MCP工具列表数据结构
type MCPToolListData struct {
	Items []MCPTool            `json:"items"`
	Stats MCPToolStatsResponse `json:"stats"`
}

// MCPToolResponse MCP工具详情响应
type MCPToolResponse struct {
	*MCPTool
	// 统计信息
	TotalCalls          int64   `json:"total_calls"`
	TodayCalls          int64   `json:"today_calls"`
	AverageResponseTime float64 `json:"average_response_time"`
	SuccessRate         float64 `json:"success_rate"`
	// 关联智能体数量
	AssociatedAgents int64 `json:"associated_agents"`
	// 配置信息
	ConfigInfo *ConfigInfo `json:"config_info,omitempty"`
}

// MCPToolStatsResponse MCP工具统计响应
type MCPToolStatsResponse struct {
	Total             int64   `json:"total"`
	Active            int64   `json:"active"`
	Inactive          int64   `json:"inactive"`
	DooTaskTools      int64   `json:"dootask_tools"`
	ExternalTools     int64   `json:"external_tools"`
	CustomTools       int64   `json:"custom_tools"`
	InternalTools     int64   `json:"internal_tools"`
	ExternalTypeTools int64   `json:"external_type_tools"`
	TotalCalls        int64   `json:"total_calls"`
	AvgResponseTime   float64 `json:"avg_response_time"`
}

// ToggleMCPToolRequest 切换工具状态请求
type ToggleMCPToolRequest struct {
	IsActive bool `json:"is_active" validate:"required"`
}

// TestMCPToolRequest 测试工具请求
type TestMCPToolRequest struct {
	TestData map[string]interface{} `json:"test_data"`
}

// TestMCPToolResponse 测试工具响应
type TestMCPToolResponse struct {
	Success      bool                   `json:"success"`
	Message      string                 `json:"message"`
	ResponseTime float64                `json:"response_time"` // 毫秒
	TestResult   map[string]interface{} `json:"test_result,omitempty"`
}

// GetAllowedSortFields 获取允许的排序字段
func GetAllowedSortFields() []string {
	return []string{"id", "name", "category", "type", "is_active", "created_at", "updated_at"}
}
