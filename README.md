# Matomeru

Combine and copy your entire codes into one LLM-ready Markdown.

複数のコードをAI向けの一つのMarkdownにまとめる

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
- **Code Compression (Experimental)**: Attempts to remove comments using Tree-sitter to reduce context length for LLMs. (See Configuration section for details)
- Flexible file exclusion:
  - Configure custom patterns to exclude
  - Use .gitignore .vscodeignore patterns to automatically exclude files (optional)
- Localization support (English/Japanese)
- Estimate size before processing large projects

### Installation

1. Install from VSCode Marketplace
2. Or download the `.vsix` file and install manually:
   ```bash
   code --install-extension matomeru-0.0.10.vsix
   ```

### Usage

1. Right-click on a directory or file in the explorer
2. Select "Matomeru: Summarize Directory/File"
3. Choose output destination:
   - Open in Editor
   - Copy to Clipboard
   - Send to ChatGPT (macOS only)
4. To check the size before processing:
   - Right-click and select "Matomeru: Estimate Size"
   - This shows file count, total size, and estimated token count without generating the full output

### Configuration

```json
{
  "matomeru.maxFileSize": 1048576,
  "matomeru.excludePatterns": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "coverage/**",
    ".DS_Store",
    "Thumbs.db",
    "*.key",
    "*.env*",
    "package-lock.json"
  ],
  "matomeru.chatGptIntegration": false,
  "matomeru.directoryStructure.directoryIcon": "📁",
  "matomeru.directoryStructure.fileIcon": "📄",
  "matomeru.directoryStructure.indentSize": 2,
  "matomeru.directoryStructure.showFileExtensions": true,
  "matomeru.prefixText": "",
  "matomeru.useGitignore": false,
  "matomeru.useVscodeignore": false,
  "matomeru.enableCompression": false
}
```

**Code Compression**: When `matomeru.enableCompression` is set to `true`, Matomeru *attempts* to remove comments and unnecessary code using Tree-sitter for the following languages, making the code more compact for LLMs. (If parsing fails, the original code will be used.)

```txt
javascript, typescript, tsx, python, css, ruby, 
csharp, c, cpp, go, rust, java, ini, regex
```

**Note on Security**: By default, Matomeru automatically excludes sensitive files like secret keys, 
credentials, certificates, and environment files (`*.key`, `*.pem`, `*.env`, etc.) to prevent accidental 
inclusion of confidential information in the generated output. Additionally, many common non-source files
like lock files, cache directories, build artifacts, and temporary files are excluded by default.
These exclusions are part of the default configuration and will apply even if you customize the `excludePatterns` setting.

### Output Example

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
- **コード圧縮機能 (実験的)**: Tree-sitterを使用してコメント等を除去し、LLM向けのコンテキスト長削減を試みます。（詳細は設定例の項目を参照）
- 柔軟なファイル除外機能：
  - カスタムパターンで除外設定
  - .gitignore/.vscodeignoreファイルのパターンを使用して自動的にファイルを除外（オプション）
- 多言語対応（英語/日本語）
- サイズ見積り機能で大きなプロジェクトを処理前に確認可能

### インストール

1. VSCode マーケットプレイスからインストール
2. または、`.vsix`ファイルをダウンロードして手動でインストール：
   ```bash
   code --install-extension matomeru-0.0.10.vsix
   ```

### 使い方

1. エクスプローラーでディレクトリまたはファイルを右クリック
2. 「Matomeru: クリップボードにコピー」などを出力先に合わせて選択
3. 処理前にサイズを確認するには：
   - 右クリックして「Matomeru: サイズを見積る」を選択

### 設定例

```json
{
  "matomeru.maxFileSize": 1048576,
  "matomeru.excludePatterns": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "coverage/**",
    ".DS_Store",
    "Thumbs.db",
    "*.key",
    "*.env*",
    "package-lock.json"
  ],
  "matomeru.chatGptIntegration": false,
  "matomeru.directoryStructure.directoryIcon": "📁",
  "matomeru.directoryStructure.fileIcon": "📄",
  "matomeru.directoryStructure.indentSize": 2,
  "matomeru.directoryStructure.showFileExtensions": true,
  "matomeru.prefixText": "",
  "matomeru.useGitignore": false,
  "matomeru.useVscodeignore": false,
  "matomeru.enableCompression": false
}
```

**コード圧縮機能**: `matomeru.enableCompression`を`true`に設定すると、以下の主要言語について、Tree-sitterを使用してコードからコメント等の除去を**試みます**。これにより、LLMに送るコードをより簡潔にし、コンテキストを効率化できます。（Tree-sitterによるパースに失敗した場合は元のコードが出力されます。）

```txt
javascript, typescript, tsx, python, css, ruby, 
csharp, c, cpp, go, rust, java, ini, regex
```

**セキュリティに関する注記**: Matomeruはデフォルトで、シークレットキー、認証情報、証明書、環境設定ファイル
(`*.key`、`*.pem`、`*.env`など) のような機密ファイルを自動的に除外します。さらに、ロックファイル、キャッシュディレクトリ、ビルド成果物、一時ファイルなど、多くの一般的な非ソースファイルもデフォルトで除外されます。
これらの除外パターンはデフォルト設定の一部であり、`excludePatterns`設定をカスタマイズした場合でも適用されます。

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

- VSCode 1.96.0以降
- ChatGPT連携機能を使用する場合：
  - macOS
  - Google Chrome
  - ChatGPTアカウント

### ライセンス

MIT License
