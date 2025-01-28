import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { UIController } from '../services/ui-controller';
import { PlatformService } from '../services/platform/PlatformService';

suite('UIController Tests', () => {
    let ui: UIController;
    let context: vscode.ExtensionContext;
    let platformService: PlatformService;
    let sandbox: sinon.SinonSandbox;
    let clipboardWriteStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        
        context = {
            subscriptions: [],
            extensionPath: '',
            globalState: {
                get: sandbox.stub(),
                update: sandbox.stub().resolves(),
                keys: () => []
            } as any,
            workspaceState: {} as any,
            extensionUri: vscode.Uri.file(''),
            environmentVariableCollection: {} as any,
            storageUri: vscode.Uri.file(''),
            globalStorageUri: vscode.Uri.file(''),
            logUri: vscode.Uri.file(''),
            extensionMode: vscode.ExtensionMode.Test,
            extension: {} as any,
            secrets: {} as any,
            asAbsolutePath: (path: string) => path,
            storagePath: '',
            globalStoragePath: '',
            logPath: '',
            languageModelAccessInformation: {} as any
        } as vscode.ExtensionContext;

        platformService = PlatformService.getInstance();
        ui = new UIController(context);

        // スタブの設定
        sandbox.stub(vscode.window, 'showInformationMessage').resolves();
        sandbox.stub(vscode.window, 'showErrorMessage').resolves();
        sandbox.stub(vscode.window, 'showWarningMessage').resolves();
        sandbox.stub(vscode.window, 'withProgress').resolves();
        sandbox.stub(vscode.workspace, 'openTextDocument').resolves({} as any);
        sandbox.stub(vscode.window, 'showTextDocument').resolves();
        
        // クリップボードのスタブ化
        clipboardWriteStub = sandbox.stub();
        Object.defineProperty(vscode.env, 'clipboard', {
            get: () => ({
                writeText: clipboardWriteStub
            }),
            configurable: true
        });

        sandbox.stub(platformService, 'openInChatGPT').resolves();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('情報メッセージを表示', async () => {
        await ui.showInformationMessage('テストメッセージ');
        assert.ok((vscode.window.showInformationMessage as sinon.SinonStub).calledWith('テストメッセージ'));
    });

    test('エラーメッセージを表示', async () => {
        await ui.showErrorMessage('エラーメッセージ');
        assert.ok((vscode.window.showErrorMessage as sinon.SinonStub).calledWith('エラーメッセージ'));
    });

    test('警告メッセージを表示', async () => {
        await ui.showWarningMessage('警告メッセージ');
        assert.ok((vscode.window.showWarningMessage as sinon.SinonStub).calledWith('警告メッセージ'));
    });

    test('プログレス通知を表示', async () => {
        const task = async (progress: vscode.Progress<{ message?: string }>) => {
            progress.report({ message: '処理中...' });
            return 'result';
        };

        await ui.showProgressNotification('タイトル', task);
        assert.ok((vscode.window.withProgress as sinon.SinonStub).called);
    });

    test('テキストドキュメントを開く', async () => {
        await ui.openTextDocument('テストコンテンツ');
        assert.ok((vscode.workspace.openTextDocument as sinon.SinonStub).called);
        assert.ok((vscode.window.showTextDocument as sinon.SinonStub).called);
    });

    test('クリップボードにコピー', async () => {
        clipboardWriteStub.resolves();
        await ui.copyToClipboard('テストコンテンツ');
        assert.ok(clipboardWriteStub.calledWith('テストコンテンツ'));
    });

    test('ChatGPTに送信', async () => {
        await ui.sendToChatGPT('テストコンテンツ');
        assert.ok((platformService.openInChatGPT as sinon.SinonStub).calledWith('テストコンテンツ'));
    });

    test('ChatGPTへの送信エラー処理', async () => {
        const error = new Error('送信エラー');
        (platformService.openInChatGPT as sinon.SinonStub).rejects(error);

        try {
            await ui.sendToChatGPT('テストコンテンツ');
            assert.fail('エラーが発生するはずです');
        } catch (error: any) {
            assert.ok(error.message === '送信エラー');
        }
    });
}); 