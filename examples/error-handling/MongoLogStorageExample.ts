import { LogEntry, LogStorage } from '../../src/core/interfaces/storage';
import { MongoClient, Collection } from 'mongodb';

/**
 * Ejemplo de implementación de LogStorage para MongoDB
 */
export class MongoLogStorage implements LogStorage {
    private collection: Collection;

    constructor(private mongoUrl: string, private dbName: string, private collectionName: string) { }

    async initialize(): Promise<void> {
        const client = await MongoClient.connect(this.mongoUrl);
        const db = client.db(this.dbName);
        this.collection = db.collection(this.collectionName);
    }

    async save(entry: LogEntry): Promise<void> {
        if (!this.collection) {
            throw new Error('MongoDB not initialized. Call initialize() first.');
        }

        await this.collection.insertOne({
            ...entry,
            timestamp: entry.timestamp,
            created_at: new Date()
        });
    }
}

/**
 * Ejemplo de uso:
 * 
 * const mongoStorage = new MongoLogStorage(
 *     'mongodb://localhost:27017',
 *     'kernel_logs',
 *     'error_logs'
 * );
 * await mongoStorage.initialize();
 * 
 * const logHandler = new LogErrorHandler(mongoStorage);
 * kernel.errorHandler.registerHandler(logHandler);
 */
