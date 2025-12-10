# Change Log

All notable changes to the "matomeru" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.7] - 2025-12-10
### Fixed
- **Windows compatibility**: Fixed `copy-wasm` script failing on Windows by replacing `mkdir -p` (Unix-only) with cross-platform Node.js `fs.mkdirSync`. This prevented the extension from working on Windows when installed via VSIX.
- **Windows localization**: Fixed l10n (localization) not working on Windows. The VS Code l10n API requires English message strings as keys, not custom identifiers like `msg.clipboardCopySuccessWithSize`.

### Changed
- Refactored all `vscode.l10n.t()` calls to use English messages as keys (e.g., `'Copied to clipboard (Size: {0}, ~{1} tokens)'`).
- Updated l10n bundle files (`l10n/bundle.l10n.json`, `l10n/bundle.l10n.ja.json`) to use the correct key format.
- Added `@vscode/l10n` to `.vscodeignore` allowlist for proper VSIX packaging.

## [0.1.6] - 2025-01-21
### Removed
- **esbuild dependency**: Removed esbuild package to resolve packaging issues with native binaries in VS Code extensions.
- **Runtime minification**: Removed `matomeru.enableMinifyIdentifiers` setting and the `minifyJsTsRuntimeEquivalent` function that performed JavaScript/TypeScript minification.

### Changed
- Compression pipeline now uses only Tree-sitter based features: comment removal and TypeScript type stripping via `matomeru.enableStripTypes`.
- Extension package size reduced by removing esbuild and its native dependencies.

## [0.1.5] - 2025-11-18
### Added
- **LLM-focused compression pipeline**: After Tree-sitter removes TypeScript-only syntax, esbuild now performs runtime-equivalent minification for JS/TS. Both `matomeru.enableStripTypes` and `matomeru.enableMinifyIdentifiers` default to true so running the compressed commands automatically applies every stage.
- **Function-scoped Git diff mode**: Introduced `matomeru.diff.mode = "function"` (default) plus `matomeru.diff.localContextLines`. `copyGitDiff` now AST-matches the functions/classes that touch the diff and falls back to entire files only when extraction fails.
- **Test coverage**: Added dedicated Jest suites for the git diff parser, function extractor, TypeScript type stripping, and the real WASM parser path.

### Changed
- The compressed clipboard workflow (Markdown/YAML/Git diff) now runs comment stripping → type stripping → whitespace tightening → esbuild minify in sequence, honoring the new settings everywhere.
- `collectChangedFilesWithLineInfo` parses `git diff --unified=0` and feeds AST extraction with safe fallbacks so the function mode remains robust.
- README/README.ja now document the new settings and updated VSIX install version.

## [0.1.4] - 2025-11-18
### Security
- Locked down `matomeru.copyGitDiff` by validating each revision-range token and invoking `git diff` via `spawn`, eliminating command injection vectors originating from `matomeru.gitDiff.range`.
- Hardened the validation to keep accepting safe Git syntax (reflog/upstream/peel) while still rejecting shell metacharacters, and ensured explorer-selected secrets (e.g. `.env`, `*.key`) stay excluded even when commands run on a single file.

### Changed
- Unified every scan/estimate path around `ConfigService`, ensuring default secret/lockfile exclusions stay active even when users override `excludePatterns`.
- File scanning now attaches/detaches `.gitignore` / `.vscodeignore` watchers dynamically as workspaces are added or removed, so exclusions remain up to date across multi-root sessions without reloading.
- Git diff command now asks which workspace folder to inspect in multi-root windows and runs entirely on the selected repo; all progress/warning messages are logged silently instead of flooding VS Code toasts.
- Extension activation waits for a workspace to open before constructing `CommandRegistrar`, preventing startup failures when VS Code launches with an empty window.
- Directory structure output groups files per workspace (with fallback labels for standalone paths) so identically named files from different folders no longer collide, and `commands.processDirectories` now drops empty results produced solely by exclusions.

