package middleware

import (
	"dootask-ai/go-service/global"
	"dootask-ai/go-service/utils"
	"errors"
	"net/http"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
)

// AuthMiddleware 对接口进行鉴权
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 标记为已认证（防止重复认证）
		if c.GetBool("is_authenticated") {
			return
		}
		c.Set("is_authenticated", true)

		// 设置用户信息为空
		global.DooTaskError = errors.New("not_authenticated")

		// 从请求头获取token（优先使用环境变量）
		authToken := utils.GetEnvWithDefault("DOOTASK_API_USER_TOKEN", c.GetHeader("Authorization"))
		if after, ok := strings.CutPrefix(authToken, "Bearer "); ok {
			authToken = after
		}

		// 如果token为空，则设置用户信息为空
		if authToken == "" {
			global.DooTaskError = errors.New("token is empty")
			c.Next()
			return
		}

		// 创建DooTask客户端
		client := utils.NewDooTaskClient(authToken)
		user, err := client.Client.GetUserInfo()
		if err != nil {
			global.DooTaskError = err
			c.Next()
			return
		}

		// 设置全局变量
		global.DooTaskClient = &client
		global.DooTaskUser = user
		global.DooTaskError = nil

		c.Next()
	}
}

// UserRoleMiddleware 用户权限中间件
func UserRoleMiddleware(role ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		AuthMiddleware()(c)

		// 如果DooTask错误不为空，则返回401
		if global.DooTaskError != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": global.DooTaskError.Error()})
			c.Abort()
			return
		}

		// 判断用户是否具有指定角色
		if len(role) > 0 {
			userHasRole := slices.Contains(global.DooTaskUser.Identity, role[0])
			if !userHasRole {
				c.JSON(http.StatusForbidden, gin.H{"error": "权限不足"})
				c.Abort()
				return
			}
		}

		c.Next()
	}
}
