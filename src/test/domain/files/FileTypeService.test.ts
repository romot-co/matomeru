import { expect } from 'chai';
import { FileTypeService, IFileTypeConfig } from '@/domain/files/FileTypeService';

describe('FileTypeService Tests', () => {
    let service: FileTypeService;

    beforeEach(() => {
        service = new FileTypeService();
    });

    describe('テキストファイル判定', () => {
        it('デフォルトのテキストファイル拡張子を正しく判定できる', () => {
            expect(service.isTextFile('test.txt')).to.be.true;
            expect(service.isTextFile('test.md')).to.be.true;
            expect(service.isTextFile('test.ts')).to.be.true;
            expect(service.isTextFile('test.json')).to.be.true;
            expect(service.isTextFile('.gitignore')).to.be.true;
        });

        it('非テキストファイルを正しく判定できる', () => {
            expect(service.isTextFile('test.exe')).to.be.false;
            expect(service.isTextFile('test.dll')).to.be.false;
            expect(service.isTextFile('test.bin')).to.be.false;
        });

        it('拡張子のない特殊ファイルを正しく判定できる', () => {
            expect(service.isTextFile('.env')).to.be.true;
            expect(service.isTextFile('.gitignore')).to.be.true;
            expect(service.isTextFile('Dockerfile')).to.be.false;
        });

        it('大文字小文字を区別せずに判定できる', () => {
            expect(service.isTextFile('test.TXT')).to.be.true;
            expect(service.isTextFile('test.Md')).to.be.true;
            expect(service.isTextFile('test.JSON')).to.be.true;
        });
    });

    describe('ファイルタイプ判定', () => {
        it('既知のファイルタイプを正しく判定できる', () => {
            const jsType = service.getFileType('test.js');
            expect(jsType.languageId).to.equal('javascript');
            expect(jsType.typeName).to.equal('JavaScript');

            const tsType = service.getFileType('test.ts');
            expect(tsType.languageId).to.equal('typescript');
            expect(tsType.typeName).to.equal('TypeScript');
        });

        it('未知のファイルタイプをプレーンテキストとして判定する', () => {
            const unknownType = service.getFileType('test.unknown');
            expect(unknownType.languageId).to.equal('plaintext');
            expect(unknownType.typeName).to.equal('Unknown Type');
        });

        it('大文字小文字を区別せずにタイプを判定できる', () => {
            const jsType = service.getFileType('test.JS');
            expect(jsType.languageId).to.equal('javascript');
            expect(jsType.typeName).to.equal('JavaScript');
        });
    });

    describe('テキストファイル拡張子の管理', () => {
        it('新しい拡張子を追加できる', () => {
            service.addTextFileExtension('.custom');
            expect(service.isTextFile('test.custom')).to.be.true;
        });

        it('拡張子を削除できる', () => {
            service.removeTextFileExtension('.txt');
            expect(service.isTextFile('test.txt')).to.be.false;
        });

        it('ドットなしの拡張子も正しく処理できる', () => {
            service.addTextFileExtension('custom');
            expect(service.isTextFile('test.custom')).to.be.true;
        });

        it('拡張子リストを取得できる', () => {
            const extensions = service.getTextFileExtensions();
            expect(extensions).to.include('.txt');
            expect(extensions).to.include('.md');
            expect(extensions).to.include('.js');
        });
    });

    describe('カスタム設定', () => {
        it('カスタムのテキストファイル拡張子で初期化できる', () => {
            const config: IFileTypeConfig = {
                textFileExtensions: ['.custom1', '.custom2']
            };
            const customService = new FileTypeService(config);

            expect(customService.isTextFile('test.custom1')).to.be.true;
            expect(customService.isTextFile('test.custom2')).to.be.true;
            expect(customService.isTextFile('test.txt')).to.be.false;
        });

        it('カスタムのファイルタイプ設定で初期化できる', () => {
            const config: IFileTypeConfig = {
                fileTypes: {
                    '.custom': {
                        languageId: 'customlang',
                        typeName: 'Custom Language'
                    }
                }
            };
            const customService = new FileTypeService(config);

            const customType = customService.getFileType('test.custom');
            expect(customType.languageId).to.equal('customlang');
            expect(customType.typeName).to.equal('Custom Language');
        });
    });

    describe('createDefault', () => {
        it('デフォルト設定でインスタンスを生成できる', () => {
            const defaultService = FileTypeService.createDefault();
            expect(defaultService).to.be.instanceOf(FileTypeService);
            expect(defaultService.isTextFile('test.txt')).to.be.true;
        });
    });
}); 