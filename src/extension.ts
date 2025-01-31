import * as vscode from 'vscode';
import { DirectoryProcessingService } from './domain/output/DirectoryProcessingService';
import { ConfigurationService } from './infrastructure/config/ConfigurationService';
import { UIService } from './infrastructure/ui/UIService';
import { I18nService } from './i18n/I18nService';
import { LoggingService } from './infrastructure/logging/LoggingService';
import { ErrorService } from './shared/errors/services/ErrorService';
import { ClipboardService } from './infrastructure/platform/ClipboardService';
import { DirectoryScanner } from './domain/files/DirectoryScanner';
import { FileTypeService } from './domain/files/FileTypeService';
import { FileSystemAdapter } from './domain/files/FileSystemAdapter';
import { MarkdownGenerator } from './domain/output/MarkdownGenerator';
import { WorkspaceService } from './infrastructure/workspace/WorkspaceService';
import { PlatformService } from './infrastructure/platform/PlatformService';
import { MatomeruError, ErrorCode } from './shared/errors/MatomeruError';
import { DirectoryStructureService } from './domain/files/DirectoryStructureService';
import { MacOSImplementation } from './infrastructure/platform/MacOSImplementation';
import { CrossPlatformImplementation } from './infrastructure/platform/CrossPlatformImplementation';
import { FileSystemEntity } from './types';

