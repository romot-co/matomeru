import { expect } from 'chai';
import * as sinon from 'sinon';
import { ClipboardService } from '@/infrastructure/platform/ClipboardService';

describe('ClipboardService', () => {
    let sandbox: sinon.SinonSandbox;
    let service: ClipboardService;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        service = new ClipboardService();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('writeText', () => {
        it('テキストをクリップボードに書き込める', async () => {
            const writeTextStub = sandbox.stub(service, 'writeText').resolves();
            const text = 'テストテキスト';
            
            await service.writeText(text);
            
            expect(writeTextStub.calledOnce).to.be.true;
            expect(writeTextStub.calledWith(text)).to.be.true;
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('クリップボードエラー');
            sandbox.stub(service, 'writeText').rejects(error);

            try {
                await service.writeText('テスト');
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.equal(error);
            }
        });
    });

    describe('readText', () => {
        it('クリップボードからテキストを読み取れる', async () => {
            const expectedText = 'テストテキスト';
            const readTextStub = sandbox.stub(service, 'readText').resolves(expectedText);

            const result = await service.readText();
            
            expect(result).to.equal(expectedText);
            expect(readTextStub.calledOnce).to.be.true;
        });

        it('エラー時に適切に処理する', async () => {
            const error = new Error('クリップボードエラー');
            sandbox.stub(service, 'readText').rejects(error);

            try {
                await service.readText();
                expect.fail('エラーが発生するはずです');
            } catch (err) {
                expect(err).to.equal(error);
            }
        });
    });
}); 
