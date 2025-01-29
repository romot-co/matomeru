import { BaseError } from '@/shared/errors/base/BaseError';

export class ScanError extends BaseError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'ScanError', details);
    }
} 