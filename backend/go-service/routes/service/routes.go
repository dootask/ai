package service

import (
	"context"
	"dootask-ai/go-service/global"
	"dootask-ai/go-service/routes/api/agents"
	aimodels "dootask-ai/go-service/routes/api/ai-models"
	"dootask-ai/go-service/routes/api/conversations"
	knowledgebases "dootask-ai/go-service/routes/api/knowledge-bases"
	mcptools "dootask-ai/go-service/routes/api/mcp-tools"
	"dootask-ai/go-service/utils"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	dootask "github.com/dootask/tools/server/go"
	"gorm.io/gorm"

	"github.com/duke-git/lancet/v2/convertor"
	"github.com/duke-git/lancet/v2/random"
	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

const (
	// 流式处理超时时间
	StreamTimeout = 5 * time.Minute
	// Redis读取超时时间
	RedisReadTimeout = 5 * time.Second
)

// Handler 机器人webhook处理器
type Handler struct {
}

// RegisterRoutes 注册路由
func RegisterRoutes(r *gin.RouterGroup) {
	handler := &Handler{}
	serviceGroup := r.Group("/service")
	{
		serviceGroup.POST("/webhook", handler.Webhook)
		serviceGroup.GET("/stream/:streamId", handler.Stream)
	}
}

// Webhook 机器人webhook
func (h *Handler) Webhook(c *gin.Context) {
	var req WebhookRequest
	if err := c.ShouldBindWith(&req, binding.FormPost); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    "VALIDATION_001",
			"message": "请求数据格式错误",
			"data":    err.Error(),
		})
		return
	}

	// 群聊且没有@机器人，不处理
	if req.DialogType == "group" && req.Mention == 0 {
		return
	}

	// 设置 DooTask 客户端
	client := utils.NewDooTaskClient(req.Token)
	global.DooTaskClient = &client

	// 检查智能体是否存在
	var agent agents.Agent
	if err := global.DB.Where("bot_id = ?", req.BotUid).First(&agent).Error; err != nil {
		global.DooTaskClient.Client.SendMessage(dootask.SendMessageRequest{
			DialogID: int(req.DialogId),
			Text:     "智能体不存在",
			Silence:  true,
		})
		return
	}

	// 检查智能体是否启用
	if !agent.IsActive {
		global.DooTaskClient.Client.SendMessage(dootask.SendMessageRequest{
			DialogID: int(req.DialogId),
			Text:     "智能体未启用",
			Silence:  true,
		})
		return
	}

	// 创建一条消息
	var response map[string]any
	global.DooTaskClient.Client.SendMessage(dootask.SendMessageRequest{
		DialogID:   int(req.DialogId),
		Text:       "...",
		TextType:   "md",
		Silence:    true,
		ReplyID:    int(req.MsgId),
		ReplyCheck: "yes",
	}, &response)
	req.SendId, _ = convertor.ToInt(response["id"])

	// 生成随机流ID
	req.StreamId = random.RandString(6)
	global.Redis.Set(context.Background(), fmt.Sprintf("stream:%s", req.StreamId), convertor.ToString(req), time.Minute*10)

	// 通知 Stream 服务
	global.DooTaskClient.Client.SendStreamMessage(dootask.SendStreamMessageRequest{
		UserID:    int(req.MsgUid),
		StreamURL: fmt.Sprintf("%s/service/stream/%s", c.GetString("base_url"), req.StreamId),
	})

	// 获取消息 map 转 json
	webhookResponse, err := h.parseWebhookResponse(response)
	if err != nil {
		fmt.Println("解析响应数据失败:", err)
		return
	}

	// 创建对话
	var conversation conversations.Conversation
	dialogId := strconv.Itoa(webhookResponse.DialogID)
	userID := strconv.Itoa(int(agent.UserID))
	if err := global.DB.Where("agent_id = ? AND dootask_chat_id = ? AND dootask_user_id = ?", agent.ID, dialogId, userID).First(&conversation).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			conversation = conversations.Conversation{
				AgentID:       agent.ID,
				DootaskChatID: dialogId,
				DootaskUserID: userID,
				IsActive:      true,
			}
			if err := global.DB.Create(&conversation).Error; err != nil {
				fmt.Println("创建对话失败:", err)
				return
			}
		} else {
			fmt.Println("查询对话失败:", err)
			return
		}
	}

	// 使用rune处理Unicode字符，确保正确截取多字节字符
	text := h.buildUserMessage(req)
	runes := []rune(text)
	if len(runes) > 200 {
		text = string(runes[:200]) + "..."
	}

	message := conversations.Message{
		ConversationID: conversation.ID,
		SendID:         req.SendId,
		Role:           "user",
		Content:        text,
	}
	if err := global.DB.Create(&message).Error; err != nil {
		fmt.Println("创建消息失败:", err)
		return
	}
}

