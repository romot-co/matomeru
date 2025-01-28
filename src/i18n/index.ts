import * as vscode from 'vscode';
import { LocaleMessages, I18nOptions, MessagePath } from './types';
import { MessageValidator } from './validator';

export class I18n {
	private static instance: I18n;
	private messages: Record<string, Partial<LocaleMessages>>;
	private validator: MessageValidator;
	private currentLocale: string;
	private fallbackLocale: string;

	private constructor(options: I18nOptions = {}) {
		this.messages = {};
		this.validator = new MessageValidator();
		this.currentLocale = options.defaultLocale || this.detectLocale();
		this.fallbackLocale = options.fallbackLocale || 'en';
		this.loadMessages();
	}

	static getInstance(options?: I18nOptions): I18n {
		if (!I18n.instance) {
			I18n.instance = new I18n(options);
		}
		return I18n.instance;
	}

	private detectLocale(): string {
		const vscodeLang = vscode.env.language;
		return vscodeLang.startsWith('ja') ? 'ja' : 'en';
	}

	private loadMessages() {
		this.messages = {
			en: {
				commands: {
					combineDirectory: 'Combine Directory'
				},
				ui: {
					outputDestination: {
						placeholder: 'Select Output Destination',
						editor: {
							label: 'Editor',
							description: 'Open in New Editor'
						},
						clipboard: {
							label: 'Clipboard',
							description: 'Copy to Clipboard'
						}
					},
					progress: {
						scanning: 'Scanning...',
						collecting: 'Collecting Files...',
						processing: 'Processing...'
					},
					messages: {
						selectDirectory: 'Please select a directory',
						openedInEditor: 'Opened in Editor',
						copiedToClipboard: 'Copied to Clipboard',
						error: 'An error occurred',
						showDetails: 'Show Details',
						noStackTrace: 'No stack trace available',
						sentToChatGPT: 'Sent to ChatGPT',
						macOSOnly: 'This feature is only available on macOS',
						accessibilityRequired: 'Accessibility permissions required',
						openSettings: 'Open Settings',
						chatGPTNotInstalled: 'ChatGPT is not installed',
						activated: 'Extension activated',
						sendFailed: 'Send failed: {0}',
						sendSuccess: 'Send successful',
						waitingForResponse: 'Waiting for ChatGPT response...',
						scanError: 'Failed to scan directory: {0}'
					}
				},
				errors: {
					accessibilityPermission: 'Accessibility permissions required',
					windowActivation: 'Failed to activate ChatGPT window',
					pasteFailed: 'Failed to paste from clipboard',
					sendButtonNotFound: 'Send button not found',
					responseTimeout: 'Response timeout'
				}
			},
			ja: {
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
			}
		};
	}

	t(key: string, ...args: any[]): string {
		const parts = key.split('.');
		let message = this.findMessage(parts);

		if (typeof message !== 'string') {
			console.warn(`Translation not found for key: ${key}`);
			return key;
		}

		return this.format(message, args);
	}

	private findMessage(parts: string[]): any {
		let current: any = this.messages[this.currentLocale];

		for (const part of parts) {
			if (current === undefined) {
				current = this.messages[this.fallbackLocale];
				if (current === undefined) {
					return undefined;
				}
			}
			current = current[part];
		}

		return current;
	}

	private format(message: string, args: any[]): string {
		return args.reduce((str, arg, i) => str.replace(`{${i}}`, String(arg)), message);
	}
}

export { LocaleMessages, I18nOptions }; 

