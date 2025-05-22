import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

// VSCodeのAPIをモック
jest.mock('vscode', () => ({
    window: {
        createOutputChannel: jest.fn().mockReturnValue({
            appendLine: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn()
        }),
        showWarningMessage: jest.fn(),
        showErrorMessage: jest.fn()
    }
}));

describe('Logger', () => {
    let logger: Logger;
    const mockOutputChannel = {
        appendLine: jest.fn(),
        show: jest.fn(),
        hide: jest.fn(),
        clear: jest.fn(),
        dispose: jest.fn()
    };
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.window.createOutputChannel as jest.Mock).mockReturnValue(mockOutputChannel);
        logger = Logger.getInstance('TestContext');
    });

    afterEach(() => {
        process.env.NODE_ENV = originalEnv;
    });

    describe('getInstance', () => {
        it('同じコンテキストで同じインスタンスを返す', () => {
            const logger1 = Logger.getInstance('TestContext');
            const logger2 = Logger.getInstance('TestContext');
            expect(logger1).toBe(logger2);
        });

        it('異なるコンテキストでも同じインスタンスを返す', () => {
            const logger1 = Logger.getInstance('TestContext1');
            const logger2 = Logger.getInstance('TestContext2');
            expect(logger1).toBe(logger2);
        });
    });

    describe('info', () => {
        it('INFOレベルでメッセージをログ出力する', () => {
            logger.info('Test info message');
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[TestContext\] Test info message$/)
            );
        });

        it('開発環境ではconsole.logも使用する', () => {
            const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
            process.env.NODE_ENV = 'development';
            
            logger.info('Test info message');
            
            expect(mockConsoleLog).toHaveBeenCalledWith(
                expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[INFO\] \[TestContext\] Test info message$/)
            );
            mockConsoleLog.mockRestore();
        });
    });

    describe('debug', () => {
        it('DEBUGレベルでメッセージをログ出力する', () => {
            logger.debug('Test debug message');
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[DEBUG\] \[TestContext\] Test debug message$/)
            );
        });

        it('開発環境ではconsole.logも使用する', () => {
            const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
            process.env.NODE_ENV = 'development';

            logger.debug('Test debug message');

            expect(mockConsoleLog).toHaveBeenCalledWith(
                expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[DEBUG\] \[TestContext\] Test debug message$/)
            );
            mockConsoleLog.mockRestore();
        });
    });

    describe('warn', () => {
        it('WARNレベルでメッセージをログ出力し、警告を表示する', () => {
            const message = 'Test warning message';
            logger.warn(message);
            
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[WARN\] \[TestContext\] Test warning message$/)
            );
            expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(message);
        });
    });

    describe('error', () => {
        it('ERRORレベルで文字列メッセージをログ出力し、エラーを表示する', () => {
            const message = 'Test error message';
            logger.error(message);
            
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] \[TestContext\] Test error message$/)
            );
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(message);
        });

        it('ERRORレベルでErrorオブジェクトをログ出力し、エラーを表示する', () => {
            const error = new Error('Test error object');
            logger.error(error);
            
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] \[ERROR\] \[TestContext\] Test error object$/)
            );
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(error.message);
        });
    });

    describe('出力チャンネル操作', () => {
        it('show()が出力チャンネルを表示する', () => {
            logger.show();
            expect(mockOutputChannel.show).toHaveBeenCalled();
        });

        it('hide()が出力チャンネルを非表示にする', () => {
            logger.hide();
            expect(mockOutputChannel.hide).toHaveBeenCalled();
        });

        it('clear()が出力チャンネルをクリアする', () => {
            logger.clear();
            expect(mockOutputChannel.clear).toHaveBeenCalled();
        });

        it('dispose()が出力チャンネルを破棄する', () => {
            logger.dispose();
            expect(mockOutputChannel.dispose).toHaveBeenCalled();
        });
    });
}); 