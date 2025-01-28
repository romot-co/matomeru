import * as assert from 'assert';
import { MarkdownGenerator, FileEntity, DirectoryEntity } from '../services/markdown-generator';
import { ScanResult } from '../types';
import { FileTypeManager } from '../services/FileTypeManager';
import * as sinon from 'sinon';

suite('MarkdownGenerator Tests', () => {
    let generator: MarkdownGenerator;
    let sandbox: sinon.SinonSandbox;
    let fileTypeManager: FileTypeManager;

    setup(() => {
        sandbox = sinon.createSandbox();
        generator = new MarkdownGenerator();
        fileTypeManager = FileTypeManager.getInstance();
    });

    teardown(() => {
        sandbox.restore();
    });

    test('スキャン結果からMarkdownを生成する', async () => {
        const scanResults: ScanResult[] = [
            {
                path: 'test.ts',
                content: 'console.log("Hello");',
                extension: '.ts'
            },
            {
                path: 'test.py',
                content: 'print("Hello")',
                extension: '.py'
            }
        ];

        const markdown = await generator.generateMarkdown(scanResults);

        assert.ok(markdown.includes('# コードベース概要'));
        assert.ok(markdown.includes('## test.ts'));
        assert.ok(markdown.includes('```typescript'));
        assert.ok(markdown.includes('console.log("Hello");'));
        assert.ok(markdown.includes('## test.py'));
        assert.ok(markdown.includes('```python'));
        assert.ok(markdown.includes('print("Hello")'));
    });

    test('ファイルエンティティからMarkdownを生成する', () => {
        const entities: (FileEntity | DirectoryEntity)[] = [
            {
                type: 'file',
                path: 'test.ts',
                content: 'console.log("Hello");'
            },
            {
                type: 'directory',
                path: 'src',
                children: [
                    {
                        type: 'file',
                        path: 'src/index.ts',
                        content: 'export const x = 1;'
                    }
                ]
            }
        ];

        const markdown = generator.generate(entities);

        assert.ok(markdown.includes('## 📄 test.ts'));
        assert.ok(markdown.includes('```typescript'));
        assert.ok(markdown.includes('console.log("Hello");'));
        assert.ok(markdown.includes('## 📁 src'));
        assert.ok(markdown.includes('### 📄 index.ts'));
        assert.ok(markdown.includes('export const x = 1;'));
    });

    test('未知の拡張子のファイルを処理する', async () => {
        const scanResults: ScanResult[] = [
            {
                path: 'test.unknown',
                content: 'Some content',
                extension: '.unknown'
            }
        ];

        const markdown = await generator.generateMarkdown(scanResults);

        assert.ok(markdown.includes('## test.unknown'));
        assert.ok(markdown.includes('```plaintext'));
        assert.ok(markdown.includes('Some content'));
    });

    test('空のディレクトリを処理する', () => {
        const entities: DirectoryEntity[] = [
            {
                type: 'directory',
                path: 'empty',
                children: []
            }
        ];

        const markdown = generator.generate(entities);

        assert.ok(markdown.includes('## 📁 empty'));
        assert.ok(!markdown.includes('###'));
    });

    test('ネストされたディレクトリ構造を処理する', () => {
        const entities: DirectoryEntity[] = [
            {
                type: 'directory',
                path: 'root',
                children: [
                    {
                        type: 'directory',
                        path: 'root/src',
                        children: [
                            {
                                type: 'file',
                                path: 'root/src/index.ts',
                                content: 'export {};'
                            }
                        ]
                    }
                ]
            }
        ];

        const markdown = generator.generate(entities);

        assert.ok(markdown.includes('## 📁 root'));
        assert.ok(markdown.includes('### 📁 src'));
        assert.ok(markdown.includes('#### 📄 index.ts'));
        assert.ok(markdown.includes('```typescript'));
        assert.ok(markdown.includes('export {};'));
    });
}); 