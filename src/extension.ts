import * as vscode from 'vscode';
import { DirectoryScanner } from './services/directory-scanner';
import { MarkdownGenerator } from './services/markdown-generator';
import { UIController } from './services/ui-controller';
import { I18n } from './i18n';
import { ConfigurationManager } from './services/configuration-manager';
import { ProductionFSAdapter } from './services/fs-adapter';
import { ErrorService } from './services/error/ErrorService';
import { PlatformService } from './services/platform/PlatformService';

export function activate(context: vscode.ExtensionContext) {
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

    // 設定変更の監視
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('matomeru')) {
                config.reload();
            }
        })
    );

    let disposable = vscode.commands.registerCommand('matomeru.sendToChatGPT', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            await errorService.handleError(new Error(i18n.t('errors.noWorkspace')), {
                source: 'Command.sendToChatGPT',
                timestamp: new Date()
            });
            return;
        }

        try {
            const features = platformService.getFeatures();
            if (!features.canUseChatGPT) {
                throw new Error(i18n.t('errors.macOSOnly'));
            }

            const scanResult = await scanner.scan(workspaceFolders[0].uri.fsPath);
            const markdown = await generator.generateMarkdown(scanResult);
            await platformService.openInChatGPT(markdown);

            vscode.window.showInformationMessage(i18n.t('ui.messages.sentToChatGPT'));
        } catch (error) {
            await errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'Command.sendToChatGPT',
                timestamp: new Date(),
                details: {
                    workspace: workspaceFolders[0].uri.fsPath
                }
            });
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
