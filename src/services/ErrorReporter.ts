import * as vscode from 'vscode';
import { I18n } from '../i18n';

export interface ErrorMetadata {
    code?: string;
    file?: string;
    [key: string]: any;
}

export interface ErrorLog extends ErrorMetadata {
    message: string;
    stack?: string;
    timestamp: string;
    extensionVersion: string;
}

export class ErrorReporter {
    private i18n: I18n;

    constructor(private context: vscode.ExtensionContext) {
        this.i18n = I18n.getInstance();
    }

    async report(error: Error, metadata: ErrorMetadata = {}): Promise<void> {
        const errorLog = this.createErrorLog(error, metadata);
        await this.context.globalState.update('lastError', errorLog);
        await this.showUserFriendlyMessage(errorLog);
    }

    private createErrorLog(error: Error, metadata: ErrorMetadata): ErrorLog {
        return {
            ...metadata,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            extensionVersion: this.context.extension.packageJSON.version
        };
    }

    private async showUserFriendlyMessage(log: ErrorLog): Promise<void> {
        const message = this.i18n.t(`errors.${log.code || 'default'}`);
        const showDetails = this.i18n.t('ui.messages.showDetails');
        
        const selection = await vscode.window.showErrorMessage(
            message,
            showDetails
        );

        if (selection === showDetails) {
            await vscode.window.showErrorMessage(log.stack || this.i18n.t('ui.messages.noStackTrace'));
        }
    }
} 