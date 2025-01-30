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

    /**
     * ChatGPTアプリのバンドルID
     */
    chatgptBundleId?: string;

    /**
     * 開発用設定
     */
    development: {
        /**
         * ChatGPT機能をモックする
         */
        mockChatGPT: boolean;

        /**
         * デバッグログを有効にする
         */
        debugLogging: boolean;

        /**
         * ネイティブ機能を無効にする
         */
        disableNativeFeatures: boolean;
    };
}

export interface IConfigurationService {
    getConfiguration(): Configuration;
    addChangeListener(listener: (config: Configuration) => Promise<void>): void;
    removeChangeListener(listener: (config: Configuration) => Promise<void>): void;
}

export type ConfigurationChangeListener = (newConfig: Configuration) => void | Promise<void>;

/**
 * 設定管理サービス
 * VS Code の設定を管理し、設定変更の通知を提供します
 */
export class ConfigurationService implements IConfigurationService {
    private config: Configuration;
    private readonly configSection = 'matomeru';
    private readonly listeners: Set<ConfigurationChangeListener> = new Set();
    private disposable?: vscode.Disposable;

    constructor() {
        this.config = this.loadConfiguration();
        this.setupConfigurationWatcher();
    }

    /**
     * ファクトリメソッド - デフォルトの設定でConfigurationServiceインスタンスを生成
     */
    public static createDefault(): ConfigurationService {
        return new ConfigurationService();
    }

    getConfiguration(): Configuration {
        return this.config;
    }

    addChangeListener(listener: ConfigurationChangeListener): void {
        this.listeners.add(listener);
    }

    removeChangeListener(listener: ConfigurationChangeListener): void {
        this.listeners.delete(listener);
    }

    async updateConfiguration(changes: Partial<Configuration>): Promise<void> {
        const config = vscode.workspace.getConfiguration(this.configSection);
        
        for (const [key, value] of Object.entries(changes)) {
            if (typeof value === 'object' && value !== null) {
                // ネストされたオブジェクトの場合、各プロパティを個別に更新
                for (const [subKey, subValue] of Object.entries(value)) {
                    await config.update(`${key}.${subKey}`, subValue, vscode.ConfigurationTarget.Workspace);
                }
            } else {
                await config.update(key, value, vscode.ConfigurationTarget.Workspace);
            }
        }
        
        await this.reload();
    }

    dispose(): void {
        this.disposable?.dispose();
        this.listeners.clear();
    }

    private async reload(): Promise<void> {
        const oldConfig = this.config;
        this.config = this.loadConfiguration();

        // 設定に変更があった場合のみリスナーを呼び出す
        if (JSON.stringify(oldConfig) !== JSON.stringify(this.config)) {
            await this.notifyListeners();
        }
    }

    private setupConfigurationWatcher(): void {
        this.disposable = vscode.workspace.onDidChangeConfiguration(async e => {
            if (e.affectsConfiguration(this.configSection)) {
                await this.reload();
            }
        });
    }

    private loadConfiguration(): Configuration {
        const config = vscode.workspace.getConfiguration(this.configSection);
        return {
            excludePatterns: config.get('excludePatterns', ['node_modules/**', '.git/**']),
            maxFileSize: config.get('maxFileSize', 1024 * 1024), // 1MB
            maxConcurrentFiles: config.get('maxConcurrentFiles', 10),
            defaultOutputType: config.get('defaultOutputType', 'editor'),
            chatGptIntegration: config.get('chatGptIntegration', false),
            batchSize: config.get('batchSize', 100),
            chatgptBundleId: config.get('chatgptBundleId', 'com.openai.chat'),
            development: {
                mockChatGPT: config.get('development.mockChatGPT', false),
                debugLogging: config.get('development.debugLogging', false),
                disableNativeFeatures: config.get('development.disableNativeFeatures', false)
            }
        };
    }

    private async notifyListeners(): Promise<void> {
        const promises = Array.from(this.listeners).map(listener => {
            try {
                const result = listener(this.config);
                return result instanceof Promise ? result : Promise.resolve();
            } catch (error) {
                return Promise.reject(error);
            }
        });

        await Promise.all(promises);
    }
} 