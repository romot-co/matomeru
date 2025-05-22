import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import { scanDependencies } from '../parsers/dependencyScanner';

// Mock getExtensionContext to provide a minimal ExtensionContext
jest.mock('../extension', () => ({
  getExtensionContext: () => ({ extensionPath: '/test/extension' })
}));

let mockMatches: any[] = [];

// Helper to create tree-sitter like nodes
const createNode = (type: string, text: string, children: any[] = []) => {
  const node: any = { type, text, children };
  node.firstChild = children[0];
  children.forEach((c: any) => { c.parent = node; });
  return node;
};

const mockParser = {
  parse: jest.fn().mockReturnValue({ rootNode: {} }),
  get language() {
    return {
      query: jest.fn().mockReturnValue({
        matches: jest.fn(() => mockMatches)
      })
    } as any;
  }
};

const mockInstance: any = {
  getParser: jest.fn().mockImplementation(async () => mockParser as any)
};

jest.mock('../services/parserManager', () => ({
  ParserManager: {
    getInstance: jest.fn(() => mockInstance)
  }
}));

// Utility to build match data for "from ..package import module" style
const relativeImportMatch = (dotCount: number, identifier: string) => {
  const prefixes = Array.from({ length: dotCount }, () => createNode('import_prefix', '.'));
  const idNode = createNode('identifier', identifier);
  createNode('relative_import', '', [...prefixes, idNode]);
  return [{ captures: [{ name: 'path', node: idNode }] }];
};

// Utility to build match data for "from .. import module" style
const dotsImportMatch = (dotCount: number, itemName: string) => {
  const dotsNode = createNode('dots', '.'.repeat(dotCount));
  const itemNode = createNode('identifier', itemName);
  return [{ captures: [ { name: 'dots', node: dotsNode }, { name: 'item_name', node: itemNode } ] }];
};

describe('scanDependencies Python relative imports', () => {
  beforeEach(() => { mockMatches = []; });

  test('handles "from ..package import module"', async () => {
    mockMatches = relativeImportMatch(2, 'package');
    const result = await scanDependencies('/test/workspace/app/mod.py', 'from ..package import module', 'python');
    expect(result).toEqual(['package']);
  });

  test('handles multi-level "from ...subpackage import util"', async () => {
    mockMatches = relativeImportMatch(3, 'subpackage');
    const result = await scanDependencies('/test/workspace/app/module/mod.py', 'from ...subpackage import util', 'python');
    expect(result).toEqual(['subpackage']);
  });

  test('handles "from .. import util"', async () => {
    mockMatches = dotsImportMatch(2, 'util');
    const result = await scanDependencies('/test/workspace/app/mod.py', 'from .. import util', 'python');
    expect(result).toEqual(['util']);
  });
});
