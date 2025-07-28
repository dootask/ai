package database

import (
	"fmt"
	"time"

	"dootask-ai/go-service/global"
	"dootask-ai/go-service/migrations"
	"dootask-ai/go-service/utils"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// 数据库连接重试配置
const (
	maxRetries = 5
	retryDelay = 2 * time.Second
)

// InitDatabase 初始化数据库
func InitDatabase() error {
	// 从环境变量获取配置
	host := utils.GetEnvWithDefault("POSTGRES_HOST", "127.0.0.1")
	port := utils.GetEnvWithDefault("POSTGRES_PORT", "5432")
	dbName := utils.GetEnvWithDefault("POSTGRES_DB", "dootask_ai")
	username := utils.GetEnvWithDefault("POSTGRES_USER", "dootask")
	password := utils.GetEnvWithDefault("POSTGRES_PASSWORD", "dootask123")
	sslmode := utils.GetEnvWithDefault("POSTGRES_SSLMODE", "disable")

	// 构建DSN
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, username, password, dbName, sslmode)

	// 数据库连接
	var err error
	for i := 0; i < maxRetries; i++ {
		global.DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			// 连接成功，测试数据库连接
			sqlDB, dbErr := global.DB.DB()
			if dbErr == nil {
				pingErr := sqlDB.Ping()
				if pingErr == nil {
					fmt.Printf("数据库连接成功\n")
					break
				}
				err = pingErr
			} else {
				err = dbErr
			}
		}

		if i < maxRetries-1 {
			fmt.Printf("数据库连接失败 (尝试 %d/%d)\n", i+1, maxRetries)
			time.Sleep(retryDelay)
		}
	}

	if err != nil {
		return fmt.Errorf("连接Postgres数据库失败，已重试%d次: %v", maxRetries, err)
	}

	// 使用迁移管理器执行数据库迁移
	migrationManager := migrations.NewMigrationManager(global.DB)
	if err := migrationManager.Migrate(); err != nil {
		return fmt.Errorf("数据库迁移失败: %v", err)
	}

	return nil
}

// CloseDatabase 关闭数据库连接
func CloseDatabase() error {
	if global.DB != nil {
		sqlDB, err := global.DB.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}
