import { LocaleMessages } from './types';

export const ja: Partial<LocaleMessages> = {
	commands: {
		combineDirectory: 'ディレクトリを結合'
	},
	ui: {
		outputDestination: {
			placeholder: '出力先を選択',
			editor: {
				label: 'エディタ',
				description: '新しいエディタで開く'
			},
			clipboard: {
				label: 'クリップボード',
				description: 'クリップボードにコピー'
			}
		},
		progress: {
			scanning: 'スキャン中...',
			collecting: 'ファイル収集中...',
			processing: '処理中...'
		},
		messages: {
			selectDirectory: 'ディレクトリを選択してください',
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
			activated: '拡張機能が有効化されました',
			sendFailed: '送信に失敗しました: {0}',
			sendSuccess: '送信に成功しました',
			waitingForResponse: 'ChatGPTからの応答を待っています...',
			scanError: 'ディレクトリのスキャンに失敗しました: {0}'
		}
	},
	errors: {
		accessibilityPermission: 'アクセシビリティ権限が必要です',
		windowActivation: 'ChatGPTウィンドウのアクティブ化に失敗しました',
		pasteFailed: 'クリップボードからの貼り付けに失敗しました',
		sendButtonNotFound: '送信ボタンが見つかりません',
		responseTimeout: '応答がタイムアウトしました'
	}
}; 