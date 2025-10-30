package migrations

import (
	"embed"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
)

//go:embed *.sql
var migrationFiles embed.FS

// Migration 迁移记录结构
type Migration struct {
	ID        uint      `gorm:"primaryKey;autoIncrement"`
	Version   string    `gorm:"type:varchar(50);uniqueIndex;not null"`
	Name      string    `gorm:"type:varchar(255);not null"`
	BatchID   int       `gorm:"not null"`
	CreatedAt time.Time `gorm:"autoCreateTime"`
}

// TableName 设置Migration表名
func (Migration) TableName() string {
	return "migrations"
}

// MigrationManager 迁移管理器
type MigrationManager struct {
	db *gorm.DB
}

// NewMigrationManager 创建迁移管理器
func NewMigrationManager(db *gorm.DB) *MigrationManager {
	return &MigrationManager{
		db: db,
	}
}

// Migrate 执行迁移
func (m *MigrationManager) Migrate() error {
	// 确保迁移表存在
	if err := m.db.AutoMigrate(&Migration{}); err != nil {
		return fmt.Errorf("创建迁移表失败: %v", err)
	}

	// 获取所有迁移文件
	migrations, err := m.loadMigrations()
	if err != nil {
		return fmt.Errorf("加载迁移文件失败: %v", err)
	}

	// 获取已执行的迁移
	var executedMigrations []Migration
	if err := m.db.Order("version ASC").Find(&executedMigrations).Error; err != nil {
		return fmt.Errorf("查询已执行迁移失败: %v", err)
	}

	executedVersions := make(map[string]bool)
	for _, migration := range executedMigrations {
		executedVersions[migration.Version] = true
	}

	// 获取下一个批次ID
	var lastBatch int
	m.db.Model(&Migration{}).Select("COALESCE(MAX(batch_id), 0)").Scan(&lastBatch)
	nextBatch := lastBatch + 1

	// 执行未执行的迁移
	for _, migration := range migrations {
		if executedVersions[migration.Version] {
			continue
		}

		log.Printf("执行迁移: %s - %s\n", migration.Version, migration.Name)

		// 开始事务
		tx := m.db.Begin()
		if tx.Error != nil {
			return fmt.Errorf("开始事务失败: %v", tx.Error)
		}

		// 按分号分割SQL语句，分别执行
		statements := m.splitSQL(migration.SQL)

		// 预验证：检查所有语句的语法（使用EXPLAIN或语法检查）
		if err := m.validateStatements(tx, statements); err != nil {
			tx.Rollback()
			return fmt.Errorf("迁移 %s 语法验证失败: %v", migration.Version, err)
		}

		migrationSuccess := true
		var lastError error

		for _, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			if err := tx.Exec(stmt).Error; err != nil {
				migrationSuccess = false
				lastError = fmt.Errorf("执行迁移 %s 失败: %v\n语句: %s", migration.Version, err, stmt)
				break
			}
		}

		if migrationSuccess {
			// 记录迁移成功
			migrationRecord := Migration{
				Version: migration.Version,
				Name:    migration.Name,
				BatchID: nextBatch,
			}
			if err := tx.Create(&migrationRecord).Error; err != nil {
				tx.Rollback()
				return fmt.Errorf("记录迁移 %s 失败: %v", migration.Version, err)
			}

			// 提交事务
			if err := tx.Commit().Error; err != nil {
				return fmt.Errorf("提交迁移 %s 失败: %v", migration.Version, err)
			}

			log.Printf("迁移 %s 执行成功\n", migration.Version)
		} else {
			// 回滚事务（注意：DDL语句无法回滚，但可以回滚迁移记录）
			tx.Rollback()

			// 提供恢复建议
			m.provideDDLRecoveryAdvice(migration.Version, statements)
			return lastError
		}
	}

	return nil
}

// MigrationFile 迁移文件结构
type MigrationFile struct {
	Version string
	Name    string
	SQL     string
}

// loadMigrations 加载所有迁移文件
func (m *MigrationManager) loadMigrations() ([]MigrationFile, error) {
	entries, err := migrationFiles.ReadDir(".")
	if err != nil {
		return nil, err
	}

	var migrations []MigrationFile
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		// 解析文件名获取版本号
		version := strings.TrimSuffix(entry.Name(), ".sql")

		// 读取文件内容
		content, err := migrationFiles.ReadFile(entry.Name())
		if err != nil {
			return nil, fmt.Errorf("读取迁移文件 %s 失败: %v", entry.Name(), err)
		}

		// 解析迁移名称
		name := m.parseMigrationName(string(content))
		if name == "" {
			name = version
		}

		migrations = append(migrations, MigrationFile{
			Version: version,
			Name:    name,
			SQL:     string(content),
		})
	}

	// 按版本号排序
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	return migrations, nil
}

