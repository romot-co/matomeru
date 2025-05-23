import { describe, expect, jest, beforeEach } from '@jest/globals';
import * as vscode from 'vscode';
import { MarkdownGenerator } from '../generators/MarkdownGenerator';
import { YamlGenerator } from '../generators/YamlGenerator';
import { DirectoryInfo } from '../types/fileTypes';

// VSCode APIのモック
jest.mock('vscode', () => ({
  workspace: {
    getConfiguration: jest.fn().mockReturnValue({
      get: jest.fn().mockImplementation((key: unknown, defaultValue: unknown = undefined) => {
        const keyStr = String(key);
        switch (keyStr) {
          case 'mermaid.maxNodes':
            return 50;
          case 'includeDependencies':
            return true;
          default:
            return defaultValue;
        }
      })
    })
  },
  Uri: {
    file: (path: string) => ({ fsPath: path, scheme: 'file' })
  }
}));

jest.mock('../extension', () => ({
  getExtensionContext: () => ({
    extensionPath: '/test/extension/path'
  })
}));

describe('Mermaidグラフ循環依存検出詳細テスト', () => {
  let markdownGenerator: MarkdownGenerator;
  let yamlGenerator: YamlGenerator;

  beforeEach(() => {
    jest.clearAllMocks();
    yamlGenerator = new YamlGenerator();
    markdownGenerator = new MarkdownGenerator(undefined, yamlGenerator);
  });

  describe('単純な循環依存の検出', () => {
    it('2つのファイル間の循環依存を検出すること', async () => {
      const dependencies = {
        'src/A.ts': ['src/B.ts'],
        'src/B.ts': ['src/A.ts']
      };

      // detectCyclesメソッドをテスト用に公開
      const cycles = (markdownGenerator as any).detectCycles(dependencies);

      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toEqual(['src/A.ts', 'src/B.ts', 'src/A.ts']);
    });

    it('3つのファイル間の循環依存を検出すること', async () => {
      const dependencies = {
        'src/A.ts': ['src/B.ts'],
        'src/B.ts': ['src/C.ts'],
        'src/C.ts': ['src/A.ts']
      };

      const cycles = (markdownGenerator as any).detectCycles(dependencies);

      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toEqual(['src/A.ts', 'src/B.ts', 'src/C.ts', 'src/A.ts']);
    });
  });

  describe('複雑な循環依存の検出', () => {
    it('複数の独立した循環依存を検出すること', async () => {
      const dependencies = {
        // 循環1: A -> B -> A
        'src/A.ts': ['src/B.ts'],
        'src/B.ts': ['src/A.ts'],
        // 循環2: C -> D -> E -> C
        'src/C.ts': ['src/D.ts'],
        'src/D.ts': ['src/E.ts'],
        'src/E.ts': ['src/C.ts'],
        // 非循環: F -> G
        'src/F.ts': ['src/G.ts'],
        'src/G.ts': []
      };

      const cycles = (markdownGenerator as any).detectCycles(dependencies);

      expect(cycles).toHaveLength(2);
      
      // 循環の検出順序は実装に依存するため、存在確認で検証
      const cycleStrings = cycles.map(cycle => cycle.join('->'));
      expect(cycleStrings.some(cycle => 
        cycle.includes('src/A.ts->src/B.ts->src/A.ts') ||
        cycle.includes('src/B.ts->src/A.ts->src/B.ts')
      )).toBe(true);
      expect(cycleStrings.some(cycle => 
        cycle.includes('src/C.ts->src/D.ts->src/E.ts->src/C.ts') ||
        cycle.includes('src/D.ts->src/E.ts->src/C.ts->src/D.ts') ||
        cycle.includes('src/E.ts->src/C.ts->src/D.ts->src/E.ts')
      )).toBe(true);
    });

    it('ネストした循環依存を検出すること', async () => {
      const dependencies = {
        'src/A.ts': ['src/B.ts', 'src/C.ts'],
        'src/B.ts': ['src/D.ts'],
        'src/C.ts': ['src/D.ts'],
        'src/D.ts': ['src/A.ts'] // A -> B -> D -> A, A -> C -> D -> A
      };

      const cycles = (markdownGenerator as any).detectCycles(dependencies);

      expect(cycles.length).toBeGreaterThan(0);
      // 複数の循環パスが検出される可能性がある
      const cycleStrings = cycles.map(cycle => cycle.join('->'));
      expect(cycleStrings.some(cycle => cycle.includes('src/A.ts') && cycle.includes('src/D.ts'))).toBe(true);
    });
  });

  describe('Mermaidグラフ生成での循環依存表示', () => {
    it('循環依存をコメントとして出力すること', async () => {
      // YamlGeneratorをモック
      jest.spyOn(yamlGenerator, 'generate').mockResolvedValue(`
dependencies:
  src/A.ts:
    - src/B.ts
  src/B.ts:
    - src/A.ts
`);

      const directories: DirectoryInfo[] = [{
        uri: vscode.Uri.file('/test/src'),
        relativePath: 'src',
        files: [],
        directories: new Map()
      }];

      const mermaidGraph = await (markdownGenerator as any).generateMermaidGraph(
        directories,
        vscode.workspace.getConfiguration('matomeru')
      );

      expect(mermaidGraph).toContain('flowchart TD');
      expect(mermaidGraph).toContain('%% Warning: Circular dependencies detected');
      expect(mermaidGraph).toContain('src/A.ts -> src/B.ts -> src/A.ts');
    });

    it('大量の循環依存で表示数が制限されること', async () => {
      // 10個の循環依存を生成
      const dependencies: { [key: string]: string[] } = {};
      for (let i = 0; i < 10; i++) {
        const current = `cycle${i}/A.ts`;
        const next = `cycle${i}/B.ts`;
        dependencies[current] = [next];
        dependencies[next] = [current];
      }

      const yamlContent = `
dependencies:
${Object.entries(dependencies).map(([key, deps]) => 
  `  ${key}:\n${deps.map(dep => `    - ${dep}`).join('\n')}`
).join('\n')}
`;

      jest.spyOn(yamlGenerator, 'generate').mockResolvedValue(yamlContent);

      const directories: DirectoryInfo[] = [];
      const mermaidGraph = await (markdownGenerator as any).generateMermaidGraph(
        directories,
        vscode.workspace.getConfiguration('matomeru')
      );

      // 最大5個の循環依存まで表示
      const warningLines = mermaidGraph.split('\n').filter(line => line.includes('%% '));
      const cycleComments = warningLines.filter(line => line.includes('->'));
      expect(cycleComments.length).toBeLessThanOrEqual(5);

      // "more"表示の確認
      if (cycleComments.length === 5) {
        expect(mermaidGraph).toContain('more');
      }
    });
  });

  describe('循環依存のエッジケース', () => {
    it('自己循環依存を検出すること', async () => {
      const dependencies = {
        'src/A.ts': ['src/A.ts'] // 自己参照
      };

      const cycles = (markdownGenerator as any).detectCycles(dependencies);

      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toEqual(['src/A.ts', 'src/A.ts']);
    });

    it('循環依存がない場合は空配列を返すこと', async () => {
      const dependencies = {
        'src/A.ts': ['src/B.ts'],
        'src/B.ts': ['src/C.ts'],
        'src/C.ts': []
      };

      const cycles = (markdownGenerator as any).detectCycles(dependencies);

      expect(cycles).toHaveLength(0);
    });

    it('空の依存関係で循環依存チェックが失敗しないこと', async () => {
      const dependencies = {};

      const cycles = (markdownGenerator as any).detectCycles(dependencies);

      expect(cycles).toHaveLength(0);
    });

    it('依存先が存在しないファイルでも処理が継続されること', async () => {
      const dependencies = {
        'src/A.ts': ['src/NonExistent.ts'],
        'src/B.ts': ['src/C.ts'],
        'src/C.ts': ['src/B.ts']
      };

      const cycles = (markdownGenerator as any).detectCycles(dependencies);

      // 存在する循環依存のみが検出される
      expect(cycles).toHaveLength(1);
      expect(cycles[0]).toEqual(['src/B.ts', 'src/C.ts', 'src/B.ts']);
    });
  });

  describe('パフォーマンステスト', () => {
    it('大規模な依存関係グラフでも合理的な時間で処理されること', async () => {
      // 100個のファイルと循環依存を含む大規模グラフを生成
      const dependencies: { [key: string]: string[] } = {};
      
      // 線形チェーン + 1つの循環
      for (let i = 0; i < 99; i++) {
        dependencies[`file${i}.ts`] = [`file${i + 1}.ts`];
      }
      dependencies['file99.ts'] = ['file0.ts']; // 大きな循環を作成

      const startTime = Date.now();
      const cycles = (markdownGenerator as any).detectCycles(dependencies);
      const endTime = Date.now();

      expect(cycles).toHaveLength(1);
      expect(endTime - startTime).toBeLessThan(1000); // 1秒以内
    });

    it('深くネストした依存関係でスタックオーバーフローが発生しないこと', async () => {
      // 深い線形依存チェーン（1000レベル）
      const dependencies: { [key: string]: string[] } = {};
      for (let i = 0; i < 999; i++) {
        dependencies[`level${i}.ts`] = [`level${i + 1}.ts`];
      }
      dependencies['level999.ts'] = ['level0.ts']; // 最後に循環を作成

      expect(() => {
        const cycles = (markdownGenerator as any).detectCycles(dependencies);
        expect(cycles).toHaveLength(1);
      }).not.toThrow();
    });
  });
}); 