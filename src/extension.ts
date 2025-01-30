import * as vscode from 'vscode';
import { DirectoryProcessingService } from './domain/output/DirectoryProcessingService';
import { ConfigurationService } from './infrastructure/config/ConfigurationService';
import { UIService } from './domain/output/UIService';
import { I18nService } from './i18n/I18nService';
import { LoggingService } from './infrastructure/logging/LoggingService';
import { ErrorService } from './shared/errors/services/ErrorService';
import { ClipboardService } from './infrastructure/platform/ClipboardService';
import { DirectoryScanner } from './domain/files/DirectoryScanner';
import { FileTypeService } from './domain/files/FileTypeService';
import { FileSystemAdapter } from './domain/files/FileSystemAdapter';
import { MarkdownGenerator } from './domain/output/MarkdownGenerator';
import { WorkspaceService } from './domain/workspace/WorkspaceService';
import { PlatformService } from './infrastructure/platform/PlatformService';

export async function activate(context: vscode.ExtensionContext) {
    // 基本サービスの初期化
    const config = ConfigurationService.createDefault();
    const logger = LoggingService.createDefault(config);
    logger.info('Activating Matomeru extension...', {
        source: 'extension.activate'
    });

    // 各サービスの初期化（依存関係の順序に注意）
    const i18n = I18nService.createDefault(logger);
    const errorHandler = ErrorService.createDefault(i18n, logger);
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
                await errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
                    source: 'matomeru.combineDirectoryToEditor',
                    timestamp: new Date()
                });
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
                await errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
                    source: 'matomeru.combineDirectoryToClipboard',
                    timestamp: new Date()
                });
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
                await errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
                    source: 'matomeru.openInChatGPT',
                    timestamp: new Date()
                });
                await ui.showErrorMessage(i18n.t('ui.messages.error'), true);
            }
        })
    ];

    context.subscriptions.push(...disposables);
    logger.info('Matomeru extension activated', {
        source: 'extension.activate'
    });
}

export function deactivate() {
    // 特別なクリーンアップは不要（dispose で対応済み）
}
