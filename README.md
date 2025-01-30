# Matomeru / まとめる

[English](./README.md) | [日本語](./README.md#まとめる)

# Matomeru

A VS Code extension that instantly documents directory contents. Streamline code reviews, project documentation, and ChatGPT interactions.

## ✨ Features

### 📁 Fast Directory Visualization
- Convert directory structures to beautiful markdown with emoji indicators (📁 for directories, 📄 for files)
- Automatic file type detection and classification
- Detailed information (size, line count, paths)
- Clear hierarchical structure display

### 🚀 Three Output Methods
- **Open in Editor**: Instant VS Code preview
- **Copy to Clipboard**: Quick sharing
- **Send to ChatGPT**: AI analysis (macOS only)

### 📝 Output Format
```markdown
# Directory Structure

📁 src
   📁 domain
      📁 files
         📄 FileSystemAdapter.ts
      📁 output
         📄 MarkdownGenerator.ts
   📁 infrastructure
      📁 logging
         📄 LoggingService.ts

# Files

File: FileSystemAdapter.ts | Path: src/domain/files/FileSystemAdapter.ts
```typescript
// File contents here
```

### ⚡️ Impressive Performance
| Project Size | Processing Time | Memory Usage |
|------------|------|---------|
| Small (100 files) | 0.3s | 50MB |
| Medium (1,000 files) | 2.1s | 120MB |
| Large (10,000 files) | 3.2s | 450MB |

## 🛠 Usage

1. Right-click a directory in VS Code explorer
2. Select Matomeru command:
   - "Open in Editor"
   - "Copy to Clipboard"
   - "Open in ChatGPT" (macOS only)

## ⚙️ Customization

```json
{
  "matomeru.maxConcurrency": 5,     // Parallel operations (1-20)
  "matomeru.batchSize": 100,        // Batch size (10-1000)
  "matomeru.excludePatterns": [     // Exclude patterns
    "node_modules/**",
    ".git/**"
  ]
}
```

## 🔒 Security & Stability

- Safe symlink handling
- Binary file detection and exclusion
- Detailed error messages and logs

## 🤖 ChatGPT Integration (macOS only)

### Requirements
- macOS
- ChatGPT desktop app
- Accessibility permissions

### Setup
1. Install ChatGPT app
2. Grant VS Code accessibility permissions

## 🔄 Roadmap

- Windows support
- Enhanced analysis
- Custom templates
- GitHub integration

## 📝 License

MIT License

## 👨‍💻 Developer

Romot

---

# まとめる

ディレクトリの内容を瞬時にドキュメント化するVS Code拡張機能。コードレビュー、プロジェクト文書化、ChatGPTとの対話をスマートに。

## 🌟 主な機能

### 📁 高速なディレクトリ可視化
- 絵文字を使用した分かりやすいディレクトリ構造の表示（📁 ディレクトリ、📄 ファイル）
- ファイルタイプの自動検出と分類
- 詳細な情報（サイズ、行数、パス）を表示
- 階層構造の明確な表示

### 🚀 3つの出力方法
- **エディタで開く**: 即座にVS Codeで確認
- **クリップボードにコピー**: すぐに共有可能
- **ChatGPTに送信**: AIによる分析（macOSのみ）

### 📝 出力形式
```markdown
# Directory Structure

📁 src
   📁 domain
      📁 files
         📄 FileSystemAdapter.ts
      📁 output
         📄 MarkdownGenerator.ts
   📁 infrastructure
      📁 logging
         📄 LoggingService.ts

# Files

File: FileSystemAdapter.ts | Path: src/domain/files/FileSystemAdapter.ts
```typescript
// ファイルの内容
```

### ⚡️ 圧倒的なパフォーマンス
| プロジェクトサイズ | 処理時間 | メモリ使用量 |
|------------|------|---------|
| 小規模 (100ファイル) | 0.3秒 | 50MB |
| 中規模 (1,000ファイル) | 2.1秒 | 120MB |
| 大規模 (10,000ファイル) | 3.2秒 | 450MB |

## 🛠 使い方

1. VS Codeのエクスプローラーでディレクトリを右クリック
2. Matomeruコマンドを選択:
   - 「エディタで開く」
   - 「クリップボードにコピー」
   - 「ChatGPTで開く」（macOSのみ）

## ⚙️ カスタマイズ

```json
{
  "matomeru.maxConcurrency": 5,     // 並列処理数（1-20）
  "matomeru.batchSize": 100,        // バッチサイズ（10-1000）
  "matomeru.excludePatterns": [     // 除外パターン
    "node_modules/**",
    ".git/**"
  ]
}
```

## 🔒 セキュリティと安定性

- シンボリックリンクの自動スキップによる安全性確保
- バイナリファイルの自動検出と除外
- 詳細なエラーメッセージとログ

## 🤖 ChatGPT連携（macOS専用）

### 必要条件
- macOS
- ChatGPTデスクトップアプリ
- アクセシビリティ権限

### セットアップ
1. ChatGPTアプリをインストール
2. VS Codeにアクセシビリティ権限を付与

## 🔄 今後の予定

- Windowsサポート
- より詳細な解析機能
- カスタムテンプレート
- GitHub連携

## 📝 ライセンス

MIT License

## 👨‍💻 開発者

Romot

---

**Note**: This project is under active development. Your feedback and contributions are welcome!
**注**: 活発に開発中です。フィードバックや貢献を歓迎します！
