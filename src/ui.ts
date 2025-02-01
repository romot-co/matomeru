import * as vscode from 'vscode';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from './utils/logger';
import { ChatGPTError, ClipboardError, EditorError } from './errors/errors';
import { getLocalizedMessage } from './l10n/index';

const execAsync = promisify(exec);
const logger = Logger.getInstance('UI');

export async function showInEditor(content: string): Promise<void> {
    try {
        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(document);
        logger.info('エディタに出力しました');
        vscode.window.showInformationMessage(getLocalizedMessage('msg.editorOpenSuccess'));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`エディタ表示エラー: ${errorMessage}`);
        throw new EditorError(errorMessage);
    }
}

export async function copyToClipboard(content: string): Promise<void> {
    try {
        await vscode.env.clipboard.writeText(content);
        logger.info('クリップボードにコピーしました');
        vscode.window.showInformationMessage(getLocalizedMessage('msg.clipboardCopySuccess'));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`クリップボードコピーエラー: ${errorMessage}`);
        throw new ClipboardError(errorMessage);
    }
}

export async function openInChatGPT(content: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('matomeru');
    const chatGptEnabled = config.get<boolean>('chatGptIntegration', false);

    if (!chatGptEnabled) {
        const error = new ChatGPTError(getLocalizedMessage('msg.chatGPTDisabled'));
        logger.error(error.message);
        throw error;
    }

    if (os.platform() !== 'darwin') {
        const error = new ChatGPTError(getLocalizedMessage('msg.chatGPTOnlyMac'));
        logger.error(error.message);
        throw error;
    }

    try {
        // クリップボードにコピー
        await copyToClipboard(content);

        // ChatGPTを開く
        const script = `
            tell application "ChatGPT"
                activate
                delay 1
                tell application "System Events"
                    keystroke "v" using command down
                    keystroke return
                end tell
            end tell
        `.trim().replace(/\n\s+/g, ' ');

        await execAsync(`osascript -e '${script}'`);
        logger.info('ChatGPTに送信しました');
        vscode.window.showInformationMessage(getLocalizedMessage('msg.chatGPTSendSuccess'));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`ChatGPT送信エラー: ${errorMessage}`);
        throw new ChatGPTError(errorMessage);
    }
} 