### Fixed
- YAML generator now nests directory keys according to the real relative path so the structure mirrors the Markdown output, and Mermaid graphs gracefully truncate while still rendering available edges when the node cap is exceeded.
- `logError`/logger changes stop bulk scans from spawning dozens of warning dialogs while keeping telemetry intact.
- Git diff clipboard flow correctly switches between Markdown/YAML generators under test, and integration tests clean up by calling `deactivate()` to avoid cross-test leakage.
- Multi-root Git diff/command tests, workspace detection cases, and new Git-range unit tests cover the updated watcher lifecycle to keep `npm test` stable.
- Markdown/YAML generation tests now cover the new directory-grouping behavior, preventing regressions when workspace APIs or structure merging changes.


## [0.1.3] - 2025-09-21
### Changed
- **Compression algorithm enhancements**: Tightened Tree-sitter based whitespace trimming around operators and now remove Python docstrings / JSDoc-style comments by default for leaner outputs.

### Improved
- **Compression logging**: Log entries now report the number of removed comment/docstring blocks and the overall size reduction percentage so the effect is visible at a glance.

### Fixed
- **`.gitignore` / `.vscodeignore` loading**: Corrected `Map` flag handling to ensure ignore patterns load reliably in multi-root workspaces.
- **Configuration reload latency**: Invoke `ConfigService.reload()` inside `onDidChangeConfiguration` so `matomeru.*` updates take effect immediately.

## [0.1.2] - 2025-08-07
### Changed
- **Compression architecture overhaul**: Removed setting-based compression (`enableCompression`/`verboseCompression`) and replaced with explicit user-controlled commands
  - Users now choose compression explicitly via menu commands rather than hidden configuration settings
  - Improved user experience with clear compression options in context menus

### Added
- **New compressed clipboard command**: "Copy to Clipboard (Compressed)" available in right-click context menu
  - Keyboard shortcut: `Ctrl+Alt+Shift+C` / `Cmd+Alt+Shift+C` (Mac) for compressed clipboard copy
  - Removes comments and minifies whitespace using Tree-sitter for more efficient LLM context usage
- **Enhanced generator architecture**: Both MarkdownGenerator and YamlGenerator now support compression options as parameters
  - More modular and flexible compression handling
  - Better separation of concerns between configuration and feature functionality

### Fixed
- **Memory leak prevention**: Added proper `Parser.delete()` calls in ParserManager.dispose() to prevent Tree-sitter memory leaks
- **ChatGPT integration stability**: Extended AppleScript delay from 2 to 4 seconds for better browser loading reliability
- **Security enhancements**: Enhanced excludePatterns with additional security-sensitive patterns
  - Added `**/.env*`, `**/secrets/**`, `**/*.secret*`, `**/credentials/**`, `**/api_key*` patterns
- **Syntax errors**: Fixed string concatenation issues in test files that could cause build failures
- **Resource management**: Improved FileSystemWatcher disposal in FileOperations for cleaner shutdown

### Improved
- **Configuration system**: Removed compression-related dependencies from ConfigService, making it more modular
- **Code architecture**: Compression utilities (`compressUtils`) now operate independently without configuration dependencies
- **Generator interface**: Updated IGenerator interface to support optional compression parameters
- **Multilingual support**: Added complete English and Japanese translations for new compression commands
- **Error handling**: Enhanced error logging with detailed messages and proper fallback handling
- **Type safety**: Reduced usage of `any` types with more specific interface definitions
- **Test coverage**: Enhanced test suites to cover new architecture and command structures

### Technical Changes
- Refactored generators to accept compression options via method parameters instead of configuration lookup
- Updated extension command registration to include new compressed clipboard functionality
- Improved separation of concerns between configuration management and feature functionality
- Enhanced resource cleanup and memory management across the extension

