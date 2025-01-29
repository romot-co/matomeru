/**
 * ディレクトリスキャン関連の型定義
 */

export interface DirectoryScannerOptions {
    /**
     * 同時に処理するファイルの最大数
     */
    maxConcurrency: number;

    /**
     * 一度に処理するバッチサイズ
     */
    batchSize: number;

    /**
     * 除外するファイルパターン
     */
    excludePatterns: string[];

    /**
     * 処理する最大ファイルサイズ（バイト）
     */
    maxFileSize: number;
}

export interface ScanResult {
    /**
     * ファイルパス
     */
    path: string;

    /**
     * ファイルの内容
     */
    content: string;

    /**
     * ファイルの拡張子
     */
    extension: string;
}

export interface ScanProgress {
    /**
     * 現在の進行状況（0-100）
     */
    progress: number;

    /**
     * 現在の処理状態を示すメッセージ
     */
    message: string;
}

/**
 * ファイルシステム関連の型定義
 */

export interface FileSystemEntity {
    /**
     * エンティティの種類（ファイルまたはディレクトリ）
     */
    type: 'file' | 'directory';

    /**
     * エンティティのパス
     */
    path: string;

    /**
     * ファイルの内容（ファイルの場合のみ）
     */
    content?: string;

    /**
     * 子エンティティ（ディレクトリの場合のみ）
     */
    children?: FileSystemEntity[];
}

/**
 * ファイルタイプ関連の型定義
 */

export interface FileTypeConfig {
    /**
     * ファイルタイプの表示名
     */
    typeName: string;

    /**
     * VSCode言語ID
     */
    languageId: string;
}

export interface FileTypesConfig {
    [key: string]: FileTypeConfig;
}

/**
 * エラー処理関連の型定義
 */

export interface ErrorContext {
    /**
     * エラーの発生源
     */
    source: string;

    /**
     * 追加のエラー詳細情報
     */
    details?: Record<string, unknown>;

    /**
     * エラー発生時刻
     */
    timestamp: Date;
}

/**
 * プラットフォーム関連の型定義
 */

export interface PlatformFeatures {
    /**
     * ChatGPT機能が利用可能かどうか
     */
    canUseChatGPT: boolean;

    /**
     * ネイティブ機能が利用可能かどうか
     */
    canUseNativeFeatures: boolean;
}

/**
 * アプリケーション設定関連の型定義
 */

export interface ApplicationConfig {
    /**
     * 同時処理数
     */
    maxConcurrency: number;

    /**
     * バッチサイズ
     */
    batchSize: number;

    /**
     * 除外パターン
     */
    excludePatterns: string[];

    /**
     * 表示言語
     */
    language: string;

    /**
     * テーマ設定
     */
    theme: string;
}

/**
 * 階層構造関連の型定義
 */

export interface HierarchyNode {
    /**
     * ノードの名前
     */
    name: string;

    /**
     * ノードの種類
     */
    type: 'file' | 'directory';

    /**
     * ノードのパス
     */
    path: string;

    /**
     * 子ノード
     */
    children?: HierarchyNode[];

    /**
     * 階層レベル
     */
    level: number;
}

/**
 * サービス層の共通型定義
 */
