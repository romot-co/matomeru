import * as vscode from 'vscode';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { MatomeruError, ErrorContext } from '../MatomeruError';

export interface IErrorHandler {
    handleError(error: MatomeruError, context?: ErrorContext): Promise<void>;
    showErrorMessage(error: MatomeruError): Promise<void>;
    getErrorLogs(): ErrorContext[];
}

/**
 * エラーハンドリングを管理するサービス
 */
export class ErrorService implements IErrorHandler {
    private errorLogs: ErrorContext[] = [];

    constructor(
        private readonly logger: ILogger
    ) {}

    /**
     * ファクトリメソッド - デフォルトの設定でErrorServiceインスタンスを生成
     */
    public static createDefault(logger: ILogger): ErrorService {
        return new ErrorService(logger);
    }

    /**
     * エラーを処理し、適切なログとメッセージを表示
     */
    async handleError(error: MatomeruError): Promise<void> {
        try {
            // エラーログを記録
            this.errorLogs.push(error.context);

            // エラーをログに出力
            this.logger.error(error.message, {
                source: error.context.source,
                details: {
                    ...error.context.details,
                    code: error.code,
                    stack: error.stack
                }
            });

            // エラーメッセージを表示
            await this.showErrorMessage(error);
        } catch (handlingError) {
            // エラーハンドリング自体が失敗した場合のフォールバック
            this.logger.error('エラー処理に失敗しました', {
                source: 'ErrorService.handleError',
                details: {
                    originalError: error,
                    handlingError
                }
            });
        }
    }

    /**
     * エラーメッセージをユーザーに表示
     */
    async showErrorMessage(error: MatomeruError): Promise<void> {
        const message = `${error.message} (${error.code})`;
        await vscode.window.showErrorMessage(message);
    }

    /**
     * 記録されたエラーログを取得
     */
    getErrorLogs(): ErrorContext[] {
        return [...this.errorLogs];
    }
} 