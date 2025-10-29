package mcptools

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"dootask-ai/go-service/global"

	"gorm.io/gorm"
)

// 健康检查URL
var (
	HealthCheckURL     = "http://nginx/apps/mcp_server/healthz"
	AutoMCPToolName    = "dootask-mcp"
	AutoMCPToolMcpName = "dootaskmcp"
	AutoMCPDescription = "系统自动创建的dootaskMCP工具"
	AutoMCPCategory    = "dootask"
)

// 健康检查响应结构
type HealthCheckResponse struct {
	Status string `json:"status"`
}

// 初始化定时任务
func InitMCPScheduler() {
	// 启动时立即执行一次检查
	go checkAndCreateMCPTool()

	// 每10分钟执行一次
	ticker := time.NewTicker(10 * time.Minute)
	go func() {
		for range ticker.C {
			checkAndCreateMCPTool()
		}
	}()
}

// 检查健康状态并创建MCP工具
func checkAndCreateMCPTool() {
	// 检查健康状态
	if !checkHealthStatus() {
		fmt.Printf("MCP服务健康检查失败，跳过创建工具")
		return
	}

	// 检查是否已存在自动创建的MCP工具
	var existingTool MCPTool
	err := global.DB.Where("mcp_name = ?", AutoMCPToolMcpName).First(&existingTool).Error
	if err == nil {
		fmt.Printf("自动MCP工具已存在，ID: %d", existingTool.ID)
		return
	} else if err != gorm.ErrRecordNotFound {
		fmt.Printf("查询自动MCP工具失败: %v", err)
		return
	}

	// 创建MCP工具配置
	config := map[string]interface{}{
		"url": "http://nginx/apps/mcp_server/mcp",
	}
	configBytes, err := json.Marshal(config)
	if err != nil {
		fmt.Printf("序列化MCP工具配置失败: %v", err)
		return
	}

	// 创建MCP工具
	tool := MCPTool{
		UserID:      0,
		Name:        AutoMCPToolName,
		McpName:     AutoMCPToolMcpName,
		Description: &AutoMCPDescription,
		Category:    AutoMCPCategory,
		ConfigType:  ConfigTypeStreamableHTTP,
		Config:      configBytes,
		IsActive:    true,
	}

	if err := global.DB.Create(&tool).Error; err != nil {
		fmt.Printf("创建自动MCP工具失败: %v", err)
		return
	}

	fmt.Printf("自动创建MCP工具成功，ID: %d", tool.ID)

}

// 检查健康状态
func checkHealthStatus() bool {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Get(HealthCheckURL)
	if err != nil {
		fmt.Printf("健康检查请求失败: %v", err)
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		fmt.Printf("健康检查返回非200状态码: %d", resp.StatusCode)
		return false
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Printf("读取健康检查响应失败: %v", err)
		return false
	}

	var healthResp HealthCheckResponse
	if err := json.Unmarshal(body, &healthResp); err != nil {
		fmt.Printf("解析健康检查响应失败: %v", err)
		return false
	}

	return healthResp.Status == "ok"
}
