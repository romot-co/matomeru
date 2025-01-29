import * as assert from 'assert';
import { FileTypeService } from '@/services/fs/FileTypeService';

describe('FileTypeService Tests', () => {
    let fileTypeService: FileTypeService;

    beforeEach(() => {
        fileTypeService = FileTypeService.getInstance();
    });

    it('既知の拡張子に対して正しい言語IDを返す', () => {
        const testCases = [
            { path: 'test.ts', expectedLanguageId: 'typescript' },
            { path: 'test.js', expectedLanguageId: 'javascript' },
            { path: 'test.py', expectedLanguageId: 'python' },
            { path: 'test.java', expectedLanguageId: 'java' },
            { path: 'test.cpp', expectedLanguageId: 'cpp' }
        ];

        for (const testCase of testCases) {
            const fileType = fileTypeService.getFileType(testCase.path);
            assert.strictEqual(fileType.languageId, testCase.expectedLanguageId);
        }
    });

    it('未知の拡張子に対してplaintextを返す', () => {
        const testCases = [
            'test.unknown',
            'test.xyz',
            'test'
        ];

        for (const path of testCases) {
            const fileType = fileTypeService.getFileType(path);
            assert.strictEqual(fileType.languageId, 'plaintext');
            assert.strictEqual(fileType.typeName, 'Unknown Type');
        }
    });

    it('拡張子の大文字小文字を区別しない', () => {
        const testCases = [
            { path: 'test.TS', expectedLanguageId: 'typescript' },
            { path: 'test.Js', expectedLanguageId: 'javascript' },
            { path: 'test.PY', expectedLanguageId: 'python' }
        ];

        for (const testCase of testCases) {
            const fileType = fileTypeService.getFileType(testCase.path);
            assert.strictEqual(fileType.languageId, testCase.expectedLanguageId);
        }
    });

    it('サポートされている拡張子の一覧を取得できる', () => {
        const extensions = fileTypeService.getSupportedExtensions();
        assert.ok(extensions.length > 0);
        assert.ok(extensions.includes('.ts'));
        assert.ok(extensions.includes('.js'));
        assert.ok(extensions.includes('.py'));
    });

    it('isKnownTypeが正しく動作する', () => {
        assert.strictEqual(fileTypeService.isKnownType('test.ts'), true);
        assert.strictEqual(fileTypeService.isKnownType('test.js'), true);
        assert.strictEqual(fileTypeService.isKnownType('test.unknown'), false);
        assert.strictEqual(fileTypeService.isKnownType('test'), false);
    });
}); 