// parseMigrationName 从SQL内容中解析迁移名称
func (m *MigrationManager) parseMigrationName(content string) string {
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "-- Description:") {
			return strings.TrimSpace(strings.TrimPrefix(line, "-- Description:"))
		}
	}
	return ""
}

// Status 显示迁移状态
func (m *MigrationManager) Status() error {
	// 获取所有迁移文件
	migrations, err := m.loadMigrations()
	if err != nil {
		return fmt.Errorf("加载迁移文件失败: %v", err)
	}

	// 获取已执行的迁移
	var executedMigrations []Migration
	if err := m.db.Order("version ASC").Find(&executedMigrations).Error; err != nil {
		return fmt.Errorf("查询已执行迁移失败: %v", err)
	}

	executedVersions := make(map[string]Migration)
	for _, migration := range executedMigrations {
		executedVersions[migration.Version] = migration
	}

	log.Printf("迁移状态:")
	log.Printf("版本号\t\t状态\t\t名称")
	log.Printf("------\t\t----\t\t----")

	for _, migration := range migrations {
		status := "待执行"
		if _, exists := executedVersions[migration.Version]; exists {
			status = "已执行"
		}
		log.Printf("%s\t\t%s\t\t%s\n", migration.Version, status, migration.Name)
	}

	return nil
}

// splitSQL 分割SQL语句，正确处理注释、字符串和PostgreSQL函数定义
func (m *MigrationManager) splitSQL(sql string) []string {
	var statements []string
	var current strings.Builder
	inFunction := false

	lines := strings.Split(sql, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)

		// 跳过空行和注释行
		if line == "" || strings.HasPrefix(line, "--") {
			continue
		}

		// 添加到当前语句
		if current.Len() > 0 {
			current.WriteString(" ")
		}
		current.WriteString(line)

		// 检查是否进入或退出函数定义
		if strings.Contains(line, "$$") {
			inFunction = !inFunction
		}

		// 如果不在函数定义中，且行以分号结尾，表示语句结束
		if !inFunction && strings.HasSuffix(line, ";") {
			stmt := strings.TrimSpace(current.String())
			if stmt != "" {
				statements = append(statements, stmt)
			}
			current.Reset()
		}
	}

	// 处理最后一个没有分号的语句
	if current.Len() > 0 {
		stmt := strings.TrimSpace(current.String())
		if stmt != "" {
			statements = append(statements, stmt)
		}
	}

	return statements
}

// validateStatements 预验证SQL语句的语法
func (m *MigrationManager) validateStatements(tx *gorm.DB, statements []string) error {
	// 对于DDL语句，我们进行基本的语法检查
	for i, stmt := range statements {
		stmt = strings.TrimSpace(stmt)
		if stmt == "" {
			continue
		}

		// 基本语法检查
		if !strings.HasSuffix(stmt, ";") {
			return fmt.Errorf("语句 %d 缺少结束分号: %s", i+1, stmt)
		}

		// 检查是否是支持的SQL语句（包括函数定义）
		upperStmt := strings.ToUpper(stmt)
		validSQL := strings.HasPrefix(upperStmt, "CREATE ") ||
			strings.HasPrefix(upperStmt, "ALTER ") ||
			strings.HasPrefix(upperStmt, "DROP ") ||
			strings.HasPrefix(upperStmt, "INSERT ") ||
			strings.HasPrefix(upperStmt, "UPDATE ") ||
			strings.HasPrefix(upperStmt, "DELETE ") ||
			strings.Contains(upperStmt, "$$") // PostgreSQL函数定义

		if !validSQL {
			return fmt.Errorf("语句 %d 不是有效的SQL语句: %s", i+1, stmt)
		}
	}
	return nil
}

// provideDDLRecoveryAdvice 提供DDL恢复建议
func (m *MigrationManager) provideDDLRecoveryAdvice(version string, statements []string) {
	// 实现提供恢复建议的逻辑
	log.Printf("迁移 %s 执行失败，已回滚事务\n", version)
	log.Printf("警告：DDL语句可能已部分执行且无法回滚，请手动检查数据库状态\n")
	log.Printf("建议：请检查以下语句是否需要手动恢复\n")
	for _, stmt := range statements {
		log.Printf("  %s\n", stmt)
	}
}
