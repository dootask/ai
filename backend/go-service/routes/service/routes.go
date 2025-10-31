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
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
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
	// Redis读取超时时间 - 减少超时时间避免连接池耗尽
	RedisReadTimeout = 2 * time.Second
	// Redis连接最大空闲时间
	RedisMaxIdleTime = 30 * time.Second
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
	if err := c.Request.ParseForm(); err == nil {
		form := c.Request.PostForm
		msgUser := WebhookMsgUser{}

		// 解析msg_user相关字段
		if userid, err := strconv.ParseInt(form.Get("msg_user[userid]"), 10, 64); err == nil {
			msgUser.Userid = userid
		}
		msgUser.Email = form.Get("msg_user[email]")
		msgUser.Nickname = form.Get("msg_user[nickname]")
		msgUser.Profession = form.Get("msg_user[profession]")
		msgUser.Lang = form.Get("msg_user[lang]")
		msgUser.Token = form.Get("msg_user[token]")

		req.MsgUser = msgUser

		// 3. 解析extras字段
		extrasStr := form.Get("extras")
		if extrasStr != "" {
			var extras map[string]any
			if err := json.Unmarshal([]byte(extrasStr), &extras); err == nil {
				req.Extras = extras
			}
		}
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
		log.Printf("解析响应数据失败: %v", err)
		return
	}

	// 创建对话
	var conversation conversations.Conversation
	dialogId := strconv.Itoa(webhookResponse.DialogID)
	userID := strconv.Itoa(int(req.MsgUid))
	if err := global.DB.Where("agent_id = ? AND dootask_chat_id = ? AND dootask_user_id = ?", agent.ID, dialogId, userID).First(&conversation).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			conversation = conversations.Conversation{
				AgentID:       agent.ID,
				DootaskChatID: dialogId,
				DootaskUserID: userID,
				IsActive:      true,
			}
			if err := global.DB.Create(&conversation).Error; err != nil {
				log.Printf("创建对话失败: %v", err)
				return
			}
		} else {
			log.Printf("查询对话失败: %v", err)
			return
		}
	}
	if req.Extras == nil {
		req.Extras = make(map[string]any)
	}

	req.Extras["base_url"] = c.GetString("host")
	// 使用rune处理Unicode字符，确保正确截取多字节字符
	text, err := h.buildUserMessage(req)
	if err != nil {
		log.Printf("构建用户消息失败: %v", err)
		return
	}
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
		log.Printf("创建消息失败: %v", err)
		return
	}
}

// Stream 流式消息
func (h *Handler) Stream(c *gin.Context) {
	// 设置响应头
	c.Header("Content-Type", "text/event-stream; charset=utf-8")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Headers", "Cache-Control")
	c.Header("X-Accel-Buffering", "no")

	// 立即刷新响应头到客户端
	c.Writer.Flush()

	// 获取流ID
	streamId := c.Param("streamId")

	// 检查请求是否正在处理
	streamKey := fmt.Sprintf("stream_processing:%s", streamId)
	isNewRequest, err := global.Redis.SetNX(context.Background(), streamKey, 1, 3*time.Minute).Result()
	if err != nil {
		c.String(http.StatusOK, "id: %d\nevent: %s\ndata: {\"error\": \"%s\"}\n\n", 0, "done", "检查流状态失败")
		return
	}

	// 如果不是新请求，直接从Redis读取数据
	if !isNewRequest {
		h.streamFromRedis(c)
		return
	}

	// 是新请求，启动goroutine请求AI并将结果存入Redis
	go func() {
		// 在goroutine结束时删除处理标记
		// defer global.Redis.Del(context.Background(), streamKey)

		cache, err := global.Redis.Get(context.Background(), fmt.Sprintf("stream:%s", streamId)).Result()
		if err != nil {
			// 无法直接向客户端发送错误，记录日志
			c.String(http.StatusOK, "id: %d\nevent: %s\ndata: {\"error\": \"%s\"}\n\n", 0, "done", "获取流缓存失败")
			return
		}

		var req WebhookRequest
		if err := json.Unmarshal([]byte(cache), &req); err != nil {
			c.String(http.StatusOK, "id: %d\nevent: %s\ndata: {\"error\": \"%s\"}\n\n", 0, "done", "解析流缓存失败")
			return
		}

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
		req.Extras["base_url"] = c.GetString("host")

		// 请求AI
		resp, err := h.requestAI(aiModel, agent, req)

		if err != nil {
			errorMsg := fmt.Sprintf(`{"type":"error","content":"%s"}`, err.Error())
			key := fmt.Sprintf("stream_message:%s", streamId)
			channel := fmt.Sprintf("stream_message_pub:%s", streamId)
			global.Redis.LPush(context.Background(), key, errorMsg)
			global.Redis.Publish(context.Background(), channel, errorMsg)
			global.Redis.LPush(context.Background(), key, "[DONE]")
			global.Redis.Publish(context.Background(), channel, "[DONE]")
			return
		}
		defer resp.Body.Close()

		client := utils.NewDooTaskClient(req.Token)
		global.DooTaskClient = &client

		handler := NewMessageHandler(global.DB, global.DooTaskClient.Client)
		startTime := time.Now()

		// 写入AI响应到Redis
		handler.writeAIResponseToRedis(context.Background(), resp.Body, req, startTime)

	}()

	// 主线程也从Redis读取并返回给客户端
	h.streamFromRedis(c)
}