export async function activate(context: vscode.ExtensionContext) {
    try {
        // 基本サービスの初期化
        const config = ConfigurationService.createDefault();
        const logger = LoggingService.createDefault(config);
        logger.info('Activating Matomeru extension...', {
            source: 'extension.activate'
        });

        // 各サービスの初期化（依存関係の順序に注意）
        const i18n = I18nService.createDefault(logger);
        const errorHandler = ErrorService.createDefault(logger);
        const clipboardService = ClipboardService.createDefault();
        const workspaceService = WorkspaceService.createDefault(logger, errorHandler);
        const ui = UIService.createDefault(context, i18n, logger, clipboardService);
        const platform = PlatformService.createDefault(errorHandler, i18n, config, logger);

        // ドメインサービスの初期化
        const fileSystem = new FileSystemAdapter(errorHandler, logger);
        const fileTypeService = new FileTypeService();
        const scanner = new DirectoryScanner(
            config,
            logger,
            errorHandler,
            workspaceService,
            fileTypeService,
            fileSystem
        );
        const directoryStructure = DirectoryStructureService.createDefault(errorHandler);
        const markdownGenerator = new MarkdownGenerator(fileSystem, logger);

        // メインサービスの初期化
        const processor = DirectoryProcessingService.createDefault(
            context,
            scanner,
            markdownGenerator,
            ui,
            i18n,
            config,
            platform,
            errorHandler,
            workspaceService,
            logger,
            clipboardService
        );

        // プラットフォーム固有の実装を初期化
        const platformImpl = process.platform === 'darwin'
            ? MacOSImplementation.createDefault(errorHandler, i18n, config, logger)
            : new CrossPlatformImplementation(errorHandler);

        // コマンドの登録
        const disposables = [
            vscode.commands.registerCommand('matomeru.combineDirectoryToEditor', async (uri?: vscode.Uri) => {
                try {
                    const targetPath = uri?.fsPath || (await workspaceService.selectWorkspaceFolder())?.uri.fsPath;
                    if (!targetPath) {
                        await ui.showErrorMessage(i18n.t('ui.messages.selectDirectory'));
                        return;
                    }
                    await processor.processDirectoryToEditor(targetPath);
                } catch (error) {
                    const matomeruError = error instanceof MatomeruError ? error : new MatomeruError(
                        error instanceof Error ? error.message : String(error),
                        ErrorCode.UNKNOWN,
                        {
                            source: 'matomeru.combineDirectoryToEditor',
                            timestamp: new Date()
                        }
                    );
                    await errorHandler.handleError(matomeruError);
                    await ui.showErrorMessage(i18n.t('ui.messages.error'), true);
                }
            }),
            vscode.commands.registerCommand('matomeru.combineDirectoryToClipboard', async (uri?: vscode.Uri) => {
                try {
                    const targetPath = uri?.fsPath || (await workspaceService.selectWorkspaceFolder())?.uri.fsPath;
                    if (!targetPath) {
                        await ui.showErrorMessage(i18n.t('ui.messages.selectDirectory'));
                        return;
                    }
                    await processor.processDirectoryToClipboard(targetPath);
                } catch (error) {
                    const matomeruError = error instanceof MatomeruError ? error : new MatomeruError(
                        error instanceof Error ? error.message : String(error),
                        ErrorCode.UNKNOWN,
                        {
                            source: 'matomeru.combineDirectoryToClipboard',
                            timestamp: new Date()
                        }
                    );
                    await errorHandler.handleError(matomeruError);
                    await ui.showErrorMessage(i18n.t('ui.messages.error'), true);
                }
            }),
            vscode.commands.registerCommand('matomeru.openInChatGPT', async (uri?: vscode.Uri) => {
                try {
                    const targetPath = uri?.fsPath || (await workspaceService.selectWorkspaceFolder())?.uri.fsPath;
                    if (!targetPath) {
                        await ui.showErrorMessage(i18n.t('ui.messages.selectDirectory'));
                        return;
                    }
                    await processor.processDirectoryToChatGPT(targetPath);
                } catch (error) {
                    const matomeruError = error instanceof MatomeruError ? error : new MatomeruError(
                        error instanceof Error ? error.message : String(error),
                        ErrorCode.UNKNOWN,
                        {
                            source: 'matomeru.openInChatGPT',
                            timestamp: new Date()
                        }
                    );
                    await errorHandler.handleError(matomeruError);
                    await ui.showErrorMessage(i18n.t('ui.messages.error'), true);
                }
            }),
            vscode.commands.registerCommand('matomeru.summarize', async () => {
                try {
                    const workspaceFolder = await workspaceService.getCurrentWorkspaceFolder();
                    if (!workspaceFolder) {
                        throw new MatomeruError(
                            'ワークスペースが開かれていません',
                            ErrorCode.WORKSPACE_ERROR,
                            {
                                source: 'extension.activate',
                                timestamp: new Date()
                            }
                        );
                    }

                    const result = await scanner.scan(workspaceFolder.uri.fsPath);
                    if (!result.files.length) {
                        throw new MatomeruError(
                            'スキャン可能なファイルが見つかりませんでした',
                            ErrorCode.FILE_SYSTEM,
                            {
                                source: 'extension.activate',
                                details: { workspacePath: workspaceFolder.uri.fsPath },
                                timestamp: new Date()
                            }
                        );
                    }

                    // FileInfoをFileSystemEntityに変換
                    const entities: FileSystemEntity[] = result.files.map(file => ({
                        path: file.path,
                        type: 'file',
                        children: []
                    }));

                    const treeStructure = directoryStructure.generateTreeStructure(entities);
                    const markdown = await markdownGenerator.generateMarkdown(
                        result.files.map(f => f.path),
                        { rootPath: workspaceFolder.uri.fsPath }
                    );

                    const content = `# Project Structure\n\n${treeStructure}\n\n# File Contents\n\n${markdown}`;
                    await platformImpl.openInChatGPT(content);

                    logger.info('コマンド実行完了', {
                        source: 'extension.activate',
                        details: {
                            filesCount: result.files.length,
                            totalSize: result.totalSize
                        }
                    });
                } catch (error) {
                    if (error instanceof MatomeruError) {
                        await errorHandler.handleError(error);
                    } else {
                        const matomeruError = new MatomeruError(
                            error instanceof Error ? error.message : String(error),
                            ErrorCode.UNKNOWN,
                            {
                                source: 'extension.activate',
                                timestamp: new Date()
                            }
                        );
                        await errorHandler.handleError(matomeruError);
                    }
                }
            })
        ];

        context.subscriptions.push(...disposables);
        logger.info('Matomeru extension activated', {
            source: 'extension.activate'
        });
    } catch (error) {
        const matomeruError = error instanceof MatomeruError ? error : new MatomeruError(
            error instanceof Error ? error.message : String(error),
            ErrorCode.UNKNOWN,
            {
                source: 'extension.activate',
                timestamp: new Date()
            }
        );
        vscode.window.showErrorMessage(`拡張機能の初期化に失敗しました: ${matomeruError.message}`);
    }
}

export function deactivate() {
    // 特別なクリーンアップは不要（dispose で対応済み）
}
