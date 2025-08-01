-- Description: 为mcp_tools表添加config_type字段, 0-URL配置 1-NPX配置
-- 添加config_type字段到mcp_tools表

DO $$
BEGIN
    -- 检查config_type字段是否已经存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mcp_tools' AND column_name = 'config_type'
    ) THEN
        ALTER TABLE mcp_tools ADD COLUMN config_type smallint NOT NULL DEFAULT 0;
    END IF;
    -- mcp_tools config_type 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_mcp_tools_config_type' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_mcp_tools_config_type ON mcp_tools(config_type);
    END IF;
END $$;