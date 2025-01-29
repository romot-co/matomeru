import * as vscode from 'vscode';

/**
 * クリップボード操作のラッパークラス
 * VS Code APIの直接利用を避け、テスト時のスタブ化を容易にします
 */
export class ClipboardService {
    /**
     * テキストをクリップボードに書き込みます
     * @param text コピーするテキスト
     */
    public static async writeText(text: string): Promise<void> {
        await vscode.env.clipboard.writeText(text);
    }
} 