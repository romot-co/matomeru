import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as path from 'path';
import { DirectoryScanner } from '../services/directory-scanner';
import { MarkdownGenerator } from '../services/markdown-generator';
import { MockFSAdapter, ApplicationCoordinator } from '../extension';
import { ErrorHandler, ErrorLog } from '../services/ErrorHandler';
import { FileTypeManager } from '../services/FileTypeManager';
import { I18n } from '../i18n';
import { UIController } from '../services/ui-controller';
import { ConfigurationManager } from '../services/configuration-manager';
import { FileSystemAdapter } from '../services/fs-adapter';
// import * as myExtension from '../../extension';

interface ProcessedDirectory {
	path: string;
	timestamp: string;
	fileCount: number;
	outputType: 'editor' | 'clipboard';
}

suite('Matomeru Extension Test Suite', () => {
	vscode.window.showInformationMessage('テストを開始します');

	test('DirectoryScanner - 基本的なディレクトリスキャン', async () => {
		const mockFiles = {
			'/test/file1.txt': 'content1',
			'/test/file2.txt': 'content2',
			'/test/dir/file3.txt': 'content3'
		};

		const scanner = new DirectoryScanner(new MockFSAdapter(mockFiles));
		const result = await scanner.scan('/test');

		assert.strictEqual(result.length, 2);
		assert.strictEqual(result[0].type, 'file');
		assert.strictEqual(result[1].type, 'file');
	});

	test('DirectoryScanner - バイナリファイルの除外', async () => {
		const mockFiles = {
			'/test/text.txt': 'normal text',
			'/test/binary.bin': '\0\0\0binary content'
		};

		const scanner = new DirectoryScanner(new MockFSAdapter(mockFiles));
		const result = await scanner.scan('/test');

		assert.strictEqual(result.length, 1);
		assert.strictEqual(result[0].type, 'file');
		assert.strictEqual(path.basename(result[0].path), 'text.txt');
	});

	test('DirectoryScanner - 並列処理の動作確認', async () => {
		const mockFiles = Object.fromEntries(
			Array.from({ length: 10 }, (_, i) => [
				`/test/file${i}.txt`,
				`content${i}`
			])
		);

		const startTime = Date.now();
		const scanner = new DirectoryScanner(new MockFSAdapter(mockFiles));
		const result = await scanner.scan('/test');

		const endTime = Date.now();
		const processingTime = endTime - startTime;

		assert.strictEqual(result.length, 10);
		// 並列処理により、処理時間が一定以下であることを確認
		assert.ok(processingTime < 1000, '並列処理が期待通りに動作していません');
	});

	test('DirectoryScanner - 基本的なスキャン処理', async () => {
		const mockFiles = {
			'/test/file1.txt': 'content1',
			'/test/file2.txt': 'content2'
		};
		const mockAdapter = new MockFSAdapter(mockFiles);
		const scanner = new DirectoryScanner(mockAdapter);
		
		const results = await scanner.scan('/test');
		assert.strictEqual(results.length, 2);
	});

	test('DirectoryScanner - シンボリックリンクの除外', async () => {
		const mockAdapter = new MockFSAdapter({
			'/test/symlink.txt': 'content'
		});
		const scanner = new DirectoryScanner(mockAdapter);
		
		const results = await scanner.scan('/test');
		assert.strictEqual(results.length, 0);
	});

	test('MarkdownGenerator - マークダウン生成', () => {
		const entities = [
			{
				type: 'directory' as const,
				path: '/test/dir',
				children: [
					{
						type: 'file' as const,
						path: '/test/dir/file.txt',
						content: 'test content'
					}
				]
			}
		];

		const generator = new MarkdownGenerator();
		const markdown = generator.generate(entities);

		assert.ok(markdown.includes('## 📁 dir'));
		assert.ok(markdown.includes('### 📄 file.txt'));
		assert.ok(markdown.includes('test content'));
	});

	test('MarkdownGenerator - 空ディレクトリの処理', () => {
		const entities = [
			{
				type: 'directory' as const,
				path: '/test/empty',
				children: []
			}
		];

		const generator = new MarkdownGenerator();
		const markdown = generator.generate(entities);

		assert.ok(markdown.includes('## 📁 empty'));
		assert.ok(!markdown.includes('###')); // 子要素がないことを確認
	});

	test('ApplicationCoordinator - エディタ出力', async () => {
		const context = {
			subscriptions: [],
			globalState: {
				get: (key: string) => ({
					path: '/test',
					timestamp: new Date().toISOString(),
					fileCount: 2,
					outputType: 'editor'
				} as ProcessedDirectory),
				update: () => Promise.resolve()
			}
		} as any as vscode.ExtensionContext;
		
		const fsAdapter = new FileSystemAdapter();
		const scanner = new DirectoryScanner(fsAdapter);
		const generator = new MarkdownGenerator();
		const ui = new UIController(context);
		const i18n = I18n.getInstance();
		const config = ConfigurationManager.getInstance();

		const coordinator = new ApplicationCoordinator(
			context,
			scanner,
			generator,
			ui,
			i18n,
			config
		);
		await coordinator.processDirectoryToEditor('/test');
		
		const lastProcessed = context.globalState.get('lastProcessedDirectory') as ProcessedDirectory;
		assert.strictEqual(lastProcessed.outputType, 'editor');
	});

	test('ApplicationCoordinator - クリップボード出力', async () => {
		const context = {
			subscriptions: [],
			globalState: {
				get: (key: string) => ({
					path: '/test',
					timestamp: new Date().toISOString(),
					fileCount: 2,
					outputType: 'clipboard'
				} as ProcessedDirectory),
				update: () => Promise.resolve()
			}
		} as any as vscode.ExtensionContext;
		
		const fsAdapter = new FileSystemAdapter();
		const scanner = new DirectoryScanner(fsAdapter);
		const generator = new MarkdownGenerator();
		const ui = new UIController(context);
		const i18n = I18n.getInstance();
		const config = ConfigurationManager.getInstance();

		const coordinator = new ApplicationCoordinator(
			context,
			scanner,
			generator,
			ui,
			i18n,
			config
		);
		await coordinator.processDirectoryToClipboard('/test');
		
		const lastProcessed = context.globalState.get('lastProcessedDirectory') as ProcessedDirectory;
		assert.strictEqual(lastProcessed.outputType, 'clipboard');
	});

	test('ApplicationCoordinator - エラーハンドリング', async () => {
		const context = {
			subscriptions: [],
			globalState: {
				get: (key: string) => ({
					message: 'Test error',
					timestamp: new Date().toISOString(),
					stack: 'Test stack trace'
				} as ErrorLog),
				update: () => Promise.resolve()
			}
		} as any as vscode.ExtensionContext;
		
		const fsAdapter = new FileSystemAdapter();
		const scanner = new DirectoryScanner(fsAdapter);
		const generator = new MarkdownGenerator();
		const ui = new UIController(context);
		const i18n = I18n.getInstance();
		const config = ConfigurationManager.getInstance();

		const coordinator = new ApplicationCoordinator(
			context,
			scanner,
			generator,
			ui,
			i18n,
			config
		);
		await coordinator.processDirectoryToEditor('invalid/path');
		
		const lastError = context.globalState.get('lastError') as ErrorLog;
		assert.ok(lastError.message);
		assert.ok(lastError.timestamp);
	});
});

