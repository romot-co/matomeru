import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as path from 'path';
import { DirectoryScanner, FileInfo, ScanResult } from '@/domain/files/DirectoryScanner';
import { IConfigurationService, Configuration } from '@/infrastructure/config/ConfigurationService';
import { ILogger } from '@/infrastructure/logging/LoggingService';
import { IErrorHandler, ErrorLog } from '@/shared/errors/services/ErrorService';
import { IWorkspaceService } from '@/domain/workspace/WorkspaceService';
import { IFileSystem, FileStats, DirectoryEntry } from '@/domain/files/FileSystemAdapter';
import { IFileTypeService } from '@/domain/files/FileTypeService';
import { BaseError } from '@/shared/errors/base/BaseError';
import { ErrorContext } from '@/types';

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
    let testDirPath: string;
    let workspaceFolder: vscode.WorkspaceFolder;

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        testDirPath = '/test/workspace/test/dir';

        // スタブの作成と設定
        configStub = sandbox.createStubInstance<IConfigurationService>(class implements IConfigurationService {
            getConfiguration(): Configuration { return {} as Configuration; }
            addChangeListener(): void {}
            removeChangeListener(): void {}
        });
        configStub.getConfiguration.returns(defaultConfig);

        loggerStub = sandbox.createStubInstance<ILogger>(class implements ILogger {
            debug(): void {}
            info(): void {}
            warn(): void {}
            error(): void {}
            show(): void {}
            dispose(): void {}
        });

        errorHandlerStub = sandbox.createStubInstance<IErrorHandler>(class implements IErrorHandler {
            async handleError(): Promise<void> {}
            getErrorLogs(): ErrorLog[] { return []; }
            clearErrorLogs(): void {}
        });

        workspaceFolder = {
            uri: vscode.Uri.file('/test/workspace'),
            name: 'test',
            index: 0
        };

        workspaceStub = sandbox.createStubInstance<IWorkspaceService>(class implements IWorkspaceService {
            async validateWorkspacePath(): Promise<boolean> { return true; }
            getWorkspacePath(): string | undefined { return '/test/workspace'; }
            onWorkspaceChange(): vscode.Disposable { return { dispose: () => {} }; }
            async getWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> { return workspaceFolder; }
            async selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> { return workspaceFolder; }
        });

        // 常にワークスペースフォルダを返すように設定
        workspaceStub.getWorkspaceFolder.resolves(workspaceFolder);
        workspaceStub.validateWorkspacePath.resolves(true);

        fsAdapterStub = sandbox.createStubInstance<IFileSystem>(class implements IFileSystem {
            async readFile(): Promise<string> { return ''; }
            async writeFile(): Promise<void> {}
            async readDirectory(): Promise<DirectoryEntry[]> { return []; }
            async stat(): Promise<FileStats> { return { size: 0, mtime: 0 }; }
            async exists(): Promise<boolean> { return false; }
            async createDirectory(): Promise<void> {}
            async delete(): Promise<void> {}
            async copy(): Promise<void> {}
        });

        // ファイルシステムの動作をスタブ化
        fsAdapterStub.readFile.resolves('test content');
        fsAdapterStub.stat.resolves({ size: 100, mtime: Date.now() });
        fsAdapterStub.exists.resolves(true);
        fsAdapterStub.readDirectory.resolves([
            { name: 'test.ts', type: vscode.FileType.File }
        ]);

        fileTypeServiceStub = sandbox.createStubInstance<IFileTypeService>(class implements IFileTypeService {
            getFileType() { return { languageId: '', typeName: '' }; }
            isTextFile(): boolean { return false; }
            isKnownType(): boolean { return false; }
            getSupportedExtensions(): string[] { return []; }
            addTextFileExtension(): void {}
            removeTextFileExtension(): void {}
            getTextFileExtensions(): string[] { return []; }
        });

        fileTypeServiceStub.getFileType.returns({ languageId: 'typescript', typeName: 'TypeScript' });
        fileTypeServiceStub.isTextFile.returns(true);
        fileTypeServiceStub.isKnownType.returns(true);

        // VS Code APIのスタブ
        sandbox.stub(vscode.workspace, 'findFiles').resolves([
            vscode.Uri.file(path.join(testDirPath, 'test.ts'))
        ]);

        // DirectoryScannerのインスタンス作成
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
                expect.fail('エラーが発生するはずです');
            } catch (error: unknown) {
                expect(error).to.be.instanceOf(BaseError);
                expect((error as BaseError).code).to.equal('InvalidDirectoryError');
                expect(errorHandlerStub.handleError.called).to.be.true;
            }
        });

        it('ファイルサイズ制限を超えたファイルをスキップする', async () => {
            fsAdapterStub.stat.resolves({ size: 2 * 1024 * 1024, mtime: Date.now() });
            const folder = await workspaceStub.getWorkspaceFolder(testDirPath);
            if (!folder) {
                throw new Error('Workspace folder not found');
            }

            const config = configStub.getConfiguration();
            configStub.getConfiguration.returns({
                ...config,
                maxFileSize: 1024 * 1024
            });

            const result = await scanner.scan(testDirPath);
            
            expect(result.files).to.have.lengthOf(0);
            expect(loggerStub.warn.called).to.be.true;
        });

        it('除外パターンを正しく処理する', async () => {
            const excludePatterns = ['*.test.ts'];
            await scanner.scan(testDirPath, { excludePatterns });
            
            const findFilesCall = vscode.workspace.findFiles as sinon.SinonStub;
            expect(findFilesCall.firstCall.args[1]).to.include('*.test.ts');
        });

        it('バッチサイズに従ってファイルを処理する', async () => {
            const batchSize = 2;
            const files = [
                vscode.Uri.file(path.join(testDirPath, 'test1.ts')),
                vscode.Uri.file(path.join(testDirPath, 'test2.ts')),
                vscode.Uri.file(path.join(testDirPath, 'test3.ts'))
            ];
            (vscode.workspace.findFiles as sinon.SinonStub).resolves(files);

            await scanner.scan(testDirPath, { batchSize });
            
            const debugCalls = loggerStub.debug.getCalls();
            const hasBatchSizeLog = debugCalls.some(call => {
                const details = call.args?.[1]?.details;
                return details?.batchSize === batchSize;
            });
            expect(hasBatchSizeLog).to.be.true;
        });
    });

    describe('validateWorkspace', () => {
        it('有効なワークスペースパスを検証できる', async () => {
            const result = await scanner.validateWorkspace(testDirPath);
            expect(result).to.equal(workspaceFolder);
            expect(workspaceStub.getWorkspaceFolder.calledWith(testDirPath)).to.be.true;
        });

        it('無効なワークスペースパスを検出できる', async () => {
            workspaceStub.getWorkspaceFolder.resolves(undefined);
            const result = await scanner.validateWorkspace(testDirPath);
            expect(result).to.be.undefined;
        });
    });

    describe('collectFiles', () => {
        it('ファイルを正しく収集できる', async () => {
            const files = await scanner.collectFiles(testDirPath, workspaceFolder);
            expect(files).to.be.an('array');
            expect((vscode.workspace.findFiles as sinon.SinonStub).called).to.be.true;
        });

        it('除外パターンを適用してファイルを収集できる', async () => {
            const excludePatterns = ['*.test.ts'];
            await scanner.collectFiles(testDirPath, workspaceFolder, excludePatterns);
            
            const findFilesCall = vscode.workspace.findFiles as sinon.SinonStub;
            expect(findFilesCall.firstCall.args[1]).to.include('*.test.ts');
        });
    });

    describe('error handling', () => {
        it('ファイル読み込みエラーを適切に処理する', async () => {
            const error = new Error('Read error');
            fsAdapterStub.readFile.rejects(error);

            try {
                await scanner.scan(testDirPath);
                expect.fail('エラーが発生するはずです');
            } catch (err: unknown) {
                const scanError = err as BaseError;
                expect(scanError).to.be.instanceOf(BaseError);
                expect(scanError.code).to.equal('ScanError');
                expect(errorHandlerStub.handleError.calledOnce).to.be.true;
            }
        });

        it('ファイル統計取得エラーを適切に処理する', async () => {
            const error = new Error('Stat error');
            fsAdapterStub.stat.rejects(error);

            const result = await scanner.scan(testDirPath);
            
            expect(result.files).to.have.lengthOf(0);
            expect(loggerStub.error.called).to.be.true;
        });
    });
}); 
