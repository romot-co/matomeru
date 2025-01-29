import type { LocaleMessages } from '../types';

export const jaMessages: Partial<LocaleMessages> = {
    commands: {
        combineDirectory: 'ディレクトリを結合'
    },
    'test.message': 'テストメッセージ',
    'test.with.params': 'こんにちは、{name}さん',
    'chatgpt.integration.error': 'ChatGPT統合機能でエラーが発生しました',
    'ui.messages.selectDirectory': 'ディレクトリを選択してください',
    'ui.messages.scanError': 'ディレクトリのスキャン中にエラーが発生しました',
    'ui.messages.sentToChatGPT': 'ChatGPTに送信しました',
    'ui.messages.chatGPTNotInstalled': 'ChatGPTがインストールされていません',
    'ui.progress.processing': 'ファイル処理中...',
    'success.directory.processed': 'ディレクトリの処理が完了しました',
    'error.directory.processing': 'ディレクトリの処理中にエラーが発生しました',
    'error.platform.unsupported': 'このプラットフォームはサポートされていません',
    'error.config.invalid': '設定が無効です',
    'config.updated': '設定が更新されました',
    'errors.directoryNotInWorkspace': 'ディレクトリがワークスペース内にありません',
    'errors.chatGptIntegrationNotSupported': 'このプラットフォームではChatGPT統合機能はサポートされていません',
    ui: {
        outputDestination: {
            placeholder: '出力先を選択',
            editor: {
                label: 'エディタ',
                description: 'エディタで開く'
            },
            clipboard: {
                label: 'クリップボード',
                description: 'クリップボードにコピー'
            }
        },
        progress: {
            scanning: 'スキャン中...',
            collecting: '情報収集中...',
            processing: 'ファイル処理中...'
        },
        messages: {
            selectDirectory: 'ディレクトリを選択してください',
            selectWorkspace: 'ワークスペースを選択してください',
            openedInEditor: 'エディタで開きました',
            copiedToClipboard: 'クリップボードにコピーしました',
            error: 'エラーが発生しました',
            showDetails: '詳細を表示',
            noStackTrace: 'スタックトレースがありません',
            sentToChatGPT: 'ChatGPTに送信しました',
            macOSOnly: 'この機能はmacOSのみ対応しています',
            accessibilityRequired: 'アクセシビリティ権限が必要です',
            openSettings: '設定を開く',
            chatGPTNotInstalled: 'ChatGPTがインストールされていません',
            activated: '有効化されました',
            sendFailed: '送信に失敗しました',
            sendSuccess: '送信に成功しました',
            waitingForResponse: 'ChatGPTからの応答を待っています',
            scanError: 'ディレクトリのスキャン中にエラーが発生しました'
        }
    },
    errors: {
        accessibilityPermission: 'アクセシビリティ権限が必要です',
        windowActivation: 'ウィンドウのアクティブ化に失敗しました',
        pasteFailed: '貼り付けに失敗しました',
        sendButtonNotFound: '送信ボタンが見つかりません',
        responseTimeout: '応答がタイムアウトしました',
        fileSystem: 'ファイルシステムエラーが発生しました',
        outOfMemory: 'メモリ不足エラーが発生しました',
        checkErrorLog: 'エラーログを確認してください',
        macOSOnly: 'この機能はmacOSのみ対応しています',
        noWorkspace: 'ワークスペースが見つかりません',
        noWorkspaceSelected: 'ワークスペースが選択されていません',
        outsideWorkspace: 'ディレクトリがワークスペース外にあります',
        configurationUpdateFailed: '設定の更新に失敗しました'
    }
}; 
