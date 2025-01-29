import * as assert from 'assert';
import * as sinon from 'sinon';
import { DirectoryStructureService } from '@/services/structure/DirectoryStructureService';
import { FileSystemEntity } from '@/types';
import { ErrorService } from '@/errors/services/ErrorService';

describe('DirectoryStructureService Tests', () => {
    let service: DirectoryStructureService;
    let sandbox: sinon.SinonSandbox;
    let errorService: ErrorService;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        service = DirectoryStructureService.getInstance();
        errorService = ErrorService.getInstance();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('ツリー形式とアイコン形式の出力を生成する', () => {
        const entities: FileSystemEntity[] = [
            {
                type: 'directory',
                path: 'src',
                children: [
                    {
                        type: 'file',
                        path: 'src/index.ts',
                        content: 'console.log("Hello");'
                    },
                    {
                        type: 'directory',
                        path: 'src/utils',
                        children: [
                            {
                                type: 'file',
                                path: 'src/utils/helper.ts',
                                content: 'export const helper = () => {};'
                            }
                        ]
                    }
                ]
            }
        ];

        const treeResult = service.generateTreeStructure(entities);
        const iconResult = service.generateDirectoryStructure(entities);

        // ツリー形式の検証
        assert.ok(treeResult.includes('src'));
        assert.ok(treeResult.includes('└── index.ts'));
        assert.ok(treeResult.includes('└── utils'));
        assert.ok(treeResult.includes('    └── helper.ts'));

        // アイコン形式の検証
        assert.ok(iconResult.includes('📁 src'));
        assert.ok(iconResult.includes('📄 index.ts'));
        assert.ok(iconResult.includes('📁 utils'));
        assert.ok(iconResult.includes('📄 helper.ts'));
    });

    it('空のディレクトリを処理する', () => {
        const entities: FileSystemEntity[] = [
            {
                type: 'directory',
                path: 'empty',
                children: []
            }
        ];

        const treeResult = service.generateTreeStructure(entities);
        const iconResult = service.generateDirectoryStructure(entities);

        assert.ok(treeResult.includes('empty'));
        assert.ok(iconResult.includes('📁 empty'));
    });

    it('エラー時の処理', () => {
        const handleErrorStub = sandbox.stub(errorService, 'handleError');
        const invalidEntities = null as unknown as FileSystemEntity[];

        const treeResult = service.generateTreeStructure(invalidEntities);
        const iconResult = service.generateDirectoryStructure(invalidEntities);

        assert.strictEqual(treeResult, '');
        assert.strictEqual(iconResult, '');
        assert.ok(handleErrorStub.calledTwice);
        assert.deepStrictEqual(handleErrorStub.firstCall.args[1].details, { format: 'tree' });
        assert.deepStrictEqual(handleErrorStub.secondCall.args[1].details, { format: 'icon' });
    });
}); 