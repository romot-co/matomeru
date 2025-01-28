/**
 * プラットフォーム固有の実装を定義するインターフェース
 */
export interface IPlatformImplementation {
    /**
     * プラットフォーム固有の機能が利用可能かどうかを確認します
     */
    isAvailable(): boolean;

    /**
     * ChatGPTでコンテンツを開きます
     */
    openInChatGPT(content: string): Promise<void>;

    /**
     * クリップボードにテキストをコピーします
     */
    copyToClipboard(text: string): Promise<void>;

    /**
     * アクセシビリティ権限を確認します
     */
    checkAccessibilityPermission(): Promise<boolean>;

    /**
     * プラットフォーム固有のアプリケーションを起動します
     */
    launchApplication(bundleId: string): Promise<void>;
} 