import * as vscode from 'vscode';

export interface Configuration {
    /**
     * 除外するファイルパターン
     */
    excludePatterns: string[];

    /**
     * 処理する最大ファイルサイズ（バイト）
     */
    maxFileSize: number;

    /**
     * 同時に処理するファイルの最大数
     */
    maxConcurrentFiles: number;

    /**
     * デフォルトの出力タイプ
     */
    defaultOutputType: 'editor' | 'clipboard';

    /**
     * ChatGPT連携の有効/無効
     */
    chatGptIntegration: boolean;

    /**
     * 一度に処理するバッチサイズ
     */
    batchSize: number;
}

export class ConfigurationManager {
    private static instance: ConfigurationManager;
    private config: Configuration;

    private constructor() {
        this.config = this.loadConfiguration();
    }

    static getInstance(): ConfigurationManager {
        if (!ConfigurationManager.instance) {
            ConfigurationManager.instance = new ConfigurationManager();
        }
        return ConfigurationManager.instance;
    }

    getConfiguration(): Configuration {
        return this.config;
    }

    reload(): void {
        this.config = this.loadConfiguration();
    }

    private loadConfiguration(): Configuration {
        const config = vscode.workspace.getConfiguration('matomeru');
        return {
            excludePatterns: config.get('excludePatterns', ['node_modules/**', '.git/**']),
            maxFileSize: config.get('maxFileSize', 1024 * 1024), // 1MB
            maxConcurrentFiles: config.get('maxConcurrentFiles', 10),
            defaultOutputType: config.get('defaultOutputType', 'editor'),
            chatGptIntegration: config.get('chatGptIntegration', false),
            batchSize: config.get('batchSize', 100)
        };
    }
} 