// Stream 流式消息
func (h *Handler) Stream(c *gin.Context) {
	// 设置响应头
	c.Header("Content-Type", "text/event-stream; charset=utf-8")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	// 获取流ID
	streamId := c.Param("streamId")

	cache, err := global.Redis.Get(context.Background(), fmt.Sprintf("stream:%s", streamId)).Result()

	// 判断流式消息是否存在
	if err != nil {
		c.String(http.StatusOK, "id: %d\nevent: %s\ndata: {\"error\": \"%s\"}\n\n", 0, "done", "流式消息不存在")
		return
	}

	// 反序列化流式消息
	var req WebhookRequest
	if err := json.Unmarshal([]byte(cache), &req); err != nil {
		c.String(http.StatusOK, "id: %d\nevent: %s\ndata: {\"error\": \"%s\"}\n\n", 0, "done", "流式消息错误")
		return
	}

	// 检查智能体是否存在
	var agent agents.Agent
	if err := global.DB.Where("bot_id = ?", req.BotUid).First(&agent).Error; err != nil {
		c.String(http.StatusOK, "id: %d\nevent: %s\ndata: {\"error\": \"%s\"}\n\n", 0, "done", "智能体不存在")
		return
	}

	// 检查智能体是否启用
	if !agent.IsActive {
		c.String(http.StatusOK, "id: %d\nevent: %s\ndata: {\"error\": \"%s\"}\n\n", 0, "done", "智能体未启用")
		return
	}

	// 检查AI模型是否存在
	var aiModel aimodels.AIModel
	if err := global.DB.Where("id = ?", agent.AIModelID).First(&aiModel).Error; err != nil {
		c.String(http.StatusOK, "id: %d\nevent: %s\ndata: {\"error\": \"%s\"}\n\n", 0, "done", "AI模型不存在")
		return
	}

	// 检查AI模型是否启用
	if aiModel.IsEnabled == nil || !*aiModel.IsEnabled {
		c.String(http.StatusOK, "id: %d\nevent: %s\ndata: {\"error\": \"%s\"}\n\n", 0, "done", "AI模型未启用")
		return
	}
	// 防重复请求：检查是否已经有客户端在处理这个流
	lockKey := fmt.Sprintf("stream_lock:%s", streamId)
	isLocked, err := global.Redis.SetNX(context.Background(), lockKey, "1", time.Minute*5).Result()

	var needRequestAI bool = false
	if err == nil && isLocked {
		// 获取锁成功，需要请求AI
		needRequestAI = true
		// 确保在函数结束时释放锁
		defer global.Redis.Del(context.Background(), lockKey)
	}
	// 如果锁已存在，直接进入流式处理，从Redis读取数据

	// 创建 DooTask 客户端
	client := utils.NewDooTaskClient(req.Token)
	global.DooTaskClient = &client

	// 创建带超时的context
	ctx, cancel := context.WithTimeout(context.Background(), StreamTimeout)
	defer func() {
		cancel()
		// 清理Redis资源
		global.Redis.Del(context.Background(), fmt.Sprintf("stream_message:%s", req.StreamId))
	}()

	// 创建消息处理器
	handler := NewMessageHandler(global.DB, global.DooTaskClient.Client)
	// 记录开始时间
	startTime := time.Now()

	// 如果需要请求AI，启动协程写入AI响应到Redis
	if needRequestAI {
		// 请求AI
		resp, err := h.requestAI(aiModel, agent, req)
		if err != nil {
			c.String(http.StatusOK, "id: %d\nevent: %s\ndata: {\"error\": \"%s\"}\n\n", 0, "done", err.Error())
			return
		}
		defer resp.Body.Close()

		// 启动协程写入AI响应到Redis
		go handler.writeAIResponseToRedis(ctx, resp.Body, req, startTime)
	}

	// 流式消息读取，阻塞式BRPop
	isFirstLine := true

	previousMessageType := ""

	c.Stream(func(w io.Writer) bool {
		for {
			// 检查context是否已取消
			select {
			case <-ctx.Done():
				return handler.handleError(w, req, "响应超时，请重试")
			default:
				// 继续处理
			}

			// 阻塞式读取，超时5秒
			result, err := global.Redis.BRPop(ctx, RedisReadTimeout, fmt.Sprintf("stream_message:%s", req.StreamId)).Result()
			if err != nil {
				if err.Error() == "redis: nil" {
					// 超时无数据，继续等待
					continue
				}
				return handler.handleError(w, req, "获取响应失败")
			}
			// BRPop返回[key, value]
			line := result[1]

			if after, ok := strings.CutPrefix(line, "data:"); ok {
				line = strings.TrimSpace(after)
			}

			if line == "[DONE]" {
				handler.handleDone(req, w)
				return false
			}

			var v StreamLineData
			if err := json.Unmarshal([]byte(line), &v); err != nil {
				if len(line) > 1 {
					logError("JSON解析失败", err, "line:", line)
				}
				continue
			}

			if v.Type == "thinking" {
				if isFirstLine {
					v.Content = fmt.Sprintf("::: reasoning\\n%s", v.Content)
				}
				v.IsFirst = isFirstLine
				isFirstLine = false
				previousMessageType = v.Type
			}

			if v.Type == "token" || v.Type == "tool" {
				if previousMessageType == "thinking" {
					isFirstLine = true
					previousMessageType = ""
				}
				v.IsFirst = isFirstLine
				isFirstLine = false
			}

			handler.handleMessage(v, req, w, startTime, 1)
		}
	})
}

