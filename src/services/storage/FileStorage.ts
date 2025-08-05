// ==========================================
// DISCUSIÓN ENTRE AGENTES
// ==========================================

/**
 * AGENTE 1 (Arquitectura):
 * "Necesitamos diseñar una arquitectura que separe responsabilidades.
 * Propongo una arquitectura en capas:
 * - Capa de Persistencia (manejo de archivos)
 * - Capa de Datos (operaciones CRUD)
 * - Capa de Interfaz (API pública)
 *
 * También necesitamos considerar:
 * - Manejo de concurrencia
 * - Transacciones básicas
 * - Validación de tipos con TypeScript
 * - Sistema de índices para búsquedas eficientes"
 */

/**
 * AGENTE 2 (Patrones de Diseño):
 * "Excelente arquitectura. Para implementarla sugiero estos patrones:
 * - Repository Pattern para abstraer el acceso a datos
 * - Singleton para garantizar una sola instancia de DB
 * - Observer Pattern para notificaciones de cambios
 * - Strategy Pattern para diferentes tipos de serialización
 * - Factory Pattern para crear diferentes tipos de colecciones
 *
 * También implementaré el patrón Unit of Work para transacciones."
 */

import * as fs from "fs";
import * as path from "path";

// ==========================================
// TIPOS E INTERFACES
// ==========================================

interface IEntity {
  id?: string | number;
  [key: string]: any;
}

interface IQueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface ITransaction {
  operations: Array<() => void>;
  rollback: Array<() => void>;
}

type SerializationStrategy = "json" | "pretty";

// ==========================================
// PATRÓN STRATEGY - Serialización
// ==========================================

interface ISerializationStrategy {
  serialize(data: any): string;
  deserialize(data: string): any;
}

class JsonStrategy implements ISerializationStrategy {
  serialize(data: any): string {
    return JSON.stringify(data);
  }

  deserialize(data: string): any {
    return JSON.parse(data);
  }
}

class PrettyJsonStrategy implements ISerializationStrategy {
  serialize(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  deserialize(data: string): any {
    return JSON.parse(data);
  }
}

// ==========================================
// PATRÓN OBSERVER - Notificaciones
// ==========================================

type EventType = "insert" | "update" | "delete" | "clear";

interface IObserver {
  update(event: EventType, collection: string, data?: any): void;
}

class DatabaseObserver {
  private observers: IObserver[] = [];

  subscribe(observer: IObserver): void {
    this.observers.push(observer);
  }

  unsubscribe(observer: IObserver): void {
    const index = this.observers.indexOf(observer);
    if (index > -1) {
      this.observers.splice(index, 1);
    }
  }

  notify(event: EventType, collection: string, data?: any): void {
    this.observers.forEach((observer) =>
      observer.update(event, collection, data),
    );
  }
}

// ==========================================
// PATRÓN REPOSITORY - Acceso a Datos
// ==========================================

class Collection<T extends IEntity> {
  private data: T[] = [];
  private nextId: number = 1;
  private indexes: Map<string, Map<any, T[]>> = new Map();

  constructor(
    private name: string,
    private observer: DatabaseObserver,
    initialData: T[] = [],
  ) {
    this.data = initialData;
    this.nextId = this.getMaxId() + 1;
  }

  private getMaxId(): number {
    return this.data.reduce((max, item) => {
      const id = typeof item.id === "number" ? item.id : 0;
      return Math.max(max, id);
    }, 0);
  }

  // CRUD Operations
  insert(item: Omit<T, "id">): T {
    const newItem = { ...item, id: this.nextId++ } as T;
    this.data.push(newItem);
    this.updateIndexes(newItem);
    this.observer.notify("insert", this.name, newItem);
    return newItem;
  }

  findById(id: string | number): T | undefined {
    return this.data.find((item) => item.id === id);
  }

  findAll(options: IQueryOptions = {}): T[] {
    let result = [...this.data];

    // Sorting
    if (options.sortBy) {
      result.sort((a, b) => {
        const aVal = a[options.sortBy!];
        const bVal = b[options.sortBy!];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return options.sortOrder === "desc" ? -comparison : comparison;
      });
    }

    // Pagination
    const start = options.offset || 0;
    const end = options.limit ? start + options.limit : undefined;
    return result.slice(start, end);
  }

