package database

import (
	"context"
	"fmt"
	"os"
	"time"

	"dootask-ai/go-service/global"
	"dootask-ai/go-service/pkg/utils"

	"github.com/redis/go-redis/v9"
)

// Redis连接重试配置
const (
	redisMaxRetries = 5
	redisRetryDelay = 2 * time.Second
)

// InitRedis 初始化Redis连接
func InitRedis() error {
	// 从环境变量获取Redis配置
	redisHost := os.Getenv("REDIS_HOST")
	redisPort := os.Getenv("REDIS_PORT")
	redisDb := os.Getenv("REDIS_DB")
	redisPassword := os.Getenv("REDIS_PASSWORD")

	// 设置默认值
	if redisHost == "" {
		redisHost = "127.0.0.1"
	}
	if redisPort == "" {
		redisPort = "6379"
	}
	if redisDb == "" {
		redisDb = "0"
	}

	var err error
	for i := 0; i < redisMaxRetries; i++ {
		global.Redis = redis.NewClient(&redis.Options{
			Addr:     fmt.Sprintf("%s:%s", redisHost, redisPort),
			Password: redisPassword,
			DB:       utils.StrToInt(redisDb),
			// 连接池配置
			PoolSize:     10,
			MinIdleConns: 5,
			// 超时配置
			DialTimeout:  5 * time.Second,
			ReadTimeout:  3 * time.Second,
			WriteTimeout: 3 * time.Second,
			// 重试配置
			MaxRetries:      3,
			MinRetryBackoff: 8 * time.Millisecond,
			MaxRetryBackoff: 512 * time.Millisecond,
		})

		// 测试连接
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		_, err = global.Redis.Ping(ctx).Result()
		cancel()

		if err == nil {
			fmt.Printf("Redis连接成功\n")
			break
		}

		// 如果不是最后一次尝试，则等待后重试
		if i < redisMaxRetries-1 {
			fmt.Printf("Redis连接失败 (尝试 %d/%d)\n", i+1, redisMaxRetries)
			time.Sleep(redisRetryDelay)
		}
	}

	if err != nil {
		return fmt.Errorf("Redis连接失败，已重试%d次: %v", redisMaxRetries, err)
	}

	return nil
}

// CloseRedis 关闭Redis连接
func CloseRedis() error {
	if global.Redis != nil {
		return global.Redis.Close()
	}
	return nil
}
