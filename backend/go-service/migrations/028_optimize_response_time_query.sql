-- Description: 优化响应时间查询的索引
-- 为响应时间查询添加优化索引

-- 为agents表添加user_id索引
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);

-- 为messages表添加响应时间相关索引
CREATE INDEX IF NOT EXISTS idx_messages_response_time ON messages(response_time_ms) WHERE response_time_ms IS NOT NULL;

-- 为messages表添加conversation_id和response_time的复合索引
CREATE INDEX IF NOT EXISTS idx_messages_conversation_response_time ON messages(conversation_id, response_time_ms) WHERE response_time_ms IS NOT NULL;

-- 为conversations表添加agent_id和活跃状态的复合索引
CREATE INDEX IF NOT EXISTS idx_conversations_agent_active ON conversations(agent_id, is_active);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);

-- 为agents表添加user_id和活跃状态的复合索引  
CREATE INDEX IF NOT EXISTS idx_agents_user_active ON agents(user_id, is_active);

