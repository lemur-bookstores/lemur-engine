import { LogEntry, LogStorage } from '../../src/core/interfaces/storage';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

/**
 * Ejemplo de implementación de LogStorage para Amazon S3
 */
export class S3LogStorage implements LogStorage {
    private s3Client: S3Client;

    constructor(
        private bucket: string,
        private prefix: string = 'kernel-logs/',
        region: string = 'us-east-1'
    ) {
        this.s3Client = new S3Client({ region });
    }

    async save(entry: LogEntry): Promise<void> {
        const date = entry.timestamp.toISOString().split('T')[0];
        const key = `${this.prefix}${date}/${entry.timestamp.toISOString()}-${crypto.randomUUID()}.json`;

        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: JSON.stringify(entry, null, 2),
            ContentType: 'application/json'
        });

        await this.s3Client.send(command);
    }
}

/**
 * Ejemplo de uso:
 * 
 * const s3Storage = new S3LogStorage(
 *     'my-kernel-logs-bucket',
 *     'production/errors/',
 *     'us-west-2'
 * );
 * 
 * const logHandler = new LogErrorHandler(s3Storage);
 * kernel.errorHandler.registerHandler(logHandler);
 */
