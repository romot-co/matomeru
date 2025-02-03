# Matomeru (まとめる)

VSCode extension to summarize directory structures and file contents in Markdown format.  
ディレクトリ構造とファイル内容をMarkdown形式でまとめるVSCode拡張機能です。

<img src="images/icon.png" width="128" height="128" alt="Matomeru Icon">

[English](#english) | [日本語](#japanese)

## English

### Features

- **Generate Markdown documentation** for directory structures and file contents
- **Automatically format and organize** your project documentation:
  - Directory tree structure
  - File contents with syntax highlighting
  - Markdown-compatible output
- Support for multiple output formats:
  - Display in editor
  - Copy to clipboard
  - Send to ChatGPT (macOS only)
- Customizable directory structure display:
  - Emoji icons for directories and files
  - Configurable indentation
  - Optional file extension display
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
  "matomeru.directoryStructure.useEmoji": true
}
```

### Requirements

- VSCode 1.96.0 or later
- For ChatGPT integration:
  - macOS
  - Google Chrome
  - ChatGPT account

### License

MIT License

---

## Japanese

### 機能

- ディレクトリ構造とファイル内容を**Markdown形式で自動生成**
- プロジェクトドキュメントを**自動的にフォーマットして整理**：
  - ディレクトリツリー構造
  - シンタックスハイライト付きファイル内容
  - Markdown互換の出力
- 複数の出力形式に対応：
  - エディタでの表示
  - クリップボードへのコピー
  - ChatGPTへの送信（macOSのみ）
- カスタマイズ可能なディレクトリ構造表示：
  - ディレクトリとファイルの絵文字アイコン
  - インデントの設定
  - ファイル拡張子の表示/非表示
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

### 設定

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
  "matomeru.directoryStructure.useEmoji": true
}
```

### 必要要件

- VSCode 1.96.0以降
- ChatGPT連携機能を使用する場合：
  - macOS
  - Google Chrome
  - ChatGPTアカウント

### ライセンス

MIT License
