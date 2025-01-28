import * as vscode from 'vscode';
import { DirectoryScanner } from './services/directory-scanner';
import { MarkdownGenerator } from './services/markdown-generator';
import { UIController } from './services/ui-controller';
import { I18n } from './services/i18n';
import { ConfigurationManager } from './services/configuration-manager';
import { ProductionFSAdapter } from './services/fs-adapter';
import { ErrorService } from './services/error/ErrorService';
import { PlatformService } from './services/platform/PlatformService';
import { ApplicationCoordinator } from './services/ApplicationCoordinator';

export function activate(context: vscode.ExtensionContext) {
    console.log('Activating Matomeru extension...');

    const fsAdapter = new ProductionFSAdapter();
    const config = ConfigurationManager.getInstance();
    const settings = config.getConfiguration();
    
    const scanner = new DirectoryScanner(fsAdapter, undefined, {
        maxConcurrency: settings.maxConcurrentFiles,
        batchSize: settings.batchSize,
        excludePatterns: settings.excludePatterns,
        maxFileSize: settings.maxFileSize
    });

    const generator = new MarkdownGenerator();
    const ui = new UIController(context);
    const i18n = I18n.getInstance();
    const errorService = ErrorService.getInstance();
    const platformService = PlatformService.getInstance();

    errorService.setContext(context);

    const coordinator = new ApplicationCoordinator(
        context,
        scanner,
        generator,
        ui,
        i18n,
        config
    );

    // 設定変更の監視
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('matomeru')) {
                config.reload();
            }
        })
    );

    // コマンドの登録
    context.subscriptions.push(
        vscode.commands.registerCommand('matomeru.combineDirectoryToEditor', async (uri: vscode.Uri) => {
            try {
                const directoryPath = uri?.fsPath || (vscode.workspace.workspaceFolders?.[0].uri.fsPath);
                if (!directoryPath) {
                    throw new Error(i18n.t('errors.noWorkspace'));
                }
                await coordinator.processDirectoryToEditor(directoryPath);
            } catch (error) {
                await errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                    source: 'Command.combineDirectoryToEditor',
                    timestamp: new Date()
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('matomeru.combineDirectoryToClipboard', async (uri: vscode.Uri) => {
            try {
                const directoryPath = uri?.fsPath || (vscode.workspace.workspaceFolders?.[0].uri.fsPath);
                if (!directoryPath) {
                    throw new Error(i18n.t('errors.noWorkspace'));
                }
                await coordinator.processDirectoryToClipboard(directoryPath);
            } catch (error) {
                await errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                    source: 'Command.combineDirectoryToClipboard',
                    timestamp: new Date()
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('matomeru.combineDirectoryToChatGPT', async (uri: vscode.Uri) => {
            try {
                const directoryPath = uri?.fsPath || (vscode.workspace.workspaceFolders?.[0].uri.fsPath);
                if (!directoryPath) {
                    throw new Error(i18n.t('errors.noWorkspace'));
                }
                await coordinator.processDirectoryToChatGPT(directoryPath);
            } catch (error) {
                await errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                    source: 'Command.combineDirectoryToChatGPT',
                    timestamp: new Date()
                });
            }
        })
    );

    console.log('Matomeru extension activated successfully.');
}

export function deactivate() {}
