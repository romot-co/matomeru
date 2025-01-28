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