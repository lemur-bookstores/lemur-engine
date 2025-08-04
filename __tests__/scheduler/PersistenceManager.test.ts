import fs from 'fs';
import path from 'path';
import { PersistenceManager } from '../../src/scheduler/PersistenceManager';

describe('PersistenceManager', () => {
    const testStoragePath = path.join(__dirname, 'test-storage');
    const persistenceManager = new PersistenceManager(testStoragePath);

    afterAll(() => {
        // Cleanup test storage directory
        if (fs.existsSync(testStoragePath)) {
            fs.rmSync(testStoragePath, { recursive: true, force: true });
        }
    });

    test('should save data to a file', () => {
        const testData = { key: 'value' };
        const fileName = 'test.json';

        persistenceManager.saveData(fileName, testData);

        const filePath = path.join(testStoragePath, fileName);
        expect(fs.existsSync(filePath)).toBe(true);

        const savedData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        expect(savedData).toEqual(testData);
    });

    test('should load data from a file', () => {
        const testData = { key: 'value' };
        const fileName = 'test.json';

        persistenceManager.saveData(fileName, testData);
        const loadedData = persistenceManager.loadData(fileName);

        expect(loadedData).toEqual(testData);
    });

    test('should delete a file', () => {
        const fileName = 'test.json';
        const filePath = path.join(testStoragePath, fileName);

        persistenceManager.saveData(fileName, { key: 'value' });
        expect(fs.existsSync(filePath)).toBe(true);

        persistenceManager.deleteData(fileName);
        expect(fs.existsSync(filePath)).toBe(false);
    });
});
