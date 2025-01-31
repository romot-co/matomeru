import * as vscode from 'vscode';
import { IPlatformImplementation } from './IPlatformImplementation';
import { IErrorHandler } from '../../shared/errors/services/ErrorService';
import { MatomeruError, ErrorCode } from '../../shared/errors/MatomeruError';

/**
 * クロスプラットフォーム実装クラス
 */
export class CrossPlatformImplementation implements IPlatformImplementation {
    constructor(
        private readonly errorHandler: IErrorHandler
    ) {}

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
            throw new MatomeruError(
                'この機能はmacOSでのみ利用可能です',
                ErrorCode.PLATFORM_ERROR,
                {
                    source: 'CrossPlatformImplementation.openInChatGPT',
                    timestamp: new Date()
                }
            );
        }
    }

    async copyToClipboard(text: string): Promise<void> {
        try {
            await vscode.env.clipboard.writeText(text);
        } catch (error) {
            const matomeruError = new MatomeruError(
                'クリップボードへのコピーに失敗しました',
                ErrorCode.CLIPBOARD_ERROR,
                {
                    source: 'CrossPlatformImplementation.copyToClipboard',
                    timestamp: new Date()
                }
            );
            await this.errorHandler.handleError(matomeruError);
            throw matomeruError;
        }
    }

    async checkAccessibilityPermission(): Promise<boolean> {
        return true; // クロスプラットフォームでは不要
    }

    async launchApplication(bundleId: string): Promise<void> {
        throw new MatomeruError(
            'この機能はmacOSでのみ利用可能です',
            ErrorCode.PLATFORM_ERROR,
            {
                source: 'CrossPlatformImplementation.launchApplication',
                timestamp: new Date()
            }
        );
    }
} 