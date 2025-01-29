import * as vscode from 'vscode';
import { DirectoryProcessingService } from './services/core/DirectoryProcessingService';
import { ConfigurationService } from './services/config/ConfigurationService';
import { UIService } from './services/ui/UIService';
import { I18nService } from './i18n/I18nService';
import { LoggingService } from './services/logging/LoggingService';

export async function activate(context: vscode.ExtensionContext) {
    const logger = LoggingService.getInstance();
    logger.info('Activating Matomeru extension...', {
        source: 'extension.activate'
    });

    const i18n = I18nService.getInstance();
    const config = ConfigurationService.getInstance();
    const ui = UIService.getInstance();
    const processor = new DirectoryProcessingService(context);

    // 設定変更の監視を一元化
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async e => {
            if (e.affectsConfiguration('matomeru')) {
                try {
                    // ワークスペースの設定変更を検知
                    const workspaceChanges = e.affectsConfiguration('matomeru', vscode.workspace.workspaceFolders?.[0]);
                    if (workspaceChanges) {
                        // 設定の更新を ConfigurationService に通知
                        await config.updateConfiguration({});
                    }
                } catch (error) {
                    await ui.showErrorMessage(
                        i18n.t('errors.configurationUpdateFailed'),
                        true
                    );
                }
            }
        })
    );

    // コマンドの登録
    context.subscriptions.push(
        vscode.commands.registerCommand('matomeru.processDirectory', async () => {
            // ワークスペースの確認
            if (!vscode.workspace.workspaceFolders?.length) {
                await ui.showErrorMessage(
                    i18n.t('errors.noWorkspace'),
                    true
                );
                return;
            }

            // 出力先の選択
            const destination = await ui.showOutputDestinationPicker();
            if (!destination) {
                return;
            }

            // ディレクトリの選択
            const options: vscode.OpenDialogOptions = {
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: i18n.t('ui.dialog.selectDirectory'),
                defaultUri: vscode.workspace.workspaceFolders[0].uri
            };

            const result = await vscode.window.showOpenDialog(options);
            if (!result?.length) {
                return;
            }

            const directoryPath = result[0].fsPath;

            // 選択された出力先に応じて処理を実行
            try {
                switch (destination.id) {
                    case 'editor':
                        await processor.processDirectoryToEditor(directoryPath);
                        break;
                    case 'clipboard':
                        await processor.processDirectoryToClipboard(directoryPath);
                        break;
                    case 'chatgpt':
                        await processor.processDirectoryToChatGPT(directoryPath);
                        break;
                }
            } catch (error) {
                // エラーは DirectoryProcessingService 内で既に処理されているため、ここでは何もしない
            }
        })
    );

    // クリーンアップ処理の登録
    context.subscriptions.push({
        dispose: () => {
            processor.dispose();
            config.dispose();
        }
    });

    logger.info('Matomeru extension activated successfully.', {
        source: 'extension.activate'
    });
}

export function deactivate() {
    // 特別なクリーンアップは不要（dispose で対応済み）
}
