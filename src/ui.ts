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
                ? vscode.l10n.t('Opened in editor')
                : vscode.l10n.t('Opened in editor (Size: {0}, ~{1} tokens)', formattedSize, formattedTokens)
        );
        
        logger.info('エディタに出力しました');
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(vscode.l10n.t('Editor error: {0}', errorMessage));
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
                    ? vscode.l10n.t('Copied to clipboard')
                    : vscode.l10n.t('Copied to clipboard (Size: {0}, ~{1} tokens)', formattedSize, formattedTokens)
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
    logger.error(vscode.l10n.t('Clipboard error: {0}', errorMessage));
    throw new ClipboardError(errorMessage);
}

export async function openInChatGPT(content: string): Promise<void> {
    // ConfigServiceを使用して設定を取得
    const config = (await import('./services/configService')).ConfigService.getInstance().getConfig();
    const chatGptIntegration = config.chatGptIntegration;

    if (!chatGptIntegration) {
        logger.warn(vscode.l10n.t('ChatGPT integration is disabled'));
        throw new ChatGPTError(vscode.l10n.t('ChatGPT integration is disabled'));
    }

    if (os.platform() !== 'darwin') {
        logger.warn(vscode.l10n.t('ChatGPT integration is only supported on macOS'));
        throw new ChatGPTError(vscode.l10n.t('ChatGPT integration is only supported on macOS'));
    }

    try {
        const { formattedSize, tokens } = calculateContentMetrics(content);
        
        // ユーザーに確認ダイアログを表示（セキュリティ向上）
        const continueLabel = vscode.l10n.t('Continue');
        const userConfirmation = await vscode.window.showInformationMessage(
            vscode.l10n.t('This will copy your content to the clipboard and open ChatGPT in Chrome. Your content will be visible on the clipboard. Continue?'),
            { modal: true },
            continueLabel,
            vscode.l10n.t('Cancel')
        );

        if (userConfirmation !== continueLabel) {
            return;
        }
        
        // AppleScriptの待機時間を延長して安定性を向上
        const script = `
        tell application "Google Chrome"
            activate
            open location "https://chat.openai.com"
            delay 4
            tell application "System Events"
                keystroke "v" using command down
                delay 2
                keystroke return
            end tell
        end tell
        `;

        await copyToClipboard(content);
        await execAsync(`osascript -e '${script}'`);
        logger.info(vscode.l10n.t('Sent to ChatGPT'));
        const formattedTokens = formatTokenCount(tokens);
        vscode.window.showInformationMessage(
            vscode.l10n.t('Sent to ChatGPT (Size: {0}, ~{1} tokens)', formattedSize, formattedTokens)
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(vscode.l10n.t('ChatGPT error: {0}', errorMessage));
        throw new ChatGPTError(errorMessage);
    }
} 