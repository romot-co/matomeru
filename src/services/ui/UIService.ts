import * as vscode from 'vscode';
import { I18nService } from '@/i18n/I18nService';
import { LoggingService } from '../logging/LoggingService';
import { ClipboardService } from '@/services/platform/ClipboardService';

export interface OutputDestination {
    id: string;
    label: string;
    description: string;
}

export class UIService {
    private static instance: UIService;
    private readonly i18n: I18nService;
    private readonly logger: LoggingService;
    private readonly context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.i18n = I18nService.getInstance();
        this.logger = LoggingService.getInstance();
        this.context = context;
    }

    static initialize(context: vscode.ExtensionContext): void {
        if (!UIService.instance) {
            UIService.instance = new UIService(context);
        }
    }

    static getInstance(): UIService {
        if (!UIService.instance) {
            throw new Error('UIService must be initialized with context before use');
        }
        return UIService.instance;
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
        task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
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

        await ClipboardService.writeText(content);
    }
} 