-- Description: 创建系统配置表
-- 系统配置表

CREATE TABLE IF NOT EXISTS user_configs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- 修正：应该是(user_id, key)组合唯一
    UNIQUE(user_id, key)
);

-- 可选：添加索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_user_configs_user_id ON user_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_configs_key ON user_configs(key);