-- Description: 为messages表添加mcp_used字段
-- 添加mcp_used字段到messages表, 统计mcp使用量

DO $$
BEGIN
    -- 检查mcp_used字段是否已经存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'mcp_used'
    ) THEN
        ALTER TABLE messages ADD COLUMN mcp_used JSONB DEFAULT NULL;
    END IF;
END $$;