suite('Progress Reporting', () => {
	test('DirectoryScanner - 進捗報告', async () => {
		const mockFiles = Object.fromEntries(
			Array.from({ length: 10 }, (_, i) => [
				`/test/file${i}.txt`,
				`content${i}`
			])
		);

		const progressUpdates: ScanProgress[] = [];
		const mockAdapter = new MockFSAdapter(mockFiles);
		const scanner = new DirectoryScanner(
			mockAdapter,
			(progress) => progressUpdates.push({ ...progress })
		);

		await scanner.scan('/test');

		assert.strictEqual(progressUpdates.length, 10);
		assert.ok(progressUpdates[0].total === 10);
		assert.ok(progressUpdates[9].processed === 10);
		assert.ok(progressUpdates[9].speed > 0);
	});

	test('DirectoryScanner - 除外パターン', async () => {
		const mockFiles = {
			'/test/file.txt': 'content',
			'/test/node_modules/lib.js': 'library',
			'/test/.git/config': 'git config'
		};

		const progressUpdates: ScanProgress[] = [];
		const mockAdapter = new MockFSAdapter(mockFiles);
		const scanner = new DirectoryScanner(
			mockAdapter,
			(progress) => progressUpdates.push({ ...progress })
		);

		const results = await scanner.scan('/test');

		assert.strictEqual(results.length, 1);
		assert.strictEqual(progressUpdates.length, 1);
	});
});

