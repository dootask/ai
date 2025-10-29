package global

import (
	"dootask-ai/go-service/utils"
	"errors"

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
func GetDooTaskUser(c *gin.Context) (*dootask.UserInfo, error) {
	if c == nil {
		return nil, errors.New("context is nil")
	}
	if v, ok := c.Get(CtxKeyAuthError); ok && v != nil {
		if err, ok2 := v.(error); ok2 && err != nil {
			return nil, err
		}
	}
	v, ok := c.Get(CtxKeyDooTaskUser)
	if !ok || v == nil {
		return nil, errors.New("not_authenticated")
	}
	user, ok := v.(*dootask.UserInfo)
	if !ok || user == nil {
		return nil, errors.New("invalid_user_context")
	}
	return user, nil
}

// MustGetDooTaskUser 获取用户信息，若不存在则直接返回未认证错误
func MustGetDooTaskUser(c *gin.Context) *dootask.UserInfo {
	user, err := GetDooTaskUser(c)
	if err != nil {
		// 仅返回 nil，由调用方决定如何处理（大多数路由由鉴权中间件保护）
		return nil
	}
	return user
}
