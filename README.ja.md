# Matomeru

複数のコードをAI向けの一つのMarkdown/YAMLにまとめる

<img src="images/icon.png" width="128" height="128" alt="Matomeru Icon">

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/romot-co.matomeru)](https://marketplace.visualstudio.com/items?itemName=romot.matomeru)

## 機能

- 選択したディレクトリ構造とファイル内容を**Markdown形式で自動生成**
- **YAML出力**: `matomeru.outputFormat` 設定により、Markdown と YAML の間で出力形式を選択できるようになりました。
- **依存関係の分析と可視化**: `matomeru.includeDependencies` が有効な場合、ファイル内のimport/dependency文（TypeScript/JavaScript, Python, Go対応）をスキャンし、Markdown出力の先頭に関係性を視覚化するMermaidフローチャートを生成します。
- **マルチルートワークスペース対応**: 複数のワークスペースフォルダーからファイルを適切にコンテキスト分離して処理
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
- **強化されたコード圧縮機能**: Tree-sitterを使用してコメント、不要な空白、改行を除去し、LLM向けのコンテキスト長削減を実現します。（詳細は設定例の項目を参照）
- 柔軟なファイル除外機能：
  - カスタムパターンで除外設定
  - .gitignore/.vscodeignoreファイルのパターンを使用して自動的にファイルを除外（オプション）
  - セキュリティに配慮したファイルは常にデフォルトで除外
- 多言語対応（英語/日本語）
- サイズ見積り機能で大きなプロジェクトを処理前に確認可能
- **メモリ最適化されたYAML出力**: 大規模プロジェクト向けにYAML形式でファイル内容を除外するオプション

## インストール

1. VSCode マーケットプレイスからインストール
2. または、`.vsix`ファイルをダウンロードして手動でインストール：
   ```bash
   code --install-extension matomeru-0.1.0.vsix
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

**`matomeru.outputFormat`**: 生成されるドキュメントの出力形式を指定します。
  - `"markdown"` (デフォルト): Markdown形式で出力します。
  - `"yaml"`: YAML形式で出力します。
  出力形式を変更するには、VS Codeの設定（JSON）でこの設定を更新します。例えば、YAMLに切り替えるには次のようにします:
  ```json
  "matomeru.outputFormat": "yaml"
  ```

**`matomeru.includeDependencies`**: (boolean, デフォルト: `false`) `true` に設定すると、ファイル内のimport/dependency文をスキャンします（TypeScript/JavaScript, Python, Go対応）。この情報は以下の目的で使用されます:
  - YAML出力の各ファイルに `imports` リストを含める。
  - Markdown出力の先頭にMermaid依存関係グラフを生成する。

**`matomeru.mermaid.maxNodes`**: (number, デフォルト: `300`) Mermaid依存関係グラフにレンダリングするノードの最大数を指定します。ユニークなファイルと依存関係の数がこの制限を超えた場合、グラフは切り捨てられ、警告メッセージが表示されます。

<details>
<summary>settings.jsonの例（クリックして展開）</summary>

```json
{
  "matomeru.outputFormat": "markdown",
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
  "matomeru.directoryStructure.useEmoji": true,
  "matomeru.prefixText": "",
  "matomeru.useGitignore": false,
  "matomeru.useVscodeignore": false,
  "matomeru.enableMinifyIdentifiers": false,
  "matomeru.enableStripTypes": false,
  "matomeru.includeDependencies": false,
  "matomeru.mermaid.maxNodes": 300,
  "matomeru.diff.mode": "function",
  "matomeru.diff.localContextLines": 3,
  "matomeru.gitDiff.range": "",
  "matomeru.yaml.includeContent": false
}
```
</details>

**Git Diffのリビジョン範囲**: `matomeru.gitDiff.range`を設定すると、変更ファイル収集時に指定したリビジョン範囲が使用されます。設定例：
- 空文字列（デフォルト）: ワークツリーとHEADの差分を表示
- `"HEAD~3..HEAD"`: 最新3コミットの変更を表示
- `"origin/main..HEAD"`: mainブランチと現在のHEADの差分を表示

**コード圧縮機能**: 「Matomeru: クリップボード（圧縮）」コマンド（`Ctrl+Alt+Shift+C` / `Cmd+Alt+Shift+C`）を使用すると、Tree-sitterでコメントと不要な空白を削除したコンテンツを得られます。LLM へ貼り付ける際にトークン数を抑えたい場合に活用してください。（Tree-sitterの解析に失敗した場合は元のコードが使用されます。）

圧縮コマンドを実行すると、以下の処理が自動的に適用されます（どちらもデフォルト有効で、設定から無効化可能です）:

- `matomeru.enableStripTypes` (既定: `true`): TypeScript専用構文（型注釈、`import type`、`as`、interfaceなど）を実行同値のまま削除します。
- `matomeru.enableMinifyIdentifiers` (既定: `true`): esbuildのミニファイで JavaScript/TypeScript の識別子や空白を極力削減します。

**YAMLメモリ最適化**: `matomeru.yaml.includeContent`設定（デフォルト: `false`）は、YAML出力にファイル内容を含めるかどうかを制御します。大規模プロジェクトでは、これを無効にしておくことでメモリの問題を防ぎながら、プロジェクト構造とメタデータを提供できます。

**Git Diffモード**:

- `matomeru.diff.mode = "function"`（デフォルト）: 「Git差分をコピー」実行時、差分に触れた関数/クラス本体だけ（＋指定行数の文脈）を抽出します。
- `matomeru.diff.mode = "file"`: 以前と同じくファイル全体をコピーします。
- `matomeru.diff.localContextLines`: 関数/クラス抽出時に付与する前後の文脈行数を調整できます。

**セキュリティに関する注記**: Matomeruはデフォルトで、シークレットキー、認証情報、証明書、環境設定ファイル
(`*.key`、`*.pem`、`*.env`など) のような機密ファイルを自動的に除外します。さらに、ロックファイル、キャッシュディレクトリ、ビルド成果物、一時ファイルなど、多くの一般的な非ソースファイルもデフォルトで除外されます。
これらの除外パターンはデフォルト設定の一部であり、`excludePatterns`設定をカスタマイズした場合でも適用されます。

## 出力例

```markdown
# Project Overview
This is a sample project.

<!-- matomeru:auto-graph:start -->
```mermaid
flowchart TD
    "src/index.ts" --> "src/utils.ts"
    "src/index.ts" --> "external:lodash"
    "tests/index.test.ts" --> "src/index.ts"
```
<!-- matomeru:auto-graph:end -->
---

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
