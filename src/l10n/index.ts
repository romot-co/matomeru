import * as vscode from 'vscode';
import { messages as jaMessages } from './ja';
import { messages as enMessages } from './en';

export type MessageKey = keyof typeof jaMessages;

/**
 * ローカライズされたメッセージを取得します。
 * @param key メッセージキー
 * @param args メッセージの引数
 * @returns ローカライズされたメッセージ
 */
export function getLocalizedMessage(key: MessageKey, ...args: any[]): string {
    const message = vscode.env.language === 'ja' ? jaMessages[key] : enMessages[key];
    return args.reduce((msg, arg, i) => msg.replace(`{${i}}`, String(arg)), message);
}

/**
 * メッセージキーを取得します。
 * @param key メッセージキー
 * @returns メッセージキー
 */
export function getMessageKey<K extends MessageKey>(key: K): K {
    return key;
} 