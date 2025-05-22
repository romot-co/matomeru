import * as vscode from 'vscode';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Logger } from './utils/logger';
import { ChatGPTError, ClipboardError, EditorError } from './errors/errors';
import { calculateContentMetrics, formatTokenCount } from './utils/fileUtils';

const execAsync = promisify(exec);
const logger = Logger.getInstance('UI');

export async function showInEditor(content: string, language: 'markdown' | 'yaml' = 'markdown'): Promise<void> {
    try {
        const document = await vscode.workspace.openTextDocument({
            content: content,
            language: language
        });
        
        await vscode.window.showTextDocument(document);
        const { formattedSize, tokens } = calculateContentMetrics(content);
        const formattedTokens = formatTokenCount(tokens);
        
        vscode.window.showInformationMessage(
            content.length === 0
                ? vscode.l10n.t('msg.editorOpenSuccess')
                : vscode.l10n.t('msg.editorOpenSuccessWithSize', formattedSize, formattedTokens)
        );
        
        logger.info('エディタに出力しました');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(vscode.l10n.t('msg.editorError', errorMessage));
        throw new EditorError(errorMessage);
    }
}

export async function copyToClipboard(content: string): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            await vscode.env.clipboard.writeText(content);

            const { formattedSize, tokens } = calculateContentMetrics(content);
            const formattedTokens = formatTokenCount(tokens);

            vscode.window.showInformationMessage(
                content.length === 0
                    ? vscode.l10n.t('msg.clipboardCopySuccess')
                    : vscode.l10n.t('msg.clipboardCopySuccessWithSize', formattedSize, formattedTokens)
            );

            logger.info('クリップボードにコピーしました');
            return;
        } catch (error) {
            lastError = error;
            if (attempt < 3) {
                await new Promise((r) => setTimeout(r, 100));
            }
        }
    }

    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    logger.error(vscode.l10n.t('msg.clipboardError', errorMessage));
    throw new ClipboardError(errorMessage);
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
        const { formattedSize, tokens } = calculateContentMetrics(content);
        
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
        const formattedTokens = formatTokenCount(tokens);
        vscode.window.showInformationMessage(
            vscode.l10n.t('msg.chatGPTSendSuccessWithSize', formattedSize, formattedTokens)
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(vscode.l10n.t('msg.chatGPTError', errorMessage));
        throw new ChatGPTError(errorMessage);
    }
} 