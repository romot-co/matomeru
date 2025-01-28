import * as vscode from 'vscode';
import { ErrorContext } from '../../types';
import { I18n } from '../../i18n';

export type ErrorType =
    | 'ScanError'
    | 'UnsupportedPlatformError'
    | 'AccessibilityPermissionError'
    | 'ChatGPTAppNotFoundError'
    | 'ChatGPTIntegrationError'
    | 'ChatGPTTimeoutError'
    | 'ChatGPTPermissionError'
    | 'ChatGPTUIError'
    | 'UnknownError';

export interface ErrorMetadata {
    source: string;
    details?: Record<string, any>;
    type?: ErrorType;
    timestamp?: Date;
}

/**
 * エラーログのインターフェース
 */
export interface ErrorLog {
    /**
     * エラーメッセージ
     */
    message: string;

    /**
     * エラーの発生源
     */
    source: string;

    /**
     * エラーの発生時刻
     */
    timestamp: Date;

    /**
     * スタックトレース
     */
    stack?: string;

    /**
     * エラーコード
     */
    code?: string;

    /**
     * 関連するファイルパス
     */
    path?: string;

    /**
     * 拡張機能のバージョン
     */
    extensionVersion?: string;

    /**
     * 追加のメタデータ
     */
    metadata?: Record<string, unknown>;

    /**
     * エラータイプ
     */
    type: ErrorType;

    /**
     * 詳細なエラー情報
     */
    details?: Record<string, any>;
}

/**
 * エラー処理を統一的に管理するサービス
 */
export class ErrorService {
    private static instance: ErrorService;
    private context?: vscode.ExtensionContext;
    private errorLogs: ErrorLog[] = [];
    private outputChannel: vscode.OutputChannel;
    private i18n: I18n;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Matomeru');
        this.i18n = I18n.getInstance();
    }

    /**
     * インスタンスを取得します
     */
    static getInstance(): ErrorService {
        if (!ErrorService.instance) {
            ErrorService.instance = new ErrorService();
        }
        return ErrorService.instance;
    }

    /**
     * 拡張機能のコンテキストを設定します
     */
    setContext(context: vscode.ExtensionContext): void {
        this.context = context;
    }

    /**
     * エラーを処理します
     */
    async handleError(error: Error, context: ErrorContext): Promise<void> {
        const errorLog = this.createErrorLog(error, context);
        this.errorLogs.push(errorLog);
        this.logToOutputChannel(errorLog);

        // エラータイプに応じた特別な処理
        switch (errorLog.type) {
            case 'ChatGPTPermissionError':
            case 'AccessibilityPermissionError':
                await vscode.window.showErrorMessage(
                    this.i18n.t('errors.permissionRequired'),
                    { modal: true }
                );
                break;
            case 'UnsupportedPlatformError':
                await vscode.window.showErrorMessage(
                    this.i18n.t('errors.macOSOnly'),
                    { modal: true }
                );
                break;
            default:
                await vscode.window.showErrorMessage(
                    `${error.message}\n${this.i18n.t('errors.checkErrorLog')}`
                );
        }
    }

    /**
     * エラーを正規化します
     */
    private normalizeError(error: unknown): Error {
        if (error instanceof Error) {
            return error;
        }
        return new Error(String(error));
    }

    /**
     * エラーログを作成します
     */
    private createErrorLog(error: Error, context: ErrorContext): ErrorLog {
        return {
            message: error.message,
            source: context.source || 'unknown',
            type: this.determineErrorType(error),
            details: context.details,
            timestamp: new Date(),
            stack: error.stack,
            extensionVersion: this.context?.extension?.packageJSON?.version
        };
    }

    /**
     * 出力チャンネルにログを記録します
     */
    private logToOutputChannel(errorLog: ErrorLog): void {
        this.outputChannel.appendLine('=== Error Log ===');
        this.outputChannel.appendLine(`Time: ${errorLog.timestamp.toISOString()}`);
        this.outputChannel.appendLine(`Source: ${errorLog.source}`);
        this.outputChannel.appendLine(`Type: ${errorLog.type}`);
        this.outputChannel.appendLine(`Message: ${errorLog.message}`);
        
        if (errorLog.stack) {
            this.outputChannel.appendLine('Stack Trace:');
            this.outputChannel.appendLine(errorLog.stack);
        }
        
        if (errorLog.details) {
            this.outputChannel.appendLine('Details:');
            this.outputChannel.appendLine(JSON.stringify(errorLog.details, null, 2));
        }
        
        if (errorLog.extensionVersion) {
            this.outputChannel.appendLine(`Extension Version: ${errorLog.extensionVersion}`);
        }
        
        this.outputChannel.appendLine('---\n');
    }

    /**
     * エラーログを取得します
     */
    getErrorLog(): ErrorLog[] {
        return [...this.errorLogs];
    }

    /**
     * エラーログをクリアします
     */
    clearErrorLog(): void {
        this.errorLogs = [];
        this.outputChannel.clear();
    }

    private determineErrorType(error: Error): ErrorType {
        return error.name as ErrorType || 'UnknownError';
    }
} 