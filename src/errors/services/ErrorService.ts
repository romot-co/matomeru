import * as vscode from 'vscode';
import { ErrorContext } from '@/types';
import { BaseError } from '@/errors/base/BaseError';
import { I18nService } from '@/i18n/I18nService';
import { LoggingService } from '@/services/logging/LoggingService';

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

export interface ErrorLog {
    id: string;
    timestamp: string;
    type: string;
    message: string;
    stack?: string;
    context?: ErrorContext;
}

export class ErrorService {
    private static instance: ErrorService;
    private context?: vscode.ExtensionContext;
    private errorLogs: ErrorLog[] = [];
    private outputChannel: vscode.OutputChannel;
    private readonly i18n: I18nService;
    private readonly logger: LoggingService;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Matomeru');
        this.i18n = I18nService.getInstance();
        this.logger = LoggingService.getInstance();
    }

    static getInstance(): ErrorService {
        if (!ErrorService.instance) {
            ErrorService.instance = new ErrorService();
        }
        return ErrorService.instance;
    }

    setContext(context: vscode.ExtensionContext): void {
        this.context = context;
    }

    async handleError(error: Error | BaseError, context: ErrorContext): Promise<void> {
        const errorLog = this.createErrorLog(error, context);
        this.errorLogs.push(errorLog);
        this.logToOutputChannel(errorLog);

        this.logger.error('Error occurred', {
            source: 'ErrorService.handleError',
            details: {
                id: errorLog.id,
                type: errorLog.type,
                message: errorLog.message,
                context: errorLog.context
            }
        });

        switch (errorLog.type) {
            case 'ChatGPTPermissionError':
            case 'AccessibilityPermissionError':
                await vscode.window.showErrorMessage(
                    this.i18n.t('errors.accessibilityPermission'),
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

    private normalizeError(error: unknown): Error | BaseError {
        if (error instanceof Error || error instanceof BaseError) {
            return error;
        }
        return new BaseError(String(error), 'UNKNOWN_ERROR');
    }

    private createErrorLog(error: Error | BaseError, context: ErrorContext): ErrorLog {
        const timestamp = context.timestamp || new Date();
        const type = error instanceof BaseError ? error.name : 'UnknownError';

        return {
            id: this.generateErrorId(),
            timestamp: timestamp.toISOString(),
            type,
            message: error.message,
            stack: error.stack,
            context
        };
    }

    private generateErrorId(): string {
        return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    private logToOutputChannel(errorLog: ErrorLog): void {
        this.outputChannel.appendLine('=== Error Log ===');
        this.outputChannel.appendLine(`Time: ${errorLog.timestamp}`);
        this.outputChannel.appendLine(`Type: ${errorLog.type}`);
        this.outputChannel.appendLine(`Message: ${errorLog.message}`);
        
        if (errorLog.stack) {
            this.outputChannel.appendLine('Stack Trace:');
            this.outputChannel.appendLine(errorLog.stack);
        }
        
        this.outputChannel.appendLine('---\n');
    }

    getErrorLogs(): ErrorLog[] {
        return [...this.errorLogs];
    }

    clearErrorLogs(): void {
        this.errorLogs = [];
        this.outputChannel.clear();
    }

    private determineErrorType(error: Error | BaseError): ErrorType {
        if (error instanceof BaseError) {
            return error.name as ErrorType;
        }
        return error.name as ErrorType || 'UnknownError';
    }
} 