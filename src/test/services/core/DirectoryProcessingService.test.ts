import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import { DirectoryProcessingService } from '@/services/core/DirectoryProcessingService';
import { DirectoryScanner } from '@/services/fs/DirectoryScanner';
import { MarkdownGenerator } from '@/services/ui/MarkdownGenerator';
import { UIService } from '@/services/ui/UIService';
import { I18nService } from '@/i18n/I18nService';
import { ConfigurationService, Configuration } from '@/services/config/ConfigurationService';
import { PlatformService } from '@/services/platform/PlatformService';
import type { PlatformFeatures } from '@/types';
import { ErrorService } from '@/errors/services/ErrorService';
import { UnsupportedPlatformError } from '@/errors/ChatGPTErrors';
import { WorkspaceService } from '@/services/workspace/WorkspaceService';
import { BaseError } from '@/errors/base/BaseError';
import { SinonStubbedInstance } from 'sinon';
import { ClipboardService } from '@/services/platform/ClipboardService';

describe('DirectoryProcessingService Test Suite', () => {
    let service: DirectoryProcessingService;
    let sandbox: sinon.SinonSandbox;
    let scannerStub: SinonStubbedInstance<DirectoryScanner>;
    let generatorStub: SinonStubbedInstance<MarkdownGenerator>;
    let configStub: SinonStubbedInstance<ConfigurationService>;
    let uiStub: SinonStubbedInstance<UIService>;
    let errorStub: SinonStubbedInstance<ErrorService>;
    let platformStub: SinonStubbedInstance<PlatformService>;
    let workspaceStub: WorkspaceService;
    let testDirPath: string;
    let mockContext: vscode.ExtensionContext;
    let workspaceFolder: vscode.WorkspaceFolder;
    let clipboardStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // スタブの作成
        scannerStub = sandbox.createStubInstance(DirectoryScanner);
        generatorStub = sandbox.createStubInstance(MarkdownGenerator);
        configStub = sandbox.createStubInstance(ConfigurationService);
        uiStub = sandbox.createStubInstance(UIService);
        errorStub = sandbox.createStubInstance(ErrorService);
        platformStub = sandbox.createStubInstance(PlatformService);

        // ワークスペースのセットアップ
        workspaceFolder = {
            uri: vscode.Uri.file(__dirname),
            name: 'test',
            index: 0
        };
        testDirPath = path.join(__dirname, 'test/dir');

        // WorkspaceServiceのスタブ設定
        workspaceStub = WorkspaceService.getInstance();
        sandbox.stub(workspaceStub, 'getWorkspaceFolder').resolves(workspaceFolder);
        sandbox.stub(workspaceStub, 'validateWorkspacePath').resolves(true);
        sandbox.stub(workspaceStub, 'selectWorkspaceFolder').resolves(workspaceFolder);

        // モックコンテキストの作成
        mockContext = {
            extensionPath: __dirname,
            globalState: {
                get: sandbox.stub(),
                update: sandbox.stub().resolves()
            }
        } as unknown as vscode.ExtensionContext;

        // UIServiceのスタブ設定
        uiStub.showProgress.callsFake(async (title, task) => {
            return task({
                report: () => {}
            });
        });
        uiStub.showErrorMessage.resolves();
        uiStub.showInformationMessage.resolves();

        // クリップボードのスタブ設定
        clipboardStub = sandbox.stub(ClipboardService, 'writeText').resolves();
        uiStub.copyToClipboard.callsFake(async (text: string) => {
            await clipboardStub(text);
        });

        // サービスの作成
        service = new DirectoryProcessingService(
            mockContext,
            scannerStub,
            generatorStub,
            uiStub,
            undefined,
            configStub,
            platformStub,
            errorStub,
            workspaceStub
        );

        // デフォルトの設定をスタブ化
        configStub.getConfiguration.returns({
            excludePatterns: [],
            maxFileSize: 1000,
            maxConcurrentFiles: 10,
            defaultOutputType: 'editor' as const,
            chatGptIntegration: false,
            batchSize: 100,
            development: {
                mockChatGPT: false,
                debugLogging: false,
                disableNativeFeatures: false
            }
        });

        // DirectoryScannerのデフォルト設定
        scannerStub.scan.resolves({
            files: [],
            totalSize: 0
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('processDirectoryToClipboard', () => {
        it('should process files and copy to clipboard', async () => {
            const testFiles = [{
                path: testDirPath,
                relativePath: 'test.ts',
                size: 100,
                content: 'test content',
                language: 'typescript'
            }];

            scannerStub.scan.resolves({
                files: testFiles,
                totalSize: 100
            });
            generatorStub.generateMarkdown.resolves('test markdown');

            await service.processDirectoryToClipboard(testDirPath);
            
            sinon.assert.calledOnce(scannerStub.scan);
            sinon.assert.calledOnce(generatorStub.generateMarkdown);
            sinon.assert.calledWith(clipboardStub, 'test markdown');
            sinon.assert.calledOnce(uiStub.showInformationMessage);
        });
    });

    describe('error handling', () => {
        it('should handle errors during processing and log them correctly', async () => {
            const errorMessage = 'テスト用エラー';
            const error = new Error(errorMessage);
            scannerStub.scan.rejects(error);

            await assert.rejects(
                async () => {
                    await service.processDirectoryToClipboard(testDirPath);
                },
                (err: Error) => {
                    assert.strictEqual(err.message, errorMessage);
                    sinon.assert.calledWith(errorStub.handleError, sinon.match.instanceOf(Error));
                    return true;
                }
            );
        });
    });

    describe('configuration changes', () => {
        it('should handle configuration changes', async () => {
            const newConfig: Configuration = {
                excludePatterns: ['**/*.test.ts'],
                maxFileSize: 1000,
                maxConcurrentFiles: 10,
                defaultOutputType: 'clipboard' as const,
                chatGptIntegration: false,
                batchSize: 100,
                development: {
                    mockChatGPT: false,
                    debugLogging: false,
                    disableNativeFeatures: false
                }
            };

            configStub.getConfiguration.returns(newConfig);

            const testFiles = [{
                path: testDirPath,
                relativePath: 'test.ts',
                size: 100,
                content: 'test content',
                language: 'typescript'
            }];

            scannerStub.scan.resolves({
                files: testFiles,
                totalSize: 100
            });
            generatorStub.generateMarkdown.resolves('test markdown');

            await service.processDirectoryToClipboard(testDirPath);

            sinon.assert.calledOnce(scannerStub.scan);
            sinon.assert.calledOnce(generatorStub.generateMarkdown);
            sinon.assert.calledWith(clipboardStub, 'test markdown');
            sinon.assert.calledOnce(uiStub.showInformationMessage);

            const scanCall = scannerStub.scan.firstCall;
            assert.ok(scanCall.args[1], 'スキャンオプションが設定されていません');
            const scanOptions = scanCall.args[1] as { excludePatterns: string[] };
            assert.ok(scanOptions.excludePatterns, 'excludePatternsが設定されていません');
            assert.deepStrictEqual(
                scanOptions.excludePatterns,
                ['**/*.test.ts'],
                'スキャンオプションが正しく更新されていません'
            );
        });
    });
});
