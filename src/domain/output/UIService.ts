import * as vscode from 'vscode';
import { II18nService } from '../../i18n/I18nService';
import { ILogger } from '../../infrastructure/logging/LoggingService';
import { IClipboardService } from '../../infrastructure/platform/ClipboardService';

export interface OutputDestination {
    id: string;
    label: string;
    description: string;
}

export interface IUIService {
    showInformationMessage(message: string): Promise<void>;
    showErrorMessage(message: string, isPersistent?: boolean): Promise<void>;
    showProgress<T>(title: string, task: (progress: vscode.Progress<{ message?: string }>) => Promise<T>): Promise<T>;
    openTextDocument(content: string): Promise<void>;
}

/**
 * UI操作サービス
 * VS Code のUI関連APIをラップし、一貫したインターフェースを提供します
 */
export class UIService implements IUIService {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly i18n: II18nService,
        private readonly logger: ILogger,
        private readonly clipboardService: IClipboardService
    ) {}

    /**
     * ファクトリメソッド - デフォルトの設定でUIServiceインスタンスを生成
     */
    public static createDefault(
        context: vscode.ExtensionContext,
        i18n: II18nService,
        logger: ILogger,
        clipboardService: IClipboardService
    ): UIService {
        return new UIService(context, i18n, logger, clipboardService);
    }

    async showOutputDestinationPicker(): Promise<OutputDestination | undefined> {
        const items: OutputDestination[] = [
            {
                id: 'editor',
                label: this.i18n.t('ui.outputDestination.editor.label'),
                description: this.i18n.t('ui.outputDestination.editor.description')
            },
            {
                id: 'clipboard',
                label: this.i18n.t('ui.outputDestination.clipboard.label'),
                description: this.i18n.t('ui.outputDestination.clipboard.description')
            }
        ];

        return vscode.window.showQuickPick(items, {
            placeHolder: this.i18n.t('ui.outputDestination.placeholder')
        });
    }

    async showProgress<T>(
        title: string,
        task: (progress: vscode.Progress<{ message?: string }>) => Promise<T>
    ): Promise<T> {
        this.logger.debug('Starting progress operation', {
            source: 'UIService.showProgress',
            details: { title }
        });

        return vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title,
                cancellable: false
            },
            task
        );
    }

    async showErrorMessage(message: string, modal: boolean = false): Promise<void> {
        this.logger.error(message, {
            source: 'UIService.showErrorMessage',
            details: { modal }
        });

        await vscode.window.showErrorMessage(message, { modal });
    }

    async showInformationMessage(message: string): Promise<void> {
        this.logger.info(message, {
            source: 'UIService.showInformationMessage'
        });

        await vscode.window.showInformationMessage(message);
    }

    async openTextDocument(content: string): Promise<void> {
        this.logger.debug('Opening text document', {
            source: 'UIService.openTextDocument',
            details: { contentLength: content.length }
        });

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(document);
    }

    async copyToClipboard(content: string): Promise<void> {
        this.logger.debug('Copying to clipboard', {
            source: 'UIService.copyToClipboard',
            details: { contentLength: content.length }
        });

        await this.clipboardService.writeText(content);
    }
} 