package service

import (
	"bufio"
	"context"
	"dootask-ai/go-service/global"
	"dootask-ai/go-service/routes/api/agents"
	"dootask-ai/go-service/routes/api/conversations"
	"dootask-ai/go-service/utils"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	dootask "github.com/dootask/tools/server/go"

	"gorm.io/gorm"
)

// MessageHandler 消息处理器
type MessageHandler struct {
	db     *gorm.DB
	client *dootask.Client
}

// NewMessageHandler 创建消息处理器
func NewMessageHandler(db *gorm.DB, client *dootask.Client) *MessageHandler {
	return &MessageHandler{
		db:     db,
		client: client,
	}
}

// sendSSEResponse 发送SSE响应
func (h *MessageHandler) sendSSEResponse(w io.Writer, req WebhookRequest, event string, content string) {
	fmt.Fprintf(w, "id: %d\nevent: %s\ndata: {\"content\": \"%s\"}\n\n", req.SendId, event, content)

	// 确保立即刷新到客户端
	if flusher, ok := w.(http.Flusher); ok {
		flusher.Flush()
	} else {
		fmt.Printf("[WARNING] Writer不支持Flush操作\n")
	}
}

// sendDooTaskMessage 发送DooTask消息
func (h *MessageHandler) sendDooTaskMessage(req WebhookRequest, text string) {
	h.client.SendMessage(dootask.SendMessageRequest{
		DialogID:   int(req.DialogId),
		UpdateID:   int(req.SendId),
		UpdateMark: "no",
		Text:       text,
		TextType:   "md",
		Silence:    true,
	})
}

// handleTokenMessage 处理token类型消息
func (h *MessageHandler) handleTokenMessage(v StreamLineData, req WebhookRequest, w io.Writer) {
	if content, ok := v.Content.(string); ok {
		// 将实际的换行符重新转义为 \n 字符串，以便前端正确显示
		content = strings.ReplaceAll(content, "\n", "\\n")
		event := "append"
		if v.IsFirst {
			event = "replace"
		}

		h.sendSSEResponse(w, req, event, content)
	} else {
		logError("Token消息内容类型错误", nil, "type:", v.Type, "content:", fmt.Sprintf("%v", v.Content))
	}
}

// handleMessageMessage 处理message类型消息
func (h *MessageHandler) handleMessageMessage(v StreamLineData, req WebhookRequest, startTime time.Time, status int) {
	content, ok := v.Content.(map[string]any)
	if !ok {
		logError("Message消息内容类型错误", nil, "type:", v.Type, "content:", fmt.Sprintf("%v", v.Content))
		return
	}

	contentJson, err := json.Marshal(content)
	if err != nil {
		logError("Message消息JSON序列化失败", err, "type:", v.Type)
		return
	}

	var StreamMessageData StreamMessageData
	if err := json.Unmarshal(contentJson, &StreamMessageData); err != nil {
		logError("Message消息JSON反序列化失败", err, "type:", v.Type)
		return
	}

	// 处理可能包含HTML的内容
	processedContent := h.processHTMLContent(StreamMessageData.Content)

	h.createMessage(CreateMessage{
		Req:          req,
		Content:      processedContent,
		StartTime:    startTime,
		Status:       status,
		InputTokens:  StreamMessageData.UsageMetadata.InputTokens,
		OutputTokens: StreamMessageData.UsageMetadata.OutputTokens,
	})
	h.sendDooTaskMessage(req, processedContent)
}

// parseErrorContent 解析错误内容
func (h *MessageHandler) parseErrorContent(content string) (*StreamErrorData, error) {
	originalContent := content

	// 使用正则表达式匹配 "Error code: XXX - " 格式，支持任意错误码
	// 先尝试匹配标准格式
	if strings.Contains(content, "Error code:") {
		// 查找 "Error code: " 后面的第一个 " - " 分隔符
		errorCodePrefix := "Error code:"
		startIndex := strings.Index(content, errorCodePrefix)
		if startIndex != -1 {
			// 找到 " - " 分隔符的位置
			dashIndex := strings.Index(content[startIndex:], " - ")
			if dashIndex != -1 {
				// 截取 " - " 后面的内容
				content = content[startIndex+dashIndex+3:]
			}
		}
	}

	// 替换Python风格的引号和None值
	content = strings.ReplaceAll(content, "'", "\"")
	content = strings.ReplaceAll(content, "None", "null")

	var data StreamErrorData
	if err := json.Unmarshal([]byte(content), &data); err != nil {
		// JSON解析失败时，将原始content作为错误信息返回
		data.Error.Message = originalContent
		return &data, nil
	}
	return &data, nil
}