// streamFromRedis 从Redis读取流式数据并发送到客户端（支持多个并发订阅者）
func (h *Handler) streamFromRedis(c *gin.Context) {
	streamId := c.Param("streamId")

	// 获取请求信息
	req, handler, err := h.initStreamHandler(streamId)
	if err != nil {
		c.String(http.StatusOK, "id: %d\nevent: %s\ndata: {\"error\": \"%s\"}\n\n", 0, "done", err.Error())
		return
	}

	// 创建带超时的上下文
	ctx, cancel := context.WithTimeout(context.Background(), StreamTimeout)
	defer cancel()

	// 流式状态管理
	state := &StreamState{
		isFirstLine:         true,
		previousMessageType: "",
		startTime:           time.Now(),
	}

	key := fmt.Sprintf("stream_message:%s", streamId)
	channel := fmt.Sprintf("stream_message_pub:%s", streamId)

	// 读取 backlog（按时间正序回放）
	backlog, _ := global.Redis.LRange(ctx, key, 0, -1).Result()
	// LPUSH 导致索引0是最新，这里倒序遍历
	blIdx := len(backlog) - 1

	// 订阅实时频道
	pubsub := global.Redis.Subscribe(ctx, channel)
	msgCh := pubsub.Channel()
	defer pubsub.Close()

	initialMsg := StreamLineData{
		Type:    "token",
		Content: "思考中,请稍候...",
		IsFirst: true,
	}
	idleMsg := StreamLineData{
		Type:    "token",
		Content: "正在努力思考中...",
		IsFirst: true,
	}

	var initialPingSent int = 0
	var idleNotified bool

	c.Stream(func(w io.Writer) bool {
		if initialPingSent == 0 && blIdx < 0 {
			handler.handleMessage(initialMsg, *req, w, state.startTime, 1, *state)
			initialPingSent = 1
			return true
		}
		// 优先回放 backlog
		if blIdx >= 0 {
			line := backlog[blIdx]
			blIdx--
			if line == "[DONE]" {
				handler.handleDone(*req, w)
				return false
			}
			var v StreamLineData
			if err := json.Unmarshal([]byte(line), &v); err != nil {
				return true
			}
			h.updateMessageState(&v, state)
			handler.handleMessage(v, *req, w, state.startTime, 1, *state)
			return true
		}

		// backlog 用尽后，进入实时订阅
		select {
		case <-ctx.Done():
			return handler.handleError(w, *req, "流式响应超时")
		case msg, ok := <-msgCh:
			if !ok {
				return handler.handleError(w, *req, "订阅通道已关闭")
			}
			line := msg.Payload
			if line == "[DONE]" {
				handler.handleDone(*req, w)
				return false
			}
			var v StreamLineData
			if err := json.Unmarshal([]byte(line), &v); err != nil {
				return true
			}
			if initialPingSent == 1 {
				initialMsg.Content = ""
				handler.handleMessage(initialMsg, *req, w, state.startTime, 1, *state)
				initialPingSent = 2
			}
			idleNotified = true
			h.updateMessageState(&v, state)
			handler.handleMessage(v, *req, w, state.startTime, 1, *state)
			return true
		case <-time.After(RedisReadTimeout):
			if !idleNotified && time.Since(state.startTime) >= 10*time.Second {
				handler.handleMessage(idleMsg, *req, w, state.startTime, 1, *state)
				idleNotified = true
				return true
			}
			return true
		}
	})
}

