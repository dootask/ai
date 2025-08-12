-- Description: 为kb_documents表添加status字段, processing处理中 processed已处理 failed处理失败
-- 添加status字段到kb_documents表

DO $$
BEGIN
    -- 检查status字段是否已经存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kb_documents' AND column_name = 'status'
    ) THEN
        ALTER TABLE kb_documents ADD COLUMN status varchar(20) NOT NULL DEFAULT 'processing';
    END IF;
    -- kb_documents status 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_kb_documents_status' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_kb_documents_status ON kb_documents(status);
    END IF;
END $$; 