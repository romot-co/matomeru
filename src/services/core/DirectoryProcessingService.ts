import * as vscode from 'vscode';
import { DirectoryScanner, ScanResult, FileInfo } from '@/services/fs/DirectoryScanner';
import { MarkdownGenerator } from '@/services/ui/MarkdownGenerator';
import { UIService } from '@/services/ui/UIService';
import { I18nService } from '@/i18n/I18nService';
import { ConfigurationService, Configuration } from '@/services/config/ConfigurationService';
import { PlatformService } from '@/services/platform/PlatformService';
import { ErrorService } from '@/errors/services/ErrorService';
import { BaseError } from '@/errors/base/BaseError';
import type { ErrorContext } from '@/types';
import { LoggingService } from '@/services/logging/LoggingService';
import { WorkspaceService } from '@/services/workspace/WorkspaceService';
import { ClipboardService } from '@/services/platform/ClipboardService';

/**
 * ディレクトリ処理サービス
 * ディレクトリの内容を読み取り、指定された形式（エディタ、クリップボード、ChatGPT）で出力する
 */
export class DirectoryProcessingService {
    private readonly scanner: DirectoryScanner;
    private readonly generator: MarkdownGenerator;
    private readonly ui: UIService;
    private readonly i18n: I18nService;
    private readonly config: ConfigurationService;
    private readonly platform: PlatformService;
    private readonly error: ErrorService;
    private readonly workspace: WorkspaceService;
    private readonly logger: LoggingService;

    constructor(
        private readonly context: vscode.ExtensionContext,
        scanner?: DirectoryScanner,
        generator?: MarkdownGenerator,
        ui?: UIService,
        i18n?: I18nService,
        config?: ConfigurationService,
        platform?: PlatformService,
        error?: ErrorService,
        workspace?: WorkspaceService
    ) {
        this.scanner = scanner ?? new DirectoryScanner();
        this.generator = generator ?? new MarkdownGenerator();
        this.ui = ui ?? UIService.getInstance();
        this.i18n = i18n ?? I18nService.getInstance();
        this.config = config ?? ConfigurationService.getInstance();
        this.platform = platform ?? PlatformService.getInstance();
        this.error = error ?? ErrorService.getInstance();
        this.workspace = workspace ?? WorkspaceService.getInstance();
        this.logger = LoggingService.getInstance();

        this.config.addChangeListener(this.handleConfigurationChange.bind(this));
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
            const context: ErrorContext = {
                source: 'DirectoryProcessingService.handleConfigurationChange',
                details: { newConfig },
                timestamp: new Date()
            };
            await this.error.handleError(
                error instanceof Error ? error : new BaseError(String(error), 'UnknownError'),
                context
            );
        }
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
                throw new BaseError(
                    this.i18n.t('errors.macOSOnly'),
                    'UnsupportedPlatformError'
                );
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
            const context: ErrorContext = {
                source: 'DirectoryProcessingService.processDirectoryToChatGPT',
                details: { directoryPath },
                timestamp: new Date()
            };
            await this.error.handleError(
                error instanceof Error ? error : new BaseError(String(error), 'UnknownError'),
                context
            );
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
            const context: ErrorContext = {
                source: 'DirectoryProcessingService.processDirectoryToEditor',
                details: { directoryPath },
                timestamp: new Date()
            };
            await this.error.handleError(
                error instanceof Error ? error : new BaseError(String(error), 'UnknownError'),
                context
            );
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
                    await ClipboardService.writeText(markdown);

                    await this.scanAndSaveResult(directoryPath, 'clipboard', scanResult);
                }
            );

            await this.ui.showInformationMessage(
                this.i18n.t('ui.messages.copiedToClipboard')
            );
        } catch (error) {
            const context: ErrorContext = {
                source: 'DirectoryProcessingService.processDirectoryToClipboard',
                details: { directoryPath },
                timestamp: new Date()
            };
            await this.error.handleError(
                error instanceof Error ? error : new BaseError(String(error), 'UnknownError'),
                context
            );
            throw error;
        }
    }

    dispose(): void {
        this.config.removeChangeListener(this.handleConfigurationChange.bind(this));
    }
} 