export class ScanError extends Error {
    constructor(
        public readonly path: string,
        message: string
    ) {
        super(`[SCAN_ERROR] ${message}`);
        this.name = 'ScanError';
    }
} 