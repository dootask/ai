-- Description: 给ai_models,knowledge_bases,mcp_tools,agents表添加user_id字段
-- 添加用户ID字段

DO $$
BEGIN
    -- ai_models 表
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='ai_models' AND column_name='user_id'
    ) THEN
        ALTER TABLE ai_models ADD COLUMN user_id BIGINT;
    END IF;
    -- knowledge_bases 表
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='knowledge_bases' AND column_name='user_id'
    ) THEN
        ALTER TABLE knowledge_bases ADD COLUMN user_id BIGINT;
    END IF;
    -- mcp_tools 表
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='mcp_tools' AND column_name='user_id'
    ) THEN
        ALTER TABLE mcp_tools ADD COLUMN user_id BIGINT;
    END IF;
    -- agents 表
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='agents' AND column_name='user_id'
    ) THEN
        ALTER TABLE agents ADD COLUMN user_id BIGINT;
    END IF;
    -- ai_models user_id 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_ai_models_user_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_ai_models_user_id ON ai_models(user_id);
    END IF;
    -- knowledge_bases user_id 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_knowledge_bases_user_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_knowledge_bases_user_id ON knowledge_bases(user_id);
    END IF;
    -- mcp_tools user_id 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_mcp_tools_user_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_mcp_tools_user_id ON mcp_tools(user_id);
    END IF;
    -- agents user_id 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_agents_user_id' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_agents_user_id ON agents(user_id);
    END IF;
END $$;
