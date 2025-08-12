-- Description: 为知识库表添加api_key、provider、proxy_url字段
-- 添加api_key、provider、proxy_url字段到knowledge_bases表

DO $$
BEGIN
    -- 检查api_key字段是否已经存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_bases' AND column_name = 'api_key'
    ) THEN
        ALTER TABLE knowledge_bases ADD COLUMN api_key TEXT;
    END IF;
    -- 检查provider字段是否已经存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_bases' AND column_name = 'provider'
    ) THEN
        ALTER TABLE knowledge_bases ADD COLUMN provider VARCHAR(100) NOT NULL DEFAULT '';
    END IF;
    -- 检查proxy_url字段是否已经存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'knowledge_bases' AND column_name = 'proxy_url'
    ) THEN
        ALTER TABLE knowledge_bases ADD COLUMN proxy_url VARCHAR(500) NOT NULL DEFAULT '';
    END IF;
END $$; 