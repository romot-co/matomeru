import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ConfigurationService, Configuration, IConfigurationService } from '../../../infrastructure/config/ConfigurationService';

interface IConfigurationServiceWithInternals extends IConfigurationService {
    updateConfiguration(changes: Partial<Configuration>): Promise<void>;
    dispose(): void;
}

describe('ConfigurationService', () => {
    let service: IConfigurationServiceWithInternals;
    let sandbox: sinon.SinonSandbox;
    let workspaceConfig: vscode.WorkspaceConfiguration & {
        get: sinon.SinonStub;
        update: sinon.SinonStub;
        has: sinon.SinonStub;
        inspect: sinon.SinonStub;
    };
    let onDidChangeConfigurationCallback: (event: vscode.ConfigurationChangeEvent) => Promise<void>;

    const defaultConfig: Configuration = {
        excludePatterns: ['node_modules/**', '.git/**'],
        maxFileSize: 1024 * 1024,
        maxConcurrentFiles: 10,
        defaultOutputType: 'editor',
        chatGptIntegration: false,
        batchSize: 100,
        chatgptBundleId: 'com.openai.chat',
        development: {
            mockChatGPT: false,
            debugLogging: false,
            disableNativeFeatures: false
        }
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        workspaceConfig = {
            get: sandbox.stub(),
            update: sandbox.stub(),
            has: sandbox.stub().returns(true),
            inspect: sandbox.stub()
        } as any;

        workspaceConfig.get.withArgs('excludePatterns').returns(defaultConfig.excludePatterns);
        workspaceConfig.get.withArgs('maxFileSize').returns(defaultConfig.maxFileSize);
        workspaceConfig.get.withArgs('maxConcurrentFiles').returns(defaultConfig.maxConcurrentFiles);
        workspaceConfig.get.withArgs('defaultOutputType').returns(defaultConfig.defaultOutputType);
        workspaceConfig.get.withArgs('chatGptIntegration').returns(defaultConfig.chatGptIntegration);
        workspaceConfig.get.withArgs('batchSize').returns(defaultConfig.batchSize);
        workspaceConfig.get.withArgs('chatgptBundleId').returns(defaultConfig.chatgptBundleId);
        workspaceConfig.get.withArgs('development.mockChatGPT').returns(defaultConfig.development.mockChatGPT);
        workspaceConfig.get.withArgs('development.debugLogging').returns(defaultConfig.development.debugLogging);
        workspaceConfig.get.withArgs('development.disableNativeFeatures').returns(defaultConfig.development.disableNativeFeatures);

        sandbox.stub(vscode.workspace, 'getConfiguration')
            .withArgs('matomeru')
            .returns(workspaceConfig);

        const disposable = { dispose: sandbox.stub() };
        onDidChangeConfigurationCallback = async (_event: vscode.ConfigurationChangeEvent) => { /**/ };
        sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((callback) => {
            onDidChangeConfigurationCallback = callback;
            return disposable;
        });

        // updateが呼ばれたら、もし maxFileSize 等をセットされたら stub の返り値を動的に変更しつつ、
        // onDidChangeConfigurationCallback を呼ぶ
        workspaceConfig.update.callsFake(async (key: string, value: any, scope: vscode.ConfigurationTarget) => {
            // 例: maxFileSize を 2048 * 1024 にされたら、get('maxFileSize') がそれを返すようにする
            if (key === 'maxFileSize') {
                workspaceConfig.get.withArgs('maxFileSize').returns(value);
            } else if (key.startsWith('development.')) {
                // e.g. 'development.debugLogging' のような形
                const parts = key.split('.');
                if (parts.length === 2) {
                    workspaceConfig.get.withArgs(key).returns(value);
                }
            }
            // 更新後に onDidChangeConfiguration を発火
            if (onDidChangeConfigurationCallback) {
                await onDidChangeConfigurationCallback({
                    affectsConfiguration: (section: string) => section === 'matomeru'
                } as vscode.ConfigurationChangeEvent);
            }
        });

        service = new ConfigurationService() as IConfigurationServiceWithInternals;
    });

    afterEach(() => {
        sandbox.restore();
        service.dispose();
    });

    describe('設定の読み込み', () => {
        it('デフォルト設定を正しく読み込む', () => {
            const config = service.getConfiguration();
            expect(config).to.deep.equal(defaultConfig);
        });

        it('部分的な設定の更新が可能', async () => {
            const changes: Partial<Configuration> = {
                development: {
                    mockChatGPT: false,
                    debugLogging: true,
                    disableNativeFeatures: false
                }
            };

            await service.updateConfiguration(changes);

            expect(workspaceConfig.update.calledWith(
                'development.debugLogging',
                true,
                vscode.ConfigurationTarget.Workspace
            )).to.be.true;

            // 更新後、内部的にも debugLogging: true になっているはず
            const config = service.getConfiguration();
            expect(config.development.debugLogging).to.be.true;
        });
    });

    describe('設定変更の監視', () => {
        it('設定変更リスナーが正しく動作する', async () => {
            const listener = sinon.spy((config: Configuration) => Promise.resolve());
            service.addChangeListener(listener);

            // maxFileSize を変更
            await workspaceConfig.update('maxFileSize', 2048 * 1024, vscode.ConfigurationTarget.Workspace);

            expect(listener.callCount).to.equal(1);
            const [newConfig] = listener.firstCall.args;
            expect(newConfig.maxFileSize).to.equal(2048 * 1024);

            // リスナーを削除
            service.removeChangeListener(listener);

            // 再度更新しても呼ばれない
            await workspaceConfig.update('maxFileSize', 1024 * 1024, vscode.ConfigurationTarget.Workspace);
            expect(listener.callCount).to.equal(1);
        });

        it('非同期リスナーを正しく処理する', async () => {
            const asyncListener = sinon.spy(async (config: Configuration) => {
                await new Promise(resolve => setTimeout(resolve, 10));
            });
            service.addChangeListener(asyncListener);

            await workspaceConfig.update('maxFileSize', 2048 * 1024, vscode.ConfigurationTarget.Workspace);
            expect(asyncListener.callCount).to.equal(1);
            const [newConfig] = asyncListener.firstCall.args;
            expect(newConfig.maxFileSize).to.equal(2048 * 1024);
        });

        it('複数のリスナーを管理できる', async () => {
            const listener1 = sinon.spy((config: Configuration) => Promise.resolve());
            const listener2 = sinon.spy((config: Configuration) => Promise.resolve());

            service.addChangeListener(listener1);
            service.addChangeListener(listener2);

            await workspaceConfig.update('maxFileSize', 2048 * 1024, vscode.ConfigurationTarget.Workspace);

            expect(listener1.callCount).to.equal(1);
            expect(listener2.callCount).to.equal(1);
        });
    });
});
