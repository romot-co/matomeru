import * as vscode from 'vscode';

export interface IClipboardService {
    writeText(text: string): Promise<void>;
    readText(): Promise<string>;
}

/**
 * クリップボード操作サービス
 * VS Code のクリップボード関連APIをラップし、一貫したインターフェースを提供します
 */
export class ClipboardService implements IClipboardService {
    constructor() {}

    /**
     * ファクトリメソッド - デフォルトの設定でClipboardServiceインスタンスを生成
     */
    public static createDefault(): ClipboardService {
        return new ClipboardService();
    }

    /**
     * テキストをクリップボードに書き込みます
     * @param text コピーするテキスト
     */
    async writeText(text: string): Promise<void> {
        await vscode.env.clipboard.writeText(text);
    }

    async readText(): Promise<string> {
        return vscode.env.clipboard.readText();
    }
} 