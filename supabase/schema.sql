-- Enable RLS (Row Level Security)
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create tables for dynamic configuration
CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visual_analysis_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  description TEXT,
  icon_name TEXT DEFAULT 'eye',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rag_documents_category ON rag_documents(category);
CREATE INDEX IF NOT EXISTS idx_rag_documents_active ON rag_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_system_prompts_default ON system_prompts(is_default);
CREATE INDEX IF NOT EXISTS idx_visual_analysis_prompts_active ON visual_analysis_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);

-- Enable RLS
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual_analysis_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now - adjust based on your auth requirements)
CREATE POLICY "Allow all operations on rag_documents" ON rag_documents FOR ALL USING (true);
CREATE POLICY "Allow all operations on system_prompts" ON system_prompts FOR ALL USING (true);
CREATE POLICY "Allow all operations on visual_analysis_prompts" ON visual_analysis_prompts FOR ALL USING (true);
CREATE POLICY "Allow all operations on chat_sessions" ON chat_sessions FOR ALL USING (true);

-- Insert default data
INSERT INTO system_prompts (name, prompt, description, is_default) VALUES 
('default_support', 'あなたは顧客サポートのプロフェッショナルです。現在、ユーザーから音声またはチャットで問い合わせが寄せられています。
あなたの役割は、丁寧で信頼感のある対応を行い、ユーザーの問題を的確に解決することです。以下の対応方針に従ってください：

【対応方針】
常に丁寧・安心感のある言葉遣いで対応してください。
ユーザーが言葉で説明しづらそうな場合や、視覚的なサポートが有効な場面では、次のように提案してください：
「もしよろしければ、カメラでその対象物を映していただくか、画面を共有していただければ、状況を正確に把握できます。」
ユーザーがカメラや画面共有を希望した場合は、次のように案内してください：
「画面右下の📷アイコンをタップするとカメラが起動します。画面共有は🖥マークから開始できます。不明な点があればサポートいたします。」
映像が共有された場合は、リアルタイムで画像を解析し、問題を特定・解決してください。
映像だけで判断が難しい場合は、追加で必要な情報や映像の共有を丁寧にお願いしてください。
「AIにはできません」「画像は扱えません」などの表現は使わず、常にサポートできる姿勢を保ってください。', 'デフォルトの顧客サポートプロンプト', true);

INSERT INTO visual_analysis_prompts (name, prompt, description, icon_name, is_active) VALUES 
('detailed_detection', '映った物体名を詳細に確認し、商品名や型番が特定出来たらWebで検索して詳しい特徴などを調べた結果を簡潔に回答してください。', '詳細な物体分析と仕様情報の提供', 'eye', true),
('simple_detection', '映った物体名を詳細に確認し、商品名などを簡潔に回答してください。', '基本的な物体の識別と商品名の特定', 'search', true),
('text_recognition', '映像に映った内容を正確に文字起こしを行ってください。', '画像内のテキストの読み取りと転写', 'type', true),
('scene_analysis', '映像に映った内容がどんな状態であるかを詳細に回答してください。', '全体的な状況と環境の分析', 'image', true);

INSERT INTO rag_documents (title, content, category, tags) VALUES 
('製品サポート基本情報', 'お客様からのお問い合わせには迅速かつ丁寧に対応いたします。技術的な問題については、まず基本的なトラブルシューティングをご案内します。', 'support', ARRAY['基本', 'サポート']),
('返品・交換ポリシー', '商品の返品・交換は購入から30日以内に承ります。未開封・未使用の商品に限り、送料お客様負担で対応いたします。', 'policy', ARRAY['返品', '交換', 'ポリシー']),
('配送について', '通常配送は3-5営業日でお届けします。お急ぎの場合は翌日配送（追加料金）もご利用いただけます。', 'shipping', ARRAY['配送', '納期']);
