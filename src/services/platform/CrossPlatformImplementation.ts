import * as vscode from 'vscode';
import { IPlatformImplementation } from '@/services/platform/IPlatformImplementation';
import { ErrorService } from '@/errors/services/ErrorService';
import { UnsupportedPlatformError } from '@/errors/ChatGPTErrors';

/**
 * クロスプラットフォーム実装クラス
 */
export class CrossPlatformImplementation implements IPlatformImplementation {
    private errorService: ErrorService;

    constructor() {
        this.errorService = ErrorService.getInstance();
    }

    isAvailable(): boolean {
        return true; // 常に利用可能
    }

    async openInChatGPT(content: string): Promise<void> {
        try {
            const url = 'https://chat.openai.com/';
            await vscode.env.openExternal(vscode.Uri.parse(url));
            await this.copyToClipboard(content);
            
            await vscode.window.showInformationMessage(
                'ChatGPTをブラウザで開きました。コンテンツはクリップボードにコピーされています。'
            );
        } catch (error) {
            await this.errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'CrossPlatformImplementation.openInChatGPT',
                timestamp: new Date()
            });
        }
    }

    async copyToClipboard(text: string): Promise<void> {
        await vscode.env.clipboard.writeText(text);
    }

    async checkAccessibilityPermission(): Promise<boolean> {
        return true; // クロスプラットフォームでは不要
    }

    async launchApplication(bundleId: string): Promise<void> {
        throw new UnsupportedPlatformError('この機能はプラットフォーム固有の実装でのみ利用可能です');
    }
} 