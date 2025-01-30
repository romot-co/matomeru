import * as vscode from 'vscode';
import { promisify } from 'util';
import { exec, ExecOptions } from 'child_process';
import { IPlatformImplementation } from './IPlatformImplementation';
import { IErrorHandler } from '../../shared/errors/services/ErrorService';
import { UnsupportedPlatformError, AccessibilityPermissionError, ChatGPTUIError } from '../../shared/errors/ChatGPTErrors';
import { II18nService } from '../../i18n/I18nService';
import { IConfigurationService } from '../config/ConfigurationService';
import { ILogger } from '../logging/LoggingService';
import { BaseError } from '../../shared/errors/base/BaseError';

const execAsync = promisify(exec);
const PASTE_RETRY_COUNT = 3;
const PASTE_RETRY_DELAY = 500; // ms
const ACTIVATION_RETRY_COUNT = 3;
const ACTIVATION_RETRY_DELAY = 500; // ms
const MAX_SCRIPT_RETRIES = 3;
const DEFAULT_BUNDLE_ID = 'com.openai.chat';

/**
 * macOS固有の実装クラス
 */
export class MacOSImplementation implements IPlatformImplementation {
    constructor(
        private readonly errorHandler: IErrorHandler,
        private readonly i18n: II18nService,
        private readonly configManager: IConfigurationService,
        private readonly logger: ILogger
    ) {}

    public static createDefault(
        errorHandler: IErrorHandler,
        i18n: II18nService,
        configManager: IConfigurationService,
        logger: ILogger
    ): MacOSImplementation {
        return new MacOSImplementation(errorHandler, i18n, configManager, logger);
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
                const action = await vscode.window.showErrorMessage(
                    this.i18n.t('errors.accessibilityPermission'),
                    { modal: true },
                    '設定を開く',
                    'ブラウザ版を使用'
                );

                if (action === '設定を開く') {
                    await execAsync('open "x-apple.systempreferences:com.apple.preference.security"');
                    return;
                } else if (action === 'ブラウザ版を使用') {
                    await this.openInBrowser(content);
                    return;
                }
                throw new AccessibilityPermissionError('アクセシビリティの権限が必要です');
            }

            // アプリを起動して待機
            const bundleId = await this.getChatGPTBundleId();
            await this.launchApplication(bundleId);
            await this.delay(2000); // アプリの起動を待機

            // クリップボードにコピー
            await this.copyToClipboard(content);
            await this.delay(500); // クリップボードの準備を待機

            let success = false;
            for (let i = 0; i < MAX_SCRIPT_RETRIES; i++) {
                try {
                    await this.activateChatGPTWindow();
                    await this.pasteWithRetry();
                    await this.sendMessage();
                    success = true;
                    break;
                } catch (error) {
                    console.error(`Attempt ${i + 1} failed:`, error);
                    if (i === MAX_SCRIPT_RETRIES - 1) {
                        const action = await vscode.window.showErrorMessage(
                            'ChatGPTへの自動貼り付けに失敗しました。',
                            'マニュアルで貼り付け',
                            'ブラウザ版を使用',
                            'バンドルIDを設定'
                        );

                        if (action === 'マニュアルで貼り付け') {
                            await vscode.window.showInformationMessage(
                                'コンテンツはクリップボードにコピーされています。ChatGPTアプリで Command+V を押して貼り付けてください。'
                            );
                            return;
                        } else if (action === 'ブラウザ版を使用') {
                            await this.openInBrowser(content);
                            return;
                        } else if (action === 'バンドルIDを設定') {
                            await vscode.commands.executeCommand('workbench.action.openSettings', 'matomeru.chatgptBundleId');
                            return;
                        }
                        throw error;
                    }
                    await this.delay(1000 * (i + 1)); // 指数バックオフ
                }
            }

