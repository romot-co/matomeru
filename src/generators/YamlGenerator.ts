import * as vscode from 'vscode';
import { DirectoryInfo } from '../types/fileTypes';
import { IGenerator } from './IGenerator';
import yaml from 'js-yaml';
import { stripComments, minifyJsTsRuntimeEquivalent } from '../utils/compressUtils';
import { getExtensionContext } from '../extension';
import { Logger } from '../utils/logger';

const logger = Logger.getInstance('YamlGenerator');

export class YamlGenerator implements IGenerator {
  async generate(dirs: DirectoryInfo[], options?: { compression?: boolean }): Promise<string> {
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
        obj.files = await this.buildFiles(dirs, cfg, allFilesForDependencies, options?.compression || false);
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

    const mapDirectory = (dirInfo: DirectoryInfo, currentLevel: any) => {
        for (const file of dirInfo.files) {
            const fileName = file.relativePath.split('/').pop() || file.relativePath;
            currentLevel[fileName] = null;
        }

        for (const [name, subDir] of dirInfo.directories) {
            if (!currentLevel[name]) {
                currentLevel[name] = {};
            }
            mapDirectory(subDir, currentLevel[name]);
        }
    };

    const insertDirectory = (dir: DirectoryInfo) => {
        const relativePath = dir.relativePath;
        const parts = relativePath && relativePath !== '.' ? relativePath.split('/').filter(Boolean) : [];
        let currentLevel = root;

        for (const part of parts) {
            if (!currentLevel[part]) {
                currentLevel[part] = {};
            }
            currentLevel = currentLevel[part];
        }

        mapDirectory(dir, currentLevel);
    };

    dirs.forEach(insertDirectory);
    return root;
  }

  private async buildFiles(dirs: DirectoryInfo[], cfg: vscode.WorkspaceConfiguration, allFilesCollector?: {path: string, imports?: string[]}[], useCompression: boolean = false): Promise<any[]> {
    const filesData: any[] = [];
    const maxFileSize = cfg.get<number>('maxFileSize'); // In Bytes
    const includeDependencies = cfg.get<boolean>('includeDependencies');
    const includeContent = cfg.get<boolean>('yaml.includeContent', false);

    const collectFilesRecursively = async (dirInfo: DirectoryInfo) => {
        for (const file of dirInfo.files) {
            if (maxFileSize !== undefined && file.size > maxFileSize) {
                continue; // Skip large files
            }
            const fileEntry: any = {
                path: file.relativePath,
                size: file.size, 
                language: file.language,
            };
            if (includeContent) {
                let content = file.content;
                if (useCompression) {
                    try {
                        const ctx = getExtensionContext();
                        const enableStripTypes = cfg.get<boolean>('enableStripTypes', false);
                        content = await stripComments(file.content, file.language, ctx, {
                            stripTypes: enableStripTypes
                        });
                        
                        if (content !== file.content) {
                            logger.info(`Compressed content for ${file.relativePath}`);
                        }

                        if (cfg.get<boolean>('enableMinifyIdentifiers', false)) {
                            const minified = await minifyJsTsRuntimeEquivalent(content, file.language);
                            if (minified && minified.length <= content.length) {
                                if (minified !== content) {
                                    logger.info(`Minified identifiers for ${file.relativePath}`);
                                }
                                content = minified;
                            }
                        }
                    } catch (error) {
                        logger.error(`Failed to compress content: ${error}`);
                    }
                }
                fileEntry.content = content;
            }
            if (includeDependencies && file.imports) {
                fileEntry.imports = file.imports;
            }
            filesData.push(fileEntry);
            if (allFilesCollector && file.imports && file.imports.length > 0) {
              allFilesCollector.push({ path: file.relativePath, imports: file.imports });
            }
        }
        for (const subDir of dirInfo.directories.values()) {
            await collectFilesRecursively(subDir);
        }
    };

    for (const dir of dirs) {
        await collectFilesRecursively(dir);
    }
    return filesData.sort((a, b) => a.path.localeCompare(b.path));
  }
} 
