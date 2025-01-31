import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { DirectoryProcessingService } from '../../../domain/output/DirectoryProcessingService';
import { DirectoryScanner, ScanResult } from '../../../domain/files/DirectoryScanner';
import { MarkdownGenerator } from '../../../domain/output/MarkdownGenerator';
import { IUIService } from '../../../infrastructure/ui/UIService';
import { II18nService } from '../../../i18n/I18nService';
import { IConfigurationService, Configuration } from '../../../infrastructure/config/ConfigurationService';
import { IPlatformService } from '../../../infrastructure/platform/PlatformService';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { IWorkspaceService } from '../../../infrastructure/workspace/WorkspaceService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { IClipboardService } from '../../../infrastructure/platform/ClipboardService';
import { MatomeruError, ErrorCode } from '../../../shared/errors/MatomeruError';
import * as path from 'path';

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
    const testContent = 'test content';
    const testMarkdown = `# ディレクトリ構造

\`\`\`
test.txt
\`\`\`

# ファイル内容

## test.txt
\`\`\`plaintext
${testContent}
\`\`\`
`;

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

        scannerStub.scan.resolves({
            files: [{
                path: 'test.txt',
                relativePath: 'test.txt',
                content: testContent,
                size: 100,
                language: 'plaintext'
            }],
            totalSize: 100,
            hasErrors: false
        });
        markdownGeneratorStub.generateMarkdown.resolves(testMarkdown);

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
        describe('正常系', () => {
            it('ディレクトリを処理してChatGPTで開く', async () => {
                await service.processDirectoryToChatGPT(testPath);
                expect(platformServiceStub.openInChatGPT.callCount).to.equal(1);
                expect(platformServiceStub.openInChatGPT.firstCall.args[0]).to.equal(testMarkdown);
            });
        });

        describe('異常系', () => {
            it('スキャンエラーが発生した場合、エラーを伝播する', async () => {
                const error = new MatomeruError(
                    'ディレクトリの処理に失敗しました',
                    ErrorCode.FILE_SYSTEM,
                    {
                        source: 'DirectoryProcessingService.processDirectoryToChatGPT',
                        details: { path: testPath },
                        timestamp: new Date()
                    }
                );
                scannerStub.scan.rejects(error);

                try {
                    await service.processDirectoryToChatGPT(testPath);
                    expect.fail('エラーが発生するはずです');
                } catch (e) {
                    expect(e).to.be.instanceOf(MatomeruError);
                    const matomeruError = e as MatomeruError;
                    expect(matomeruError.code).to.equal(ErrorCode.FILE_SYSTEM);
                    expect(matomeruError.message).to.equal('ディレクトリの処理に失敗しました');
                    expect(matomeruError.context.source).to.equal('DirectoryProcessingService.processDirectoryToChatGPT');
                }
            });
        });
    });

    describe('processDirectoryToEditor', () => {
        describe('正常系', () => {
            it('ディレクトリを処理してエディタで開く', async () => {
                await service.processDirectoryToEditor(testPath);
                expect(uiServiceStub.openTextDocument.callCount).to.equal(1);
                expect(uiServiceStub.openTextDocument.firstCall.args[0]).to.equal(testMarkdown);
            });
        });

        describe('異常系', () => {
            it('スキャンエラーが発生した場合、エラーを伝播する', async () => {
                const error = new MatomeruError(
                    'ディレクトリの処理に失敗しました',
                    ErrorCode.FILE_SYSTEM,
                    {
                        source: 'DirectoryProcessingService.processDirectoryToEditor',
                        details: { path: testPath },
                        timestamp: new Date()
                    }
                );
                scannerStub.scan.rejects(error);

                try {
                    await service.processDirectoryToEditor(testPath);
                    expect.fail('エラーが発生するはずです');
                } catch (e) {
                    expect(e).to.be.instanceOf(MatomeruError);
                    const matomeruError = e as MatomeruError;
                    expect(matomeruError.code).to.equal(ErrorCode.FILE_SYSTEM);
                    expect(matomeruError.message).to.equal('ディレクトリの処理に失敗しました');
                    expect(matomeruError.context.source).to.equal('DirectoryProcessingService.processDirectoryToEditor');
                }
            });
        });
    });

    describe('processDirectoryToClipboard', () => {
        describe('正常系', () => {
            it('ディレクトリを処理してクリップボードにコピー', async () => {
                await service.processDirectoryToClipboard(testPath);
                expect(clipboardServiceStub.writeText.callCount).to.equal(1);
                expect(clipboardServiceStub.writeText.firstCall.args[0]).to.equal(testMarkdown);
            });
        });

        describe('異常系', () => {
            it('スキャンエラーが発生した場合、エラーを伝播する', async () => {
                const error = new MatomeruError(
                    'ディレクトリの処理に失敗しました',
                    ErrorCode.FILE_SYSTEM,
                    {
                        source: 'DirectoryProcessingService.processDirectoryToClipboard',
                        details: { path: testPath },
                        timestamp: new Date()
                    }
                );
                scannerStub.scan.rejects(error);

                try {
                    await service.processDirectoryToClipboard(testPath);
                    expect.fail('エラーが発生するはずです');
                } catch (e) {
                    expect(e).to.be.instanceOf(MatomeruError);
                    const matomeruError = e as MatomeruError;
                    expect(matomeruError.code).to.equal(ErrorCode.FILE_SYSTEM);
                    expect(matomeruError.message).to.equal('ディレクトリの処理に失敗しました');
                    expect(matomeruError.context.source).to.equal('DirectoryProcessingService.processDirectoryToClipboard');
                }
            });
        });
    });
});
