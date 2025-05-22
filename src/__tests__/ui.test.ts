import * as vscode from 'vscode';
import { showInEditor, copyToClipboard, openInChatGPT } from '../ui';
import * as os from 'os';
import { exec } from 'child_process';
import { calculateContentMetrics, formatTokenCount } from '../utils/fileUtils';

jest.mock('os', () => ({
    platform: jest.fn()
}));

jest.mock('../utils/fileUtils', () => ({
    calculateContentMetrics: jest.fn().mockReturnValue({
        size: 1024,
        tokens: 256,
        formattedSize: '1.0 KB'
    }),
    formatTokenCount: jest.fn().mockReturnValue('256')
}));

jest.mock('child_process', () => ({
    exec: jest.fn((_cmd: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
        callback(null, '', '');
    })
}));

describe('UI Module', () => {
    const content = '# Test Content';
    const mockDocument = { test: 'document' };

    beforeEach(() => {
        jest.clearAllMocks();
        (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
        (vscode.env.clipboard.writeText as jest.Mock) = jest.fn().mockResolvedValue(undefined);
        (os.platform as jest.Mock).mockReturnValue('darwin');
        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
            get: jest.fn().mockReturnValue(true)
        });
    });

    describe('showInEditor', () => {
        it('エディタで正しく表示される', async () => {
            await showInEditor(content);

            expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith({
                content,
                language: 'markdown'
            });
            expect(vscode.window.showTextDocument).toHaveBeenCalledWith(mockDocument);
            expect(calculateContentMetrics).toHaveBeenCalledWith(content);
            expect(formatTokenCount).toHaveBeenCalledWith(256);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                vscode.l10n.t('msg.editorOpenSuccessWithSize', '1.0 KB', '256')
            );
        });

        it('エラー時に適切に処理される', async () => {
            const error = new Error('Test error');
            (vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(error);

            await expect(showInEditor(content)).rejects.toThrow();
        });

        it('エラーメッセージが文字列の場合も適切に処理される', async () => {
            const errorMessage = 'String error message';
            (vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(errorMessage);

            await expect(showInEditor(content)).rejects.toThrow(errorMessage);
        });
    });

    describe('copyToClipboard', () => {
        it('クリップボードに正しくコピーされる', async () => {
            await copyToClipboard(content);
            
            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(content);
            expect(calculateContentMetrics).toHaveBeenCalledWith(content);
            expect(formatTokenCount).toHaveBeenCalledWith(256);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                vscode.l10n.t('msg.clipboardCopySuccessWithSize', '1.0 KB', '256')
            );
        });

        it('エラー時に適切に処理される', async () => {
            const error = new Error('Test error');
            (vscode.env.clipboard.writeText as jest.Mock).mockRejectedValue(error);

            await expect(copyToClipboard(content)).rejects.toThrow();
        });

        it('エラーメッセージが文字列の場合も適切に処理される', async () => {
            const errorMessage = 'String error message';
            (vscode.env.clipboard.writeText as jest.Mock).mockRejectedValue(errorMessage);

            await expect(copyToClipboard(content)).rejects.toThrow(errorMessage);
        });

        it('1回目のコピーが失敗しても2回目で成功する', async () => {
            (vscode.env.clipboard.writeText as jest.Mock)
                .mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValueOnce(undefined);

            await expect(copyToClipboard(content)).resolves.toBeUndefined();
            expect((vscode.env.clipboard.writeText as jest.Mock).mock.calls.length).toBe(2);
        });

        it('すべてのコピー試行が失敗した場合はエラーを投げる', async () => {
            (vscode.env.clipboard.writeText as jest.Mock)
                .mockRejectedValue(new Error('fail'));

            await expect(copyToClipboard(content)).rejects.toThrow();
            expect((vscode.env.clipboard.writeText as jest.Mock).mock.calls.length).toBe(3);
        });
    });

    describe('openInChatGPT', () => {
        it('ChatGPTが無効の場合はエラーを投げる', async () => {
            (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue({
                get: jest.fn().mockReturnValue(false)
            });

            await expect(openInChatGPT(content)).rejects.toThrow(
                vscode.l10n.t('msg.chatGPTDisabled')
            );
        });

        it('macOS以外の場合はエラーを投げる', async () => {
            (os.platform as jest.Mock).mockReturnValue('win32');

            await expect(openInChatGPT(content)).rejects.toThrow(
                vscode.l10n.t('msg.chatGPTOnlyMac')
            );
        });

        it('正常に送信される', async () => {
            await openInChatGPT(content);

            expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(content);
            expect(exec).toHaveBeenCalled();
            expect(calculateContentMetrics).toHaveBeenCalledWith(content);
            expect(formatTokenCount).toHaveBeenCalledWith(256);
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                vscode.l10n.t('msg.chatGPTSendSuccessWithSize', '1.0 KB', '256')
            );
        });

        it('AppleScriptの実行に失敗した場合はエラーを投げる', async () => {
            const error = new Error('AppleScript error');
            (exec as unknown as jest.Mock).mockImplementationOnce(
                (_cmd: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
                  callback(error, '', '');
                }
            );

            await expect(openInChatGPT(content)).rejects.toThrow();
        });

        it('エラーメッセージが文字列の場合も適切に処理される', async () => {
            const errorMessage = 'String error message';
            (exec as unknown as jest.Mock).mockImplementationOnce(
                (_cmd: string, callback: (error: Error | null, stdout: string, stderr: string) => void) => {
                    callback(errorMessage as unknown as Error, '', '');
                }
            );

            await expect(openInChatGPT(content)).rejects.toThrow(errorMessage);
        });
    });

    describe('空のコンテンツの処理', () => {
        beforeEach(() => {
            (calculateContentMetrics as jest.Mock).mockReturnValue({
                size: 0,
                tokens: 0,
                formattedSize: '0 B'
            });
            (formatTokenCount as jest.Mock).mockReturnValue('0');
        });

        it('空のコンテンツをエディタで表示するとき簡潔なメッセージを表示する', async () => {
            await showInEditor('');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                vscode.l10n.t('msg.editorOpenSuccess')
            );
        });

        it('空のコンテンツをクリップボードにコピーするとき簡潔なメッセージを表示する', async () => {
            await copyToClipboard('');
            expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
                vscode.l10n.t('msg.clipboardCopySuccess')
            );
        });
    });
}); 