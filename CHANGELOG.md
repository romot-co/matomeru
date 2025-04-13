# Change Log

All notable changes to the "matomeru" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

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