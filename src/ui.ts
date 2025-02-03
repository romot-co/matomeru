import * as vscode from 'vscode';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from './utils/logger';
import { ChatGPTError, ClipboardError, EditorError } from './errors/errors';

const execAsync = promisify(exec);
const logger = Logger.getInstance('UI');

export async function showInEditor(content: string): Promise<void> {
    try {
        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(document);
        logger.info(vscode.l10n.t('msg.editorOpenSuccess'));
        vscode.window.showInformationMessage(vscode.l10n.t('msg.editorOpenSuccess'));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(vscode.l10n.t('msg.editorError', errorMessage));
        throw new EditorError(errorMessage);
    }
}

export async function copyToClipboard(content: string): Promise<void> {
    try {
        await vscode.env.clipboard.writeText(content);
        logger.info(vscode.l10n.t('msg.clipboardCopySuccess'));
        vscode.window.showInformationMessage(vscode.l10n.t('msg.clipboardCopySuccess'));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(vscode.l10n.t('msg.clipboardError', errorMessage));
        throw new ClipboardError(errorMessage);
    }
}

export async function openInChatGPT(content: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('matomeru');
    const chatGptIntegration = config.get<boolean>('chatGptIntegration', false);

    if (!chatGptIntegration) {
        logger.warn(vscode.l10n.t('msg.chatGPTDisabled'));
        throw new ChatGPTError(vscode.l10n.t('msg.chatGPTDisabled'));
    }

    if (os.platform() !== 'darwin') {
        logger.warn(vscode.l10n.t('msg.chatGPTOnlyMac'));
        throw new ChatGPTError(vscode.l10n.t('msg.chatGPTOnlyMac'));
    }

    try {
        const script = `
        tell application "Google Chrome"
            activate
            open location "https://chat.openai.com"
            delay 2
            tell application "System Events"
                keystroke "v" using command down
                delay 1
                keystroke return
            end tell
        end tell
        `;

        await copyToClipboard(content);
        await execAsync(`osascript -e '${script}'`);
        logger.info(vscode.l10n.t('msg.chatGPTSendSuccess'));
        vscode.window.showInformationMessage(vscode.l10n.t('msg.chatGPTSendSuccess'));
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(vscode.l10n.t('msg.chatGPTError', errorMessage));
        throw new ChatGPTError(errorMessage);
    }
} 