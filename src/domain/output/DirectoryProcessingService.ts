import * as vscode from 'vscode';
import { DirectoryScanner, ScanResult, FileInfo } from '../files/DirectoryScanner';
import { MarkdownGenerator } from './MarkdownGenerator';
import { IUIService } from './UIService';
import { II18nService } from '../../i18n/I18nService';
import { IConfigurationService, Configuration } from '../../infrastructure/config/ConfigurationService';
import { IPlatformService } from '../../infrastructure/platform/PlatformService';
import { IErrorHandler } from '../../shared/errors/services/ErrorService';
import { BaseError } from '../../shared/errors/base/BaseError';
import { UnsupportedPlatformError } from '../../shared/errors/ChatGPTErrors';
import { ErrorContext } from '../../types';
import { ILogger } from '../../infrastructure/logging/LoggingService';
import { IWorkspaceService } from '../../domain/workspace/WorkspaceService';
import { IClipboardService } from '../../infrastructure/platform/ClipboardService';

export interface IDirectoryProcessor {
    processDirectoryToChatGPT(directoryPath: string): Promise<void>;
    processDirectoryToEditor(directoryPath: string): Promise<void>;
    processDirectoryToClipboard(directoryPath: string): Promise<void>;
}

/**
 * ディレクトリ処理サービス
 * ディレクトリの内容を読み取り、指定された形式（エディタ、クリップボード、ChatGPT）で出力する
 */