// 解析响应数据
func (h *Handler) parseWebhookResponse(response map[string]any) (*WebhookResponse, error) {
	responseJson, err := json.Marshal(response)
	if err != nil {
		fmt.Println("解析响应数据失败:", err)
		return nil, err
	}

	var webhookResponse WebhookResponse
	if err := json.Unmarshal(responseJson, &webhookResponse); err != nil {
		fmt.Println("解析响应数据失败:", err)
		return nil, err
	}

	return &webhookResponse, nil
}

// 请求AI
func (h *Handler) requestAI(aiModel aimodels.AIModel, agent agents.Agent, req WebhookRequest) (*http.Response, error) {
	baseURL := utils.GetEnvWithDefault("AI_BASE_URL", fmt.Sprintf("http://localhost:%s", utils.GetEnvWithDefault("PYTHON_AI_SERVICE_PORT", "8001")))
	requestTimeout, _ := strconv.Atoi(utils.GetEnvWithDefault("AI_REQUEST_TIMEOUT", "60"))

	httpClient := utils.NewHTTPClient(
		baseURL,
		utils.WithTimeout(time.Duration(requestTimeout)*time.Second),
	)

	agentConfig := map[string]any{
		"api_key":     aiModel.ApiKey,
		"api_version": "",
		"base_url":    aiModel.BaseURL,
		"credentials": "",
		"proxy_url":   aiModel.ProxyURL,
		"prompt":      agent.Prompt,
		"spicy_level": 0,
	}
	if !aiModel.IsThinking {
		agentConfig["temperature"] = aiModel.Temperature
	}

	threadId := fmt.Sprintf("%d_%d", req.DialogId, req.SessionId)
	if req.DialogType == "group" {
		threadId = ""
	}

	text := h.buildUserMessage(req)
	if text == "" {
		return nil, errors.New("用户消息为空")
	}

	// 发送POST请求获取流式响应
	data := map[string]any{
		"message":       text,
		"provider":      aiModel.Provider,
		"model":         aiModel.ModelName,
		"thread_id":     threadId,
		"user_id":       strconv.Itoa(int(agent.UserID)),
		"agent_config":  agentConfig,
		"stream_tokens": true,
	}

	var (
		path      = "/stream"
		isUseTool = false
		isUseRag  = false
		ragConfig = []map[string]any{}
		mcpConfig = map[string]any{}
	)

	// 检查是否使用RAG
	if agent.KnowledgeBases != nil {
		var kbs []knowledgebases.KnowledgeBase
		var kbIds []int64
		json.Unmarshal([]byte(agent.KnowledgeBases), &kbIds)
		global.DB.Where("id in (?) AND is_active = ?", kbIds, true).Find(&kbs)
		if len(kbs) > 0 {
			isUseRag = true
			path = "/rag_agent/stream"
			for _, kb := range kbs {
				ragConfig = append(ragConfig, map[string]any{
					"api_key":        kb.ApiKey,
					"model":          kb.EmbeddingModel,
					"provider":       kb.Provider,
					"proxy_url":      kb.ProxyURL,
					"knowledge_base": []string{kb.Name},
				})
			}
			data["rag_config"] = ragConfig
		}
	}

	// 检查是否使用MCP
	if agent.Tools != nil {
		var mcpTools []mcptools.MCPTool
		var mcpToolIds []int64
		json.Unmarshal([]byte(agent.Tools), &mcpToolIds)
		global.DB.Where("id in (?) AND is_active = ?", mcpToolIds, true).Find(&mcpTools)
		if len(mcpTools) > 0 {
			isUseTool = true
			path = "/mcp_agent/stream"
			for _, mcpTool := range mcpTools {
				var config map[string]any
				json.Unmarshal(mcpTool.Config, &config)
				transport := ""
				switch mcpTool.ConfigType {
				case 0:
					transport = "streamable_http"
				case 1:
					transport = "websocket"
				case 2:
					transport = "sse"
				case 3:
					transport = "stdio"
				default:
					transport = "streamable_http"
				}
				config["transport"] = transport
				mcpConfig[mcpTool.McpName] = config
			}
			data["mcp_config"] = mcpConfig
		}
	}

	if isUseTool && isUseRag {
		path = "/supervisor_agent/stream"
	}

	resp, err := httpClient.Stream(context.Background(), path, nil, nil, http.MethodPost, data, "application/json")
	if err != nil {
		return nil, errors.New("请求AI失败")
	}

	return resp, nil
}

