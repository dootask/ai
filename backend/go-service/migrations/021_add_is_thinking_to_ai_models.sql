-- Description: 为AI模型表添加状态字段
-- 添加状态字段到ai_models表，用于判断model是否思考型: 0否 1是, 默认0

DO $$
BEGIN
    -- 检查is_thinking字段是否已经存在
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ai_models' AND column_name = 'is_thinking'
    ) THEN
        ALTER TABLE ai_models ADD COLUMN is_thinking BOOLEAN DEFAULT false;
    END IF;
    -- ai_models is_thinking 索引
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'idx_ai_models_is_thinking' AND n.nspname = 'public'
    ) THEN
        CREATE INDEX idx_ai_models_is_thinking ON ai_models(is_thinking);
    END IF;
END $$; 