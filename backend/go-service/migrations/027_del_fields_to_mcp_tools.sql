-- Description: 为mcp_tools表删除type、permissions字段
-- 删除mcp_tools表的type、permissions字段

DO $$
BEGIN
    -- 检查type字段是否已经存在
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mcp_tools' AND column_name = 'type'
    ) THEN
        ALTER TABLE mcp_tools DROP COLUMN type;
    END IF;

    -- 检查permissions字段是否已经存在
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'mcp_tools' AND column_name = 'permissions'
    ) THEN
        ALTER TABLE mcp_tools DROP COLUMN permissions;
    END IF;
END $$;