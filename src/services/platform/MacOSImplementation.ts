import * as vscode from 'vscode';
import { promisify } from 'util';
import { exec } from 'child_process';
import { IPlatformImplementation } from './IPlatformImplementation';
import { ErrorService } from '../error/ErrorService';
import { UnsupportedPlatformError, AccessibilityPermissionError, ChatGPTUIError } from '../../errors/ChatGPTErrors';

const execAsync = promisify(exec);
const PASTE_RETRY_COUNT = 3;
const PASTE_RETRY_DELAY = 500; // ms
const ACTIVATION_RETRY_COUNT = 3;
const ACTIVATION_RETRY_DELAY = 500; // ms

/**
 * macOS固有の実装クラス
 */
export class MacOSImplementation implements IPlatformImplementation {
    private errorService: ErrorService;

    constructor() {
        this.errorService = ErrorService.getInstance();
    }

    isAvailable(): boolean {
        return process.platform === 'darwin';
    }

    async openInChatGPT(content: string): Promise<void> {
        if (!this.isAvailable()) {
            throw new UnsupportedPlatformError('この機能はmacOSでのみ利用可能です');
        }

        try {
            const hasPermission = await this.checkAccessibilityPermission();
            if (!hasPermission) {
                throw new AccessibilityPermissionError('アクセシビリティの権限が必要です');
            }

            await this.launchApplication('com.openai.chat');
            await this.activateChatGPTWindow();
            await this.copyToClipboard(content);
            await this.pasteWithRetry();
            await this.sendMessage();

        } catch (error) {
            await this.errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'MacOSImplementation.openInChatGPT',
                timestamp: new Date()
            });
        }
    }

    async copyToClipboard(text: string): Promise<void> {
        await vscode.env.clipboard.writeText(text);
        await this.delay(100); // クリップボードの内容が確実に書き込まれるまで待機
    }

    async checkAccessibilityPermission(): Promise<boolean> {
        if (!this.isAvailable()) {
            throw new UnsupportedPlatformError(
                'この機能はmacOSでのみ利用可能です。他のプラットフォームではブラウザ版ChatGPTをご利用ください。'
            );
        }

        try {
            const script = `
                tell application "System Events"
                    tell application process "ChatGPT"
                        return true
                    end tell
                end tell
            `;
            await execAsync(`osascript -e '${script}'`);
            return true;
        } catch (error) {
            await this.errorService.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'MacOSImplementation.checkAccessibilityPermission',
                timestamp: new Date(),
                details: {
                    platform: process.platform,
                    osVersion: process.version
                }
            });
            return false;
        }
    }

    async launchApplication(bundleId: string): Promise<void> {
        try {
            // まずSpotlight検索でアプリの存在を確認
            const searchResult = await execAsync(
                `mdfind "kMDItemCFBundleIdentifier = '${bundleId}'"`
            );

            if (searchResult.stdout.trim().length === 0) {
                throw new Error('ChatGPTアプリが見つかりません');
            }

            // アプリを起動
            const script = `
                tell application "ChatGPT"
                    activate
                end tell
            `;
            await execAsync(`osascript -e '${script}'`);
            await this.delay(1000); // 起動完了を待機
        } catch (error) {
            throw new ChatGPTUIError('ChatGPTアプリの起動に失敗しました');
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
                    throw new ChatGPTUIError('ChatGPTウィンドウのアクティブ化に失敗しました');
                }
                await this.delay(ACTIVATION_RETRY_DELAY * (i + 1));
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
                    throw new ChatGPTUIError('クリップボードからの貼り付けに失敗しました');
                }
                await this.delay(PASTE_RETRY_DELAY * (i + 1));
            }
        }
    }

    private async sendMessage(): Promise<void> {
        const script = `
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
            await execAsync(`osascript -e '${script}'`);
            await this.delay(1000);
        } catch (error) {
            // 送信ボタンが見つからない場合はCommand+Enterを試す
            try {
                await execAsync('osascript -e \'tell application "System Events" to keystroke return using command down\'');
            } catch (retryError) {
                throw new ChatGPTUIError('送信ボタンが見つかりません');
            }
        }
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
} 
