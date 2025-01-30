import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as path from 'path';
import { DirectoryScanner } from '../../../domain/files/DirectoryScanner';
import { IConfigurationService, Configuration } from '../../../infrastructure/config/ConfigurationService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { IWorkspaceService } from '../../../domain/workspace/WorkspaceService';
import { IFileSystem } from '../../../domain/files/FileSystemAdapter';
import { IFileTypeService } from '../../../domain/files/FileTypeService';
import { BaseError } from '../../../shared/errors/base/BaseError';

const defaultConfig: Configuration = {
    excludePatterns: ['node_modules/**', '.git/**'],
    maxFileSize: 1024 * 1024,
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

describe('DirectoryScanner Test Suite', () => {
    let scanner: DirectoryScanner;
    let sandbox: sinon.SinonSandbox;
    let configStub: sinon.SinonStubbedInstance<IConfigurationService>;
    let loggerStub: sinon.SinonStubbedInstance<ILogger>;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;
    let workspaceStub: sinon.SinonStubbedInstance<IWorkspaceService>;
    let fsAdapterStub: sinon.SinonStubbedInstance<IFileSystem>;
    let fileTypeServiceStub: sinon.SinonStubbedInstance<IFileTypeService>;
    const testDirPath = '/test/workspace/test/dir';

    beforeEach(async () => {
        sandbox = sinon.createSandbox();

        configStub = sandbox.createStubInstance<IConfigurationService>(class implements IConfigurationService {
            getConfiguration() { return defaultConfig; }
            addChangeListener() {}
            removeChangeListener() {}
        });

        configStub.getConfiguration.returns(defaultConfig);

        loggerStub = sandbox.createStubInstance<ILogger>(class implements ILogger {
            info() {}
            warn() {}
            error() {}
            debug() {}
            show() {}
            dispose() {}
        });
        errorHandlerStub = sandbox.createStubInstance<IErrorHandler>(class implements IErrorHandler {
            handleError() { return Promise.resolve(); }
            getErrorLogs() { return []; }
            clearErrorLogs() {}
        });
        workspaceStub = sandbox.createStubInstance<IWorkspaceService>(class implements IWorkspaceService {
            validateWorkspacePath() { return Promise.resolve(true); }
            getWorkspacePath() { return '/test/workspace'; }
            onWorkspaceChange(listener: () => void) { return { dispose: () => {} }; }
            getWorkspaceFolder() { return Promise.resolve({ uri: vscode.Uri.file('/test/workspace'), name: 'test', index: 0 }); }
            selectWorkspaceFolder() { return Promise.resolve({ uri: vscode.Uri.file('/test/workspace'), name: 'test', index: 0 }); }
        });
        fsAdapterStub = sandbox.createStubInstance<IFileSystem>(class implements IFileSystem {
            readFile() { return Promise.resolve(''); }
            writeFile() { return Promise.resolve(); }
            readDirectory() { return Promise.resolve([]); }
            stat() { return Promise.resolve({ size: 0, mtime: 0 }); }
            exists() { return Promise.resolve(true); }
            createDirectory() { return Promise.resolve(); }
            delete() { return Promise.resolve(); }
            copy() { return Promise.resolve(); }
        });
        fileTypeServiceStub = sandbox.createStubInstance<IFileTypeService>(class implements IFileTypeService {
            isTextFile() { return true; }
            getFileType() { return { languageId: '', typeName: '' }; }
            isKnownType() { return true; }
            getSupportedExtensions() { return []; }
            addTextFileExtension() {}
            removeTextFileExtension() {}
            getTextFileExtensions() { return []; }
        });

        workspaceStub.getWorkspaceFolder.resolves({
            uri: vscode.Uri.file('/test/workspace'),
            name: 'test',
            index: 0
        });
        workspaceStub.validateWorkspacePath.resolves(true);

        fsAdapterStub.readFile.resolves('test content');
        fsAdapterStub.stat.resolves({ size: 100, mtime: Date.now() });
        fsAdapterStub.exists.resolves(true);
        fsAdapterStub.readDirectory.resolves([{ name: 'test.ts', type: vscode.FileType.File }]);

        fileTypeServiceStub.getFileType.returns({ languageId: 'typescript', typeName: 'TypeScript' });
        fileTypeServiceStub.isTextFile.returns(true);
        fileTypeServiceStub.isKnownType.returns(true);

        sandbox.stub(vscode.workspace, 'findFiles').resolves([
            vscode.Uri.file(path.join(testDirPath, 'test.ts'))
        ]);

        scanner = new DirectoryScanner(
            configStub,
            loggerStub,
            errorHandlerStub,
            workspaceStub,
            fileTypeServiceStub,
            fsAdapterStub
        );
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('scan', () => {
        it('ディレクトリを正常にスキャンできる', async () => {
            const result = await scanner.scan(testDirPath);
            expect(result).to.be.an('object');
            expect(result.files).to.be.an('array');
            expect(result.totalSize).to.be.a('number');
        });

        it('ワークスペース外のディレクトリに対してエラーを投げる', async () => {
            workspaceStub.getWorkspaceFolder.resolves(undefined);
            try {
                await scanner.scan(testDirPath);
                expect.fail('エラーが発生するはず');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(BaseError);
                expect((error as BaseError).code).to.equal('InvalidDirectoryError');
                expect(errorHandlerStub.handleError.called).to.be.true;
            }
        });

        it('ファイルサイズ制限を超えたファイルをスキップする', async () => {
            fsAdapterStub.stat.resolves({ size: 2 * 1024 * 1024, mtime: Date.now() });

            const result = await scanner.scan(testDirPath);
            expect(result.files).to.have.lengthOf(0);
            expect(loggerStub.warn.called).to.be.true;
        });

        it('除外パターンを正しく処理する', async () => {
            const excludePatterns = ['*.test.ts'];
            await scanner.scan(testDirPath, { excludePatterns });

            const findFilesCall = (vscode.workspace.findFiles as sinon.SinonStub).firstCall;
            const excluded = findFilesCall.args[1];
            expect(excluded).to.include('*.test.ts');
        });

        it('バッチサイズに従ってファイルを処理する', async () => {
            const files = [
                vscode.Uri.file(path.join(testDirPath, 'test1.ts')),
                vscode.Uri.file(path.join(testDirPath, 'test2.ts')),
                vscode.Uri.file(path.join(testDirPath, 'test3.ts'))
            ];
            (vscode.workspace.findFiles as sinon.SinonStub).resolves(files);

            const result = await scanner.scan(testDirPath, { batchSize: 2 });
            // バッチごとの DEBUG ログなどをチェック
            expect(loggerStub.debug.called).to.be.true;
            expect(result.files.length).to.equal(3);
        });

        it('ディレクトリ読み込みエラーが発生してもスキャンを続行する', async () => {
            const error = new Error('Failed to read directory');
            fsAdapterStub.readDirectory.rejects(error);
            workspaceStub.getWorkspaceFolder.resolves({
                uri: vscode.Uri.file(testDirPath),
                name: 'test',
                index: 0
            });
            (vscode.workspace.findFiles as sinon.SinonStub).resolves([
                vscode.Uri.file(path.join(testDirPath, 'test.ts'))
            ]);
            fsAdapterStub.readFile.rejects(error);

            const result = await scanner.scan(testDirPath);

            expect(result.files).to.be.empty;
            expect(loggerStub.error.calledOnce).to.be.true;
            expect(errorHandlerStub.handleError.calledOnce).to.be.true;
        });
    });

    describe('validateWorkspace', () => {
        it('有効なワークスペースパスを検証できる', async () => {
            const result = await scanner.validateWorkspace(testDirPath);
            expect(result).to.be.ok;
        });

        it('無効なワークスペースパスを検出できる', async () => {
            workspaceStub.getWorkspaceFolder.resolves(undefined);
            const result = await scanner.validateWorkspace(testDirPath);
            expect(result).to.be.undefined;
        });
    });

    describe('collectFiles', () => {
        it('ファイルを正しく収集できる', async () => {
            const files = await scanner.collectFiles(testDirPath, {
                uri: vscode.Uri.file('/test/workspace'),
                name: 'test',
                index: 0
            }, []);
            expect(files).to.be.an('array');
            expect(files.length).to.be.gt(0);
        });

        it('除外パターンを適用してファイルを収集できる', async () => {
            const excludePatterns = ['*.test.ts'];
            await scanner.collectFiles(testDirPath, {
                uri: vscode.Uri.file('/test/workspace'),
                name: 'test',
                index: 0
            }, excludePatterns);

            const findFilesCall = (vscode.workspace.findFiles as sinon.SinonStub).firstCall;
            const excluded = findFilesCall.args[1];
            expect(excluded).to.include('*.test.ts');
        });
    });

    describe('error handling', () => {
        it('ファイル読み込みエラーが発生してもスキャンを続行し、エラーをログに残す', async () => {
            const error = new Error('Failed to read file');
            fsAdapterStub.readFile.rejects(error);

            const result = await scanner.scan(testDirPath);

            expect(result.files).to.be.empty;
            expect(loggerStub.error.calledOnce).to.be.true;
            expect(errorHandlerStub.handleError.calledOnce).to.be.true;
        });

        it('ファイル統計取得エラーが発生してもスキャンを続行する', async () => {
            const error = new Error('Failed to get file stats');
            fsAdapterStub.stat.rejects(error);

            const result = await scanner.scan(testDirPath);

            expect(result.files).to.be.empty;
            expect(loggerStub.error.calledOnce).to.be.true;
            expect(errorHandlerStub.handleError.calledOnce).to.be.true;
        });

        it('ファイルタイプ判定エラーが発生してもスキャンを続行する', async () => {
            const error = new Error('Failed to determine file type');
            fileTypeServiceStub.getFileType.throws(error);

            const result = await scanner.scan(testDirPath);

            expect(result.files).to.be.empty;
            expect(loggerStub.error.calledOnce).to.be.true;
            expect(errorHandlerStub.handleError.calledOnce).to.be.true;
        });
    });
});