// handleErrorMessage 处理error类型消息
func (h *MessageHandler) handleErrorMessage(v StreamLineData, req WebhookRequest, w io.Writer, status int) {
	if content, ok := v.Content.(string); ok {
		processedErrorMsg := ""
		StreamErrorData, err := h.parseErrorContent(content)
		if err != nil {
			processedErrorMsg = err.Error()
			logError("错误消息解析失败", err, "type:", v.Type)
		} else {
			processedErrorMsg = h.processHTMLContent(StreamErrorData.Error.Message)
		}

		// 处理可能包含HTML的错误消息

		h.sendSSEResponse(w, req, "done", processedErrorMsg)
		h.createMessage(CreateMessage{
			Req:          req,
			Content:      processedErrorMsg,
			StartTime:    time.Now(),
			Status:       status,
			InputTokens:  0,
			OutputTokens: 0,
		})
		h.sendDooTaskMessage(req, processedErrorMsg)
	} else {
		logError("Error消息内容类型错误", nil, "type:", v.Type, "content:", fmt.Sprintf("%v", v.Content))
	}
}

// handleDone 处理结束消息
func (h *MessageHandler) handleDone(req WebhookRequest, w io.Writer) {
	h.sendSSEResponse(w, req, "done", "")
}

// handleMessage 根据消息类型分发处理
func (h *MessageHandler) handleMessage(v StreamLineData, req WebhookRequest, w io.Writer, startTime time.Time, status int) {
	switch v.Type {
	case "token", "thinking", "tool":
		h.handleTokenMessage(v, req, w)
	case "message":
		h.handleMessageMessage(v, req, startTime, status)
	case "error":
		h.handleErrorMessage(v, req, w, status)
	default:
		logError("未知消息类型", nil, "type:", v.Type, "send_id:", fmt.Sprintf("%d", req.SendId))
	}
}

// createMessage 创建消息
func (h *MessageHandler) createMessage(createMessage CreateMessage) {
	// 获取对话
	var agent agents.Agent
	if err := global.DB.Where("bot_id = ?", createMessage.Req.BotUid).First(&agent).Error; err != nil {
		logError("查询智能体失败", err, "bot_id:", fmt.Sprintf("%d", createMessage.Req.BotUid))
		return
	}

	var conversation conversations.Conversation
	dialogId := strconv.Itoa(int(createMessage.Req.DialogId))
	userID := strconv.Itoa(int(createMessage.Req.MsgUid))
	if err := h.db.Where("agent_id = ? AND dootask_user_id = ? AND dootask_chat_id = ?", agent.ID, userID, dialogId).First(&conversation).Error; err != nil {
		logError("查询对话失败", err, "dialog_id:", dialogId, "user_id:", userID)
		return
	}

	// 计算响应时间
	responseTimeMs := int(time.Since(createMessage.StartTime).Milliseconds())

	// 使用rune处理Unicode字符，确保正确截取多字节字符
	runes := []rune(createMessage.Content)
	if len(runes) > 200 {
		createMessage.Content = string(runes[:200]) + "..."
	}

	// 创建AI回复消息
	message := conversations.Message{
		ConversationID: conversation.ID,
		SendID:         createMessage.Req.SendId,
		Role:           "assistant",
		Content:        createMessage.Content,
		ResponseTimeMs: &responseTimeMs,
		Status:         createMessage.Status,
		TokensUsed:     createMessage.OutputTokens,
	}
	if createMessage.McpUsed != nil {
		message.McpUsed = *createMessage.McpUsed
	}
	h.db.Create(&message)
	// 更新用户提问消息的token使用量
	h.db.Model(&conversations.Message{}).
		Where("conversation_id = ? AND role = ? AND send_id = ?", conversation.ID, "user", createMessage.Req.SendId).
		Updates(map[string]interface{}{
			"tokens_used": createMessage.InputTokens,
		})
}

// logError 统一错误日志格式
func logError(message string, err error, fields ...string) {
	if err != nil {
		fmt.Printf("[ERROR] %s: %v | %s\n", message, err, strings.Join(fields, " | "))
	} else {
		fmt.Printf("[ERROR] %s | %s\n", message, strings.Join(fields, " | "))
	}
}