            if (!success) {
                throw new ChatGPTUIError('ChatGPTへの送信に失敗しました');
            }

        } catch (error) {
            console.error('Error in openInChatGPT:', error);
            await this.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'MacOSImplementation.openInChatGPT',
                timestamp: new Date(),
                details: {
                    platform: process.platform,
                    osVersion: process.version
                }
            });
            throw error;
        }
    }

    private async getChatGPTBundleId(): Promise<string> {
        const config = this.configManager.getConfiguration();
        const bundleId = config.chatgptBundleId || DEFAULT_BUNDLE_ID;

        // バンドルIDの存在確認
        const searchResult = await execAsync(
            `mdfind "kMDItemCFBundleIdentifier = '${bundleId}'"`
        );

        if (searchResult.stdout.trim().length === 0) {
            const action = await vscode.window.showErrorMessage(
                `ChatGPTアプリが見つかりません (${bundleId})`,
                'バンドルIDを設定',
                'ブラウザ版を使用'
            );

            if (action === 'バンドルIDを設定') {
                await vscode.commands.executeCommand('workbench.action.openSettings', 'matomeru.chatgptBundleId');
            } else if (action === 'ブラウザ版を使用') {
                throw new ChatGPTUIError('ブラウザ版に切り替えます');
            }
            throw new ChatGPTUIError('ChatGPTアプリが見つかりません');
        }

        return bundleId;
    }

    private async openInBrowser(content: string): Promise<void> {
        await vscode.env.openExternal(vscode.Uri.parse('https://chat.openai.com/'));
        await this.copyToClipboard(content);
        await vscode.window.showInformationMessage(
            'ChatGPTをブラウザで開きました。コンテンツはクリップボードにコピーされています。ログイン後、Command+V で貼り付けてください。'
        );
    }

    protected async runExecCommand(cmd: string, options: ExecOptions = {}): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            exec(cmd, options, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve({ stdout, stderr });
            });
        });
    }

    async copyToClipboard(text: string): Promise<void> {
        try {
            await this.runExecCommand(`echo "${text}" | pbcopy`, {});
        } catch (error) {
            const context = {
                source: 'MacOSImplementation.copyToClipboard',
                details: { text },
                timestamp: new Date()
            };
            await this.errorHandler.handleError(error as Error, context);
            throw new BaseError('クリップボードへのコピーに失敗しました', 'ClipboardError', { originalError: error });
        }
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
                    return true
                end tell
            `;
            const result = await this.runExecCommand(`osascript -e '${script}'`);
            return result.stdout.trim() === 'true';
        } catch (error) {
            await this.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
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
            const searchResult = await this.runExecCommand(
                `mdfind "kMDItemCFBundleIdentifier = '${bundleId}'"`
            );

            if (searchResult.stdout.trim().length === 0) {
                const error = new ChatGPTUIError(this.i18n.t('errors.chatGPTNotInstalled'));
                await this.errorHandler.handleError(error, {
                    source: 'MacOSImplementation.launchApplication',
                    details: { bundleId },
                    timestamp: new Date()
                });
                throw error;
            }

            // アプリを起動
            const script = `
                tell application id "${bundleId}"
                    activate
                end tell
            `;
            await this.runExecCommand(`osascript -e '${script}'`);
            await this.delay(1000); // 起動完了を待機
        } catch (error) {
            if (error instanceof ChatGPTUIError) {
                throw error;
            }
            console.error('アプリケーション起動エラー:', error);
            const uiError = new ChatGPTUIError(this.i18n.t('errors.windowActivation'));
            await this.errorHandler.handleError(error instanceof Error ? error : new Error(String(error)), {
                source: 'MacOSImplementation.launchApplication',
                details: { bundleId },
                timestamp: new Date()
            });
            throw uiError;
        }
    }

    private async activateChatGPTWindow(): Promise<void> {
        for (let i = 0; i < ACTIVATION_RETRY_COUNT; i++) {
            try {
                const script = `
                    tell application "System Events"
                        tell process "ChatGPT"
                            set frontmost to true
                            delay 1
                            
                            set mainWindow to window 1
                            
                            -- より詳細なUI階層の探索
                            set foundTextArea to false
                            
                            -- スクロールエリア内を探索
                            try
                                set scrollAreas to every scroll area of mainWindow
                                repeat with scrollArea in scrollAreas
                                    try
                                        set textArea to text area 1 of scrollArea
                                        click textArea
                                        set foundTextArea to true
                                        exit repeat
                                    end try
                                end repeat
                            end try
                            
                            -- グループ内を探索（foundTextAreaがfalseの場合）
                            if not foundTextArea then
                                set groups to every group of mainWindow
                                repeat with grp in groups
                                    try
                                        set textArea to text area 1 of grp
                                        click textArea
                                        set foundTextArea to true
                                        exit repeat
                                    end try
                                end repeat
                            end if
                            
                            -- 直接のテキストエリアを探索（foundTextAreaがfalseの場合）
                            if not foundTextArea then
                                try
                                    set textArea to text area 1 of mainWindow
                                    click textArea
                                    set foundTextArea to true
                                end try
                            end if
                            
                            if not foundTextArea then
                                error "テキストエリアが見つかりません"
                            end if
                            
                            return true
                        end tell
                    end tell
                `;
                
                const { stdout } = await execAsync(`osascript -e '${script}'`);
                if (stdout.trim().toLowerCase() === 'true') {
                    return;
                }
                
                console.log(`ウィンドウのアクティブ化試行 ${i + 1} 失敗`);
                await this.delay(ACTIVATION_RETRY_DELAY * (i + 1)); // 指数バックオフ
            } catch (error) {
                console.error(`ウィンドウのアクティブ化試行 ${i + 1} エラー:`, error);
                if (i === ACTIVATION_RETRY_COUNT - 1) {
                    throw new ChatGPTUIError(this.i18n.t('errors.windowActivation'));
                }
                await this.delay(ACTIVATION_RETRY_DELAY * (i + 1)); // 指数バックオフ
            }
        }
        
        throw new ChatGPTUIError(this.i18n.t('errors.windowActivation'));
    }

    private async pasteWithRetry(): Promise<void> {
        for (let i = 0; i < PASTE_RETRY_COUNT; i++) {
            try {
                const script = `
                    tell application "System Events"
                        tell process "ChatGPT"
                            set mainWindow to window 1
                            set foundTextArea to false
                            set targetTextArea to missing value
                            
                            -- スクロールエリア内を探索
                            try
                                set scrollAreas to every scroll area of mainWindow
                                repeat with scrollArea in scrollAreas
                                    try
                                        set textArea to text area 1 of scrollArea
                                        set targetTextArea to textArea
                                        set foundTextArea to true
                                        exit repeat
                                    end try
                                end repeat
                            end try
                            
                            -- グループ内を探索（foundTextAreaがfalseの場合）
                            if not foundTextArea then
                                set groups to every group of mainWindow
                                repeat with grp in groups
                                    try
                                        set textArea to text area 1 of grp
                                        set targetTextArea to textArea
                                        set foundTextArea to true
                                        exit repeat
                                    end try
                                end repeat
                            end if
                            
                            -- 直接のテキストエリアを探索（foundTextAreaがfalseの場合）
                            if not foundTextArea then
                                try
                                    set textArea to text area 1 of mainWindow
                                    set targetTextArea to textArea
                                    set foundTextArea to true
                                end try
                            end if
                            
                            if not foundTextArea then
                                error "テキストエリアが見つかりません"
                            end if
                            
                            -- テキストエリアにフォーカスを設定
                            click targetTextArea
                            delay 1
                            
                            -- Command+Vでペースト
                            keystroke "v" using command down
                            delay 1.5
                            
                            -- テキストが入力されたか確認
                            if value of targetTextArea is "" then
                                error "ペーストに失敗しました"
                            end if
                            
                            return true
                        end tell
                    end tell
                `;
                
                const { stdout } = await execAsync(`osascript -e '${script}'`);
                if (stdout.trim().toLowerCase() === 'true') {
                    console.log('ペースト成功');
                    return;
                }
                
                console.log(`ペースト試行 ${i + 1} 失敗`);
                await this.delay(PASTE_RETRY_DELAY * (i + 1)); // 指数バックオフ
            } catch (error) {
                console.error(`ペースト試行 ${i + 1} エラー:`, error);
                if (i === PASTE_RETRY_COUNT - 1) {
                    throw new ChatGPTUIError(this.i18n.t('errors.pasteFailed'));
                }
                await this.delay(PASTE_RETRY_DELAY * (i + 1)); // 指数バックオフ
            }
        }
        
        throw new ChatGPTUIError(this.i18n.t('errors.pasteFailed'));
    }

    private async sendMessage(): Promise<void> {
        for (let i = 0; i < MAX_SCRIPT_RETRIES; i++) {
            try {
                const script = `
                    tell application "System Events"
                        tell process "ChatGPT"
                            -- プロンプト入力エリアを探す
                            set promptArea to text area 1 of group 1 of group 1 of window 1
                            
                            -- 送信ボタンを探す
                            set sendButton to button 1 of group 1 of group 1 of window 1
                            
                            -- 送信ボタンの状態を確認
                            if enabled of sendButton then
                                click sendButton
                                delay 1
                                
                                -- 送信後にボタンが無効化されているか確認
                                if not (enabled of sendButton) then
                                    return true
                                end if
                            end if
                            
                            -- Command+Enterで送信を試みる
                            keystroke return using command down
                            delay 1
                            
                            -- 再度確認
                            if not (enabled of sendButton) then
                                return true
                            end if
                            
                            error "送信が完了していません"
                        end tell
                    end tell
                `;

                const { stdout } = await execAsync(`osascript -e '${script}'`);
                if (stdout.trim().toLowerCase() === 'true') {
                    console.log('送信成功');
                    return;
                }
                
                console.log(`送信試行 ${i + 1} 失敗`);
                await this.delay(1000 * (i + 1)); // 指数バックオフ
            } catch (error) {
                console.error(`送信試行 ${i + 1} エラー:`, error);
                if (i === MAX_SCRIPT_RETRIES - 1) {
                    throw new ChatGPTUIError(this.i18n.t('errors.sendButtonNotFound'));
                }
                await this.delay(1000 * (i + 1)); // 指数バックオフ
            }
        }
        
        throw new ChatGPTUIError(this.i18n.t('errors.sendButtonNotFound'));
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
} 