export class DirectoryProcessingService implements IDirectoryProcessor {
    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly scanner: DirectoryScanner,
        private readonly generator: MarkdownGenerator,
        private readonly ui: IUIService,
        private readonly i18n: II18nService,
        private readonly config: IConfigurationService,
        private readonly platform: IPlatformService,
        private readonly error: IErrorHandler,
        private readonly workspace: IWorkspaceService,
        private readonly logger: ILogger,
        private readonly clipboard: IClipboardService
    ) {
        this.config.addChangeListener(this.handleConfigurationChange.bind(this));
    }

    /**
     * デフォルト設定でDirectoryProcessingServiceインスタンスを生成するファクトリメソッド
     */
    public static createDefault(
        context: vscode.ExtensionContext,
        scanner: DirectoryScanner,
        generator: MarkdownGenerator,
        ui: IUIService,
        i18n: II18nService,
        config: IConfigurationService,
        platform: IPlatformService,
        error: IErrorHandler,
        workspace: IWorkspaceService,
        logger: ILogger,
        clipboard: IClipboardService
    ): DirectoryProcessingService {
        return new DirectoryProcessingService(
            context,
            scanner,
            generator,
            ui,
            i18n,
            config,
            platform,
            error,
            workspace,
            logger,
            clipboard
        );
    }

    /**
     * 設定変更時のハンドラ
     */
    private async handleConfigurationChange(newConfig: Configuration): Promise<void> {
        try {
            if (newConfig.chatGptIntegration) {
                const features = this.platform.getFeatures();
                if (!features.canUseChatGPT) {
                    await this.ui.showErrorMessage(
                        this.i18n.t('errors.chatGptIntegrationNotSupported'),
                        true
                    );
                }
            }

            this.logger.info('Configuration updated', {
                source: 'DirectoryProcessingService.handleConfigurationChange',
                details: { newConfig }
            });
        } catch (error) {
            await this.handleError(error, 'handleConfigurationChange', { newConfig });
        }
    }

    /**
     * エラー処理の共通化
     */
    private async handleError(error: unknown, operation: string, details: Record<string, unknown>): Promise<void> {
        const context: ErrorContext = {
            source: `DirectoryProcessingService.${operation}`,
            details,
            timestamp: new Date()
        };
        await this.error.handleError(
            error instanceof Error ? error : new BaseError(String(error), 'UnknownError'),
            context
        );
        throw error;
    }

    /**
     * ディレクトリをスキャンし、結果を保存
     */
    private async scanAndSaveResult(directoryPath: string, outputType: 'editor' | 'clipboard' | 'chatgpt', scanResult: ScanResult): Promise<void> {
        await this.context.globalState.update('lastProcessedDirectory', {
            path: directoryPath,
            timestamp: new Date().toISOString(),
            fileCount: scanResult.files.length,
            totalSize: scanResult.totalSize,
            outputType
        });
    }

    /**
     * ディレクトリの内容をMarkdown形式に変換
     */
    private async generateMarkdownContent(files: FileInfo[]): Promise<string> {
        const filePaths = files.map(file => file.relativePath);
        return this.generator.generateMarkdown(filePaths, {
            includeFileName: true,
            includeRelativePath: true,
            includeLanguage: true
        });
    }

    /**
     * ディレクトリの内容をChatGPTで開く
     */
    async processDirectoryToChatGPT(directoryPath: string): Promise<void> {
        try {
            const features = this.platform.getFeatures();
            if (!features.canUseChatGPT) {
                const error = new UnsupportedPlatformError(this.i18n.t('errors.macOSOnly'));
                await this.handleError(error, 'processDirectoryToChatGPT', { directoryPath });
                throw error;
            }

            if (!await this.workspace.validateWorkspacePath(directoryPath)) {
                throw new BaseError(
                    this.i18n.t('errors.directoryNotInWorkspace'),
                    'InvalidDirectoryError',
                    { directoryPath }
                );
            }

            await this.ui.showProgress(
                this.i18n.t('ui.progress.processing'),
                async (progress) => {
                    progress.report({ message: this.i18n.t('ui.progress.scanning') });
                    const scanResult = await this.scanner.scan(directoryPath);

                    progress.report({ message: this.i18n.t('ui.progress.collecting') });
                    const markdown = await this.generateMarkdownContent(scanResult.files);

                    progress.report({ message: this.i18n.t('ui.progress.processing') });
                    await this.platform.openInChatGPT(markdown);

                    await this.scanAndSaveResult(directoryPath, 'chatgpt', scanResult);
                }
            );

            await this.ui.showInformationMessage(
                this.i18n.t('ui.messages.sentToChatGPT')
            );
        } catch (error) {
            await this.handleError(error, 'processDirectoryToChatGPT', { directoryPath });
            throw error;
        }
    }

    /**
     * ディレクトリの内容をエディタで開く
     */
    async processDirectoryToEditor(directoryPath: string): Promise<void> {
        try {
            if (!await this.workspace.validateWorkspacePath(directoryPath)) {
                throw new BaseError(
                    this.i18n.t('errors.directoryNotInWorkspace'),
                    'InvalidDirectoryError',
                    { directoryPath }
                );
            }

            await this.ui.showProgress(
                this.i18n.t('ui.progress.processing'),
                async (progress) => {
                    progress.report({ message: this.i18n.t('ui.progress.scanning') });
                    const scanResult = await this.scanner.scan(directoryPath);

                    progress.report({ message: this.i18n.t('ui.progress.collecting') });
                    const markdown = await this.generateMarkdownContent(scanResult.files);

                    progress.report({ message: this.i18n.t('ui.progress.processing') });
                    await this.ui.openTextDocument(markdown);

                    await this.scanAndSaveResult(directoryPath, 'editor', scanResult);
                }
            );

            await this.ui.showInformationMessage(
                this.i18n.t('ui.messages.openedInEditor')
            );
        } catch (error) {
            await this.handleError(error, 'processDirectoryToEditor', { directoryPath });
            throw error;
        }
    }

    /**
     * ディレクトリの内容をクリップボードにコピー
     */
    async processDirectoryToClipboard(directoryPath: string): Promise<void> {
        try {
            if (!await this.workspace.validateWorkspacePath(directoryPath)) {
                throw new BaseError(
                    this.i18n.t('errors.directoryNotInWorkspace'),
                    'InvalidDirectoryError',
                    { directoryPath }
                );
            }

            await this.ui.showProgress(
                this.i18n.t('ui.progress.processing'),
                async (progress) => {
                    progress.report({ message: this.i18n.t('ui.progress.scanning') });
                    const config = this.config.getConfiguration();
                    const scanResult = await this.scanner.scan(directoryPath, {
                        batchSize: config.batchSize,
                        maxFileSize: config.maxFileSize,
                        excludePatterns: config.excludePatterns
                    });

                    progress.report({ message: this.i18n.t('ui.progress.collecting') });
                    const markdown = await this.generateMarkdownContent(scanResult.files);

                    progress.report({ message: this.i18n.t('ui.progress.processing') });
                    await this.clipboard.writeText(markdown);

                    await this.scanAndSaveResult(directoryPath, 'clipboard', scanResult);
                }
            );

            await this.ui.showInformationMessage(
                this.i18n.t('ui.messages.copiedToClipboard')
            );
        } catch (error) {
            await this.handleError(error, 'processDirectoryToClipboard', { directoryPath });
            throw error;
        }
    }

    dispose(): void {
        this.config.removeChangeListener(this.handleConfigurationChange.bind(this));
    }
} 