// writeAIResponseToRedis 写入AI响应到Redis
func (h *MessageHandler) writeAIResponseToRedis(ctx context.Context, body io.ReadCloser, req WebhookRequest, startTime time.Time) {
	defer func() {
		redisKey := fmt.Sprintf("stream_message:%s", req.StreamId)
		// 确保写入协程结束时发送结束信号
		global.Redis.LPush(context.Background(), redisKey, "[DONE]")
		// 设置过期时间，防止客户端未消费导致内存泄漏
		global.Redis.Expire(context.Background(), redisKey, 10*time.Minute)
	}()

	reader := bufio.NewReader(body)

	var tokenBuffer []string
	var currentMessageType string = "token" // 默认消息类型
	lastCompressTime := time.Now()
	// 获取流间隔时间
	streamInterval, _ := strconv.Atoi(utils.GetEnvWithDefault("AI_STREAM_INTERVAL", "100"))
	compressInterval := time.Duration(streamInterval) * time.Millisecond

	// 压缩并写入Redis的函数
	compressAndWrite := func(messageType string) {
		if len(tokenBuffer) > 0 {
			combinedContent := strings.Join(tokenBuffer, "")
			compressedMessage := StreamLineData{
				Type:    messageType,
				Content: combinedContent,
			}
			if jsonData, err := json.Marshal(compressedMessage); err == nil {
				global.Redis.LPush(context.Background(), fmt.Sprintf("stream_message:%s", req.StreamId), string(jsonData))
			}
			tokenBuffer = tokenBuffer[:0]
		}
	}

	for {
		select {
		case <-ctx.Done():
			compressAndWrite(currentMessageType)
			logError("AI响应读取超时", nil, "stream_id:", req.StreamId)
			return
		default:
		}

		line, err := reader.ReadString('\n')
		if err != nil {
			if err.Error() == "EOF" {
				compressAndWrite(currentMessageType)
				break
			}
			logError("读取数据失败", err)
			break
		}

		if after, ok := strings.CutPrefix(line, "data:"); ok {
			line = strings.TrimSpace(after)
		}

		if line == "[DONE]" {
			compressAndWrite(currentMessageType)
			break
		}

		var v StreamLineData
		if err := json.Unmarshal([]byte(line), &v); err != nil {
			continue
		}

		if v.Content == nil || v.Content == "" {
			continue
		}

		if v.Type == "token" || v.Type == "thinking" {
			if content, ok := v.Content.(string); ok {
				currentMessageType = v.Type // 更新当前消息类型
				tokenBuffer = append(tokenBuffer, content)
				if time.Since(lastCompressTime) >= compressInterval {
					compressAndWrite(v.Type)
					lastCompressTime = time.Now()
				}
			}
		} else {
			if v.Type == "message" {
				contentJson, _ := json.Marshal(v.Content)
				var toolData StreamToolData
				if err := json.Unmarshal(contentJson, &toolData); err == nil {
					if toolData.Type == "tool" {
						continue
					}
					if toolData.Type == "ai" {
						if len(toolData.ToolCalls) > 0 {
							currentMessageType = "tool"
							mcpUsed := []string{}
							for _, toolCall := range toolData.ToolCalls {
								content := fmt.Sprintf("#### MCP工具调用: %s\n", toolCall.Name)
								tokenBuffer = append(tokenBuffer, content)
								if time.Since(lastCompressTime) >= compressInterval {
									v.Type = "tool"
									v.Content = content
									compressAndWrite(v.Type)
									lastCompressTime = time.Now()
								}
								mcpUsed = append(mcpUsed, toolCall.Name)
							}
							mcpUsedJson, _ := json.Marshal(mcpUsed)
							h.createMessage(CreateMessage{
								Req:          req,
								Content:      "MCP工具调用",
								StartTime:    startTime,
								Status:       1,
								InputTokens:  toolData.UsageMetadata.InputTokens,
								OutputTokens: toolData.UsageMetadata.OutputTokens,
								McpUsed:      (*json.RawMessage)(&mcpUsedJson),
							})
							continue
						}
					}
				}
			}
			global.Redis.LPush(context.Background(), fmt.Sprintf("stream_message:%s", req.StreamId), line)
		}
	}
}

// processHTMLContent 处理可能包含HTML的内容，转换为Markdown
func (h *MessageHandler) processHTMLContent(content string) string {
	// 检查内容是否包含HTML标签
	if !h.containsHTML(content) {
		return content
	}

	// 转换HTML为Markdown
	markdown, err := utils.HTMLToMarkdown(content)
	if err != nil {
		logError("HTML转换为Markdown失败", err, "content_length:", fmt.Sprintf("%d", len(content)))
		// 如果转换失败，返回原内容
		return content
	}

	return markdown
}

// containsHTML 简单检查内容是否包含HTML标签
func (h *MessageHandler) containsHTML(content string) bool {
	// 检查常见的HTML标签
	htmlTags := []string{"<p>", "<div>", "<span>", "<a>", "<img>", "<br>", "<h1>", "<h2>", "<h3>", "<h4>", "<h5>", "<h6>", "<ul>", "<ol>", "<li>", "<strong>", "<b>", "<em>", "<i>", "<code>", "<pre>", "<blockquote>"}

	contentLower := strings.ToLower(content)
	for _, tag := range htmlTags {
		if strings.Contains(contentLower, tag) {
			return true
		}
	}

	return false
}

// 错误处理函数
func (h *MessageHandler) handleError(w io.Writer, req WebhookRequest, message string) bool {
	logError(message, nil, "stream_id:", req.StreamId)
	h.sendSSEResponse(w, req, "error", message)
	return false
}