// initStreamHandler 初始化流处理器
func (h *Handler) initStreamHandler(streamId string) (*WebhookRequest, *MessageHandler, error) {
	cache, err := global.Redis.Get(context.Background(), fmt.Sprintf("stream:%s", streamId)).Result()
	if err != nil {
		return nil, nil, fmt.Errorf("流式消息不存在")
	}

	var req WebhookRequest
	if err := json.Unmarshal([]byte(cache), &req); err != nil {
		return nil, nil, fmt.Errorf("解析请求失败")
	}

	// 创建客户端和处理器
	client := utils.NewDooTaskClient(req.Token)
	global.DooTaskClient = &client
	handler := NewMessageHandler(global.DB, global.DooTaskClient.Client)

	return &req, handler, nil
}

// streamState 流状态管理
type StreamState struct {
	isFirstLine         bool
	previousMessageType string
	startTime           time.Time
	ThinkingEnd         bool
	ThinkingContent     string
}

// updateMessageState 更新消息状态
func (h *Handler) updateMessageState(v *StreamLineData, state *StreamState) {
	switch v.Type {
	case "thinking":
		state.ThinkingContent += fmt.Sprintf("%v", v.Content)
		if state.isFirstLine {
			v.Content = fmt.Sprintf("::: reasoning\\n%s", v.Content)
		}
		v.IsFirst = state.isFirstLine
		state.isFirstLine = false
		state.previousMessageType = v.Type
		state.ThinkingEnd = false

	case "token", "tool":
		if state.previousMessageType == "thinking" {
			v.IsFirst = true
			state.ThinkingEnd = true
			state.previousMessageType = ""
			return
		}
		v.IsFirst = false
		state.ThinkingEnd = false
	}
}

