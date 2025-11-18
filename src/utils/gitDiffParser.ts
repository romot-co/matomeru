export function parseUnifiedDiff(diffText: string): Map<string, Set<number>> {
  const fileMap = new Map<string, Set<number>>();
  let currentFile: string | null = null;

  const lines = diffText.split(/\r?\n/);
  for (const line of lines) {
    if (line.startsWith('diff --git')) {
      currentFile = null;
      continue;
    }

    if (line.startsWith('+++ ')) {
      const fileLabel = line.slice(4).trim();
      if (fileLabel === '/dev/null') {
        currentFile = null;
        continue;
      }
      currentFile = normalizeDiffPath(fileLabel);
      continue;
    }

    if (!currentFile || !line.startsWith('@@')) {
      continue;
    }

    const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!match) {
      continue;
    }

    const startLine = parseInt(match[1], 10);
    const length = match[2] ? parseInt(match[2], 10) : 1;
    if (Number.isNaN(startLine) || Number.isNaN(length) || length === 0) {
      continue;
    }

    const existing = ensureFileEntry(fileMap, currentFile);
    for (let i = 0; i < length; i++) {
      existing.add(startLine + i);
    }
  }

  return fileMap;
}

function ensureFileEntry(map: Map<string, Set<number>>, filePath: string): Set<number> {
  if (!map.has(filePath)) {
    map.set(filePath, new Set());
  }
  return map.get(filePath)!;
}

function normalizeDiffPath(rawPath: string): string {
  const cleaned = rawPath.replace(/^["']|["']$/g, '');
  if (cleaned.startsWith('a/') || cleaned.startsWith('b/')) {
    return cleaned.slice(2);
  }
  return cleaned;
}
