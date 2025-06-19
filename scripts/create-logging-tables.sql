-- Create logging tables for debugging and analytics

-- Registration logs table
CREATE TABLE IF NOT EXISTS registration_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    entry_data JSONB,
    error_message TEXT,
    processing_time_ms INTEGER,
    embedding_dimensions INTEGER,
    api_version TEXT DEFAULT 'v1.0',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analysis logs table
CREATE TABLE IF NOT EXISTS analysis_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    analysis_data JSONB,
    error_message TEXT,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_registration_logs_session_id ON registration_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_registration_logs_event_type ON registration_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_registration_logs_timestamp ON registration_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_analysis_logs_session_id ON analysis_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_event_type ON analysis_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_analysis_logs_timestamp ON analysis_logs(timestamp);

-- Add RLS policies
ALTER TABLE registration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to access all data
CREATE POLICY "Service role can access registration logs" ON registration_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role can access analysis logs" ON analysis_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Create a function to clean old logs (optional)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    -- Delete logs older than 30 days
    DELETE FROM registration_logs WHERE created_at < NOW() - INTERVAL '30 days';
    DELETE FROM analysis_logs WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create analysis prompts table if it doesn't exist
CREATE TABLE IF NOT EXISTS analysis_prompts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    analysis_focus TEXT NOT NULL,
    prompt_text TEXT NOT NULL,
    prompt_type TEXT DEFAULT 'analysis',
    category TEXT,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default analysis prompts
INSERT INTO analysis_prompts (analysis_focus, prompt_text, prompt_type, category, priority, is_active) VALUES
('coffee_maker_expert', 'あなたはコーヒーメーカーの専門技術者です。画像を詳細に分析し、以下の点に注目してください：

1. インジケーターランプの状態（点灯、点滅、消灯）
2. ランプの色（赤、緑、青、オレンジなど）
3. 表示されているアイコンやシンボル
4. 機器の全体的な状態

特に以下の問題を特定してください：
- カス受け関連の問題
- 給水タンクの問題
- 抽出ユニットの問題
- メンテナンス要求
- エラー状態

具体的で実用的な解決策を提供してください。', 'analysis', 'coffee_maker', 100, true),

('general_assistant', '画像を詳細に分析し、以下の情報を提供してください：

1. 画像に写っている主要な物体や要素
2. 注目すべき特徴や状態
3. 問題や異常が見られる場合はその詳細
4. 推奨される対処法や次のステップ

分析は正確で具体的に行い、ユーザーにとって有用な情報を提供してください。', 'analysis', 'general', 50, true),

('technical_support', '技術サポートの専門家として画像を分析してください：

1. 機器の状態と動作状況
2. エラーインジケーターや警告表示
3. 物理的な問題や異常
4. メンテナンスの必要性

技術的に正確で、段階的な解決手順を提供してください。', 'analysis', 'technical', 75, true)

ON CONFLICT DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_analysis_prompts_focus ON analysis_prompts(analysis_focus);
CREATE INDEX IF NOT EXISTS idx_analysis_prompts_active ON analysis_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_analysis_prompts_priority ON analysis_prompts(priority);