// 解析响应数据
func (h *Handler) parseWebhookResponse(response map[string]any) (*WebhookResponse, error) {
	responseJson, err := json.Marshal(response)
	if err != nil {
		log.Printf("解析响应数据失败: %v", err)
		return nil, err
	}

	var webhookResponse WebhookResponse
	if err := json.Unmarshal(responseJson, &webhookResponse); err != nil {
		log.Printf("解析响应数据失败: %v", err)
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

	text, err := h.buildUserMessage(req)
	if err != nil {
		log.Printf("requestAI buildUserMessage error: %v", err)
		return nil, err
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
	var dootaskMcp []mcptools.MCPTool
	var userConfig []agents.UserConfig

	global.DB.Where("user_id = ? AND is_active = ? AND category = ?", 0, true, "dootask").Find(&dootaskMcp)
	if req.MsgUid != 0 {
		global.DB.Where("user_id = ? AND key = ? AND value = ?", req.MsgUid, "autoAssignMCP", "0").Find(&userConfig)
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
		}
	}
	if len(dootaskMcp) > 0 && len(userConfig) == 0 {
		var dootaskConfig map[string]any
		json.Unmarshal(dootaskMcp[0].Config, &dootaskConfig)
		dootaskConfig["transport"] = "streamable_http"
		dootaskConfig["url"] = fmt.Sprintf("%s/apps/mcp_server/mcp", req.Extras["base_url"])
		if headers, ok := dootaskConfig["headers"].(map[string]any); ok {
			headers["Authorization"] = fmt.Sprintf("Bearer %s", req.MsgUser.Token)
		} else {
			dootaskConfig["headers"] = map[string]any{"Authorization": fmt.Sprintf("Bearer %s", req.MsgUser.Token)}
		}
		if req.MsgUser.Token != "" {
			isUseTool = true
			path = "/mcp_agent/stream"
			mcpConfig[dootaskMcp[0].McpName] = dootaskConfig
		}
	}
	if len(mcpConfig) > 0 {
		data["mcp_config"] = mcpConfig
	}

	if isUseTool && isUseRag {
		path = "/supervisor_agent/stream"
	}

	resp, err := httpClient.Stream(context.Background(), path, nil, nil, http.MethodPost, data, "application/json")
	if err != nil {
		return nil, err
	}

	return resp, nil
}

// 构建用户消息
func (h *Handler) buildUserMessage(req WebhookRequest) (string, error) {
	text := ""
	if req.DialogType == "group" {
		messageList, err := global.DooTaskClient.Client.GetMessageList(dootask.GetMessageListRequest{
			DialogID: int(req.DialogId),
			Take:     10,
		})
		if err != nil {
			log.Printf("获取消息列表失败: %v", err)
		}

		// 拼接所有文本，仅对最新一条进行特殊处理（标签转换）
		var builder strings.Builder

		if messageBytes, err := json.Marshal(messageList); err == nil {
			var listContainer struct {
				List []any `json:"List"`
			}
			if err := json.Unmarshal(messageBytes, &listContainer); err == nil {
				// 反转后按新->旧
				slices.Reverse(listContainer.List)
				listLength := len(listContainer.List)
				pattern := `!\[.*?\]\(.*?\)`
				re := regexp.MustCompile(pattern)
				for i, message := range listContainer.List {
					if dooTaskMsg, err := parseMessageFromAny(message); err == nil {
						var msgText string
						var reply string = ""
						isLatestHandled := (i == listLength-1) || (i == listLength-2)
						// 仅对最新一条执行标签转换
						if isLatestHandled {
							if dooTaskMsg.ReplyId > 0 {
								if dooTaskMsg.Msg.Reply != nil && dooTaskMsg.Msg.Reply.MsgType == "file" {
									decodedText, _ := url.QueryUnescape(fmt.Sprintf("![%s](%s) ", dooTaskMsg.Msg.Reply.Msg["name"], dooTaskMsg.Msg.Reply.Msg["url"]))
									reply = strings.ReplaceAll(decodedText, "{{RemoteURL}}", fmt.Sprintf("%v/", req.Extras["base_url"]))
								} else if strings.Contains(fmt.Sprint(dooTaskMsg.Msg.Reply.Msg["text"]), "<p><img") {
									reply, _ = utils.HTMLToMarkdown(fmt.Sprint(dooTaskMsg.Msg.Reply.Msg["text"]))
								}
							}

							if md, err := utils.HTMLToMarkdown(dooTaskMsg.ExtractText()); err == nil {
								msgText = reply + md
							}

							if re.MatchString(msgText) {
								decodedText, _ := url.QueryUnescape(msgText)
								msgText = strings.ReplaceAll(decodedText, "{{RemoteURL}}", fmt.Sprintf("%v/", req.Extras["base_url"]))
							}
							isLatestHandled = false
						} else {
							// 提取文本并转为 Markdown（如需）
							if dooTaskMsg.Msg.Type != nil && *dooTaskMsg.Msg.Type == "md" {
								msgText = dooTaskMsg.ExtractText()
							} else {
								if md, err := utils.HTMLToMarkdown(dooTaskMsg.ExtractText()); err == nil {
									msgText = md
								} else {
									log.Printf("转换HTML为Markdown失败: %v", err)
									msgText = dooTaskMsg.ExtractText()
								}
							}

							if re.MatchString(msgText) {
								cleanText := re.ReplaceAllString(msgText, "")
								msgText = cleanText
							}
						}

						builder.WriteString(fmt.Sprintf("%s\n\n", msgText))
					} else {
						log.Printf("消息解析失败: %v", err)
					}
				}
			}
		}

		text = builder.String()
	} else {
		text = strings.ReplaceAll(req.Text, "{{RemoteURL}}", fmt.Sprintf("%v/", req.Extras["base_url"]))

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
					log.Printf("转换消息失败: %v", err)
					return "", err
				}
				text = convertMessage.Msg

			}
		}
	}

	return text, nil
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
