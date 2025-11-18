import type { ExtensionContext } from 'vscode';
import { ParserManager } from '../services/parserManager';
import { Logger } from './logger';
import type { Tree as WebTreeSitterTree } from 'web-tree-sitter';

const logger = Logger.getInstance('DiffContextExtractor');

type WebTreeSitterSyntaxNode = WebTreeSitterTree['rootNode'];
type Range = { start: number; end: number };

const DEFAULT_NODE_TYPES = [
  'function_declaration',
  'method_definition',
  'class_declaration',
  'function_definition',
  'class_definition'
];

const LANGUAGE_NODE_MAP: Record<string, string[]> = {
  javascript: [
    'function_declaration',
    'method_definition',
    'class_declaration',
    'lexical_declaration',
    'variable_declaration',
    'arrow_function',
    'generator_function'
  ],
  typescript: [
    'function_declaration',
    'method_definition',
    'class_declaration',
    'lexical_declaration',
    'variable_declaration',
    'interface_declaration'
  ],
  tsx: [
    'function_declaration',
    'method_definition',
    'class_declaration'
  ],
  python: [
    'function_definition',
    'class_definition'
  ],
  go: [
    'function_declaration',
    'method_declaration'
  ],
  java: [
    'method_declaration',
    'constructor_declaration',
    'class_declaration'
  ],
  csharp: [
    'method_declaration',
    'class_declaration'
  ]
};

export async function extractChangedCodeByFunction(options: {
  code: string;
  languageId: string;
  changedLineNumbers: Set<number>; // 1-based
  contextLines: number;
  ctx: ExtensionContext;
}): Promise<string | undefined> {
  const { code, languageId, changedLineNumbers, contextLines, ctx } = options;
  if (!code || changedLineNumbers.size === 0) {
    return undefined;
  }

  const zeroBasedLines = normalizeChangedLines(changedLineNumbers);
  if (zeroBasedLines.size === 0) {
    return undefined;
  }

  try {
    const parser = await ParserManager.getInstance(ctx).getParser(languageId);
    if (!parser) {
      return buildLineContextFallback(code, zeroBasedLines, contextLines);
    }

    const tree = parser.parse(code);
    if (!tree) {
      return buildLineContextFallback(code, zeroBasedLines, contextLines);
    }

    const nodeTypes = resolveNodeTypes(languageId);
    const nodeRanges = collectNodeRanges(tree.rootNode, nodeTypes, zeroBasedLines, code, contextLines);
    const rangesToUse = nodeRanges.length > 0
      ? nodeRanges
      : buildLineRangesFromChangedLines(zeroBasedLines, code, contextLines);

    if (!rangesToUse.length) {
      return undefined;
    }

    const merged = mergeRanges(rangesToUse);
    const snippets = merged.map(range => code.slice(range.start, range.end).trimEnd());
    const combined = snippets.join('\n\n').trim();
    return combined || undefined;
  } catch (error) {
    logger.warn(`Failed to extract diff-aware context: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

function resolveNodeTypes(languageId: string): string[] {
  const normalized = languageId.toLowerCase();
  return LANGUAGE_NODE_MAP[normalized] ?? DEFAULT_NODE_TYPES;
}

function collectNodeRanges(
  root: WebTreeSitterSyntaxNode,
  nodeTypes: string[],
  changedLines: Set<number>,
  code: string,
  contextLines: number
): Range[] {
  const candidates = root.descendantsOfType(nodeTypes);
  const lineStarts = computeLineStartIndexes(code);
  const lastRow = Math.max(0, lineStarts.length - 2);

  const ranges: Range[] = [];
  for (const node of candidates) {
    if (!node || !node.startPosition || !node.endPosition) {
      continue;
    }
    const startRow = node.startPosition.row;
    const endRow = node.endPosition.row;
    if (!touchesChangedRow(startRow, endRow, changedLines)) {
      continue;
    }
    const expandedStartRow = Math.max(0, startRow - contextLines);
    const expandedEndRow = Math.min(lastRow, endRow + contextLines);
    ranges.push({
      start: lineStarts[expandedStartRow],
      end: getRowEndIndex(expandedEndRow, lineStarts, code.length)
    });
  }

  return ranges;
}

function touchesChangedRow(startRow: number, endRow: number, changedLines: Set<number>): boolean {
  for (let row = startRow; row <= endRow; row++) {
    if (changedLines.has(row)) {
      return true;
    }
  }
  return false;
}

function computeLineStartIndexes(code: string): number[] {
  const indices = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') {
      indices.push(i + 1);
    }
  }
  indices.push(code.length);
  return indices;
}

function getRowEndIndex(row: number, lineStarts: number[], codeLength: number): number {
  const nextStart = lineStarts[row + 1];
  return nextStart !== undefined ? nextStart : codeLength;
}

function mergeRanges(ranges: Range[]): Range[] {
  if (!ranges.length) {
    return [];
  }

  const sorted = ranges.slice().sort((a, b) => a.start - b.start);
  const merged: Range[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

function buildLineRangesFromChangedLines(
  changedLines: Set<number>,
  code: string,
  contextLines: number
): Range[] {
  if (!changedLines.size) {
    return [];
  }

  const lineStarts = computeLineStartIndexes(code);
  const sortedLines = Array.from(changedLines).sort((a, b) => a - b);
  const lineBlocks: { startRow: number; endRow: number }[] = [];

  let blockStart = sortedLines[0];
  let blockEnd = sortedLines[0];
  for (let i = 1; i < sortedLines.length; i++) {
    const line = sortedLines[i];
    if (line === blockEnd + 1) {
      blockEnd = line;
    } else {
      lineBlocks.push({ startRow: blockStart, endRow: blockEnd });
      blockStart = line;
      blockEnd = line;
    }
  }
  lineBlocks.push({ startRow: blockStart, endRow: blockEnd });

  const lastRowIndex = Math.max(0, lineStarts.length - 2);
  return lineBlocks.map(block => {
    const startRow = Math.max(0, block.startRow - contextLines);
    const endRow = Math.min(lastRowIndex, block.endRow + contextLines);
    return {
      start: lineStarts[startRow],
      end: getRowEndIndex(endRow, lineStarts, code.length)
    };
  });
}

function buildLineContextFallback(
  code: string,
  changedLines: Set<number>,
  contextLines: number
): string | undefined {
  const ranges = buildLineRangesFromChangedLines(changedLines, code, contextLines);
  if (!ranges.length) {
    return undefined;
  }
  const snippets = ranges.map(range => code.slice(range.start, range.end).trimEnd());
  return snippets.join('\n\n').trim() || undefined;
}

function normalizeChangedLines(lines: Set<number>): Set<number> {
  const result = new Set<number>();
  lines.forEach(line => {
    if (line > 0) {
      result.add(line - 1);
    }
  });
  return result;
}
