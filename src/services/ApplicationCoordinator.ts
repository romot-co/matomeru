import * as vscode from 'vscode';
import { DirectoryScanner } from './directory-scanner';
import { MarkdownGenerator } from './markdown-generator';
import { UIController } from './ui-controller';
import { I18n } from './i18n';
import { ConfigurationManager } from './configuration-manager';
import { PlatformService } from './platform/PlatformService';
import { ErrorService } from './error/ErrorService';

export class ApplicationCoordinator {
    private readonly errorService: ErrorService;
    private readonly platformService: PlatformService;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly scanner: DirectoryScanner,
        private readonly generator: MarkdownGenerator,
        private readonly ui: UIController,
        private readonly i18n: I18n,
        private readonly config: ConfigurationManager
    ) {
        this.errorService = ErrorService.getInstance();
        this.platformService = PlatformService.getInstance();
    }

    async processDirectoryToChatGPT(directoryPath: string): Promise<void> {
        try {
            const features = this.platformService.getFeatures();
            if (!features.canUseChatGPT) {
                throw new Error(this.i18n.t('errors.macOSOnly'));
            }

            const files = await this.scanner.scan(directoryPath);
            const markdown = await this.generator.generateMarkdown(files);
            await this.platformService.openInChatGPT(markdown);

            await this.context.globalState.update('lastProcessedDirectory', {
                path: directoryPath,
                timestamp: new Date().toISOString(),
                fileCount: files.length,
                outputType: 'chatgpt'
            });

            await this.ui.showInformationMessage(this.i18n.t('ui.messages.sentToChatGPT'));
        } catch (error) {
            await this.errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'ApplicationCoordinator.processDirectoryToChatGPT',
                timestamp: new Date(),
                details: { directoryPath }
            });
        }
    }

    async processDirectoryToEditor(directoryPath: string): Promise<void> {
        try {
            const files = await this.scanner.scan(directoryPath);
            const markdown = await this.generator.generateMarkdown(files);
            await this.ui.openTextDocument(markdown);

            await this.context.globalState.update('lastProcessedDirectory', {
                path: directoryPath,
                timestamp: new Date().toISOString(),
                fileCount: files.length,
                outputType: 'editor'
            });

            await this.ui.showInformationMessage(this.i18n.t('ui.messages.openedInEditor'));
        } catch (error) {
            await this.errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'ApplicationCoordinator.processDirectoryToEditor',
                timestamp: new Date(),
                details: { directoryPath }
            });
        }
    }

    async processDirectoryToClipboard(directoryPath: string): Promise<void> {
        try {
            const files = await this.scanner.scan(directoryPath);
            const markdown = await this.generator.generateMarkdown(files);
            await this.ui.copyToClipboard(markdown);

            await this.context.globalState.update('lastProcessedDirectory', {
                path: directoryPath,
                timestamp: new Date().toISOString(),
                fileCount: files.length,
                outputType: 'clipboard'
            });

            await this.ui.showInformationMessage(this.i18n.t('ui.messages.copiedToClipboard'));
        } catch (error) {
            await this.errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'ApplicationCoordinator.processDirectoryToClipboard',
                timestamp: new Date(),
                details: { directoryPath }
            });
        }
    }
} 
