import { DirectoryInfo } from '../types/fileTypes';

export interface IGenerator {
  generate(dirs: DirectoryInfo[], options?: { compression?: boolean }): Promise<string>;
} 