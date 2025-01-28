import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export class PlatformManager {
    static isSupportedPlatform(): boolean {
        return process.platform === 'darwin';
    }

    static async checkChatGPTApp(): Promise<boolean> {
        if (!this.isSupportedPlatform()) {
            return false;
        }

        try {
            // バンドルIDでSpotlight検索
            const bundleIdResult = await execAsync(
                'mdfind "kMDItemCFBundleIdentifier = \'com.openai.ChatGPT\'"'
            );
            if (bundleIdResult.stdout.trim().length > 0) {
                return true;
            }

            // アプリケーション名でSpotlight検索
            const nameResult = await execAsync(
                'mdfind "kMDItemKind = \'Application\' && kMDItemDisplayName = \'ChatGPT\'"'
            );
            if (nameResult.stdout.trim().length > 0) {
                return true;
            }

            // Applications フォルダ内のChatGPTアプリを確認
            const appExists = await fs.access('/Applications/ChatGPT.app')
                .then(() => true)
                .catch(() => false);

            if (appExists) {
                return true;
            }

            // 最後に、プロセスの確認
            const { stdout } = await execAsync('pgrep -f "ChatGPT"');
            return stdout.trim().length > 0;
        } catch (error) {
            console.error('ChatGPTアプリの検出に失敗:', error);
            return false;
        }
    }

    static async checkAccessibilityPermissions(): Promise<boolean> {
        if (!this.isSupportedPlatform()) {
            return false;
        }

        try {
            await execAsync(
                'osascript -e "tell application \\"System Events\\" to get name"'
            );
            return true;
        } catch {
            return false;
        }
    }

    static async openSystemPreferences(): Promise<void> {
        if (!this.isSupportedPlatform()) {
            return;
        }

        await execAsync(
            'open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"'
        );
    }

    /**
     * アクセシビリティ権限を確認する
     */
    static async verifyAccessibility(): Promise<void> {
        const script = `
            tell application "System Events"
                set isEnabled to UI elements enabled
                return isEnabled
            end tell
        `;

        try {
            await execAsync(`osascript -e '${script}'`);
        } catch (error) {
            throw new Error('アクセシビリティ権限が必要です');
        }
    }

    /**
     * AppleScriptを実行する
     */
    static async executeAppleScript(script: string): Promise<boolean> {
        try {
            const { stdout } = await execAsync(`osascript -e '${script}'`);
            return stdout.trim().toLowerCase() === 'true';
        } catch (error) {
            return false;
        }
    }

    static async openSecurityPreferences(panel: string): Promise<void> {
        const script = `
            tell application "System Preferences"
                activate
                set current pane to pane id "${panel}"
            end tell
        `;
        await execAsync(`osascript -e '${script}'`);
    }
} 