import * as vscode from 'vscode';
import { DirectoryInfo } from '../types/fileTypes';
import { IGenerator } from './IGenerator';
import yaml from 'js-yaml';

export class YamlGenerator implements IGenerator {
  async generate(dirs: DirectoryInfo[]): Promise<string> {
    const obj: any = {};
    const cfg = vscode.workspace.getConfiguration('matomeru');
    const prefix = cfg.get<string>('prefixText')?.trim();
    if (prefix) {
      obj.project_overview = prefix;
    }

    obj.directory_structure = {};
    obj.files = [];

    const allFilesForDependencies: {path: string, imports?: string[]}[] = [];

    if (dirs.length > 0) {
        obj.directory_structure = this.buildTree(dirs, cfg);
        obj.files = this.buildFiles(dirs, cfg, allFilesForDependencies);
    }

    const includeDependencies = cfg.get<boolean>('includeDependencies');
    if (includeDependencies) {
      obj.dependencies = {};
      for (const file of allFilesForDependencies) {
        if (file.imports && file.imports.length > 0) {
          obj.dependencies[file.path] = file.imports;
        }
      }
      // DirectoryInfo.imports の処理 (指示書 4-1 に基づく)。
      // 現状では DirectoryInfo.imports は fileOperations で設定されていないため、
      // ここではプレースホルダーとしてコメントアウトしておく。
      // 必要に応じて、DirectoryInfo の imports をどのように集約・表現するかを定義し、
      // fileOperations で設定するロジックと合わせて実装する。
      // dirs.forEach(dir => {
      //   if (dir.imports && dir.imports.length > 0) {
      //     // ディレクトリの代表パス（例：dir.relativePath）をキーとするか検討
      //     // obj.dependencies[`${dir.relativePath}/ (dir)`] = dir.imports; 
      //   }
      // });
    }
    
    // yaml.dump の indent オプションは期待通りにキーのインデントを行わないため、一旦削除しデフォルトの挙動とする。
    // 必要であればテスト段階で出力形式を確認し調整する。
    return yaml.dump(obj, { lineWidth: 120 }); 
  }

  private buildTree(dirs: DirectoryInfo[], _cfg: vscode.WorkspaceConfiguration): any {
    const root: any = {};

    // Helper function to recursively build the directory structure.
    // In YAML, files under a directory can be represented as keys with null values (or other markers).
    // Directories are keys pesquisas to nested objects.
    function mapDirectory(dirInfo: DirectoryInfo, currentLevel: any) {
        // Add files to the current directory level
        for (const file of dirInfo.files) {
            const fileName = file.relativePath.split('/').pop() || file.relativePath; // Get base name
            currentLevel[fileName] = null; // Represent file as a key with null value
        }

        // Recursively add subdirectories
        for (const [name, subDir] of dirInfo.directories) {
            currentLevel[name] = {}; // Create a new object for the subdirectory
            mapDirectory(subDir, currentLevel[name]);
        }
    }

    // Handle multiple root directories or a single root directory
    if (dirs.length === 1 && (dirs[0].relativePath === '.' || dirs[0].relativePath === '')) {
        // If there's one root dir, and it's the current workspace root, expand its contents directly.
        mapDirectory(dirs[0], root);
    } else {
        // If multiple dirs, or a single dir not at root, nest them under their relativePaths.
        for (const dir of dirs) {
            const dirName = dir.relativePath || 'unknown_directory'; // Fallback name
            root[dirName] = {};
            mapDirectory(dir, root[dirName]);
        }
    }
    return root;
  }

  private buildFiles(dirs: DirectoryInfo[], cfg: vscode.WorkspaceConfiguration, allFilesCollector?: {path: string, imports?: string[]}[]): any[] {
    const filesData: any[] = [];
    const maxFileSize = cfg.get<number>('maxFileSize'); // In Bytes
    const includeDependencies = cfg.get<boolean>('includeDependencies');

    const collectFilesRecursively = (dirInfo: DirectoryInfo) => {
        for (const file of dirInfo.files) {
            if (maxFileSize !== undefined && file.size > maxFileSize) {
                continue; // Skip large files
            }
            const fileEntry: any = {
                path: file.relativePath,
                size: file.size, 
                language: file.language,
                content: file.content,
            };
            if (includeDependencies && file.imports) {
                fileEntry.imports = file.imports;
            }
            filesData.push(fileEntry);
            if (allFilesCollector && file.imports && file.imports.length > 0) {
              allFilesCollector.push({ path: file.relativePath, imports: file.imports });
            }
        }
        for (const subDir of dirInfo.directories.values()) {
            collectFilesRecursively(subDir);
        }
    };

    dirs.forEach(collectFilesRecursively);
    return filesData.sort((a, b) => a.path.localeCompare(b.path));
  }
} 