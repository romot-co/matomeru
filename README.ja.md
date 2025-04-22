# Matomeru

複数のコードをAI向けの一つのMarkdownにまとめる

<img src="images/icon.png" width="128" height="128" alt="Matomeru Icon">

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/romot-co.matomeru)](https://marketplace.visualstudio.com/items?itemName=romot-co.matomeru)

## 機能

- 選択したディレクトリ構造とファイル内容を**Markdown形式で自動生成**
- **自動的にフォーマットして整理**：
  - ディレクトリツリー構造
  - Markdown互換の出力
- 複数の出力形式に対応：
  - エディタでの表示
  - クリップボードへのコピー
  - ChatGPTへの送信（macOSのみ）
- **Git Diff機能**：
  - 変更ファイル（ワークツリー vs HEAD）をワンクリックでMarkdownに変換
  - 任意のリビジョン範囲指定が可能（例：`origin/main..HEAD`）
  - エクスプローラーとSCMコンテキストメニューから直接アクセス可能
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

## インストール

1. VSCode マーケットプレイスからインストール
2. または、`.vsix`ファイルをダウンロードして手動でインストール：
   ```bash
   code --install-extension matomeru-0.0.12.vsix
   ```

## 使い方

1. エクスプローラーでディレクトリまたはファイルを右クリック
2. 以下の出力先を選択：
   - 「Matomeru: エディタに出力」
   - 「Matomeru: クリップボードにコピー」
   - 「Matomeru: ChatGPTに送信」（macOSのみ）
   - 「Matomeru: Git差分をコピー」

### キーボードショートカット

キーボードショートカットを使用して素早くアクセスすることもできます：
- `Ctrl+Alt+C` / `Cmd+Alt+C` (Mac): クリップボードにコピー
- `Ctrl+Alt+D` / `Cmd+Alt+D` (Mac): Git差分をコピー
- `Ctrl+Alt+E` / `Cmd+Alt+E` (Mac): エディタに出力

これらのショートカットはVS Codeのキーボードショートカットエディタ（`Ctrl+K Ctrl+S` / `Cmd+K Cmd+S`）でカスタマイズできます。

## 設定例

<details>
<summary>settings.jsonの例（クリックして展開）</summary>

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
  "matomeru.enableCompression": false,
  "matomeru.gitDiff.range": ""
}
```
</details>

**Git Diffのリビジョン範囲**: `matomeru.gitDiff.range`を設定すると、変更ファイル収集時に指定したリビジョン範囲が使用されます。設定例：
- 空文字列（デフォルト）: ワークツリーとHEADの差分を表示
- `"HEAD~3..HEAD"`: 最新3コミットの変更を表示
- `"origin/main..HEAD"`: mainブランチと現在のHEADの差分を表示

**コード圧縮機能**: `matomeru.enableCompression`を`true`に設定すると、以下の主要言語について、Tree-sitterを使用してコードからコメント等の除去を**試みます**。これにより、LLMに送るコードをより簡潔にし、コンテキストを効率化できます。（Tree-sitterによるパースに失敗した場合は元のコードが出力されます。）

```txt
javascript, typescript, tsx, python, css, ruby, 
csharp, c, cpp, go, rust, java, ini, regex
```

**セキュリティに関する注記**: Matomeruはデフォルトで、シークレットキー、認証情報、証明書、環境設定ファイル
(`*.key`、`*.pem`、`*.env`など) のような機密ファイルを自動的に除外します。さらに、ロックファイル、キャッシュディレクトリ、ビルド成果物、一時ファイルなど、多くの一般的な非ソースファイルもデフォルトで除外されます。
これらの除外パターンはデフォルト設定の一部であり、`excludePatterns`設定をカスタマイズした場合でも適用されます。

## 出力例

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

## 必要要件

- VSCode 1.96.0以降
- ChatGPT連携機能を使用する場合：
  - macOS
  - Google Chrome
  - ChatGPTアカウント

## ライセンス

MIT License 