package global

import (
	"dootask-ai/go-service/utils"

	dootask "github.com/dootask/tools/server/go"
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

var (
	EnvFile   string              // 环境变量文件
	Validator *validator.Validate // 验证器
	DB        *gorm.DB            // 数据库连接
	Redis     *redis.Client       // Redis客户端

	DooTaskClient *utils.DooTaskClient // DooTask客户端
	DooTaskUser   *dootask.UserInfo    // DooTask用户信息
	DooTaskError  error                // DooTask错误
)

// 请求上下文中的键名
const (
	CtxKeyDooTaskUser   = "dooTaskUser"
	CtxKeyDooTaskClient = "dooTaskClient"
	CtxKeyAuthError     = "authError"
)

// GetDooTaskUser 从 gin 上下文中获取用户信息
func GetDooTaskUser(c *gin.Context) *dootask.UserInfo {
	if c == nil {
		return nil
	}
	if v, ok := c.Get(CtxKeyAuthError); ok && v != nil {
		if err, ok2 := v.(error); ok2 && err != nil {
			return nil
		}
	}
	v, ok := c.Get(CtxKeyDooTaskUser)
	if !ok || v == nil {
		return nil
	}
	user, ok := v.(*dootask.UserInfo)
	if !ok || user == nil {
		return nil
	}
	return user
}

func GetDooTaskClient(c *gin.Context) *utils.DooTaskClient {
	v, ok := c.Get(CtxKeyDooTaskClient)
	if !ok || v == nil {
		return nil
	}
	client, ok := v.(*utils.DooTaskClient)
	if !ok || client == nil {
		return nil
	}
	return client
}
