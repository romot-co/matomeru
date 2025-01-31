import type { PlatformFeatures } from '../../types';
import { IErrorHandler } from '../../shared/errors/services/ErrorService';
import type { IPlatformImplementation } from './IPlatformImplementation';
import { MacOSImplementation } from './MacOSImplementation';
import { CrossPlatformImplementation } from './CrossPlatformImplementation';
import { II18nService } from '../../i18n/I18nService';
import { IConfigurationService } from '../config/ConfigurationService';
import { ILogger } from '../logging/LoggingService';

export interface IPlatformService {
    getFeatures(): PlatformFeatures;
    openInChatGPT(content: string): Promise<void>;
    copyToClipboard(text: string): Promise<void>;
    checkAccessibilityPermission(): Promise<boolean>;
    launchApplication(bundleId: string): Promise<void>;
}

/**
 * プラットフォーム機能サービス
 * プラットフォーム固有の機能を提供します
 */
export class PlatformService implements IPlatformService {
    private implementation: IPlatformImplementation;
    
    constructor(
        private readonly errorHandler: IErrorHandler,
        private readonly i18n: II18nService,
        private readonly config: IConfigurationService,
        private readonly logger: ILogger
    ) {
        this.implementation = this.createImplementation();
    }

    /**
     * ファクトリメソッド - デフォルトの設定でPlatformServiceインスタンスを生成
     */
    public static createDefault(
        errorHandler: IErrorHandler,
        i18n: II18nService,
        config: IConfigurationService,
        logger: ILogger
    ): PlatformService {
        return new PlatformService(errorHandler, i18n, config, logger);
    }

    /**
     * プラットフォームに応じた実装を作成します
     */
    private createImplementation(): IPlatformImplementation {
        // 開発モードでネイティブ機能を無効化する設定がある場合
        if (this.config.getConfiguration().development.disableNativeFeatures) {
            return new CrossPlatformImplementation(this.errorHandler);
        }

        // プラットフォームに応じた実装を選択
        switch (process.platform) {
            case 'darwin':
                const macOS = MacOSImplementation.createDefault(
                    this.errorHandler,
                    this.i18n,
                    this.config,
                    this.logger
                );
                return macOS.isAvailable() ? macOS : new CrossPlatformImplementation(this.errorHandler);
            case 'win32':
                // 将来的なWindows実装のための準備
                return new CrossPlatformImplementation(this.errorHandler);
            case 'linux':
                // 将来的なLinux実装のための準備
                return new CrossPlatformImplementation(this.errorHandler);
            default:
                return new CrossPlatformImplementation(this.errorHandler);
        }
    }

    /**
     * 現在のプラットフォームの機能サポート状況を取得します
     */
    getFeatures(): PlatformFeatures {
        const isMacOS = process.platform === 'darwin' && 
            !this.config.getConfiguration().development.disableNativeFeatures;
        
        return {
            canUseChatGPT: isMacOS,
            canUseNativeFeatures: isMacOS
        };
    }

    /**
     * ChatGPTでコンテンツを開きます
     */
    async openInChatGPT(content: string): Promise<void> {
        await this.implementation.openInChatGPT(content);
    }

    /**
     * クリップボードにテキストをコピーします
     */
    async copyToClipboard(text: string): Promise<void> {
        await this.implementation.copyToClipboard(text);
    }

    /**
     * アクセシビリティ権限を確認します
     */
    async checkAccessibilityPermission(): Promise<boolean> {
        if (this.config.getConfiguration().development.disableNativeFeatures) {
            return true;
        }

        if (process.platform === 'darwin') {
            return await this.implementation.checkAccessibilityPermission();
        }

        return true;
    }

    /**
     * プラットフォーム固有のアプリケーションを起動します
     */
    async launchApplication(bundleId: string): Promise<void> {
        await this.implementation.launchApplication(bundleId);
    }
} 