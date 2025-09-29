package middleware

import (
	"fmt"

	"github.com/gin-gonic/gin"
)

// BaseMiddleware 基础中间件
func BaseMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 基础地址
		scheme := "http"
		if c.Request.TLS != nil || c.GetHeader("X-Forwarded-Proto") == "https" {
			scheme = "https"
		}
		// 检查是否有 server_url 查询参数
		serverURL := c.Query("server_url")
		if serverURL != "" {
			// 如果有 server_url 参数，直接使用它
			c.Set("base_url", serverURL)
		} else {
			// 否则使用原来的逻辑
			host := c.GetHeader("X-Forwarded-Host")
			if host == "" {
				host = c.Request.Host
			}
			c.Set("base_url", fmt.Sprintf("%s://%s", scheme, host))
		}
		c.Set("host", fmt.Sprintf("%s://%s", scheme, c.Request.Host))
		// 语言偏好
		lang := c.GetHeader("Language")
		if lang == "" {
			lang = c.GetString("Accept-Language")
		}
		if lang == "" {
			lang = "en-US"
		}
		c.Set("lang", lang)

		c.Next()
	}
}
