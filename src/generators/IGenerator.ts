import { DirectoryInfo } from '../types/fileTypes';

export interface IGenerator {
  generate(dirs: DirectoryInfo[]): Promise<string>;
} 