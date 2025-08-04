import fs from 'fs';
import path from 'path';

class PersistenceManager {
    private storagePath: string;

    constructor(storagePath: string) {
        this.storagePath = storagePath;
        if (!fs.existsSync(storagePath)) {
            fs.mkdirSync(storagePath, { recursive: true });
        }
    }

    saveData(fileName: string, data: any): void {
        const filePath = path.join(this.storagePath, fileName);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
        console.log(`Data saved to ${filePath}`);
    }

    loadData(fileName: string): any {
        const filePath = path.join(this.storagePath, fileName);
        if (fs.existsSync(filePath)) {
            const rawData = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(rawData);
        }
        console.log(`No data found at ${filePath}`);
        return null;
    }

    deleteData(fileName: string): void {
        const filePath = path.join(this.storagePath, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Data deleted from ${filePath}`);
        }
    }
}

export { PersistenceManager };
