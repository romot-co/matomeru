import * as vscode from 'vscode';
import { ConfigurationService } from '../../services/config/ConfigurationService';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogContext {
    source: string;
    details?: Record<string, unknown>;
    timestamp?: Date;
}

/**
 * Logging service for centralized log management
 * Provides structured logging with different log levels and VSCode OutputChannel integration
 */
export class LoggingService {
    private static instance: LoggingService;
    private outputChannel: vscode.OutputChannel;
    private config: ConfigurationService;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Matomeru');
        this.config = ConfigurationService.getInstance();
    }

    public static getInstance(): LoggingService {
        if (!LoggingService.instance) {
            LoggingService.instance = new LoggingService();
        }
        return LoggingService.instance;
    }

    /**
     * Log a message with specified level and context
     */
    private log(level: LogLevel, message: string, context?: LogContext): void {
        const timestamp = context?.timestamp || new Date();
        const logEntry = {
            timestamp: timestamp.toISOString(),
            level,
            message,
            ...context && {
                source: context.source,
                details: context.details
            }
        };

        const config = this.config.getConfiguration();
        const logMessage = JSON.stringify(logEntry, null, config.development?.debugLogging ? 2 : 0);
        this.outputChannel.appendLine(logMessage);

        // In development mode, also log to console
        if (config.development?.debugLogging) {
            console.log(logMessage);
        }
    }

    /**
     * Log an info message
     */
    public info(message: string, context?: LogContext): void {
        this.log('INFO', message, context);
    }

    /**
     * Log a warning message
     */
    public warn(message: string, context?: LogContext): void {
        this.log('WARN', message, context);
    }

    /**
     * Log an error message
     */
    public error(message: string, context?: LogContext): void {
        this.log('ERROR', message, context);
    }

    /**
     * Log a debug message (only in development mode)
     */
    public debug(message: string, context?: LogContext): void {
        const config = this.config.getConfiguration();
        if (config.development?.debugLogging) {
            this.log('DEBUG', message, context);
        }
    }

    /**
     * Show the output channel
     */
    public show(): void {
        this.outputChannel.show();
    }

    /**
     * Dispose the output channel
     */
    public dispose(): void {
        this.outputChannel.dispose();
    }
} 
