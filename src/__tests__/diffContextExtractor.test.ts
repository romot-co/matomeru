import { describe, expect, jest, test } from '@jest/globals';
import { extractChangedCodeByFunction } from '../utils/diffContextExtractor';
import * as vscode from 'vscode';

jest.mock('../services/parserManager', () => {
  return {
    ParserManager: {
      getInstance: jest.fn().mockReturnValue({
        getParser: jest.fn().mockReturnValue(Promise.resolve(null))
      })
    }
  };
});

describe('diffContextExtractor', () => {
  const ctx = {
    extensionUri: vscode.Uri.file('/tmp/mock'),
    extensionPath: '/tmp/mock'
  } as any;

  test('falls back to line context extraction when parser unavailable', async () => {
    const code = ['const a = 1;', 'const b = 2;', 'const c = 3;', 'const d = 4;'].join('\n');
    const changed = new Set<number>([2]); // line numbers are 1-based

    const result = await extractChangedCodeByFunction({
      code,
      languageId: 'unknown',
      changedLineNumbers: changed,
      contextLines: 1,
      ctx
    });

    expect(result).toContain('const a = 1;');
    expect(result).toContain('const b = 2;');
    expect(result).toContain('const c = 3;');
  });
});
