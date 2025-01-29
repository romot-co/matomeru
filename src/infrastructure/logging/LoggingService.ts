import * as vscode from 'vscode';
import { IConfigurationService } from '@/infrastructure/config/ConfigurationService';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogContext {
    source: string;
    details?: Record<string, unknown>;
    timestamp?: Date;
}

export interface ILogger {
    info(message: string, context?: LogContext): void;
    warn(message: string, context?: LogContext): void;
    error(message: string, context?: LogContext): void;
    debug(message: string, context?: LogContext): void;
    show(): void;
    dispose(): void;
}

export interface ILoggerConfig {
    isDebugEnabled: boolean;
}

/**
 * VSCode向けロギングサービス
 * 構造化ログを異なるログレベルでVSCode OutputChannelに出力します
 */
export class LoggingService implements ILogger {
    private outputChannel: vscode.LogOutputChannel;
    private config: ILoggerConfig;

    constructor(
        outputChannel: vscode.LogOutputChannel,
        private readonly configService: IConfigurationService
    ) {
        this.outputChannel = outputChannel;
        this.config = {
            isDebugEnabled: this.configService.getConfiguration().development?.debugLogging ?? false
        };
    }

    /**
     * ファクトリメソッド - VSCode環境での標準的なロガーインスタンスを生成
     */
    public static createDefault(configService: IConfigurationService): LoggingService {
        const channel = vscode.window.createOutputChannel('Matomeru', { log: true });
        return new LoggingService(channel, configService);
    }

    /**
     * 指定されたレベルとコンテキストでログを記録
     */
    private log(level: LogLevel, message: string, context?: LogContext): void {
        const timestamp = context?.timestamp || new Date();
        const logEntry = {
            timestamp: timestamp.toISOString(),
            level,
            message,
            ...(context && {
                source: context.source,
                details: context.details
            })
        };

        const logMessage = JSON.stringify(logEntry, null, this.config.isDebugEnabled ? 2 : 0);
        
        switch (level) {
            case 'INFO':
                this.outputChannel.info(logMessage);
                break;
            case 'WARN':
                this.outputChannel.warn(logMessage);
                break;
            case 'ERROR':
                this.outputChannel.error(logMessage);
                break;
            case 'DEBUG':
                this.outputChannel.debug(logMessage);
                break;
        }

        // 開発モードの場合はコンソールにも出力
        if (this.config.isDebugEnabled) {
            console.log(logMessage);
        }
    }

    public info(message: string, context?: LogContext): void {
        this.log('INFO', message, context);
    }

    public warn(message: string, context?: LogContext): void {
        this.log('WARN', message, context);
    }

    public error(message: string, context?: LogContext): void {
        this.log('ERROR', message, context);
    }

    public debug(message: string, context?: LogContext): void {
        if (this.config.isDebugEnabled) {
            this.log('DEBUG', message, context);
        }
    }

    public show(): void {
        this.outputChannel.show();
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
} 
