export default {
    commands: {
        combineDirectory: 'ディレクトリの内容を結合'
    },
    ui: {
        outputDestination: {
            placeholder: '出力先を選択',
            editor: {
                label: 'エディタで開く',
                description: '結合した内容を新しいエディタで開きます'
            },
            clipboard: {
                label: 'クリップボードにコピー',
                description: '結合した内容をクリップボードにコピーします'
            }
        },
        progress: {
            scanning: 'ディレクトリをスキャン中...',
            collecting: 'ファイル内容を収集中...',
            processing: 'ファイルを処理中...'
        },
        messages: {
            selectDirectory: 'ディレクトリを選択してください',
            openedInEditor: '結合した内容をエディタで開きました',
            copiedToClipboard: '結合した内容をクリップボードにコピーしました',
            error: 'エラーが発生しました: {0}',
            showDetails: '詳細を表示',
            noStackTrace: 'スタックトレースはありません',
            sentToChatGPT: 'ChatGPTに送信しました',
            macOSOnly: 'この機能はmacOSでのみ利用可能です',
            accessibilityRequired: 'アクセシビリティの許可が必要です',
            openSettings: '設定を開く',
            chatGPTNotInstalled: 'ChatGPTデスクトップアプリがインストールされていません',
            activated: 'Matomeruが有効化されました',
            sendFailed: 'ChatGPTへの送信に失敗しました: {0}',
            sendSuccess: 'ChatGPTへの送信が完了しました',
            waitingForResponse: 'ChatGPTの応答を待っています...',
            scanError: 'ディレクトリのスキャンに失敗しました: {0}'
        }
    },
    errors: {
        accessibilityPermission: 'ChatGPTとの連携にはアクセシビリティの許可が必要です',
        windowActivation: 'ChatGPTウィンドウのアクティブ化に失敗しました',
        pasteFailed: 'ChatGPTへの貼り付けに失敗しました',
        sendButtonNotFound: 'ChatGPTウィンドウの送信ボタンが見つかりません',
        responseTimeout: 'ChatGPTの応答待ちがタイムアウトしました',
        fileSystem: 'ファイルシステムエラーが発生しました',
        outOfMemory: 'メモリ不足エラーが発生しました',
        invalidPath: '無効なファイルパスです',
        symlink: 'シンボリックリンクの処理に失敗しました',
        parallel: '並列処理中にエラーが発生しました'
    }
}; 