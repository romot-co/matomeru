import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { DirectoryProcessingService } from '../../../domain/output/DirectoryProcessingService';
import { DirectoryScanner, ScanResult } from '../../../domain/files/DirectoryScanner';
import { MarkdownGenerator } from '../../../domain/output/MarkdownGenerator';
import { IUIService } from '../../../domain/output/UIService';
import { II18nService } from '../../../i18n/I18nService';
import { IConfigurationService, Configuration } from '../../../infrastructure/config/ConfigurationService';
import { IPlatformService } from '../../../infrastructure/platform/PlatformService';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { IWorkspaceService } from '../../../domain/workspace/WorkspaceService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { IClipboardService } from '../../../infrastructure/platform/ClipboardService';
import { ScanError } from '../../../shared/errors/ScanError';

describe('DirectoryProcessingService', () => {
    let service: DirectoryProcessingService;
    let contextStub: sinon.SinonStubbedInstance<vscode.ExtensionContext>;
    let scannerStub: sinon.SinonStubbedInstance<DirectoryScanner>;
    let markdownGeneratorStub: sinon.SinonStubbedInstance<MarkdownGenerator>;
    let uiServiceStub: sinon.SinonStubbedInstance<IUIService>;
    let i18nServiceStub: sinon.SinonStubbedInstance<II18nService>;
    let configServiceStub: sinon.SinonStubbedInstance<IConfigurationService>;
    let platformServiceStub: sinon.SinonStubbedInstance<IPlatformService>;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;
    let workspaceServiceStub: sinon.SinonStubbedInstance<IWorkspaceService>;
    let loggerStub: sinon.SinonStubbedInstance<ILogger>;
    let clipboardServiceStub: sinon.SinonStubbedInstance<IClipboardService>;
    let sandbox: sinon.SinonSandbox;

    const testPath = '/test/path';
    const scanResult: ScanResult = {
        files: [
            { path: 'file1.ts', relativePath: 'file1.ts', size: 100, content: 'content1', language: 'typescript' },
            { path: 'file2.ts', relativePath: 'file2.ts', size: 100, content: 'content2', language: 'typescript' }
        ],
        totalSize: 1000
    };
    const markdownString = '# Test Markdown';

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        contextStub = {
            globalState: {
                update: sandbox.stub().resolves() as sinon.SinonStub
            }
        } as any;

        scannerStub = sandbox.createStubInstance(DirectoryScanner);
        markdownGeneratorStub = sandbox.createStubInstance(MarkdownGenerator);
        uiServiceStub = {
            showProgress: sandbox.stub().callsFake(async (title: string, task: (progress: vscode.Progress<{ message?: string }>) => Promise<void>) => {
                return task({ report: () => {} });
            }),
            showInformationMessage: sandbox.stub().resolves(),
            showErrorMessage: sandbox.stub().resolves(),
            openTextDocument: sandbox.stub().resolves()
        } as any;
        i18nServiceStub = { t: sandbox.stub().returns('test message') } as any;
        configServiceStub = {
            addChangeListener: sandbox.stub(),
            getConfiguration: sandbox.stub().returns({} as Configuration)
        } as any;
        platformServiceStub = {
            getFeatures: sandbox.stub().returns({ canUseChatGPT: true }),
            openInChatGPT: sandbox.stub().resolves()
        } as any;
        errorHandlerStub = { handleError: sandbox.stub().resolves() } as any;
        workspaceServiceStub = { validateWorkspacePath: sandbox.stub().resolves(true) } as any;
        loggerStub = {
            info: sandbox.stub(),
            error: sandbox.stub(),
            warn: sandbox.stub(),
            debug: sandbox.stub()
        } as any;
        clipboardServiceStub = { writeText: sandbox.stub().resolves() } as any;

        scannerStub.scan.resolves(scanResult);
        markdownGeneratorStub.generateMarkdown.resolves(markdownString);

        service = new DirectoryProcessingService(
            contextStub,
            scannerStub,
            markdownGeneratorStub,
            uiServiceStub,
            i18nServiceStub,
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
        it('正常系: ディレクトリを処理してChatGPTで開く', async () => {
            await service.processDirectoryToChatGPT(testPath);

            expect(scannerStub.scan.calledOnce).to.be.true;
            expect(scannerStub.scan.firstCall.args[0]).to.equal(testPath);
            expect(markdownGeneratorStub.generateMarkdown.calledOnce).to.be.true;
            expect(platformServiceStub.openInChatGPT.calledOnce).to.be.true;
            expect((contextStub.globalState.update as sinon.SinonStub).called).to.be.true;
            expect(uiServiceStub.showInformationMessage.calledOnce).to.be.true;
        });

        it('異常系: スキャンエラーが発生した場合', async () => {
            const error = new ScanError('Failed to process file', { path: testPath });
            scannerStub.scan.rejects(error);

            try {
                await service.processDirectoryToChatGPT(testPath);
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.be.instanceOf(ScanError);
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
                expect(markdownGeneratorStub.generateMarkdown.called).to.be.false;
                expect(platformServiceStub.openInChatGPT.called).to.be.false;
            }
        });

        it('異常系: 空のディレクトリの場合', async () => {
            scannerStub.scan.resolves({ files: [], totalSize: 0 });

            await service.processDirectoryToChatGPT(testPath);

            expect(scannerStub.scan.calledOnce).to.be.true;
            expect(markdownGeneratorStub.generateMarkdown.calledOnce).to.be.true;
            expect(platformServiceStub.openInChatGPT.calledOnce).to.be.true;
            expect((contextStub.globalState.update as sinon.SinonStub).called).to.be.true;
        });
    });

    describe('processDirectoryToEditor', () => {
        it('正常系: ディレクトリを処理してエディタで開く', async () => {
            await service.processDirectoryToEditor(testPath);

            expect(scannerStub.scan.calledOnce).to.be.true;
            expect(scannerStub.scan.firstCall.args[0]).to.equal(testPath);
            expect(markdownGeneratorStub.generateMarkdown.calledOnce).to.be.true;
            expect(uiServiceStub.openTextDocument.calledOnce).to.be.true;
            expect((contextStub.globalState.update as sinon.SinonStub).called).to.be.true;
            expect(uiServiceStub.showInformationMessage.calledOnce).to.be.true;
        });

        it('異常系: スキャンエラーが発生した場合', async () => {
            const error = new ScanError('Failed to process file', { path: testPath });
            scannerStub.scan.rejects(error);

            try {
                await service.processDirectoryToEditor(testPath);
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.be.instanceOf(ScanError);
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
                expect(markdownGeneratorStub.generateMarkdown.called).to.be.false;
                expect(uiServiceStub.openTextDocument.called).to.be.false;
            }
        });
    });

    describe('processDirectoryToClipboard', () => {
        it('正常系: ディレクトリを処理してクリップボードにコピー', async () => {
            await service.processDirectoryToClipboard(testPath);

            expect(scannerStub.scan.calledOnce).to.be.true;
            expect(scannerStub.scan.firstCall.args[0]).to.equal(testPath);
            expect(markdownGeneratorStub.generateMarkdown.calledOnce).to.be.true;
            expect(clipboardServiceStub.writeText.calledOnce).to.be.true;
            expect((contextStub.globalState.update as sinon.SinonStub).called).to.be.true;
            expect(uiServiceStub.showInformationMessage.calledOnce).to.be.true;
        });

        it('異常系: スキャンエラーが発生した場合', async () => {
            const error = new ScanError('Failed to process file', { path: testPath });
            scannerStub.scan.rejects(error);

            try {
                await service.processDirectoryToClipboard(testPath);
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.be.instanceOf(ScanError);
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
                expect(markdownGeneratorStub.generateMarkdown.called).to.be.false;
                expect(clipboardServiceStub.writeText.called).to.be.false;
            }
        });
    });
});
