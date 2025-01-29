import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as path from 'path';
import { DirectoryProcessingService } from '@/domain/output/DirectoryProcessingService';
import { DirectoryScanner, ScanResult, FileInfo } from '@/domain/files/DirectoryScanner';
import { MarkdownGenerator } from '@/domain/output/MarkdownGenerator';
import { IUIService } from '@/domain/output/UIService';
import { II18nService } from '@/i18n/I18nService';
import { IConfigurationService, Configuration } from '@/infrastructure/config/ConfigurationService';
import { IPlatformService } from '@/infrastructure/platform/PlatformService';
import { IErrorHandler, ErrorLog } from '@/shared/errors/services/ErrorService';
import { IWorkspaceService } from '@/domain/workspace/WorkspaceService';
import { ILogger, LogContext } from '@/infrastructure/logging/LoggingService';
import { IClipboardService } from '@/infrastructure/platform/ClipboardService';
import { PlatformFeatures, ErrorContext } from '@/types';
import { BaseError } from '@/shared/errors/base/BaseError';
import { WorkspaceService } from '@/domain/workspace/WorkspaceService';
import { ErrorService } from '@/shared/errors/services/ErrorService';
import { UIService } from '@/domain/output/UIService';

describe('DirectoryProcessingService', () => {
    let service: DirectoryProcessingService;
    let sandbox: sinon.SinonSandbox;
    let context: vscode.ExtensionContext;
    let scannerStub: sinon.SinonStubbedInstance<DirectoryScanner>;
    let markdownGeneratorStub: sinon.SinonStubbedInstance<MarkdownGenerator>;
    let uiServiceStub: sinon.SinonStubbedInstance<IUIService>;
    let i18nStub: sinon.SinonStubbedInstance<II18nService>;
    let configServiceStub: sinon.SinonStubbedInstance<IConfigurationService>;
    let platformServiceStub: sinon.SinonStubbedInstance<IPlatformService>;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;
    let workspaceServiceStub: sinon.SinonStubbedInstance<IWorkspaceService>;
    let loggerStub: sinon.SinonStubbedInstance<ILogger>;
    let clipboardServiceStub: sinon.SinonStubbedInstance<IClipboardService>;
    const disabledFeatures: PlatformFeatures = {
        canUseChatGPT: false,
        canUseNativeFeatures: false
    };

    const testPath = '/test/dir';
    const scanResult: ScanResult = {
        files: [
            { path: 'file1.ts', relativePath: 'file1.ts', size: 100, content: 'content1', language: 'typescript' },
            { path: 'file2.ts', relativePath: 'file2.ts', size: 100, content: 'content2', language: 'typescript' }
        ],
        totalSize: 200
    };
    const markdown = '# Test Directory\n\n```typescript\n// content\n```';

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // ExtensionContextのスタブ化
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

        // スタブの作成
        scannerStub = sandbox.createStubInstance(DirectoryScanner);
        markdownGeneratorStub = sandbox.createStubInstance(MarkdownGenerator);
        
        uiServiceStub = sandbox.createStubInstance<IUIService>(class implements IUIService {
            showInformationMessage(message: string): Promise<void> { 
                return Promise.resolve(); 
            }
            showErrorMessage(message: string, isPersistent?: boolean): Promise<void> { 
                return Promise.resolve(); 
            }
            showProgress<T>(title: string, task: (progress: vscode.Progress<{ message?: string }>) => Promise<T>): Promise<T> {
                return task({ report: () => {} });
            }
            openTextDocument(content: string): Promise<void> { 
                return Promise.resolve(); 
            }
        });

        i18nStub = sandbox.createStubInstance<II18nService>(class implements II18nService {
            t(key: string, ...args: any[]): string { 
                return ''; 
            }
            setLocale(locale: string): void {}
            getCurrentLocale(): string { 
                return 'en'; 
            }
        });
        i18nStub.t.returns('translated message');

        configServiceStub = sinon.createStubInstance<IConfigurationService>(class implements IConfigurationService {
            getConfiguration(): Configuration {
                return {
                    excludePatterns: ['node_modules/**', '.git/**'],
                    maxFileSize: 1048576,
                    maxConcurrentFiles: 10,
                    defaultOutputType: 'editor',
                    chatGptIntegration: false,
                    batchSize: 100,
                    chatgptBundleId: 'com.openai.chat',
                    development: {
                        mockChatGPT: false,
                        debugLogging: false,
                        disableNativeFeatures: false
                    }
                };
            }
            addChangeListener(): void {}
            removeChangeListener(): void {}
        });

        configServiceStub.getConfiguration.returns({
            excludePatterns: ['node_modules/**', '.git/**'],
            maxFileSize: 1048576,
            maxConcurrentFiles: 10,
            defaultOutputType: 'editor',
            chatGptIntegration: false,
            batchSize: 100,
            chatgptBundleId: 'com.openai.chat',
            development: {
                mockChatGPT: false,
                debugLogging: false,
                disableNativeFeatures: false
            }
        });

        platformServiceStub = sandbox.createStubInstance<IPlatformService>(class implements IPlatformService {
            getFeatures(): PlatformFeatures {
                return {
                    canUseChatGPT: true,
                    canUseNativeFeatures: true
                };
            }
            openInChatGPT(content: string): Promise<void> {
                return Promise.resolve();
            }
            copyToClipboard(text: string): Promise<void> {
                return Promise.resolve();
            }
            checkAccessibilityPermission(): Promise<boolean> {
                return Promise.resolve(true);
            }
            launchApplication(bundleId: string): Promise<void> {
                return Promise.resolve();
            }
        });
        platformServiceStub.getFeatures.returns({
            canUseChatGPT: true,
            canUseNativeFeatures: true
        });

        // プラットフォーム機能が利用できない場合のテストのために、
        // getFeatures()の戻り値を変更できるようにしておく
        const disabledFeatures = {
            canUseChatGPT: false,
            canUseNativeFeatures: false
        };

        errorHandlerStub = sandbox.createStubInstance<IErrorHandler>(class implements IErrorHandler {
            handleError(error: Error | BaseError, context: ErrorContext): Promise<void> {
                return Promise.resolve();
            }
            getErrorLogs(): ErrorLog[] {
                return [];
            }
            clearErrorLogs(): void {}
        });

        workspaceServiceStub = sandbox.createStubInstance<IWorkspaceService>(class implements IWorkspaceService {
            validateWorkspacePath(path: string): Promise<boolean> {
                return Promise.resolve(true);
            }
            getWorkspacePath(): string {
                return '/test/workspace';
            }
            onWorkspaceChange(listener: () => void): vscode.Disposable {
                return { dispose: () => {} };
            }
            getWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
                return Promise.resolve({
                    uri: vscode.Uri.file('/test/workspace'),
                    name: 'test',
                    index: 0
                });
            }
            selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
                return Promise.resolve({
                    uri: vscode.Uri.file('/test/workspace'),
                    name: 'test',
                    index: 0
                });
            }
        });
        workspaceServiceStub.validateWorkspacePath.withArgs('/test/dir').resolves(true);

        loggerStub = sandbox.createStubInstance<ILogger>(class implements ILogger {
            info(message: string, context?: LogContext): void {}
            warn(message: string, context?: LogContext): void {}
            error(message: string, context?: LogContext): void {}
            debug(message: string, context?: LogContext): void {}
            show(): void {}
            dispose(): void {}
        });

        clipboardServiceStub = sandbox.createStubInstance<IClipboardService>(class implements IClipboardService {
            writeText(text: string): Promise<void> {
                return Promise.resolve();
            }
            readText(): Promise<string> {
                return Promise.resolve('');
            }
        });

        // サービスのインスタンスを作成
        service = new DirectoryProcessingService(
            context,
            scannerStub,
            markdownGeneratorStub,
            uiServiceStub,
            i18nStub,
            configServiceStub,
            platformServiceStub,
            errorHandlerStub,
            workspaceServiceStub,
            loggerStub,
            clipboardServiceStub
        );
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('processDirectoryToChatGPT', () => {
        it.skip('ディレクトリの内容をChatGPTで開く', async () => {
            // スキャン結果のスタブ設定
            scannerStub.scan.withArgs(testPath, sinon.match.object).resolves(scanResult);
            markdownGeneratorStub.generateMarkdown.withArgs(sinon.match(scanResult)).resolves(markdown);

            // プラットフォーム機能が利用可能な状態を確認
            platformServiceStub.getFeatures.returns({
                canUseChatGPT: true,
                canUseNativeFeatures: true
            });

            await service.processDirectoryToChatGPT(testPath);

            // スキャンが正しく呼ばれたことを確認
            expect(scannerStub.scan.calledOnce).to.be.true;
            expect(scannerStub.scan.firstCall.args[0]).to.equal(testPath);

            // Markdownが生成されたことを確認
            expect(markdownGeneratorStub.generateMarkdown.calledOnce).to.be.true;
            expect(markdownGeneratorStub.generateMarkdown.firstCall.args[0]).to.deep.equal(scanResult);

            // ChatGPTで開かれたことを確認
            expect(platformServiceStub.openInChatGPT.calledOnce).to.be.true;
            expect(platformServiceStub.openInChatGPT.firstCall.args[0]).to.equal(markdown);
        });

        it.skip('プラットフォーム機能が利用できない場合はエラーを処理する', async () => {
            platformServiceStub.getFeatures.returns({
                canUseChatGPT: false,
                canUseNativeFeatures: false
            });

            try {
                await service.processDirectoryToChatGPT(testPath);
                expect.fail('エラーが発生するはずです');
            } catch (err: unknown) {
                const error = err as BaseError;
                expect(error).to.be.instanceOf(BaseError);
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
            }
        });
    });

    describe('processDirectoryToEditor', () => {
        it('ディレクトリの内容をエディタで開く', async () => {
            // スキャン結果のスタブ設定
            scannerStub.scan.withArgs(testPath, sinon.match.object).resolves(scanResult);
            markdownGeneratorStub.generateMarkdown.withArgs(sinon.match(scanResult)).resolves(markdown);

            // ワークスペースの検証を成功させる
            workspaceServiceStub.validateWorkspacePath.withArgs(testPath).resolves(true);

            await service.processDirectoryToEditor(testPath);

            // スキャンが正しく呼ばれたことを確認
            expect(scannerStub.scan.calledOnce).to.be.true;
            expect(scannerStub.scan.firstCall.args[0]).to.equal(testPath);

            // Markdownが生成されたことを確認
            expect(markdownGeneratorStub.generateMarkdown.calledOnce).to.be.true;
            expect(markdownGeneratorStub.generateMarkdown.firstCall.args[0]).to.deep.equal(scanResult);

            // エディタで開かれたことを確認
            expect(uiServiceStub.openTextDocument.calledOnce).to.be.true;
            expect(uiServiceStub.openTextDocument.firstCall.args[0]).to.equal(markdown);
        });
    });

    describe('processDirectoryToClipboard', () => {
        it('ディレクトリの内容をクリップボードにコピーする', async () => {
            // スキャン結果のスタブ設定
            scannerStub.scan.withArgs(testPath, sinon.match.object).resolves(scanResult);
            markdownGeneratorStub.generateMarkdown.withArgs(sinon.match(scanResult)).resolves(markdown);

            // プラットフォーム機能が利用可能な状態を確認
            platformServiceStub.getFeatures.returns({
                canUseChatGPT: true,
                canUseNativeFeatures: true
            });

            // クリップボードサービスのスタブ設定
            clipboardServiceStub.writeText.withArgs(markdown).resolves();

            await service.processDirectoryToClipboard(testPath);

            // スキャンが正しく呼ばれたことを確認
            expect(scannerStub.scan.calledOnce).to.be.true;
            expect(scannerStub.scan.firstCall.args[0]).to.equal(testPath);

            // Markdownが生成されたことを確認
            expect(markdownGeneratorStub.generateMarkdown.calledOnce).to.be.true;
            expect(markdownGeneratorStub.generateMarkdown.firstCall.args[0]).to.deep.equal(scanResult);

            // クリップボードにコピーされたことを確認
            expect(clipboardServiceStub.writeText.calledOnce).to.be.true;
            expect(clipboardServiceStub.writeText.firstCall.args[0]).to.equal(markdown);
        });

        it('クリップボード機能が利用できない場合はエラーを処理する', async () => {
            // プラットフォーム機能が利用不可の状態を設定
            platformServiceStub.getFeatures.returns({
                canUseChatGPT: false,
                canUseNativeFeatures: false
            });

            // エラーハンドラーのスタブ設定
            errorHandlerStub.handleError.resolves();

            try {
                await service.processDirectoryToClipboard(testPath);
                expect.fail('プラットフォーム機能が利用できないためエラーが発生するはずです');
            } catch (err: unknown) {
                expect(err).to.be.instanceOf(BaseError);
                expect((err as BaseError).message).to.equal('プラットフォーム機能が利用できません');
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
            }
        });
    });
});
