import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { UIService } from '@/services/ui/UIService';
import { PlatformService } from '@/services/platform/PlatformService';

describe('UIService Tests', () => {
    let ui: UIService;
    let context: vscode.ExtensionContext;
    let platformService: PlatformService;
    let sandbox: sinon.SinonSandbox;
    let clipboardWriteStub: sinon.SinonStub;

    beforeEach(() => {
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
        ui = new UIService(context);

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

    afterEach(() => {
        sandbox.restore();
    });

    it('情報メッセージを表示', async () => {
        await ui.showInformationMessage('テストメッセージ');
        assert.ok((vscode.window.showInformationMessage as sinon.SinonStub).calledWith('テストメッセージ'));
    });

    it('エラーメッセージを表示', async () => {
        await ui.showErrorMessage('エラーメッセージ');
        assert.ok((vscode.window.showErrorMessage as sinon.SinonStub).calledWith('エラーメッセージ'));
    });

    it('テキストドキュメントを開く', async () => {
        await ui.openTextDocument('テストコンテンツ');
        assert.ok((vscode.workspace.openTextDocument as sinon.SinonStub).called);
        assert.ok((vscode.window.showTextDocument as sinon.SinonStub).called);
    });

    it('クリップボードにコピー', async () => {
        clipboardWriteStub.resolves();
        await ui.copyToClipboard('テストコンテンツ');
        assert.ok(clipboardWriteStub.calledWith('テストコンテンツ'));
    });
}); 