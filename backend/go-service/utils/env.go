package utils

import (
	"os"
)

// GetEnvWithDefault 获取环境变量，如果为空则返回默认值
func GetEnvWithDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