suite('Error Handling', () => {
	test('ErrorHandler - エラーログの作成', async () => {
		const handler = ErrorHandler.getInstance();
		const context = {
			globalState: {
				get: (key: string) => ({
					message: 'Test error',
					code: 'TEST_ERROR',
					path: '/test/path',
					timestamp: new Date().toISOString()
				} as ErrorLog),
				update: () => Promise.resolve()
			}
		} as any as vscode.ExtensionContext;

		const testError = new Error('Test error');
		await handler.handleError(testError, context, {
			showNotification: false,
			code: 'TEST_ERROR',
			path: '/test/path'
		});

		const errorLog = context.globalState.get('lastError') as ErrorLog;
		assert.ok(errorLog);
		assert.strictEqual(errorLog.message, 'Test error');
		assert.strictEqual(errorLog.code, 'TEST_ERROR');
		assert.strictEqual(errorLog.path, '/test/path');
	});

	test('ErrorHandler - 非Error型のエラー処理', async () => {
		const handler = ErrorHandler.getInstance();
		const context = {
			globalState: {
				get: (key: string) => ({
					message: 'String error',
					timestamp: new Date().toISOString()
				} as ErrorLog),
				update: () => Promise.resolve()
			}
		} as any as vscode.ExtensionContext;

		await handler.handleError('String error', context, {
			showNotification: false
		});

		const errorLog = context.globalState.get('lastError') as ErrorLog;
		assert.ok(errorLog);
		assert.strictEqual(errorLog.message, 'String error');
	});
});

suite('File Type Management', () => {
	test('FileTypeManager - 既知の拡張子', () => {
		const manager = FileTypeManager.getInstance();
		const tsFile = manager.getFileType('/test/file.ts');
		
		assert.strictEqual(tsFile.typeName, 'TypeScript Source');
		assert.strictEqual(tsFile.languageId, 'typescript');
	});

	test('FileTypeManager - 未知の拡張子', () => {
		const manager = FileTypeManager.getInstance();
		const unknownFile = manager.getFileType('/test/file.xyz');
		
		assert.strictEqual(unknownFile.typeName, 'Unknown Type');
		assert.strictEqual(unknownFile.languageId, 'plaintext');
	});

	test('FileTypeManager - 大文字小文字の区別なし', () => {
		const manager = FileTypeManager.getInstance();
		const tsFile = manager.getFileType('/test/file.TS');
		
		assert.strictEqual(tsFile.typeName, 'TypeScript Source');
		assert.strictEqual(tsFile.languageId, 'typescript');
	});
});

suite('DirectoryScanner Tests', () => {
	test('ファイルのスキャンが正しく動作する', async () => {
		const mockFiles = {
			'/test/path/file1.txt': 'test content 1',
			'/test/path/file2.txt': 'test content 2'
		};
		
		const fsAdapter = new MockFSAdapter(mockFiles);
		const scanner = new DirectoryScanner(
			fsAdapter,
			(progress: ScanProgress) => {
				// 進捗の監視
				console.log(`Processing: ${progress.currentFile}`);
			},
		);

		const result = await scanner.scan('/test/path');
		assert.strictEqual(result.length, 2);
		assert.ok(result.some(item => item.path.includes('file1.txt')));
		assert.ok(result.some(item => item.path.includes('file2.txt')));
	});

	test('エラーハンドリングが正しく動作する', async () => {
		const mockFiles = {
			'/test/path/error.txt': 'invalid content'
		};
		
		const fsAdapter = new MockFSAdapter(mockFiles);
		fsAdapter.readFile = async () => {
			throw new Error('Test error');
		};

		const scanner = new DirectoryScanner(fsAdapter);

		await assert.rejects(
			() => scanner.scan('/test/path'),
			(error: any) => {
				assert.ok(error instanceof ScanError);
				assert.ok(error.message.includes('Test error'));
				return true;
			}
		);
	});

	test('並列処理が正しく動作する', async () => {
		const mockFiles = {
			'/test/path/file1.txt': 'test content 1',
			'/test/path/file2.txt': 'test content 2',
			'/test/path/file3.txt': 'test content 3'
		};
		
		const fsAdapter = new MockFSAdapter(mockFiles);
		const processed = new Set<string>();
		
		const scanner = new DirectoryScanner(
			fsAdapter,
			(progress: ScanProgress) => {
				processed.add(progress.currentFile);
			},
		);

		const result = await scanner.scan('/test/path');
		assert.strictEqual(result.length, 3);
		assert.strictEqual(processed.size, 3);
	});
});
