import * as vscode from 'vscode';
import { DirectoryScanner, ScanResult, FileInfo } from '../files/DirectoryScanner';
import { MarkdownGenerator } from './MarkdownGenerator';
import { IUIService } from '../../infrastructure/ui/UIService';
import { II18nService } from '../../i18n/I18nService';
import { IConfigurationService, Configuration } from '../../infrastructure/config/ConfigurationService';
import { IPlatformService } from '../../infrastructure/platform/PlatformService';
import { IErrorHandler } from '../../shared/errors/services/ErrorService';
import { IWorkspaceService } from '../../infrastructure/workspace/WorkspaceService';
import { ILogger } from '../../infrastructure/logging/LoggingService';
import { IClipboardService } from '../../infrastructure/platform/ClipboardService';
import { MatomeruError, ErrorCode, ErrorContext } from '../../shared/errors/MatomeruError';

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
    private async handleError(error: unknown, source: string, context: Record<string, unknown>): Promise<void> {
        const matomeruError = error instanceof MatomeruError ? error : new MatomeruError(
            error instanceof Error ? error.message : String(error),
            ErrorCode.UNKNOWN,
            {
                source,
                timestamp: new Date(),
                details: context
            }
        );

        await this.error.handleError(matomeruError);
        throw matomeruError;
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
            const result = await this.scanner.scan(directoryPath);
            if (!result.files.length) {
                throw new MatomeruError(
                    'スキャン可能なファイルが見つかりませんでした',
                    ErrorCode.INVALID_DIRECTORY,
                    {
                        source: 'DirectoryProcessingService.processDirectoryToChatGPT',
                        timestamp: new Date(),
                        details: { path: directoryPath }
                    }
                );
            }

            const markdown = await this.generateMarkdownContent(result.files);
            await this.platform.openInChatGPT(markdown);
            await this.scanAndSaveResult(directoryPath, 'chatgpt', result);
        } catch (error) {
            await this.handleError(error, 'DirectoryProcessingService.processDirectoryToChatGPT', { path: directoryPath });
        }
    }

    /**
     * ディレクトリの内容をエディタで開く
     */
    async processDirectoryToEditor(directoryPath: string): Promise<void> {
        try {
            const result = await this.scanner.scan(directoryPath);
            if (!result.files.length) {
                throw new MatomeruError(
                    'スキャン可能なファイルが見つかりませんでした',
                    ErrorCode.INVALID_DIRECTORY,
                    {
                        source: 'DirectoryProcessingService.processDirectoryToEditor',
                        timestamp: new Date(),
                        details: { path: directoryPath }
                    }
                );
            }

            const markdown = await this.generateMarkdownContent(result.files);
            await this.ui.openTextDocument(markdown);
            await this.ui.showInformationMessage(this.i18n.t('ui.messages.openedInEditor'));
        } catch (error) {
            await this.handleError(error, 'DirectoryProcessingService.processDirectoryToEditor', { path: directoryPath });
        }
    }

    /**
     * ディレクトリの内容をクリップボードにコピー
     */
    async processDirectoryToClipboard(directoryPath: string): Promise<void> {
        try {
            const result = await this.scanner.scan(directoryPath);
            if (!result.files.length) {
                throw new MatomeruError(
                    'スキャン可能なファイルが見つかりませんでした',
                    ErrorCode.INVALID_DIRECTORY,
                    {
                        source: 'DirectoryProcessingService.processDirectoryToClipboard',
                        timestamp: new Date(),
                        details: { path: directoryPath }
                    }
                );
            }

            const markdown = await this.generateMarkdownContent(result.files);
            await this.clipboard.writeText(markdown);
            await this.ui.showInformationMessage(this.i18n.t('ui.messages.copiedToClipboard'));
        } catch (error) {
            await this.handleError(error, 'DirectoryProcessingService.processDirectoryToClipboard', { path: directoryPath });
        }
    }

    dispose(): void {
        this.config.removeChangeListener(this.handleConfigurationChange.bind(this));
    }
} 