import { describe, expect, test } from '@jest/globals';
import { parseUnifiedDiff } from '../utils/gitDiffParser';

describe('parseUnifiedDiff', () => {
  test('extracts changed line numbers per file', () => {
    const diff = [
      'diff --git a/src/foo.ts b/src/foo.ts',
      '--- a/src/foo.ts',
      '+++ b/src/foo.ts',
      '@@ -1,2 +1,3 @@',
      '@@ -8 +10,2 @@',
      'diff --git a/src/bar.ts b/src/bar.ts',
      '--- a/src/bar.ts',
      '+++ b/src/bar.ts',
      '@@ -20,5 +30,1 @@',
      '@@ -50,0 +60,4 @@',
      'diff --git a/src/removed.ts b/src/removed.ts',
      '--- a/src/removed.ts',
      '+++ /dev/null',
      '@@ -1,5 +0,0 @@'
    ].join('\n');

    const result = parseUnifiedDiff(diff);
    expect(result.size).toBe(2); // removed file is ignored

    const fooLines = Array.from(result.get('src/foo.ts') ?? []);
    expect(fooLines).toEqual(expect.arrayContaining([1, 2, 3, 10, 11]));

    const barLines = Array.from(result.get('src/bar.ts') ?? []).sort((a, b) => a - b);
    expect(barLines).toEqual([30, 60, 61, 62, 63]);
  });
});
