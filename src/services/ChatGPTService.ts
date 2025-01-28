import * as vscode from 'vscode';
import { promisify } from 'util';
import { exec } from 'child_process';
import { I18n } from '../i18n';
import { PlatformManager } from './PlatformManager';
import {
    ChatGPTIntegrationError,
    ChatGPTTimeoutError,
    ChatGPTPermissionError,
    ChatGPTUIError
} from '../errors/ChatGPTErrors';

const execAsync = promisify(exec);
const PASTE_RETRY_COUNT = 3;
const PASTE_RETRY_DELAY = 500; // ms
const ACTIVATION_RETRY_COUNT = 3;
const ACTIVATION_RETRY_DELAY = 500; // ms

export class ChatGPTService {
    private i18n: I18n;

    constructor() {
        this.i18n = I18n.getInstance();
    }

    async sendMessage(content: string): Promise<void> {
        await this.verifyPermissions();
        
        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: this.i18n.t('ui.messages.waitingForResponse')
        };

        await vscode.window.withProgress(progressOptions, async () => {
            await this.performPasteAndSend(content);
            await this.waitForResponse();
            vscode.window.showInformationMessage(this.i18n.t('ui.messages.sendSuccess'));
        });
    }

    private async verifyPermissions(): Promise<void> {
        try {
            await PlatformManager.verifyAccessibility();
        } catch (error) {
            throw new ChatGPTPermissionError(
                this.i18n.t('errors.accessibilityPermission')
            );
        }
    }

    private async performPasteAndSend(content: string): Promise<void> {
        try {
            await this.copyToClipboard(content);
            await this.activateChatGPTWindow();
            await this.pasteWithRetry();
            // 送信処理をスキップ
            // await this.sendMessageToChatGPT();
        } catch (error) {
            throw new ChatGPTIntegrationError(
                this.i18n.t('messages.sendFailed', error instanceof Error ? error.message : String(error))
            );
        }
    }

    private async copyToClipboard(content: string): Promise<void> {
        try {
            await vscode.env.clipboard.writeText(content);
            // クリップボードの内容が確実に書き込まれるまで少し待機
            await this.delay(100);
        } catch (error) {
            throw new ChatGPTUIError(this.i18n.t('errors.clipboardFailed'));
        }
    }

    private async activateChatGPTWindow(): Promise<void> {
        for (let i = 0; i < ACTIVATION_RETRY_COUNT; i++) {
            try {
                const script = `
                    tell application "ChatGPT"
                        activate
                        set frontmost to true
                        delay 1
                    end tell
                    
                    tell application "System Events"
                        tell process "ChatGPT"
                            set frontmost to true
                            
                            -- メインウィンドウを探してアクティブ化
                            repeat with w in windows
                                try
                                    set focused of w to true
                                    exit repeat
                                end try
                            end repeat
                            
                            -- テキストエリアを探してフォーカス
                            set textArea to text area 1 of group 1 of window 1
                            set focused of textArea to true
                            delay 0.5
                            
                            return true
                        end tell
                    end tell
                `;
                
                const { stdout } = await execAsync(`osascript -e '${script}'`);
                if (stdout.trim().toLowerCase() === 'true') {
                    return;
                }
                
                await this.delay(ACTIVATION_RETRY_DELAY);
            } catch (error) {
                console.error(`Window activation attempt ${i + 1} failed:`, error);
                if (i === ACTIVATION_RETRY_COUNT - 1) {
                    throw new ChatGPTUIError(this.i18n.t('errors.windowActivation'));
                }
                await this.delay(ACTIVATION_RETRY_DELAY * (i + 1)); // 徐々に待機時間を増やす
            }
        }
    }

    private async pasteWithRetry(): Promise<void> {
        for (let i = 0; i < PASTE_RETRY_COUNT; i++) {
            try {
                const script = `
                    tell application "System Events"
                        tell process "ChatGPT"
                            -- テキストエリアにフォーカスを移動
                            set textArea to text area 1 of group 1 of window 1
                            set focused of textArea to true
                            delay 0.5
                            
                            -- Command+Vでペースト
                            keystroke "v" using command down
                            delay 1
                            
                            -- テキストが入力されたか確認
                            if value of textArea is "" then
                                error "Paste failed: Text area is empty"
                            end if
                        end tell
                    end tell
                `;
                
                await execAsync(`osascript -e '${script}'`);
                return;
            } catch (error) {
                console.error(`Paste attempt ${i + 1} failed:`, error);
                if (i === PASTE_RETRY_COUNT - 1) {
                    throw new ChatGPTUIError(this.i18n.t('errors.pasteFailed'));
                }
                await this.delay(PASTE_RETRY_DELAY * (i + 1)); // 徐々に待機時間を増やす
            }
        }
    }

    private async sendMessageToChatGPT(): Promise<void> {
        const sendButtonScript = `
            tell application "System Events"
                tell process "ChatGPT"
                    -- 送信ボタンを探す
                    set sendButton to button 1 of group 1 of window 1
                    if enabled of sendButton then
                        click sendButton
                    else
                        -- Command+Enterでも送信
                        keystroke return using command down
                    end if
                end tell
            end tell
        `;

        try {
            await execAsync(`osascript -e '${sendButtonScript}'`);
            await this.delay(1000);
        } catch (error) {
            // 送信ボタンが見つからない場合はCommand+Enterを試す
            try {
                await execAsync('osascript -e \'tell application "System Events" to keystroke return using command down\'');
            } catch (retryError) {
                throw new ChatGPTUIError(this.i18n.t('errors.sendButtonNotFound'));
            }
        }
    }

    private async waitForResponse(timeout = 30000): Promise<void> {
        const startTime = Date.now();
        const responseCheckScript = `
            tell application "System Events"
                tell process "ChatGPT"
                    -- レスポンス待ちの状態を確認
                    set progressIndicator to group 1 of window 1
                    if exists progressIndicator then
                        return true
                    end if
                    return false
                end tell
            end tell
        `;

        while (Date.now() - startTime < timeout) {
            try {
                const { stdout } = await execAsync(`osascript -e '${responseCheckScript}'`);
                if (stdout.trim().toLowerCase() === 'false') {
                    return;
                }
                await this.delay(1000);
            } catch (error) {
                console.error('Response check failed:', error);
            }
        }
        
        throw new ChatGPTTimeoutError(this.i18n.t('errors.responseTimeout'));
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
} 