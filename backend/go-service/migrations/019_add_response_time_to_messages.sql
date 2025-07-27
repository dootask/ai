-- Description: 为消息表添加响应时间字段
-- 添加响应时间字段到messages表，用于记录assistant消息的响应时间（毫秒）

DO $$
BEGIN
    -- 检查response_time_ms字段是否已经存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'response_time_ms'
    ) THEN
        ALTER TABLE messages ADD COLUMN response_time_ms INTEGER DEFAULT NULL;
    END IF;
END $$; 