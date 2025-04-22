import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { CommandRegistrar } from './commands';
import { Logger } from './utils/logger';
import { ParserManager } from './services/parserManager';

const logger = Logger.getInstance('Extension');
let commandRegistrar: CommandRegistrar | undefined;
let extensionContext: vscode.ExtensionContext;

// グローバルにコンテキストを取得するための関数
export function getExtensionContext(): vscode.ExtensionContext {
  return extensionContext;
}

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    logger.info(vscode.l10n.t('msg.extensionActivated'));
    
    // OSがmacOS（darwin）なら isOSX を true に設定する
    vscode.commands.executeCommand('setContext', 'isOSX', process.platform === 'darwin');
    
    commandRegistrar = new CommandRegistrar();
    
    // 設定の初期状態を反映
    const config = vscode.workspace.getConfiguration('matomeru');
    vscode.commands.executeCommand('setContext', 'matomeru.chatGptIntegration', config.get('chatGptIntegration'));

    // 設定変更を監視
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('matomeru.chatGptIntegration')) {
                const newConfig = vscode.workspace.getConfiguration('matomeru');
                vscode.commands.executeCommand('setContext', 'matomeru.chatGptIntegration', newConfig.get('chatGptIntegration'));
            }
        })
    );
    
    // コマンドの登録
    const registerCommand = (commandId: string, handler: (uri?: vscode.Uri, uris?: vscode.Uri[]) => Promise<void>) => {
        return vscode.commands.registerCommand(commandId, async (arg1: unknown, arg2: unknown) => {
            logger.info(vscode.l10n.t('msg.commandExecuted', commandId, JSON.stringify({
                arg1: arg1 instanceof vscode.Uri ? arg1.fsPath : Array.isArray(arg1) ? arg1.map(a => a instanceof vscode.Uri ? a.fsPath : typeof a) : typeof arg1,
                arg2: arg2 instanceof vscode.Uri ? arg2.fsPath : Array.isArray(arg2) ? arg2.map(a => a instanceof vscode.Uri ? a.fsPath : typeof a) : typeof arg2
            })));
            
            // 引数の解析とURIの一意化
            const uriSet = new Set<string>();
            const selectedUris: vscode.Uri[] = [];

            // arg1の処理
            if (arg1 instanceof vscode.Uri && !uriSet.has(arg1.fsPath)) {
                uriSet.add(arg1.fsPath);
                selectedUris.push(arg1);
            } else if (Array.isArray(arg1)) {
                arg1.forEach(uri => {
                    if (uri instanceof vscode.Uri && !uriSet.has(uri.fsPath)) {
                        uriSet.add(uri.fsPath);
                        selectedUris.push(uri);
                    }
                });
            }

            // arg2の処理
            if (arg2 instanceof vscode.Uri && !uriSet.has(arg2.fsPath)) {
                uriSet.add(arg2.fsPath);
                selectedUris.push(arg2);
            } else if (Array.isArray(arg2)) {
                arg2.forEach(uri => {
                    if (uri instanceof vscode.Uri && !uriSet.has(uri.fsPath)) {
                        uriSet.add(uri.fsPath);
                        selectedUris.push(uri);
                    }
                });
            }
            
            logger.info(vscode.l10n.t('msg.targetUris', selectedUris.length));
            await Promise.all(selectedUris.map(async (uri, index) => {
                try {
                    const stats = await fs.stat(uri.fsPath);
                    logger.info(vscode.l10n.t('msg.targetUriInfo', index + 1, uri.fsPath, stats.isDirectory() ? 'directory' : 'file'));
                } catch (error) {
                    logger.info(vscode.l10n.t('msg.targetUriInfo', index + 1, uri.fsPath, 'unknown'));
                }
            }));

            await handler(undefined, selectedUris.length > 0 ? selectedUris : undefined);
        });
    };

    // 各コマンドの登録
    context.subscriptions.push(
        registerCommand('matomeru.quickProcessToEditor', commandRegistrar.processToEditor.bind(commandRegistrar)),
        registerCommand('matomeru.quickProcessToClipboard', commandRegistrar.processToClipboard.bind(commandRegistrar)),
        registerCommand('matomeru.quickProcessToChatGPT', commandRegistrar.processToChatGPT.bind(commandRegistrar)),
        registerCommand('matomeru.estimateSize', commandRegistrar.estimateSize.bind(commandRegistrar)),
        // Git Diff関連コマンドの追加
        registerCommand('matomeru.copyGitDiff', commandRegistrar.diffToClipboard.bind(commandRegistrar))
        // 以下のコマンドはv0.0.12では使用しません
        // registerCommand('matomeru.diffToEditor', commandRegistrar.diffToEditor.bind(commandRegistrar)),
        // registerCommand('matomeru.diffToChatGPT', commandRegistrar.diffToChatGPT.bind(commandRegistrar))
    );
}

export function deactivate() {
    logger.info(vscode.l10n.t('msg.extensionDeactivated'));
    
    // CommandRegistrarインスタンスを通じてFileOperationsを破棄
    if (commandRegistrar) {
        commandRegistrar.dispose();
        commandRegistrar = undefined;
    }
    
    // ParserManagerのリソースを解放
    try {
      const ctx = getExtensionContext();
      const parserManager = ParserManager.getInstance(ctx);
      parserManager.dispose();
    } catch (error) {
      logger.error(`ParserManager disposal error: ${error}`);
    }
    
    logger.dispose();
}
