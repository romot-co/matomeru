import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import { CommandRegistrar } from './commands';
import { Logger } from './utils/logger';

const logger = Logger.getInstance('Extension');

export function activate(context: vscode.ExtensionContext) {
    logger.info(vscode.l10n.t('msg.extensionActivated'));
    
    const commandRegistrar = new CommandRegistrar();
    
    // コマンドの登録
    const registerCommand = (commandId: string, handler: (uri?: vscode.Uri, uris?: vscode.Uri[]) => Promise<void>) => {
        return vscode.commands.registerCommand(commandId, async (arg1: unknown, arg2: unknown) => {
            logger.info(vscode.l10n.t('msg.commandExecuted', commandId, JSON.stringify({
                arg1: arg1 instanceof vscode.Uri ? arg1.fsPath : Array.isArray(arg1) ? arg1.map(a => a instanceof vscode.Uri ? a.fsPath : typeof a) : typeof arg1,
                arg2: arg2 instanceof vscode.Uri ? arg2.fsPath : Array.isArray(arg2) ? arg2.map(a => a instanceof vscode.Uri ? a.fsPath : typeof a) : typeof arg2
            })));
            
            // 引数の解析
            let selectedUris: vscode.Uri[] = [];
            if (arg1 instanceof vscode.Uri) {
                selectedUris = [arg1];
            } else if (Array.isArray(arg1) && arg1.every(uri => uri instanceof vscode.Uri)) {
                selectedUris = arg1;
            }
            if (arg2 instanceof vscode.Uri) {
                selectedUris.push(arg2);
            } else if (Array.isArray(arg2) && arg2.every(uri => uri instanceof vscode.Uri)) {
                selectedUris.push(...arg2);
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
        registerCommand('matomeru.process', commandRegistrar.processToEditor.bind(commandRegistrar)),
        registerCommand('matomeru.quickProcessToEditor', commandRegistrar.processToEditor.bind(commandRegistrar)),
        registerCommand('matomeru.quickProcessToClipboard', commandRegistrar.processToClipboard.bind(commandRegistrar)),
        registerCommand('matomeru.quickProcessToChatGPT', commandRegistrar.processToChatGPT.bind(commandRegistrar))
    );
}

export function deactivate() {
    logger.info(vscode.l10n.t('msg.extensionDeactivated'));
    logger.dispose();
}
