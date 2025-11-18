import { extractErrorMessage, logError } from '../utils/errorUtils';
import { DirectoryNotFoundError, FileSizeLimitError } from '../errors/errors';
import { Logger } from '../utils/logger';

jest.mock('../utils/logger');

describe('errorUtils', () => {
    describe('extractErrorMessage', () => {
        it('MatomeruErrorからローカライズされたメッセージを抽出する', () => {
            const error = new DirectoryNotFoundError('/test/dir');
            const message = extractErrorMessage(error);
            expect(message).toBe(error.getLocalizedMessage());
        });

        it('通常のErrorからメッセージを抽出する', () => {
            const error = new Error('Test error');
            const message = extractErrorMessage(error);
            expect(message).toBe('Test error');
        });

        it('カスタムパラメータを持つErrorからメッセージを抽出する', () => {
            const error = new Error('Base error');
            (error as any).params = ['Custom error message'];
            const message = extractErrorMessage(error);
            expect(message).toBe('Custom error message');
        });

        it('文字列エラーを適切に処理する', () => {
            const message = extractErrorMessage('String error');
            expect(message).toBe('String error');
        });

        it('その他の型のエラーを文字列に変換する', () => {
            const message = extractErrorMessage({ custom: 'error' });
            expect(message).toBe('[object Object]');
        });
    });

    describe('logError', () => {
        let mockLogger: jest.Mocked<Pick<Logger, 'warn' | 'error'>>;

        beforeEach(() => {
            mockLogger = {
                warn: jest.fn(),
                error: jest.fn()
            };
        });

        it('警告としてエラーをログ出力する', () => {
            const error = new Error('Test warning');
            logError(mockLogger, error, true);
            expect(mockLogger.warn).toHaveBeenCalledWith('Test warning', { silent: true });
            expect(mockLogger.error).not.toHaveBeenCalled();
        });

        it('エラーとしてエラーをログ出力する', () => {
            const error = new Error('Test error');
            logError(mockLogger, error);
            expect(mockLogger.error).toHaveBeenCalledWith('Test error', { silent: true });
            expect(mockLogger.warn).not.toHaveBeenCalled();
        });

        it('MatomeruErrorをローカライズして出力する', () => {
            const error = new FileSizeLimitError('test.txt', 200, 100);
            logError(mockLogger, error);
            expect(mockLogger.error).toHaveBeenCalledWith(error.getLocalizedMessage(), { silent: true });
        });

        it('カスタムパラメータを持つエラーを適切に処理する', () => {
            const error = new Error('Base error');
            (error as any).params = ['Custom error message'];
            logError(mockLogger, error);
            expect(mockLogger.error).toHaveBeenCalledWith('Custom error message', { silent: true });
        });
    });
}); 