  findBy(predicate: (item: T) => boolean): T[] {
    return this.data.filter(predicate);
  }

  update(id: string | number, updates: Partial<T>): T | undefined {
    const index = this.data.findIndex((item) => item.id === id);
    if (index === -1) return undefined;

    const oldItem = this.data[index];
    const updatedItem = { ...oldItem, ...updates, id } as T;
    this.data[index] = updatedItem;

    this.updateIndexes(updatedItem);
    this.observer.notify("update", this.name, updatedItem);
    return updatedItem;
  }

  delete(id: string | number): boolean {
    const index = this.data.findIndex((item) => item.id === id);
    if (index === -1) return false;

    const deletedItem = this.data[index];
    this.data.splice(index, 1);
    this.observer.notify("delete", this.name, deletedItem);
    return true;
  }

  clear(): void {
    this.data = [];
    this.indexes.clear();
    this.nextId = 1;
    this.observer.notify("clear", this.name);
  }

  count(): number {
    return this.data.length;
  }

  // Sistema de índices básico
  private updateIndexes(item: T): void {
    // Implementación básica - en producción se podría extender
    for (const [field, indexMap] of this.indexes) {
      const value = item[field];
      if (!indexMap.has(value)) {
        indexMap.set(value, []);
      }
      const items = indexMap.get(value)!;
      const existingIndex = items.findIndex((i) => i.id === item.id);
      if (existingIndex >= 0) {
        items[existingIndex] = item;
      } else {
        items.push(item);
      }
    }
  }

  // Método interno para obtener datos
  getData(): T[] {
    return [...this.data];
  }

  // Método interno para establecer datos
  setData(data: T[]): void {
    this.data = data;
    this.nextId = this.getMaxId() + 1;
  }
}

// ==========================================
// PATRÓN SINGLETON + UNIT OF WORK - Base de Datos Principal
// ==========================================

class FileDatabase {
  private static instance: FileDatabase;
  private collections: Map<string, Collection<any>> = new Map();
  private filePath: string;
  private observer: DatabaseObserver = new DatabaseObserver();
  private serializationStrategy: ISerializationStrategy;
  private currentTransaction: ITransaction | null = null;

  private constructor(
    filePath: string,
    strategy: SerializationStrategy = "json",
  ) {
    this.filePath = path.resolve(filePath);
    this.serializationStrategy = this.createSerializationStrategy(strategy);
    this.loadFromFile();
  }

  // Patrón Singleton
  public static getInstance(
    filePath?: string,
    strategy?: SerializationStrategy,
  ): FileDatabase {
    if (!FileDatabase.instance) {
      if (!filePath) {
        throw new Error("FilePath is required for first initialization");
      }
      FileDatabase.instance = new FileDatabase(filePath, strategy);
    }
    return FileDatabase.instance;
  }

  // Factory Method para estrategias de serialización
  private createSerializationStrategy(
    strategy: SerializationStrategy,
  ): ISerializationStrategy {
    switch (strategy) {
      case "json":
        return new JsonStrategy();
      case "pretty":
        return new PrettyJsonStrategy();
      default:
        return new JsonStrategy();
    }
  }

