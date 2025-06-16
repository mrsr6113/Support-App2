-- Create Supabase database tables for AI Vision Chat
-- Run this script in your Supabase SQL Editor

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables for dynamic configuration
CREATE TABLE IF NOT EXISTS rag_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visual_analysis_prompts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  description TEXT,
  icon_name TEXT DEFAULT 'eye',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  messages JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_rag_documents_category ON rag_documents(category);
CREATE INDEX IF NOT EXISTS idx_rag_documents_active ON rag_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_rag_documents_tags ON rag_documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_system_prompts_default ON system_prompts(is_default);
CREATE INDEX IF NOT EXISTS idx_visual_analysis_prompts_active ON visual_analysis_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual_analysis_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all operations for now - adjust based on your auth requirements)
CREATE POLICY "Allow all operations on rag_documents" ON rag_documents FOR ALL USING (true);
CREATE POLICY "Allow all operations on system_prompts" ON system_prompts FOR ALL USING (true);
CREATE POLICY "Allow all operations on visual_analysis_prompts" ON visual_analysis_prompts FOR ALL USING (true);
CREATE POLICY "Allow all operations on chat_sessions" ON chat_sessions FOR ALL USING (true);

-- Insert default system prompts
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
「AIにはできません」「画像は扱えません」などの表現は使わず、常にサポートできる姿勢を保ってください。', 'デフォルトの顧客サポートプロンプト', true),

('technical_support', 'あなたは技術サポートの専門家です。技術的な問題について詳細で正確な回答を提供してください。
- 問題の原因を特定し、段階的な解決手順を提示してください
- 専門用語を使用する場合は、分かりやすい説明も併記してください
- 画像が提供された場合は、エラーメッセージやシステム状態を詳細に分析してください', '技術サポート専用プロンプト', false),

('general_assistant', 'あなたは親しみやすいAIアシスタントです。ユーザーの質問に対して、親切で分かりやすい回答を心がけてください。
- 専門的な内容も一般の方に理解しやすいように説明してください
- 画像が提供された場合は、その内容を詳しく説明し、関連する情報も提供してください', '一般的なアシスタントプロンプト', false)
ON CONFLICT (name) DO NOTHING;

-- Insert default visual analysis prompts
INSERT INTO visual_analysis_prompts (name, prompt, description, icon_name, is_active) VALUES 
('detailed_detection', '映った物体名を詳細に確認し、商品名や型番が特定出来たらWebで検索して詳しい特徴などを調べた結果を簡潔に回答してください。', '詳細な物体分析と仕様情報の提供', 'eye', true),
('simple_detection', '映った物体名を詳細に確認し、商品名などを簡潔に回答してください。', '基本的な物体の識別と商品名の特定', 'search', true),
('text_recognition', '映像に映った内容を正確に文字起こしを行ってください。', '画像内のテキストの読み取りと転写', 'type', true),
('scene_analysis', '映像に映った内容がどんな状態であるかを詳細に回答してください。', '全体的な状況と環境の分析', 'image', true),
('error_analysis', 'エラーメッセージやシステムの状態を分析し、問題の原因と解決方法を提案してください。', 'エラー画面の分析と解決提案', 'alert-circle', true),
('product_identification', '製品の特徴を分析し、ブランド、モデル、仕様などの詳細情報を提供してください。', '製品の詳細識別と情報提供', 'package', true)
ON CONFLICT (name) DO NOTHING;

-- Insert sample RAG documents
INSERT INTO rag_documents (title, content, category, tags) VALUES 
('製品サポート基本情報', 'お客様からのお問い合わせには迅速かつ丁寧に対応いたします。技術的な問題については、まず基本的なトラブルシューティングをご案内します。
- 電源の確認
- 接続状況の確認
- 最新ソフトウェアの確認
- 再起動の実行', 'support', ARRAY['基本', 'サポート', 'トラブルシューティング']),

('返品・交換ポリシー', '商品の返品・交換は購入から30日以内に承ります。以下の条件を満たす必要があります：
- 未開封・未使用の商品
- 購入時のレシートまたは注文番号
- 送料はお客様負担
- 返品理由の明記', 'policy', ARRAY['返品', '交換', 'ポリシー', '30日']),

('配送について', '通常配送は3-5営業日でお届けします。配送オプション：
- 標準配送：無料（3-5営業日）
- 速達配送：500円（1-2営業日）
- 翌日配送：1000円（翌営業日）
配送状況は追跡番号でご確認いただけます。', 'shipping', ARRAY['配送', '納期', '追跡']),

('よくある質問', 'Q: パスワードを忘れました
A: ログイン画面の「パスワードを忘れた方」をクリックし、登録メールアドレスを入力してください。

Q: 注文をキャンセルしたい
A: 発送前であればマイページからキャンセル可能です。発送後は返品手続きをお願いします。

Q: 領収書が欲しい
A: マイページの注文履歴から領収書をダウンロードできます。', 'faq', ARRAY['FAQ', 'パスワード', 'キャンセル', '領収書']),

('技術仕様', '対応OS：Windows 10/11, macOS 10.15以降, Ubuntu 18.04以降
必要メモリ：最小4GB、推奨8GB以上
ストレージ：最小10GB、推奨20GB以上
ネットワーク：インターネット接続必須
ブラウザ：Chrome 90+, Firefox 88+, Safari 14+, Edge 90+', 'technical', ARRAY['仕様', 'OS', 'メモリ', 'ブラウザ'])
ON CONFLICT DO NOTHING;

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update the updated_at column
CREATE TRIGGER update_rag_documents_updated_at BEFORE UPDATE ON rag_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_prompts_updated_at BEFORE UPDATE ON system_prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_visual_analysis_prompts_updated_at BEFORE UPDATE ON visual_analysis_prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
