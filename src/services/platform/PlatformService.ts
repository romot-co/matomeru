import * as vscode from 'vscode';
import { PlatformFeatures } from '../../types';
import { ErrorService } from '../error/ErrorService';
import { IPlatformImplementation } from './IPlatformImplementation';
import { MacOSImplementation } from './MacOSImplementation';
import { CrossPlatformImplementation } from './CrossPlatformImplementation';

/**
 * プラットフォーム依存の機能を管理するサービス
 */
export class PlatformService {
    private static instance: PlatformService;
    private errorService: ErrorService;
    private implementation: IPlatformImplementation;
    
    private constructor() {
        this.errorService = ErrorService.getInstance();
        this.implementation = this.createImplementation();
    }
    
    static getInstance(): PlatformService {
        if (!PlatformService.instance) {
            PlatformService.instance = new PlatformService();
        }
        return PlatformService.instance;
    }

    /**
     * プラットフォームに応じた実装を作成します
     */
    private createImplementation(): IPlatformImplementation {
        switch (process.platform) {
            case 'darwin':
                const macOS = new MacOSImplementation();
                return macOS.isAvailable() ? macOS : new CrossPlatformImplementation();
            case 'win32':
                // 将来的なWindows実装のための準備
                return new CrossPlatformImplementation();
            case 'linux':
                // 将来的なLinux実装のための準備
                return new CrossPlatformImplementation();
            default:
                return new CrossPlatformImplementation();
        }
    }

    /**
     * 現在のプラットフォームの機能サポート状況を取得します
     */
    getFeatures(): PlatformFeatures {
        const macOS = new MacOSImplementation();
        return {
            canUseChatGPT: true, // ブラウザ版は常に利用可能
            canUseNativeFeatures: macOS.isAvailable()
        };
    }

    /**
     * ChatGPTでコンテンツを開きます
     */
    async openInChatGPT(content: string): Promise<void> {
        try {
            await this.implementation.openInChatGPT(content);
        } catch (error) {
            await this.errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'PlatformService.openInChatGPT',
                timestamp: new Date()
            });
        }
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
        return this.implementation.checkAccessibilityPermission();
    }

    /**
     * プラットフォーム固有のアプリケーションを起動します
     */
    async launchApplication(bundleId: string): Promise<void> {
        await this.implementation.launchApplication(bundleId);
    }
} 