import * as vscode from 'vscode';
import { CommandRegistrar } from './commands';
import { Logger } from './utils/logger';

const logger = Logger.getInstance('Extension');

export function activate(context: vscode.ExtensionContext) {
    const commandRegistrar = new CommandRegistrar();
    commandRegistrar.register(context);
    logger.info('拡張機能が有効化されました');
}

export function deactivate() {
    logger.info('拡張機能が無効化されました');
    logger.dispose();
}
