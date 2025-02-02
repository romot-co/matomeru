import { MatomeruError } from '../errors/errors';

/**
 * エラーオブジェクトからメッセージを抽出するヘルパー関数
 * @param error エラーオブジェクト
 * @returns 抽出されたエラーメッセージ
 */
export function extractErrorMessage(error: unknown): string {
    if (error instanceof MatomeruError) {
        return error.getLocalizedMessage();
    }

    if (error instanceof Error) {
        // カスタムパラメータを持つエラーの処理
        if ((error as any).params?.[0]) {
            return (error as any).params[0];
        }
        return error.message;
    }

    // その他の型のエラー（文字列など）
    return String(error);
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
        logger.warn(message);
    } else {
        logger.error(message);
    }
} 