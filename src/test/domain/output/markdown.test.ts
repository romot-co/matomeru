import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { MarkdownGenerator, IMarkdownGenerator } from '@/domain/output/MarkdownGenerator';
import { IFileSystem, DirectoryEntry, FileStats } from '@/domain/files/FileSystemAdapter';
import { II18nService } from '@/i18n/I18nService';
import { IConfigurationService } from '@/infrastructure/config/ConfigurationService';
import type { ScanResult } from '@/types';
import { ILogger } from '@/infrastructure/logging/LoggingService';
import { expect } from 'chai';
import { IErrorHandler } from '@/shared/errors/services/ErrorService';

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
}); 