-- Description: 为mcp_tools表添加标识字段
-- 添加标识字段到mcp_tools表

DO $$
BEGIN
    -- 检查is_thinking字段是否已经存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mcp_tools' AND column_name = 'mcp_name'
    ) THEN
        ALTER TABLE mcp_tools ADD COLUMN mcp_name VARCHAR(100) NOT NULL DEFAULT '';
    END IF;
END $$; 