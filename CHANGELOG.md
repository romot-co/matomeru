# Change Log

All notable changes to the "matomeru" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.12] - 2025-04-25

### Changed

- 右クリックメニューを簡略化し、以下の4項目のみに絞りました:
  - クリップボードにコピー
  - Diffをクリップボードにコピー
  - エディタで開く
  - ChatGPTに送る
- Git Diffはコピー操作のみを提供するようにシンプル化

### Added

- キーボードショートカット機能を追加:
  - `Ctrl+Alt+C` / `Cmd+Alt+C` (Mac): クリップボードにコピー
  - `Ctrl+Alt+D` / `Cmd+Alt+D` (Mac): Git差分をコピー
  - `Ctrl+Alt+E` / `Cmd+Alt+E` (Mac): エディタに出力

## [0.0.11] - 2025-04-21

### Added

- **Git Diff機能**:
  - ワークツリー vs HEADの差分ファイルをワンクリックでMarkdown化
  - 3つの新コマンド:
    - `Matomeru: Copy Git Diff` - クリップボードにコピー
    - `Matomeru: Diff to Editor` - エディタに表示
    - `Matomeru: Diff to ChatGPT` - ChatGPTに送信（macOS）
  - エクスプローラーとSCMコンテキストメニューから利用可能
  - 任意のリビジョン範囲の差分取得をサポート (`matomeru.gitDiff.range` 設定)

### Improved

- Tree-sitterコメント除去機能に統合テストを追加
  - Jest統合テスト環境の構築
  - モック環境でのTree-sitter WASMロードをテスト
  - コメント除去が実際に機能することを確認するテスト
- CIワークフローの追加 (GitHub Actions)
  - 単体テスト・統合テストの自動実行
  - リント・ビルド・パッケージングの自動化
- `verboseCompression`設定を追加し、コメント除去の詳細ログ出力をオプション化

## [0.0.10] - 2025-04-19

### Fixed

- Tree-sitter依存関係（`web-tree-sitter`と`tree-sitter-wasm-prebuilt`）を正しくバンドルするように修正
  - 依存関係を`devDependencies`から`dependencies`に移動
  - `bundledDependencies`フィールドを追加して確実にパッケージングされるように対応
  - これにより、コード圧縮機能が全てのユーザー環境で正常に動作するようになりました
- `tree-sitter-wasm-prebuilt`から`@vscode/tree-sitter-wasm`に移行し、互換性の問題を解決
  - バージョン不整合エラーを修正
  - 必要なWASMファイルが見つからないエラーを修正
  - サポート言語を整理し、実際に動作する言語のみに限定（JSON、PHP、HTML、Bashのサポートを削除）

## [0.0.9] - 2025-04-19

### Fixed

- Tree-sitter依存関係（`web-tree-sitter`と`tree-sitter-wasm-prebuilt`）を正しくバンドルするように修正
  - 依存関係を`devDependencies`から`dependencies`に移動
  - `bundledDependencies`フィールドを追加して確実にパッケージングされるように対応
  - これにより、コード圧縮機能が全てのユーザー環境で正常に動作するようになりました

## [0.0.8] - 2025-04-18

### Added

- - Tree-sitter を利用した主要言語のコード圧縮機能 (コメント除去・LLMのコンテスト長を圧迫しない) を追加

### Fixed
- コメント除去 (`stripComments`) 時に、ブロックコメント末尾の `/` が除去されずに残る問題を修正 (#1)
- Windows 環境において、パス区切り文字 (`\`) が原因でファイル除外パターン (`shouldExclude`) が正しく機能しない問題を修正 (#2)
- ファイル除外パターンマッチング (minimatch) で `nocase: true` と `dot: true` オプションを一貫して使用するように修正 (#2)
- ワークスペースを開かずに単一ファイルを開いた場合に、拡張機能が有効化されない問題を修正 (Activation Events に `onCommand` と `workspaceContains` を追加) (#5)
- Logger が Singleton パターンにより、テスト中に `dispose` された後、後続のテストで問題が発生する可能性があった問題を修正 (`dispose` 時にインスタンスをリセットするように変更) (#6)
- `estimateSize` コマンドのエラーハンドリングに関するテストが、エラーメッセージの変更により失敗していた問題を修正

### Improved
- `estimateSize` におけるトークン数の概算精度をわずかに向上 (除数を 4 から 3.5 に変更) (#8)
- 対応言語判定 (`detectLanguage`) のための拡張子マップを拡充 (Dockerfile, Makefile, .env, .lua, .pl, .r, .dart など) (#3 関連)
- README において、コード圧縮機能 (コメント除去) がベストエフォートであることを明確化 (#9 関連)

## [0.0.7]

### Improved
- ファイルサイズとトークン数の表示形式を改善
  - ファイルサイズをKB単位で読みやすく表示
  - 1000以上のトークン数をK単位（1K、1.5Kなど）で表示
  - 空のコンテンツの場合は簡潔なメッセージを表示

## [0.0.6]

### Added
- .vscodeignoreのパターンを使用してコピーしないファイルを指定するオプションを追加
  - 設定: `matomeru.useVscodeignore`
  - `.gitignore`と同様に、既存の除外パターンを活用可能に
- サイズ見積り機能の追加
  - 処理前にファイル数、サイズ、トークン数を確認可能
  - コマンド: `matomeru.estimateSize`
  - エクスプローラーのコンテキストメニューから「Matomeru: サイズを見積る」で実行可能

### Improved
- セキュリティ強化：デフォルトの除外パターンを拡張
  - 機密ファイル（鍵、証明書、環境変数ファイルなど）を自動的に除外
  - 一時ファイル、キャッシュディレクトリ、ビルド成果物などの非ソースファイルを除外
- ドキュメントの更新と改善
- パフォーマンス最適化

## [0.0.5]

### Added
- .gitignoreのパターンを使用してコピーしないファイルを指定するオプションを追加

## [0.0.4]

### Added
- 生成されるMarkdownの先頭に固定文言を追加する機能
  - 設定: `matomeru.prefixText`
  - プロジェクトの概要や説明文などを自動的に追加可能

## [0.0.3]

- Initial release