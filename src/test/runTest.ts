import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // テストのルートディレクトリ
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // テストを実行
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                '--enable-proposed-api',
                'romot-co.matomeru'
            ]
        });
    } catch (err) {
        console.error('テストの実行中にエラーが発生しました:', err);
        process.exit(1);
    }
}

main(); 