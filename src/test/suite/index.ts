import 'module-alias/register';
import * as path from 'path';
import Mocha from 'mocha';
import { glob } from 'glob';

// テスト実行前の環境設定
process.env.NODE_ENV = 'test';
process.env.VSCODE_TEST = 'true';

// module-aliasの設定を動的に行う
import moduleAlias from 'module-alias';
const rootDir = path.resolve(__dirname, '../../..');
moduleAlias.addAliases({
    '@': path.join(rootDir, 'out')
});

export async function run(): Promise<void> {
    try {
        // テストファイルを収集
        const testsRoot = path.resolve(__dirname, '..');
        const files = await glob('**/**.test.js', { cwd: testsRoot });

        // Mochaインスタンスを作成
        const mocha = new Mocha({
            ui: 'bdd',
            color: true,
            timeout: 10000, // タイムアウトを10秒に延長
            retries: 1,     // 失敗時に1回リトライ
        });

        // テストファイルを追加
        files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));

        // テストを実行
        return new Promise<void>((resolve, reject) => {
            try {
                mocha.run((failures: number) => {
                    if (failures > 0) {
                        reject(new Error(`${failures} tests failed.`));
                    } else {
                        resolve();
                    }
                });
            } catch (err) {
                console.error('テスト実行中に予期せぬエラーが発生しました:', err);
                reject(err);
            }
        });
    } catch (err) {
        console.error('テストのセットアップ中にエラーが発生しました:', err);
        throw err;
    }
} 
