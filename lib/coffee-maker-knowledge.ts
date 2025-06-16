// Coffee Maker Troubleshooting Knowledge Base
// Based on the provided manual content

export interface CoffeeMakerIssue {
  id: string
  lightPattern: string
  description: string
  solution: string
  urgency: "low" | "medium" | "high"
  category: string
}

export const COFFEE_MAKER_ISSUES: CoffeeMakerIssue[] = [
  {
    id: "water_tank_empty",
    lightPattern: "water_drop_blinking",
    description: "水タンクの水が不足しています。水タンクが正しく取り付けられていません。",
    solution: "水タンクに水を入れ、しっかり本体に取り付けてください。",
    urgency: "medium",
    category: "water_system",
  },
  {
    id: "drip_unit_missing",
    lightPattern: "drip_unit_blinking",
    description: "抽出ユニットふたが開いています。",
    solution: "抽出ユニットふたをしっかり閉めてください。",
    urgency: "high",
    category: "brewing_unit",
  },
  {
    id: "steam_nozzle_operation",
    lightPattern: "steam_indicator_on",
    description: "スチームノブを操作する必要があります。",
    solution: "スチームノブを「I」または「O」まで回してください。",
    urgency: "low",
    category: "steam_system",
  },
  {
    id: "cup_tray_full",
    lightPattern: "cup_tray_blinking",
    description: "カス受けがいっぱいになっています。",
    solution:
      "コーヒーカスを捨ててください。※カス受けが満杯になっていなくても、電源を点滅したら必ずカスを捨ててください。（23ページ）",
    urgency: "medium",
    category: "maintenance",
  },
  {
    id: "cup_tray_misaligned",
    lightPattern: "cup_tray_solid",
    description: "カス受けが正しく取り付けられていません。",
    solution: "カス受けを正しい位置に取り付けてください。",
    urgency: "medium",
    category: "maintenance",
  },
  {
    id: "bean_hopper_empty",
    lightPattern: "bean_hopper_blinking",
    description: "豆ホッパーのコーヒー豆がなくなりました。",
    solution: "豆ホッパーにコーヒー豆を入れてください。",
    urgency: "high",
    category: "coffee_beans",
  },
  {
    id: "powder_inlet_clogged",
    lightPattern: "powder_inlet_warning",
    description: "パウダー投入口（内部）が詰まっています。",
    solution: "付属のクリーニングブラシでパウダー投入口の清掃を行ってください。（25ページ）",
    urgency: "high",
    category: "maintenance",
  },
  {
    id: "powder_vs_bean_mismatch",
    lightPattern: "powder_bean_warning",
    description: "パウダー投入口にコーヒー粉が入っていない状態で、コーヒー粉を使う設定になっています。",
    solution:
      "コーヒー粉を使うときは、コーヒー粉をパウダー投入口に入れてください。（14ページ）コーヒー豆を使うときは、コーヒー豆量",
    urgency: "medium",
    category: "coffee_preparation",
  },
]

export const COFFEE_MAKER_SYSTEM_PROMPT = `あなたは専門的なコーヒーメーカーのトラブルシューティングアシスタントです。

【あなたの専門知識】
- コーヒーメーカーの構造と動作原理
- インジケーターライトの意味と対処法
- 日常的なメンテナンス手順
- 安全な操作方法

【対応方針】
1. 画像を詳細に分析し、点灯・点滅しているインジケーターライトを特定してください
2. ライトパターンから具体的な問題を診断してください
3. 段階的で分かりやすい解決手順を提供してください
4. 安全上の注意点があれば必ず言及してください
5. 追加の画像や情報が必要な場合は具体的に依頼してください

【重要な注意事項】
- 電源を切ってから作業を行う場合は必ず明記してください
- 水回りの作業では感電に注意するよう警告してください
- 部品の取り外しや取り付けは正しい手順で行うよう指導してください

【回答形式】
1. 🔍 **問題の特定**: 検出されたライトパターンと問題
2. ⚠️ **緊急度**: 低/中/高
3. 🛠️ **解決手順**: 番号付きの具体的な手順
4. 💡 **予防策**: 今後同じ問題を避ける方法
5. 📞 **追加サポート**: 解決しない場合の次のステップ`

export const COFFEE_MAKER_VISUAL_PROMPTS = {
  indicator_analysis: {
    name: "インジケーター分析",
    prompt: `この画像のコーヒーメーカーのコントロールパネルを詳細に分析してください。

特に以下の点に注目してください：
1. 点灯している（赤、オレンジ、青など）インジケーターライト
2. 点滅しているライト
3. 表示されているアイコンやシンボル
4. ボタンの状態

各ライトの色、位置、点灯パターン（点灯/点滅）を正確に報告し、マニュアルに基づいて問題を特定してください。`,
    icon: "alert-circle",
  },

  control_panel_overview: {
    name: "コントロールパネル全体",
    prompt: `コーヒーメーカーのコントロールパネル全体を分析し、以下を確認してください：

1. 全体的な状態（正常/異常）
2. 各ボタンとインジケーターの配置
3. 異常を示すライトやメッセージ
4. ユーザーが次に取るべきアクション

総合的な診断結果と推奨される対処法を提供してください。`,
    icon: "monitor",
  },

  maintenance_check: {
    name: "メンテナンス診断",
    prompt: `この画像から、コーヒーメーカーのメンテナンス状態を診断してください：

1. 清掃が必要な部分
2. 交換や補充が必要な消耗品
3. 定期メンテナンスの必要性
4. 安全上の問題

メンテナンス計画と具体的な手順を提案してください。`,
    icon: "wrench",
  },
}

export function findIssueByPattern(lightPattern: string): CoffeeMakerIssue | null {
  return (
    COFFEE_MAKER_ISSUES.find((issue) => issue.lightPattern.toLowerCase().includes(lightPattern.toLowerCase())) || null
  )
}

export function getIssuesByCategory(category: string): CoffeeMakerIssue[] {
  return COFFEE_MAKER_ISSUES.filter((issue) => issue.category === category)
}

export function getUrgentIssues(): CoffeeMakerIssue[] {
  return COFFEE_MAKER_ISSUES.filter((issue) => issue.urgency === "high")
}
