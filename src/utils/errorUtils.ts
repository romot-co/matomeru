import { MatomeruError } from '../errors/errors';

/**
 * エラーオブジェクトからメッセージを抽出するヘルパー関数
 * @param error エラーオブジェクト
 * @returns 抽出されたエラーメッセージ
 */
export function extractErrorMessage(error: unknown): string {
    let result: string;
    if (error instanceof MatomeruError) {
        result = error.getLocalizedMessage();
    }
    else if (error instanceof Error) {
        // カスタムパラメータを持つエラーの処理
        if ((error as any).params?.[0]) {
            const paramMsg = (error as any).params[0];
            // paramMsg が undefined や null の場合も考慮し、さらにフォールバックとして error.message や String(error) を使う
            result = paramMsg != null ? String(paramMsg) : (error.message || String(error));
        }
        // error.message が undefined や null の場合も考慮し、フォールバックとして String(error) を使う
        else {
            result = error.message || String(error);
        }
    }
    else {
        // その他の型のエラー（文字列など）
        result = String(error);
    }
    // 念のため、最終結果が null や undefined にならないように空文字列でフォールバック
    return result || '';
}

/**
 * エラーをログに記録し、適切なエラーメッセージを表示するヘルパー関数
 * @param logger Loggerインスタンス
 * @param error エラーオブジェクト
 * @param isWarning 警告として扱うかどうか
 */
export function logError(
    logger: { warn: (message: string) => void; error: (message: string | Error) => void },
    error: unknown,
    isWarning = false
): void {
    const message = extractErrorMessage(error);
    if (isWarning) {
        (logger as any).warn(message, { silent: true });
    } else {
        (logger as any).error(message, { silent: true });
    }
}
