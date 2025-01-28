import * as vscode from 'vscode';
import { I18n } from '../i18n';

export interface ErrorLog {
    message: string;
    timestamp: string;
    stack?: string;
    code?: string;
    path?: string;
}

export class ErrorHandler {
    private static instance: ErrorHandler;
    private i18n: I18n;

    private constructor() {
        this.i18n = I18n.getInstance();
    }

    static getInstance(): ErrorHandler {
        if (!ErrorHandler.instance) {
            ErrorHandler.instance = new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    async handleError(
        error: unknown,
        context: vscode.ExtensionContext,
        options?: {
            showNotification?: boolean;
            logToOutput?: boolean;
            code?: string;
            path?: string;
        }
    ): Promise<void> {
        const normalizedError = this.normalizeError(error);
        const errorLog = this.createErrorLog(normalizedError, options);

        // グローバルステートに保存
        await context.globalState.update('lastError', errorLog);

        // 出力チャンネルにログを記録
        if (options?.logToOutput) {
            this.logToOutputChannel(errorLog);
        }

        // エラー通知を表示
        if (options?.showNotification !== false) {
            await this.showErrorNotification(errorLog);
        }
    }

    private normalizeError(error: unknown): Error {
        if (error instanceof Error) {
            return error;
        }
        return new Error(String(error));
    }

    private createErrorLog(error: Error, options?: { code?: string; path?: string }): ErrorLog {
        return {
            message: error.message,
            timestamp: new Date().toISOString(),
            stack: error.stack,
            code: options?.code,
            path: options?.path
        };
    }

    private logToOutputChannel(errorLog: ErrorLog): void {
        const outputChannel = vscode.window.createOutputChannel('Matomeru');
        outputChannel.appendLine('=== Error Log ===');
        outputChannel.appendLine(`Time: ${errorLog.timestamp}`);
        outputChannel.appendLine(`Message: ${errorLog.message}`);
        if (errorLog.code) {
            outputChannel.appendLine(`Code: ${errorLog.code}`);
        }
        if (errorLog.path) {
            outputChannel.appendLine(`Path: ${errorLog.path}`);
        }
        if (errorLog.stack) {
            outputChannel.appendLine('Stack Trace:');
            outputChannel.appendLine(errorLog.stack);
        }
        outputChannel.show();
    }

    private async showErrorNotification(errorLog: ErrorLog): Promise<void> {
        const detail = this.i18n.t('ui.messages.showDetails');
        const selection = await vscode.window.showErrorMessage(
            this.i18n.t('ui.messages.error', errorLog.message),
            detail
        );

        if (selection === detail) {
            const details = [
                `Message: ${errorLog.message}`,
                errorLog.code ? `Code: ${errorLog.code}` : null,
                errorLog.path ? `Path: ${errorLog.path}` : null,
                errorLog.stack ? `Stack:\n${errorLog.stack}` : this.i18n.t('ui.messages.noStackTrace')
            ].filter(Boolean).join('\n');

            await vscode.window.showErrorMessage(details);
        }
    }
} 