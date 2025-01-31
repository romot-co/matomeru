import { DirectoryScanner } from '../DirectoryScanner';
import { IFileSystem, FileStats } from '../FileSystemAdapter';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { IWorkspaceService } from '../../../infrastructure/workspace/WorkspaceService';
import { IFileTypeService } from '../FileTypeService';
import { IConfigurationService, Configuration } from '../../../infrastructure/config/ConfigurationService';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import { MatomeruError, ErrorCode } from '../../../shared/errors/MatomeruError';
import * as sinon from 'sinon';
import { expect } from 'chai';
import * as vscode from 'vscode';
import * as path from 'path';

describe('DirectoryScanner Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let fileSystemStub: IFileSystem;
    let errorHandlerStub: IErrorHandler;
    let workspaceStub: IWorkspaceService;
    let fileTypeServiceStub: IFileTypeService;
    let configStub: IConfigurationService;
    let loggerStub: ILogger;
    let scanner: DirectoryScanner;
    let mockFs: any;
    let mockWorkspaceValidation: any;

    // テスト用の固定パス（プラットフォームに依存しない）
    const testWorkspacePath = path.join('test', 'workspace');
    const testFiles = [
        { path: path.join(testWorkspacePath, 'test1.txt'), size: 100, language: 'plaintext' },
        { path: path.join(testWorkspacePath, 'test2.txt'), size: 100, language: 'plaintext' },
        { path: path.join(testWorkspacePath, 'subdir', 'test3.txt'), size: 150, language: 'plaintext' }
    ];

    // デフォルトのテスト設定
    const defaultConfig: Configuration = {
        maxFileSize: 1000000,
        excludePatterns: [],
        batchSize: 100,
        maxConcurrentFiles: 10,
        defaultOutputType: 'editor',
        chatGptIntegration: false,
        development: {
            mockChatGPT: false,
            debugLogging: false,
            disableNativeFeatures: false
        }
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // ファイルシステムのモック作成
        fileSystemStub = createFileSystemStub();
        
        // エラーハンドラのモック作成
        errorHandlerStub = createErrorHandlerStub();
        
        // ワークスペースサービスのモック作成
        workspaceStub = createWorkspaceServiceStub();
        
        // ファイルタイプサービスのモック作成
        fileTypeServiceStub = createFileTypeServiceStub();
        
        // 設定サービスのモック作成
        configStub = createConfigurationStub();
        
        // ロガーのモック作成
        loggerStub = createLoggerStub();

        // スキャナーインスタンスの作成
        scanner = new DirectoryScanner(
            configStub,
            loggerStub,
            errorHandlerStub,
            workspaceStub,
            fileTypeServiceStub,
            fileSystemStub
        );

        mockFs = {
            promises: {
                readdir: sinon.stub(),
                stat: sinon.stub(),
                readFile: sinon.stub()
            }
        };
        mockWorkspaceValidation = {
            validatePath: sinon.stub().resolves(true)
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    // ヘルパー関数群
    function createFileSystemStub(): IFileSystem {
        const readFileStub = sandbox.stub();
        const statStub = sandbox.stub();
        const readDirectoryStub = sandbox.stub();

        // ファイルの読み込みをモック
        testFiles.forEach(file => {
            readFileStub.withArgs(file.path).resolves('test content');
            statStub.withArgs(file.path).resolves({ 
                size: file.size,
                mtime: Date.now()
            } as FileStats);
        });

        // ディレクトリの読み込みをモック
        readDirectoryStub.withArgs(testWorkspacePath).resolves(
            testFiles.map(f => ({
                name: path.basename(f.path),
                type: vscode.FileType.File
            }))
        );

        // サブディレクトリの処理
        const subdirPath = path.join(testWorkspacePath, 'subdir');
        readDirectoryStub.withArgs(subdirPath).resolves([
            {
                name: path.basename(testFiles[2].path),
                type: vscode.FileType.File
            }
        ]);

        return {
            readFile: readFileStub,
            writeFile: sandbox.stub().resolves(),
            readDirectory: readDirectoryStub,
            stat: statStub,
            exists: sandbox.stub().resolves(true),
            createDirectory: sandbox.stub().resolves(),
            delete: sandbox.stub().resolves(),
            copy: sandbox.stub().resolves()
        };
    }

    function createErrorHandlerStub(): IErrorHandler {
        return {
            handleError: sandbox.stub().resolves(),
            showErrorMessage: sandbox.stub().resolves(),
            getErrorLogs: sandbox.stub().returns([])
        };
    }

    function createWorkspaceServiceStub(): IWorkspaceService {
        const workspaceFolder = {
            uri: vscode.Uri.file(testWorkspacePath),
            name: 'test',
            index: 0
        };

        return {
            getWorkspaceFolder: sandbox.stub().resolves(workspaceFolder),
            validateWorkspacePath: sandbox.stub().resolves(true),
            getWorkspacePath: sandbox.stub().returns(testWorkspacePath),
            onWorkspaceChange: sandbox.stub().returns({ dispose: () => {} }),
            getCurrentWorkspaceFolder: sandbox.stub().resolves(workspaceFolder),
            getWorkspaceFolders: sandbox.stub().resolves([workspaceFolder]),
            selectWorkspaceFolder: sandbox.stub().resolves(workspaceFolder)
        };
    }

    function createFileTypeServiceStub(): IFileTypeService {
        const getFileTypeStub = sandbox.stub();
        testFiles.forEach(file => {
            getFileTypeStub.withArgs(file.path)
                .returns({ languageId: file.language, typeName: 'Plain Text' });
        });

        return {
            isTextFile: sandbox.stub().returns(true),
            getFileType: getFileTypeStub,
            isKnownType: sandbox.stub().returns(true),
            getSupportedExtensions: sandbox.stub().returns(['.txt']),
            addTextFileExtension: sandbox.stub(),
            removeTextFileExtension: sandbox.stub(),
            getTextFileExtensions: sandbox.stub().returns(['.txt'])
        };
    }

    function createConfigurationStub(): IConfigurationService {
        return {
            getConfiguration: sandbox.stub().returns(defaultConfig),
            addChangeListener: sandbox.stub(),
            removeChangeListener: sandbox.stub()
        };
    }

    function createLoggerStub(): ILogger {
        return {
            error: sandbox.stub(),
            warn: sandbox.stub(),
            info: sandbox.stub(),
            debug: sandbox.stub(),
            show: sandbox.stub(),
            dispose: sandbox.stub()
        };
    }

    describe('スキャン機能のテスト', () => {
        let findFilesStub: sinon.SinonStub;

        beforeEach(() => {
            findFilesStub = sinon.stub(vscode.workspace, 'findFiles');

            // デフォルトの動作を設定
            const mockWorkspaceFolder: vscode.WorkspaceFolder = {
                uri: vscode.Uri.file('/test/workspace'),
                name: 'test',
                index: 0
            };
            (workspaceStub.getWorkspaceFolder as sinon.SinonStub).resolves(mockWorkspaceFolder);
        });

        afterEach(() => {
            findFilesStub.restore();
        });

        it('正常系: ディレクトリを正しくスキャンできる', async () => {
            const testFiles = [
                vscode.Uri.file('/test/workspace/file1.txt'),
                vscode.Uri.file('/test/workspace/file2.txt'),
                vscode.Uri.file('/test/workspace/file3.txt')
            ];

            findFilesStub.resolves(testFiles);
            (fileSystemStub.stat as sinon.SinonStub).resolves({ size: 100 });
            (fileSystemStub.readFile as sinon.SinonStub).resolves('test content');
            (fileTypeServiceStub.getFileType as sinon.SinonStub).returns({ languageId: 'plaintext', typeName: 'Plain Text' });

            const result = await scanner.scan('/test/workspace');

            expect(findFilesStub.calledOnce).to.be.true;
            expect(result.files.length).to.equal(3);
            expect(result.totalSize).to.equal(300);
            expect(result.hasErrors).to.be.false;
        });

        it('正常系: 除外パターンを適切に処理できる', async () => {
            const testFiles = [
                vscode.Uri.file('/test/workspace/file1.txt'),
                vscode.Uri.file('/test/workspace/file2.txt')
            ];

            findFilesStub.resolves(testFiles);
            (fileSystemStub.stat as sinon.SinonStub).resolves({ size: 100 });
            (fileSystemStub.readFile as sinon.SinonStub).resolves('test content');
            (fileTypeServiceStub.getFileType as sinon.SinonStub).returns({ languageId: 'plaintext', typeName: 'Plain Text' });

            const excludePatterns = ['*.log', '*.tmp'];
            const result = await scanner.scan('/test/workspace', { excludePatterns });

            expect(findFilesStub.calledOnce).to.be.true;
            expect(result.files.length).to.equal(2);
            expect(result.totalSize).to.equal(200);
            expect(result.hasErrors).to.be.false;
        });

        it('異常系: ファイル読み込みエラーが発生した場合も続行できる', async () => {
            const testFiles = [
                vscode.Uri.file('/test/workspace/file1.txt'),
                vscode.Uri.file('/test/workspace/file2.txt')
            ];

            findFilesStub.resolves(testFiles);
            (fileSystemStub.stat as sinon.SinonStub).resolves({ size: 100 });
            (fileSystemStub.readFile as sinon.SinonStub)
                .onFirstCall().resolves('test content')
                .onSecondCall().rejects(new Error('読み込みエラー'));
            (fileTypeServiceStub.getFileType as sinon.SinonStub).returns({ languageId: 'plaintext', typeName: 'Plain Text' });

            const result = await scanner.scan('/test/workspace');

            expect(findFilesStub.calledOnce).to.be.true;
            expect(result.hasErrors).to.be.true;
            expect(result.files.length).to.equal(1);
            expect((errorHandlerStub.handleError as sinon.SinonStub).calledOnce).to.be.true;
        });

        it('異常系: ファイルサイズ制限を超えた場合はスキップする', async () => {
            const testFiles = [
                vscode.Uri.file('/test/workspace/file1.txt')
            ];

            findFilesStub.resolves(testFiles);
            (fileSystemStub.stat as sinon.SinonStub)
                .onFirstCall().resolves({ size: 2000 }); // 制限を超えるサイズ
            (fileSystemStub.readFile as sinon.SinonStub).resolves('test content');
            (fileTypeServiceStub.getFileType as sinon.SinonStub).returns({ languageId: 'plaintext', typeName: 'Plain Text' });

            const result = await scanner.scan('/test/workspace', { maxFileSize: 1000 });

            expect(findFilesStub.calledOnce).to.be.true;
            expect(result.files.length).to.equal(0);
            expect(result.hasErrors).to.be.false;
            expect((loggerStub.warn as sinon.SinonStub).calledOnce).to.be.true;
        });
    });

    describe('ワークスペース検証のテスト', () => {
        it('正常系: 有効なワークスペースパスを検証できる', async () => {
            const result = await scanner.validateWorkspace(testWorkspacePath);
            
            expect(result).to.deep.equal({
                uri: vscode.Uri.file(testWorkspacePath),
                name: 'test',
                index: 0
            });
        });

        it('異常系: 無効なワークスペースパスを検出できる', async () => {
            (workspaceStub.getWorkspaceFolder as sinon.SinonStub).resolves(undefined);
            
            const result = await scanner.validateWorkspace(path.join('invalid', 'path'));
            
            expect(result).to.be.undefined;
        });
    });

    describe('ファイル収集のテスト', () => {
        it('正常系: 再帰的にファイルを収集できる', async () => {
            const workspaceFolder = {
                uri: vscode.Uri.file(testWorkspacePath),
                name: 'test',
                index: 0
            };
            const findFilesStub = sandbox.stub(vscode.workspace, 'findFiles').resolves(
                testFiles.map(f => vscode.Uri.file(f.path))
            );

            const files = await scanner.collectFiles(testWorkspacePath, workspaceFolder);

            expect(files).to.have.lengthOf(testFiles.length);
            expect(findFilesStub.calledOnce).to.be.true;
            const [pattern] = findFilesStub.firstCall.args;
            expect(pattern).to.be.instanceOf(vscode.RelativePattern);
        });

        it('正常系: シンボリックリンクを適切に処理できる', async () => {
            const workspaceFolder = {
                uri: vscode.Uri.file(testWorkspacePath),
                name: 'test',
                index: 0
            };

            // シンボリックリンクのモック
            const mockStats = {
                size: 0,
                mtime: new Date(),
                isSymbolicLink: () => true
            } as unknown as FileStats;

            (fileSystemStub.stat as sinon.SinonStub)
                .withArgs(path.join(testWorkspacePath, 'link.txt'))
                .resolves(mockStats);

            const results = await scanner.collectFiles(testWorkspacePath, workspaceFolder);
            
            expect(results.every(r => !r.fsPath.includes('link.txt'))).to.be.true;
        });
    });
});
