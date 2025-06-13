# Matomeru

Combine and copy your entire codes into one LLM-ready Markdown / YAML.


<img src="images/icon.png" width="128" height="128" alt="Matomeru Icon">

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/romot-co.matomeru)](https://marketplace.visualstudio.com/items?itemName=romot.matomeru)

[English](#features) | [日本語](README.ja.md)

## Features

- **Generate Markdown documentation** for your directory structures and file contents
- **YAML Output**: Choose between Markdown and YAML for your output format via the `matomeru.outputFormat` setting.
- **Dependency Analysis & Visualization**: Scans import/dependency statements (for TypeScript/JavaScript, Python, Go) and generates a Mermaid flowchart in the Markdown output to visualize relationships when `matomeru.includeDependencies` is enabled.
- **Multi-root Workspace Support**: Process files from multiple workspace folders with proper context isolation
- **Automatically format and organize**:
  - Directory tree structure
  - Markdown-compatible output
- Support for multiple output formats:
  - Display in editor
  - Copy to clipboard
  - Send to ChatGPT (macOS only)
- **Git Diff Integration**:
  - Convert changed files (working tree vs HEAD) to Markdown with one click
  - Optional revision range support (e.g., `origin/main..HEAD`)
  - Direct access from Explorer and SCM context menus
- Customizable directory structure display:
  - Emoji icons for directories and files
  - Configurable indentation
  - Optional file extension display
- **Enhanced Code Compression**: Removes comments, unnecessary whitespace, and newlines using Tree-sitter to reduce context length for LLMs. (See Configuration section for details)
- Flexible file exclusion:
  - Configure custom patterns to exclude
  - Use .gitignore .vscodeignore patterns to automatically exclude files (optional)
  - Security-sensitive files are always excluded by default
- Localization support (English/Japanese)
- Estimate size before processing large projects
- **Memory-optimized YAML output**: Option to exclude file content in YAML format for large projects

## Installation

1. Install from VSCode Marketplace
2. Or download the `.vsix` file and install manually:
   ```bash
   code --install-extension matomeru-0.1.0.vsix
   ```

## Usage

1. Right-click on a directory or file in the explorer
2. Select one of the following options:
   - "Matomeru: Output to Editor"
   - "Matomeru: Copy to Clipboard" 
   - "Matomeru: Send to ChatGPT" (macOS only)
   - "Matomeru: Copy Git Diff"

### Keyboard Shortcuts

You can also use keyboard shortcuts for quick access:
- `Ctrl+Alt+C` / `Cmd+Alt+C` (Mac): Copy to Clipboard
- `Ctrl+Alt+D` / `Cmd+Alt+D` (Mac): Copy Git Diff
- `Ctrl+Alt+E` / `Cmd+Alt+E` (Mac): Output to Editor

These shortcuts can be customized in VS Code's Keyboard Shortcuts editor (`Ctrl+K Ctrl+S` / `Cmd+K Cmd+S` on Mac).

### Estimate Size

Before processing large projects, you can estimate the size of the output:
1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P` on Mac)
2. Run "Matomeru: Estimate Size"
3. Select the directories/files to estimate

This will display the total file count, size, and estimated token count.

## Configuration

**`matomeru.outputFormat`**: Specifies the output format for the generated document.
  - `"markdown"` (default): Outputs in Markdown format.
  - `"yaml"`: Outputs in YAML format.
  To change the output format, update this setting in your VS Code settings (JSON). For example, to switch to YAML:
  ```json
  "matomeru.outputFormat": "yaml"
  ```

**`matomeru.includeDependencies`**: (boolean, default: `false`) When set to `true`, Matomeru will scan for import/dependency statements in your files (supports TypeScript/JavaScript, Python, and Go). This information will be used to:
  - Include an `imports` list for each file in the YAML output.
  - Generate a Mermaid dependency graph at the beginning of the Markdown output.

**`matomeru.mermaid.maxNodes`**: (number, default: `300`) Specifies the maximum number of nodes to render in the Mermaid dependency graph. If the number of unique files and dependencies exceeds this limit, the graph will be truncated, and a warning message will be displayed.

<details>
<summary>Example settings.json (Click to expand)</summary>

```json
{
  "matomeru.outputFormat": "markdown",
  "matomeru.maxFileSize": 1048576,
  "matomeru.excludePatterns": [
    "node_modules/**",
    ".git/**",
    "dist/**",
    "build/**",
    "coverage/**",
    ".DS_Store",
    "Thumbs.db",
    "*.key",
    "*.env*",
    "package-lock.json"
  ],
  "matomeru.chatGptIntegration": false,
  "matomeru.directoryStructure.directoryIcon": "📁",
  "matomeru.directoryStructure.fileIcon": "📄",
  "matomeru.directoryStructure.indentSize": 2,
  "matomeru.directoryStructure.showFileExtensions": true,
  "matomeru.directoryStructure.useEmoji": true,
  "matomeru.prefixText": "",
  "matomeru.useGitignore": false,
  "matomeru.useVscodeignore": false,
  "matomeru.enableCompression": false,
  "matomeru.includeDependencies": false,
  "matomeru.mermaid.maxNodes": 300,
  "matomeru.gitDiff.range": "",
  "matomeru.yaml.includeContent": false
}
```
</details>

**Prefix Text**: The `matomeru.prefixText` setting allows you to add custom text at the beginning of the generated output. This is useful for adding project overviews, context, or instructions:
```json
"matomeru.prefixText": "# Project Overview\nThis is a TypeScript project for..."
```

**Git Diff Range**: When `matomeru.gitDiff.range` is set, Matomeru will use that revision range when collecting changed files. Example values:
- Empty string (default): Shows working tree changes compared to HEAD
- `"HEAD~3..HEAD"`: Shows changes in last 3 commits
- `"origin/main..HEAD"`: Shows changes between main branch and current HEAD

**Code Compression**: When `matomeru.enableCompression` is set to `true`, Matomeru removes comments, unnecessary whitespace, and newlines using Tree-sitter for the following languages, making the code more compact for LLMs while preserving syntax and functionality. (If parsing fails, the original code will be used.)

```txt
javascript, typescript, tsx, python, css, ruby, 
csharp, c, cpp, go, rust, java, ini, regex
```

**YAML Memory Optimization**: The `matomeru.yaml.includeContent` setting (default: `false`) controls whether file content is included in YAML output. For large projects, keeping this disabled prevents memory issues while still providing project structure and metadata.

**Note on Security**: By default, Matomeru automatically excludes sensitive files like secret keys, 
credentials, certificates, and environment files (`*.key`, `*.pem`, `*.env`, etc.) to prevent accidental 
inclusion of confidential information in the generated output. Additionally, many common non-source files
like lock files, cache directories, build artifacts, and temporary files are excluded by default.
These exclusions are part of the default configuration and will apply even if you customize the `excludePatterns` setting.

## Output Example

```markdown
# Project Overview
This is a sample project.

<!-- matomeru:auto-graph:start -->
```mermaid
flowchart TD
    "src/index.ts" --> "src/utils.ts"
    "src/index.ts" --> "external:lodash"
    "tests/index.test.ts" --> "src/index.ts"
```
<!-- matomeru:auto-graph:end -->
---

# Directory Structure
📁 src
  📄 index.ts
  📄 utils.ts
📁 tests
  📄 index.test.ts

# File Contents

## src/index.ts
- Size: 1.2 KB
- Language: TypeScript

```typescript
// ... file content ...
```

## src/utils.ts
...
```

## Requirements

- VSCode 1.96.0 or later
- For ChatGPT integration:
  - macOS
  - Google Chrome
  - ChatGPT account

## License

MIT License