  // Factory Method para colecciones
  collection<T extends IEntity>(name: string): Collection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Collection<T>(name, this.observer));
    }
    return this.collections.get(name)!;
  }

  // Sistema de transacciones básico (Unit of Work)
  beginTransaction(): void {
    if (this.currentTransaction) {
      throw new Error("Transaction already in progress");
    }

    this.currentTransaction = {
      operations: [],
      rollback: [],
    };
  }

  commit(): void {
    if (!this.currentTransaction) {
      throw new Error("No transaction in progress");
    }

    try {
      // Ejecutar todas las operaciones
      this.currentTransaction.operations.forEach((op) => op());
      this.saveToFile();
      this.currentTransaction = null;
    } catch (error: any) {
      this.rollback();
      throw error;
    }
  }

  rollback(): void {
    if (!this.currentTransaction) {
      throw new Error("No transaction in progress");
    }

    // Ejecutar operaciones de rollback en orden inverso
    this.currentTransaction.rollback.reverse().forEach((op) => op());
    this.currentTransaction = null;
  }

  // Persistencia
  private loadFromFile(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, "utf8");
        if (fileContent.trim()) {
          const data = this.serializationStrategy.deserialize(fileContent);

          // Restaurar colecciones
          for (const [name, collectionData] of Object.entries(data)) {
            const collection = new Collection<any>(
              name,
              this.observer,
              collectionData as any[],
            );
            this.collections.set(name, collection);
          }
        }
      }
    } catch (error: any) {
      console.error("Error loading database:", error);
      // Continuar con base de datos vacía
    }
  }

  saveToFile(): void {
    try {
      const data: Record<string, any[]> = {};

      // Serializar todas las colecciones
      for (const [name, collection] of this.collections) {
        data[name] = collection.getData();
      }

      const serializedData = this.serializationStrategy.serialize(data);
      fs.writeFileSync(this.filePath, serializedData, "utf8");
    } catch (error: any) {
      console.error("Error saving database:", error);
      throw error;
    }
  }

  // Métodos de utilidad
  getCollectionNames(): string[] {
    return Array.from(this.collections.keys());
  }

  dropCollection(name: string): boolean {
    if (this.collections.has(name)) {
      this.collections.delete(name);
      this.saveToFile();
      return true;
    }
    return false;
  }

  // Observer pattern
  subscribe(observer: IObserver): void {
    this.observer.subscribe(observer);
  }

  unsubscribe(observer: IObserver): void {
    this.observer.unsubscribe(observer);
  }

  // Método para cambiar estrategia de serialización
  setSerializationStrategy(strategy: SerializationStrategy): void {
    this.serializationStrategy = this.createSerializationStrategy(strategy);
  }
}

/*
// ==========================================
// EJEMPLO DE USO
// ==========================================

// Definir tipos para nuestras entidades
interface User extends IEntity {
    name: string;
    email: string;
    age: number;
}

interface Product extends IEntity {
    name: string;
    price: number;
    category: string;
}

// Ejemplo de observer personalizado
class LogObserver implements IObserver {
    update(event: EventType, collection: string, data?: any): void {
        console.log(`[${new Date().toISOString()}] ${event.toUpperCase()} in ${collection}:`, data?.id || 'bulk operation');
    }
}

// Función de ejemplo de uso
function exampleUsage() {
    // Inicializar base de datos
    const db = FileDatabase.getInstance('./data.json', 'pretty');

    // Suscribir observer
    const logger = new LogObserver();
    db.subscribe(logger);

    // Obtener colecciones
    const users = db.collection<User>('users');
    const products = db.collection<Product>('products');

    // Operaciones CRUD
    const user1 = users.insert({ name: 'Juan Pérez', email: 'juan@email.com', age: 30 });
    const user2 = users.insert({ name: 'María García', email: 'maria@email.com', age: 25 });

    const product1 = products.insert({ name: 'Laptop', price: 999.99, category: 'Electronics' });

    // Búsquedas
    const allUsers = users.findAll({ sortBy: 'name', limit: 10 });
    const youngUsers = users.findBy(user => user.age < 30);
    const specificUser = users.findById(user1.id!);

    // Actualización
    users.update(user1.id!, { age: 31 });

    // Transacciones
    try {
        db.beginTransaction();

        users.insert({ name: 'Carlos López', email: 'carlos@email.com', age: 35 });
        products.insert({ name: 'Mouse', price: 29.99, category: 'Electronics' });

        db.commit(); // Guarda todos los cambios
    } catch (error: any) {
        db.rollback(); // Deshace todos los cambios
    }

    // Guardar cambios
    db.saveToFile();

    console.log('Users:', users.findAll());
    console.log('Products:', products.findAll());
    console.log('Total users:', users.count());
}
*/

export {
  FileDatabase,
  Collection,
  IEntity,
  IQueryOptions,
  IObserver,
  EventType,
  SerializationStrategy,
};
