import type { LocaleMessages } from '../types';

export const jaMessages: Partial<LocaleMessages> = {
    'test.message': 'テストメッセージ',
    'test.with.params': 'こんにちは、{{name}}さん',
    'chatgpt.integration.error': 'ChatGPT統合機能でエラーが発生しました',

    // 既存のメッセージ
    'ui.messages.selectDirectory': 'ディレクトリを選択してください',
    'ui.messages.scanError': 'ディレクトリのスキャン中にエラーが発生しました',
    'ui.messages.sentToChatGPT': 'ファイル内容をChatGPTに送信しました',
    'ui.messages.chatGPTNotInstalled': 'ChatGPTがインストールされていません',
    'ui.progress.processing': 'ファイルを処理中...',

    'success.directory.processed': 'ディレクトリの処理が完了しました',
    'error.directory.processing': 'ディレクトリの処理中にエラーが発生しました',
    'error.platform.unsupported': 'このプラットフォームはサポートされていません',
    'error.config.invalid': '設定が無効です',
    'config.updated': '設定が更新されました',
    'errors.directoryNotInWorkspace': 'ディレクトリがワークスペース内にありません',
    'errors.chatGptIntegrationNotSupported': 'ChatGPT統合機能はこのプラットフォームではサポートされていません'
}; 
