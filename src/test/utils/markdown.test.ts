import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { MarkdownGenerator } from '@/services/ui/MarkdownGenerator';
import { FileSystemAdapter } from '@/services/fs/FileSystemAdapter';
import { I18nService } from '@/i18n/I18nService';
import { ConfigurationService } from '@/services/config/ConfigurationService';
import type { ScanResult } from '@/types';
import { LoggingService } from '@/services/logging/LoggingService';

interface TestFile {
    path: string;
    relativePath: string;
    size: number;
    content: string;
    language: string;
}

describe('MarkdownGenerator Tests', () => {
    let generator: MarkdownGenerator;
    let sandbox: sinon.SinonSandbox;
    let fsAdapter: sinon.SinonStubbedInstance<FileSystemAdapter>;
    let i18nStub: sinon.SinonStubbedInstance<I18nService>;
    let configStub: sinon.SinonStubbedInstance<ConfigurationService>;

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

        // FileSystemAdapterのモック
        const mockFsAdapter = {
            readFile: sandbox.stub().resolves('test content')
        };
        sandbox.stub(FileSystemAdapter.prototype, 'readFile').callsFake(mockFsAdapter.readFile);

        // LoggingServiceのモック
        const mockLogger = sandbox.createStubInstance(LoggingService);
        sandbox.stub(LoggingService, 'getInstance').returns(mockLogger);

        // I18nServiceのモック
        i18nStub = sandbox.createStubInstance(I18nService);
        i18nStub.t.returns('テストメッセージ');
        sandbox.stub(I18nService, 'getInstance').returns(i18nStub);

        // ConfigurationServiceのモック
        configStub = sandbox.createStubInstance(ConfigurationService);
        configStub.getConfiguration.returns({
            excludePatterns: ['**/node_modules/**'],
            maxFileSize: 1024 * 1024,
            maxConcurrentFiles: 10,
            defaultOutputType: 'editor',
            chatGptIntegration: false,
            batchSize: 100,
            development: {
                mockChatGPT: false,
                debugLogging: false,
                disableNativeFeatures: false
            }
        });
        sandbox.stub(ConfigurationService, 'getInstance').returns(configStub);

        // MarkdownGeneratorの初期化
        generator = new MarkdownGenerator();
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

        (FileSystemAdapter.prototype.readFile as sinon.SinonStub)
            .withArgs(testFile)
            .rejects(new Error('ファイル読み込みエラー'));

        const markdown = await generator.generateMarkdown([testFile]);
        assert.strictEqual(markdown, '');
    });
}); 