## [0.1.1] - 2025-07-23
### Fixed
- **Python dependency scanning**: Fixed incorrect dot count calculation in relative imports that caused dependency graph corruption
  - Changed from using `importPath.length` to `node.text.length` for accurate dot counting
  - Removed incorrect `-1` offset in `../` repeat calculation
- **Code compression for indent-dependent languages**: Fixed indentation destruction in Python/YAML files
  - Preserved original indentation structure instead of converting all indents to single tabs
  - Only removes excessive blank lines and trailing whitespace for better code readability
- **Parser initialization race condition**: Fixed potential concurrent `Parser.init()` calls
  - Added `initPromise` caching to ensure thread-safe initialization
  - Prevents WASM loading conflicts when multiple parsers are requested simultaneously

## [0.1.0] - 2025-06-13
### Added
- **Multi-root workspace support**: Process files from multiple workspace folders with proper context isolation
- **Enhanced code compression**: When enabled, now removes comments, unnecessary whitespace, and newlines for more efficient LLM context usage
- **YAML memory optimization**: New `matomeru.yaml.includeContent` setting (default: false) to exclude file content in YAML output for large projects
- **Security enhancements**: Security-sensitive patterns in `excludePatterns` are now always enforced, even when users customize the configuration

### Improved
- **Token conversion accuracy**: Unified token-to-byte conversion factor (3.6) across all components for consistent estimation
- **Language detection**: Fixed `.tsx` files now correctly identified as 'tsx' instead of 'typescript'
- **Configuration validation**: Enhanced validation logic ensures default security patterns are always included
- **Code compression**: Now intelligently preserves syntax based on language type (indent-based vs brace-based)
- **Performance**: Optimized file scanning for multi-root workspaces

### Fixed
- Fixed issue where user-defined exclude patterns could completely override default security patterns
- Fixed recursive directory scanning in multi-root workspaces missing workspace root parameter
- Fixed TypeScript compilation errors in test suites
- Fixed localization key mismatches between English and Japanese files
- Removed obsolete Git diff commands (diffToEditor/diffToChatGPT) references
- Fixed configuration schema mismatches for new settings

### Changed
- Removed "Experimental" label from code compression feature - it's now stable and production-ready

## [0.0.18] - 2025-05-23
### Improved
- コピー操作を最大3回再試行することで、クリップボードへのコピー信頼性を向上
- テストスイート全体の品質向上
- ConfigServiceの設定値検証機能を強化し、無効値処理のエラーハンドリングを改善
- FileOperationsの深いディレクトリ構造パフォーマンステストを修正

### Added
- 循環依存検出の包括的テストケース
- Tree-sitter実パーサー統合テスト
- ExtensionContext・ParserManager単体テスト

### Fixed
- 統合テスト実行時における `vscode` API のモックに関する問題を修正
- TypeScriptコンパイルエラー（dependencyScanner.test.ts内の未使用変数）を修正
- エラーハンドリングの堅牢性を向上させるため、内部のエラーメッセージ抽出処理とカスタムエラークラスのコンストラクタを修正

## [0.0.16] - 2025-05-11
### Added
- **依存関係の分析と可視化**:
  - 有効にすると、TypeScript/JavaScript, Python, Go ファイルの import/dependency 文をスキャンします。
  - 依存関係を視覚化するために、Markdown 出力に Mermaid フローチャートを生成します。
  - YAML 出力の各ファイルエントリに `imports` リストを追加します。
- **Mermaid グラフ設定**:
  - 生成される依存関係グラフの最大ノード数を制御するための `matomeru.mermaid.maxNodes` (number, デフォルト: `300`) 設定を追加。制限を超えた場合は警告が表示されます。

## [0.0.13] - 2025-05-09
### Added
- **(Experimental)** YAML 形式での出力をサポート (`matomeru.outputFormat` 設定)。Markdownに加え、YAML形式でディレクトリ構造やファイル内容を出力できるようになりました。

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
