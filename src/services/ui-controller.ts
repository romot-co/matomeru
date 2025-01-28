import * as vscode from 'vscode';
import { PlatformService } from './platform/PlatformService';
import { ChatGPTUIError } from '../errors/ChatGPTErrors';

export class UIController {
    private platformService: PlatformService;

    constructor(private readonly context: vscode.ExtensionContext) {
        this.platformService = PlatformService.getInstance();
    }

    async showInformationMessage(message: string): Promise<void> {
        await vscode.window.showInformationMessage(message);
    }

    async showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
        return await vscode.window.showErrorMessage(message, ...items);
    }

    async showWarningMessage(message: string): Promise<void> {
        await vscode.window.showWarningMessage(message);
    }

    async showProgressNotification<T>(
        title: string,
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
    ): Promise<T> {
        return await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable: false
            },
            task
        );
    }

    async openTextDocument(content: string): Promise<void> {
        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(document);
    }

    async copyToClipboard(content: string): Promise<void> {
        await vscode.env.clipboard.writeText(content);
    }

    async sendToChatGPT(content: string): Promise<void> {
        try {
            await this.platformService.openInChatGPT(content);
        } catch (error) {
            throw new ChatGPTUIError(error instanceof Error ? error.message : 'UI操作エラーが発生しました');
        }
    }
} 