-- Description: 为消息表添加状态字段
-- 添加响应时间字段到messages表，用于记录assistant消息的状态: 1成功 2失败, 默认1

DO $$
BEGIN
    -- 检查status字段是否已经存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'status'
    ) THEN
        ALTER TABLE messages ADD COLUMN status INTEGER DEFAULT 1;
    END IF;
    -- messages status 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_messages_status' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_messages_status ON messages(status);
    END IF;
END $$; 