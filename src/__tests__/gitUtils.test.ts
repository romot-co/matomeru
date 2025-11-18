import { buildGitDiffArgs } from '../utils/gitUtils';

describe('buildGitDiffArgs', () => {
  it('allows reflog notation', () => {
    const args = buildGitDiffArgs('HEAD@{1}');
    expect(args).toEqual(['diff', '--name-only', 'HEAD@{1}']);
  });

  it('allows peel expressions', () => {
    const args = buildGitDiffArgs('feature^{tree}');
    expect(args).toEqual(['diff', '--name-only', 'feature^{tree}']);
  });

  it('rejects dangerous characters', () => {
    expect(() => buildGitDiffArgs('HEAD; rm -rf /'))
      .toThrow('Invalid git diff range token: HEAD;');
  });
});