// 构建用户消息
func (h *Handler) buildUserMessage(req WebhookRequest) string {
	text := ""
	if req.DialogType == "group" {
		messageList, err := global.DooTaskClient.Client.GetMessageList(dootask.GetMessageListRequest{
			DialogID: int(req.DialogId),
			Take:     10,
		})
		if err != nil {
			fmt.Println("获取消息列表失败:", err)
		}

		// 使用辅助函数提取文本消息
		text = extractTextFromMessages(messageList)
	} else {
		text = req.Text
		if req.ReplyText != "" {
			text = fmt.Sprintf("<quoted_content>\n%s\n</quoted_content>\n\n%s", req.ReplyText, text)
		} else {
			var tagPath = []string{"<!--task", "<!--path", "<!--report", "<!--file"}
			if strings.ContainsFunc(text, func(r rune) bool {
				for _, tag := range tagPath {
					if strings.Contains(text, tag) {
						return true
					}
				}
				return false
			}) {
				convertMessage, err := global.DooTaskClient.Client.ConvertWebhookMessageToAI(dootask.ConvertWebhookMessageRequest{
					Msg: text,
				})
				if err != nil {
					fmt.Println("转换消息失败:", err)
				}
				text = convertMessage.Msg
			}
		}
	}

	return text
}

// parseMessageFromAny 将any类型安全地转换为DooTaskMessage
func parseMessageFromAny(message any) (*DooTaskMessage, error) {
	messageBytes, err := json.Marshal(message)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal message: %w", err)
	}

	var dooTaskMsg DooTaskMessage
	if err := json.Unmarshal(messageBytes, &dooTaskMsg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal to DooTaskMessage: %w", err)
	}

	return &dooTaskMsg, nil
}

// extractTextFromMessages 从消息列表中提取所有文本内容
func extractTextFromMessages(messageList any) string {
	var text strings.Builder

	// 尝试解析为包含List字段的结构
	if messageBytes, err := json.Marshal(messageList); err == nil {
		var listContainer struct {
			List []any `json:"List"`
		}

		if err := json.Unmarshal(messageBytes, &listContainer); err == nil {
			// slices反转
			slices.Reverse(listContainer.List)
			for _, message := range listContainer.List {
				if dooTaskMsg, err := parseMessageFromAny(message); err == nil {
					switch dooTaskMsg.Type {
					case "text":
						if dooTaskMsg.Msg.Type != nil {
							if *dooTaskMsg.Msg.Type == "md" {
								text.WriteString(fmt.Sprintf("%s\n\n", dooTaskMsg.ExtractText()))
							} else {
								md, err := utils.HTMLToMarkdown(dooTaskMsg.ExtractText())
								if err != nil {
									fmt.Println("转换HTML为Markdown失败:", err)
								}
								text.WriteString(fmt.Sprintf("%s\n\n", md))
							}
						} else {
							md, err := utils.HTMLToMarkdown(dooTaskMsg.ExtractText())
							if err != nil {
								log.Fatal(err)
							}
							text.WriteString(fmt.Sprintf("%s\n\n", md))
						}
					}
				}
			}
		}
	}

	return text.String()
}
