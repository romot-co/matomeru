# Matomeru

Combine your entire project into one LLM-ready Markdown.

プロジェクトを一つのMarkdownにまとめる、LLMに投げる

<img src="images/icon.png" width="128" height="128" alt="Matomeru Icon">

[English](#english) | [日本語](#japanese)

## English

### Features

- **Generate Markdown documentation** for your directory structures and file contents
- **Automatically format and organize**:
  - Directory tree structure
  - Markdown-compatible output
- Support for multiple output formats:
  - Display in editor
  - Copy to clipboard
  - Send to ChatGPT (macOS only)
- Customizable directory structure display:
  - Emoji icons for directories and files
  - Configurable indentation
  - Optional file extension display
- Flexible file exclusion:
  - Configure custom patterns to exclude
  - Use .gitignore patterns to automatically exclude files (optional)
- Localization support (English/Japanese)

### Installation

1. Install from VSCode Marketplace
2. Or download the `.vsix` file and install manually:
   ```bash
   code --install-extension matomeru-0.0.1.vsix
   ```

### Usage

1. Right-click on a directory or file in the explorer
2. Select "Matomeru: Summarize Directory/File"
3. Choose output destination:
   - Open in Editor
   - Copy to Clipboard
   - Send to ChatGPT (macOS only)

### Configuration

```json
{
  "matomeru.maxFileSize": 1048576,
  "matomeru.excludePatterns": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "coverage/**"
  ],
  "matomeru.chatGptIntegration": false,
  "matomeru.directoryStructure.directoryIcon": "📁",
  "matomeru.directoryStructure.fileIcon": "📄",
  "matomeru.directoryStructure.indentSize": 2,
  "matomeru.directoryStructure.showFileExtensions": true,
  "matomeru.directoryStructure.useEmoji": true,
  "matomeru.prefixText": {
    "type": "string",
    "default": "",
    "description": "Text to be added at the beginning of the generated Markdown"
  },
  "matomeru.useGitignore": false
}
```

### Requirements

- VSCode 1.085.0 or later
- For ChatGPT integration:
  - macOS
  - Google Chrome
  - ChatGPT account

### License

MIT License

---

## Japanese

### 機能

- 選択したディレクトリ構造とファイル内容を**Markdown形式で自動生成**
- **自動的にフォーマットして整理**：
  - ディレクトリツリー構造
  - Markdown互換の出力
- 複数の出力形式に対応：
  - エディタでの表示
  - クリップボードへのコピー
  - ChatGPTへの送信（macOSのみ）
- カスタマイズ可能なディレクトリ構造表示：
  - ディレクトリとファイルの絵文字アイコン
  - インデントの設定
  - ファイル拡張子の表示/非表示
- 柔軟なファイル除外機能：
  - カスタムパターンで除外設定
  - .gitignoreファイルのパターンを使用して自動的にファイルを除外（オプション）
- 多言語対応（英語/日本語）

### インストール

1. VSCode マーケットプレイスからインストール
2. または、`.vsix`ファイルをダウンロードして手動でインストール：
   ```bash
   code --install-extension matomeru-0.0.1.vsix
   ```

### 使い方

1. エクスプローラーでディレクトリまたはファイルを右クリック
2. 「Matomeru: ディレクトリ/ファイルをまとめる」を選択
3. 出力先を選択：
   - エディタで開く
   - クリップボードにコピー
   - ChatGPTに送信（macOSのみ）

### 設定例

```json
{
  "matomeru.maxFileSize": 1048576,
  "matomeru.excludePatterns": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "coverage/**"
  ],
  "matomeru.chatGptIntegration": false,
  "matomeru.directoryStructure.directoryIcon": "📁",
  "matomeru.directoryStructure.fileIcon": "📄",
  "matomeru.directoryStructure.indentSize": 2,
  "matomeru.directoryStructure.showFileExtensions": true,
  "matomeru.prefixText": "# Project Overview\nThis is a sample project.",
  "matomeru.useGitignore": false
}
```

### 出力例

```markdown
# Project Overview
This is a sample project.

# Directory Structure
📁 src
  📄 index.ts
  📄 utils.ts
📁 tests
  📄 index.test.ts

# File Contents

## src/index.ts
- Size: 1.2 KB
- Language: TypeScript

```typescript
// ... file content ...
```

## src/utils.ts
...
```

### 必要要件

- VSCode 1.85.0以降
- ChatGPT連携機能を使用する場合：
  - macOS
  - Google Chrome
  - ChatGPTアカウント

### ライセンス

MIT License
