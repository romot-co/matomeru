import { expect } from 'chai';
import * as sinon from 'sinon';
import { DirectoryStructureService } from '../../../domain/structure/DirectoryStructureService';
import { IFileSystem } from '../../../domain/files/FileSystemAdapter';
import { IErrorHandler } from '../../../shared/errors/services/ErrorService';
import { FileSystemEntity } from '../../../types';
import { II18nService } from '../../../i18n/I18nService';

describe('DirectoryStructureService', () => {
    let service: DirectoryStructureService;
    let sandbox: sinon.SinonSandbox;
    let fileSystemStub: sinon.SinonStubbedInstance<IFileSystem>;
    let errorHandlerStub: sinon.SinonStubbedInstance<IErrorHandler>;
    let i18nStub: sinon.SinonStubbedInstance<II18nService>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        fileSystemStub = sandbox.createStubInstance<IFileSystem>(class implements IFileSystem {
            readFile() { return Promise.resolve(''); }
            writeFile() { return Promise.resolve(); }
            readDirectory() { return Promise.resolve([]); }
            stat() { return Promise.resolve({ size: 0, mtime: 0 }); }
            exists() { return Promise.resolve(true); }
            createDirectory() { return Promise.resolve(); }
            delete() { return Promise.resolve(); }
            copy() { return Promise.resolve(); }
        });
        errorHandlerStub = sandbox.createStubInstance<IErrorHandler>(class implements IErrorHandler {
            handleError() { return Promise.resolve(); }
            getErrorLogs() { return []; }
            clearErrorLogs() {}
        });
        i18nStub = sandbox.createStubInstance<II18nService>(class implements II18nService {
            t(key: string) { return key; }
            setLocale() {}
            getCurrentLocale() { return 'en'; }
        });

        service = new DirectoryStructureService(errorHandlerStub);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('generateDirectoryStructure', () => {
        it('ディレクトリ構造を取得できる', () => {
            const entities: FileSystemEntity[] = [
                { path: 'file1.ts', type: 'file' },
                { path: 'file2.ts', type: 'file' }
            ];

            const result = service.generateDirectoryStructure(entities);

            expect(result).to.be.a('string');
            expect(result).to.include('file1.ts');
            expect(result).to.include('file2.ts');
        });

        it('空のディレクトリを処理できる', () => {
            const entities: FileSystemEntity[] = [];

            const result = service.generateDirectoryStructure(entities);

            expect(result).to.be.a('string');
            expect(result.trim()).to.equal('');
        });

        it('アイコン付きの構造を生成できる', () => {
            const entities: FileSystemEntity[] = [
                { path: 'file1.ts', type: 'file' },
                { path: 'file2.ts', type: 'file' },
                { path: 'src', type: 'directory', children: [
                    { path: 'src/index.ts', type: 'file' }
                ]}
            ];

            const result = service.generateDirectoryStructure(entities);

            expect(result).to.be.a('string');
            expect(result).to.include('file1.ts');
            expect(result).to.include('file2.ts');
            expect(result).to.include('📄');
            expect(result).to.include('📁');
        });

        it('エラーを適切に処理できる', () => {
            const invalidEntities = null as any;
            const result = service.generateDirectoryStructure(invalidEntities);

            expect(result).to.equal('');
            expect(errorHandlerStub.handleError.callCount).to.equal(1);
        });
    });

    describe('generateTreeStructure', () => {
        it('ツリー形式の構造を生成できる', () => {
            const entities: FileSystemEntity[] = [
                { path: 'file1.ts', type: 'file' },
                { path: 'file2.ts', type: 'file' },
                { path: 'src', type: 'directory', children: [
                    { path: 'src/index.ts', type: 'file' }
                ]}
            ];

            const result = service.generateTreeStructure(entities);

            expect(result).to.be.a('string');
            expect(result).to.include('file1.ts');
            expect(result).to.include('file2.ts');
            expect(result).to.include('└──');
            expect(result).to.include('src');
            expect(result).to.include('index.ts');
        });

        it('深いネストを処理できる', () => {
            const entities: FileSystemEntity[] = [
                { path: 'src', type: 'directory', children: [
                    { path: 'src/components', type: 'directory', children: [
                        { path: 'src/components/Button.tsx', type: 'file' }
                    ]},
                    { path: 'src/utils', type: 'directory', children: [
                        { path: 'src/utils/helper.ts', type: 'file' }
                    ]}
                ]}
            ];

            const result = service.generateTreeStructure(entities);

            expect(result).to.be.a('string');
            expect(result).to.include('src');
            expect(result).to.include('components');
            expect(result).to.include('utils');
            expect(result).to.include('Button.tsx');
            expect(result).to.include('helper.ts');
            expect(result).to.include('└──');
        });
    });
}); 