import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { MarkdownGenerator, IMarkdownGenerator } from '../../../domain/output/MarkdownGenerator';
import { IFileSystem, DirectoryEntry, FileStats } from '../../../domain/files/FileSystemAdapter';
import { ILogger } from '../../../infrastructure/logging/LoggingService';
import * as path from 'path';
import { MatomeruError, ErrorCode } from '../../../shared/errors/MatomeruError';

interface TestFile {
    path: string;
    relativePath: string;
    size: number;
    content: string;
    language: string;
}

describe('MarkdownGenerator', () => {
    let generator: IMarkdownGenerator;
    let sandbox: sinon.SinonSandbox;
    let fsAdapter: IFileSystem;
    let loggerStub: ILogger;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // VSCodeワークスペースのモック
        const mockWorkspaceFolder = {
            uri: vscode.Uri.file('/test/workspace'),
            name: 'test-workspace',
            index: 0
        };
        sandbox.stub(vscode.workspace, 'workspaceFolders').value([mockWorkspaceFolder]);
        sandbox.stub(vscode.workspace, 'getWorkspaceFolder').returns(mockWorkspaceFolder);

        // FileSystemAdapterのスタブ化
        fsAdapter = {
            readFile: sandbox.stub<[string], Promise<string>>().resolves('test content'),
            writeFile: sandbox.stub<[string, string], Promise<void>>().resolves(),
            readDirectory: sandbox.stub<[string], Promise<DirectoryEntry[]>>().resolves([]),
            stat: sandbox.stub<[string], Promise<FileStats>>().resolves({
                size: 1024,
                mtime: Date.now()
            }),
            exists: sandbox.stub<[string], Promise<boolean>>().resolves(true),
            createDirectory: sandbox.stub<[string], Promise<void>>().resolves(),
            delete: sandbox.stub<[string, { recursive?: boolean }?], Promise<void>>().resolves(),
            copy: sandbox.stub<[string, string, { overwrite?: boolean }?], Promise<void>>().resolves()
        };

        // LoggerServiceのスタブ化
        loggerStub = {
            debug: sandbox.stub(),
            info: sandbox.stub(),
            warn: sandbox.stub(),
            error: sandbox.stub(),
            show: sandbox.stub(),
            dispose: sandbox.stub()
        };

        // MarkdownGeneratorの初期化
        generator = MarkdownGenerator.createDefault(fsAdapter, loggerStub);
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('ファイルからMarkdownを生成する', async function() {
        this.timeout(5000);
        const workspaceFolder = vscode.workspace.workspaceFolders![0];
        const testFile = vscode.Uri.joinPath(workspaceFolder.uri, 'file.ts').fsPath;

        const markdown = await generator.generateMarkdown([testFile]);
        
        assert.ok(markdown.includes('File: file.ts'));
        assert.ok(markdown.includes('Path: ' + testFile));
        assert.ok(markdown.includes('```typescript'));
        assert.ok(markdown.includes('test content'));
    });

    it('オプション付きでMarkdownを生成する', async function() {
        this.timeout(5000);
        const workspaceFolder = vscode.workspace.workspaceFolders![0];
        const testFile = vscode.Uri.joinPath(workspaceFolder.uri, 'file.ts').fsPath;

        const markdown = await generator.generateMarkdown([testFile], {
            includeFileName: true,
            includeRelativePath: true,
            includeLanguage: true,
            rootPath: workspaceFolder.uri.fsPath
        });

        assert.ok(markdown.includes('File: file.ts'));
        assert.ok(markdown.includes('Path: file.ts'));
        assert.ok(markdown.includes('```typescript'));
        assert.ok(markdown.includes('test content'));
    });

    it('未知の拡張子のファイルを処理する', async function() {
        this.timeout(5000);
        const workspaceFolder = vscode.workspace.workspaceFolders![0];
        const testFile = vscode.Uri.joinPath(workspaceFolder.uri, 'test.unknown').fsPath;

        const markdown = await generator.generateMarkdown([testFile]);
        
        assert.ok(markdown.includes('File: test.unknown'));
        assert.ok(markdown.includes('Path: ' + testFile));
        assert.ok(markdown.includes('```'));
        assert.ok(markdown.includes('test content'));
    });

    it('ファイル読み込みエラーを処理する', async function() {
        this.timeout(5000);
        const workspaceFolder = vscode.workspace.workspaceFolders![0];
        const testFile = vscode.Uri.joinPath(workspaceFolder.uri, 'error.ts').fsPath;

        (fsAdapter.readFile as sinon.SinonStub)
            .withArgs(testFile)
            .rejects(new Error('ファイル読み込みエラー'));

        const markdown = await generator.generateMarkdown([testFile]);
        assert.strictEqual(markdown, '');
    });

    describe('パス解決のテスト', () => {
        it('相対パスを絶対パスに正しく解決できる', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders![0];
            const relativePath = 'src/test.ts';
            const absolutePath = path.resolve(workspaceFolder.uri.fsPath, relativePath);

            (fsAdapter.readFile as sinon.SinonStub)
                .withArgs(absolutePath)
                .resolves('test content');

            const markdown = await generator.generateMarkdown([relativePath], {
                rootPath: workspaceFolder.uri.fsPath
            });

            assert.ok(markdown.includes('File: test.ts'));
            assert.ok(markdown.includes('Path: src/test.ts'));
            sinon.assert.calledWith(fsAdapter.readFile as sinon.SinonStub, absolutePath);
        });

        it('日本語を含むパスを正しく処理できる', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders![0];
            const relativePath = 'src/テスト/テスト.ts';
            const absolutePath = path.resolve(workspaceFolder.uri.fsPath, relativePath);

            (fsAdapter.readFile as sinon.SinonStub)
                .withArgs(absolutePath)
                .resolves('test content');

            const markdown = await generator.generateMarkdown([relativePath], {
                rootPath: workspaceFolder.uri.fsPath
            });

            assert.ok(markdown.includes('File: テスト.ts'));
            assert.ok(markdown.includes('Path: src/テスト/テスト.ts'));
            sinon.assert.calledWith(fsAdapter.readFile as sinon.SinonStub, absolutePath);
        });

        it('存在しないファイルを適切にスキップする', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders![0];
            const relativePath = 'src/notexist.ts';
            const absolutePath = path.resolve(workspaceFolder.uri.fsPath, relativePath);

            (fsAdapter.readFile as sinon.SinonStub)
                .withArgs(absolutePath)
                .rejects(new MatomeruError(
                    'ファイルが存在しません',
                    ErrorCode.FILE_SYSTEM,
                    {
                        source: 'FileSystemAdapter.readFile',
                        details: { path: absolutePath },
                        timestamp: new Date()
                    }
                ));

            const markdown = await generator.generateMarkdown([relativePath], {
                rootPath: workspaceFolder.uri.fsPath
            });

            assert.strictEqual(markdown, '');
            sinon.assert.calledOnce(loggerStub.error as sinon.SinonStub);
            assert.strictEqual((loggerStub.error as sinon.SinonStub).firstCall.args[0], 'ファイル処理に失敗しました');
        });

        it('複数ファイルの処理で一部が失敗しても続行できる', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders![0];
            const validPath = 'src/valid.ts';
            const invalidPath = 'src/invalid.ts';
            const validAbsolutePath = path.resolve(workspaceFolder.uri.fsPath, validPath);
            const invalidAbsolutePath = path.resolve(workspaceFolder.uri.fsPath, invalidPath);

            (fsAdapter.readFile as sinon.SinonStub)
                .withArgs(validAbsolutePath)
                .resolves('valid content')
                .withArgs(invalidAbsolutePath)
                .rejects(new Error('ファイル読み込みエラー'));

            const markdown = await generator.generateMarkdown([validPath, invalidPath], {
                rootPath: workspaceFolder.uri.fsPath
            });

            assert.ok(markdown.includes('File: valid.ts'));
            assert.ok(markdown.includes('valid content'));
            sinon.assert.calledOnce(loggerStub.error as sinon.SinonStub);
        });
    });

    describe('エラーハンドリングのテスト', () => {
        it('空のファイルコンテンツを適切に処理する', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders![0];
            const filePath = 'src/empty.ts';
            const absolutePath = path.resolve(workspaceFolder.uri.fsPath, filePath);

            (fsAdapter.readFile as sinon.SinonStub)
                .withArgs(absolutePath)
                .resolves('');

            const markdown = await generator.generateMarkdown([filePath], {
                rootPath: workspaceFolder.uri.fsPath
            });

            assert.ok(markdown.includes('File: empty.ts'));
            assert.ok(markdown.includes('```typescript\n\n```'));
        });

        it('ファイルシステムエラーを適切にハンドリングする', async () => {
            const workspaceFolder = vscode.workspace.workspaceFolders![0];
            const filePath = 'src/error.ts';
            const absolutePath = path.resolve(workspaceFolder.uri.fsPath, filePath);

            const fsError = new Error('EACCES: permission denied');
            (fsError as any).code = 'EACCES';

            (fsAdapter.readFile as sinon.SinonStub)
                .withArgs(absolutePath)
                .rejects(fsError);

            const markdown = await generator.generateMarkdown([filePath], {
                rootPath: workspaceFolder.uri.fsPath
            });

            assert.strictEqual(markdown, '');
            sinon.assert.calledOnce(loggerStub.error as sinon.SinonStub);
            assert.ok((loggerStub.error as sinon.SinonStub).firstCall.args[1].details.error.includes('EACCES'));
        });
    });
}); 