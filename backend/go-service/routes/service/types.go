package service

import (
	"encoding/json"
	"time"
)

// WebhookRequest 机器人webhook请求
type WebhookRequest struct {
	Text       string         `json:"text" form:"text"`               // 消息文本
	ReplyText  string         `json:"reply_text" form:"reply_text"`   // 回复文本（引用的消息）
	Token      string         `json:"token" form:"token"`             // 机器人Token
	SessionId  int64          `json:"session_id" form:"session_id"`   // 对话会话ID
	DialogId   int64          `json:"dialog_id" form:"dialog_id"`     // 对话ID
	DialogType string         `json:"dialog_type" form:"dialog_type"` // 对话类型
	MsgId      int64          `json:"msg_id" form:"msg_id"`           // 消息ID
	MsgUid     int64          `json:"msg_uid" form:"msg_uid"`         // 消息发送人ID
	MsgUser    WebhookMsgUser `json:"msg_user" form:"msg_user"`       // 消息发送人
	Mention    int64          `json:"mention" form:"mention"`         // 是否被@到
	BotUid     int64          `json:"bot_uid" form:"bot_uid"`         // 机器人ID
	Version    string         `json:"version" form:"version"`         // 系统版本
	Extras     map[string]any `json:"extras" form:"extras"`           // 扩展字段

	// 流式消息相关
	StreamId string `json:"stream_id"` // 流式消息ID
	SendId   int64  `json:"send_id"`   // 发送消息后返回的消息ID
}

// WebhookMsgUser 消息发送人
type WebhookMsgUser struct {
	Userid     int64  `json:"userid" form:"userid"`
	Email      string `json:"email" form:"email"`
	Nickname   string `json:"nickname" form:"nickname"`
	Profession string `json:"profession" form:"profession"`
	Lang       string `json:"lang" form:"lang"`
	Token      string `json:"token" form:"token"`
}

// Response 机器人响应
type WebhookResponse struct {
	Bot        int            `json:"bot"`
	CreatedAt  string         `json:"created_at"`
	DialogID   int            `json:"dialog_id"`
	DialogType string         `json:"dialog_type"`
	ForwardID  int            `json:"forward_id"`
	ID         int            `json:"id"`
	Link       int            `json:"link"`
	UserID     int            `json:"userid"`
	Msg        map[string]any `json:"msg"`
}

// StreamLineData 流式消息数据结构
type StreamLineData struct {
	Type    string
	Content any
	IsFirst bool
}

// StreamMessageData 消息数据结构
type StreamMessageData struct {
	Content       string
	UsageMetadata StreamUsageMetadata `json:"usage_metadata"`
}

// StreamUsageMetadata 使用量元数据
type StreamUsageMetadata struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// StreamErrorData 错误数据结构
type StreamErrorData struct {
	Error struct {
		Message string
	}
}

// StreamToolData 工具数据结构
type StreamToolData struct {
	Type          string              `json:"type"`
	UsageMetadata StreamUsageMetadata `json:"usage_metadata"`
	ToolCalls     []StreamToolCall    `json:"tool_calls"`
}

// StreamToolCall 工具调用
type StreamToolCall struct {
	ID   string `json:"id"`
	Args any    `json:"args"`
	Name string `json:"name"`
	Type string `json:"type"`
}

// DooTaskMessage DooTask消息结构
type DooTaskMessage struct {
	Type string                `json:"Type"`
	Msg  DooTaskMessageContent `json:"Msg"`
}

// DooTaskMessageContent 消息内容
type DooTaskMessageContent struct {
	Text string  `json:"Text"`
	Type *string `json:"Type"`
}

// MessageExtractor 消息提取器接口
type MessageExtractor interface {
	ExtractText() string
	IsTextMessage() bool
}

// 实现 MessageExtractor 接口
func (m DooTaskMessage) ExtractText() string {
	if m.Type == "text" {
		return m.Msg.Text
	}
	return ""
}

func (m DooTaskMessage) IsTextMessage() bool {
	return m.Type == "text"
}

// CreateMessage 创建消息结构
type CreateMessage struct {
	Req          WebhookRequest
	Content      string           `json:"content"`
	StartTime    time.Time        `json:"start_time"`
	Status       int              `json:"status"`
	InputTokens  int              `json:"input_tokens"`
	OutputTokens int              `json:"output_tokens"`
	McpUsed      *json.RawMessage `json:"mcp_used"`
}
