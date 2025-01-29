import * as vscode from 'vscode';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ConfigurationService, Configuration, IConfigurationService } from '@/infrastructure/config/ConfigurationService';

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
    let currentConfig: Configuration;
    let onDidChangeConfigurationCallback: (event: vscode.ConfigurationChangeEvent) => Promise<void>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // 現在の設定を初期化
        currentConfig = {
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

        // VSCode設定のスタブ化
        workspaceConfig = {
            get: sandbox.stub(),
            update: sandbox.stub().callsFake(async (key: string, value: any) => {
                (currentConfig as any)[key] = value;
                workspaceConfig.get.withArgs(key).returns(value);
                // 設定変更イベントをトリガー
                if (onDidChangeConfigurationCallback) {
                    await onDidChangeConfigurationCallback({
                        affectsConfiguration: (section: string) => section === 'matomeru'
                    } as vscode.ConfigurationChangeEvent);
                }
            }),
            has: sandbox.stub().returns(true),
            inspect: sandbox.stub()
        } as vscode.WorkspaceConfiguration & {
            get: sinon.SinonStub;
            update: sinon.SinonStub;
            has: sinon.SinonStub;
            inspect: sinon.SinonStub;
        };

        // デフォルト設定値のスタブ設定
        Object.entries(currentConfig).forEach(([key, value]) => {
            workspaceConfig.get.withArgs(key).returns(value);
        });

        // VSCode設定のスタブ化
        sandbox.stub(vscode.workspace, 'getConfiguration').returns(workspaceConfig);

        // 設定変更イベントのスタブ化
        const disposable = { dispose: sandbox.stub() };
        sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').callsFake((callback) => {
            onDidChangeConfigurationCallback = callback;
            return disposable;
        });

        // ConfigurationServiceのインスタンスを作成
        service = new ConfigurationService() as IConfigurationServiceWithInternals;
    });

    afterEach(() => {
        sandbox.restore();
        service.dispose();
    });

    describe('設定の読み込み', () => {
        it('デフォルト設定を正しく読み込む', async () => {
            const defaultConfig = {
                chatGptIntegration: false,
                chatgptBundleId: 'com.openai.chat',
                defaultOutputType: 'editor',
                development: {
                    debugLogging: false,
                    disableNativeFeatures: false,
                    mockChatGPT: false
                },
                excludePatterns: [
                    'node_modules/**',
                    '.git/**'
                ]
            };

            workspaceConfig.get.returns(defaultConfig);
            const config = service.getConfiguration();
            expect(config).to.deep.equal(defaultConfig);
        });

        it('部分的な設定の更新が可能', async () => {
            const changes = {
                development: {
                    debugLogging: true,
                    disableNativeFeatures: false,
                    mockChatGPT: true
                }
            };

            await service.updateConfiguration(changes);
            expect(workspaceConfig.update.calledOnce).to.be.true;
            expect(workspaceConfig.update.firstCall.args[1]).to.deep.equal(changes);
        });
    });

    describe('設定変更の監視', () => {
        it('設定変更リスナーが正しく動作する', async () => {
            const listener = sinon.spy((config: Configuration) => Promise.resolve());
            service.addChangeListener(listener);

            // 設定を更新して変更イベントをトリガー
            await workspaceConfig.update('maxFileSize', 2048 * 1024);

            expect(listener.callCount).to.equal(1);
            const [newConfig] = listener.firstCall.args;
            expect(newConfig.maxFileSize).to.equal(2048 * 1024);
            
            service.removeChangeListener(listener);
            await workspaceConfig.update('maxFileSize', 1024 * 1024);
            expect(listener.callCount).to.equal(1);
        });

        it('非同期リスナーを正しく処理する', async () => {
            const asyncListener = sinon.spy(async (config: Configuration) => {
                await new Promise(resolve => setTimeout(resolve, 10));
            });
            service.addChangeListener(asyncListener);

            await workspaceConfig.update('maxFileSize', 2048 * 1024);

            expect(asyncListener.callCount).to.equal(1);
            const [newConfig] = asyncListener.firstCall.args;
            expect(newConfig.maxFileSize).to.equal(2048 * 1024);
        });

        it('複数のリスナーを管理できる', async () => {
            const listener1 = sinon.spy((config: Configuration) => Promise.resolve());
            const listener2 = sinon.spy((config: Configuration) => Promise.resolve());

            service.addChangeListener(listener1);
            service.addChangeListener(listener2);

            await workspaceConfig.update('maxFileSize', 2048 * 1024);

            expect(listener1.callCount).to.equal(1);
            expect(listener2.callCount).to.equal(1);
        });
    });
}); 
