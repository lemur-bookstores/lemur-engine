// ==========================================
// DISCUSIÓN ENTRE AGENTES PARA IN-MEMORY DB
// ==========================================

/**
 * AGENTE 1 (Arquitectura):
 * "Para la versión en memoria, mantendremos la misma arquitectura en capas pero
 * optimizaremos para rendimiento en RAM:
 * - Eliminaremos la capa de persistencia en disco
 * - Añadiremos caché inteligente con LRU
 * - Implementaremos índices avanzados (B-Tree simulado con Map)
 * - Sistema de snapshots para backup en memoria
 * - Pool de conexiones para operaciones concurrentes
 * - Estadísticas de rendimiento en tiempo real"
 */

/**
 * AGENTE 2 (Patrones de Diseño):
 * "Excelente arquitectura. Para la versión en memoria aplicaremos:
 * - Flyweight Pattern para optimizar memoria compartida
 * - Command Pattern para operaciones reversibles (undo/redo)
 * - Memento Pattern para snapshots
 * - Chain of Responsibility para validaciones
 * - Decorator Pattern para operaciones con caché
 * - Template Method para diferentes tipos de índices
 *
 * También implementaremos el patrón Object Pool para reutilización de objetos."
 */

// ==========================================
// TIPOS E INTERFACES MEJORADAS
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
  useIndex?: boolean;
}

interface IAdvancedQueryOptions extends IQueryOptions {
  select?: string[];
  distinct?: boolean;
  groupBy?: string;
}

interface ICacheConfig {
  maxSize: number;
  ttl?: number; // Time to live in milliseconds
  strategy: "lru" | "fifo" | "lfu";
}

interface IIndexConfig {
  field: string;
  type: "hash" | "btree" | "unique";
  sparse?: boolean;
}

interface IDatabaseStats {
  collections: number;
  totalRecords: number;
  memoryUsage: number;
  queryCount: number;
  cacheHits: number;
  cacheMisses: number;
}

interface ISnapshot {
  id: string;
  timestamp: Date;
  collections: Map<string, any[]>;
  metadata: {
    version: string;
    description?: string;
  };
}

interface IGlobalStats {
  startTime: number;
  totalQueries: number;
  totalCacheHits: number;
  totalCacheMisses: number;
}

// ==========================================
// PATRÓN FLYWEIGHT - Optimización de Memoria
// ==========================================

class FieldValueFlyweight {
  private static instances = new Map<string, FieldValueFlyweight>();

  private constructor(private value: any) {}

  static getInstance(value: any): FieldValueFlyweight {
    const key = JSON.stringify(value);
    if (!this.instances.has(key)) {
      this.instances.set(key, new FieldValueFlyweight(value));
    }
    return this.instances.get(key)!;
  }

  getValue(): any {
    return this.value;
  }
}

// ==========================================
// PATRÓN COMMAND - Operaciones Reversibles
// ==========================================

interface ICommand<T> {
  execute(): T;
  undo(): void;
  redo(): void;
}

class InsertCommand<T extends IEntity> implements ICommand<T> {
  private insertedItem?: T;

  constructor(
    private collection: InMemoryCollection<T>,
    private item: Omit<T, "id">,
  ) {}

  execute(): T {
    this.insertedItem = this.collection.directInsert(this.item);
    return this.insertedItem;
  }

  undo(): void {
    if (this.insertedItem) {
      this.collection.directDelete(this.insertedItem.id!);
    }
  }

  redo(): void {
    if (this.insertedItem) {
      this.collection.directInsert(this.insertedItem);
    }
  }
}

class UpdateCommand<T extends IEntity> implements ICommand<T> {
  private oldItem?: T;
  private newItem?: T;

  constructor(
    private collection: InMemoryCollection<T>,
    private id: string | number,
    private updates: Partial<T>,
  ) {}

  execute(): T {
    this.oldItem = this.collection.directFindById(this.id);
    if (!this.oldItem) throw new Error("Item not found");

    this.newItem = this.collection.directUpdate(this.id, this.updates);
    return this.newItem!;
  }

  undo(): void {
    if (this.oldItem) {
      this.collection.directUpdate(this.id, this.oldItem);
    }
  }

  redo(): void {
    if (this.newItem) {
      this.collection.directUpdate(this.id, this.updates);
    }
  }
}

// ==========================================
// PATRÓN MEMENTO - Snapshots
// ==========================================

class DatabaseMemento {
  private snapshots: Map<string, ISnapshot> = new Map();

  createSnapshot(
    collections: Map<string, InMemoryCollection<any>>,
    description?: string,
  ): string {
    const id = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const collectionsData = new Map<string, any[]>();

    for (const [name, collection] of collections) {
      collectionsData.set(name, collection.getData());
    }

    const snapshot: ISnapshot = {
      id,
      timestamp: new Date(),
      collections: collectionsData,
      metadata: {
        version: "1.0.0",
        description,
      },
    };

    this.snapshots.set(id, snapshot);
    return id;
  }

  restoreSnapshot(id: string): ISnapshot | null {
    return this.snapshots.get(id) || null;
  }

  listSnapshots(): ISnapshot[] {
    return Array.from(this.snapshots.values());
  }

  deleteSnapshot(id: string): boolean {
    return this.snapshots.delete(id);
  }
}

// ==========================================
// SISTEMA DE CACHÉ AVANZADO
// ==========================================

class LRUCache<T> {
  private cache = new Map<string, { value: T; timestamp: number }>();
  private accessOrder: string[] = [];

  constructor(
    private maxSize: number,
    private ttl?: number,
  ) {}

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check TTL
    if (this.ttl && Date.now() - item.timestamp > this.ttl) {
      this.delete(key);
      return null;
    }

    // Update access order
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);

    return item.value;
  }

  set(key: string, value: T): void {
    if (this.cache.has(key)) {
      this.cache.set(key, { value, timestamp: Date.now() });
      return;
    }

    if (this.cache.size >= this.maxSize) {
      const oldest = this.accessOrder.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() });
    this.accessOrder.push(key);
  }

  delete(key: string): boolean {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  size(): number {
    return this.cache.size;
  }
}

// ==========================================
// SISTEMA DE ÍNDICES AVANZADO
// ==========================================

class IndexManager<T extends IEntity> {
  private indexes = new Map<string, Map<any, Set<T>>>();
  private uniqueIndexes = new Map<string, Map<any, T>>();

  createIndex(config: IIndexConfig): void {
    if (config.type === "unique") {
      this.uniqueIndexes.set(config.field, new Map());
    } else {
      this.indexes.set(config.field, new Map());
    }
  }

  addToIndex(item: T): void {
    // Add to regular indexes
    for (const [field, index] of this.indexes) {
      const value = item[field];
      if (value !== undefined) {
        if (!index.has(value)) {
          index.set(value, new Set());
        }
        index.get(value)!.add(item);
      }
    }

    // Add to unique indexes
    for (const [field, index] of this.uniqueIndexes) {
      const value = item[field];
      if (value !== undefined) {
        if (index.has(value)) {
          throw new Error(`Unique constraint violation on field ${field}`);
        }
        index.set(value, item);
      }
    }
  }

  removeFromIndex(item: T): void {
    // Remove from regular indexes
    for (const [field, index] of this.indexes) {
      const value = item[field];
      if (value !== undefined && index.has(value)) {
        index.get(value)!.delete(item);
        if (index.get(value)!.size === 0) {
          index.delete(value);
        }
      }
    }

    // Remove from unique indexes
    for (const [field, index] of this.uniqueIndexes) {
      const value = item[field];
      if (value !== undefined) {
        index.delete(value);
      }
    }
  }

  findByIndex(field: string, value: any): T[] {
    const regularIndex = this.indexes.get(field);
    if (regularIndex && regularIndex.has(value)) {
      return Array.from(regularIndex.get(value)!);
    }

    const uniqueIndex = this.uniqueIndexes.get(field);
    if (uniqueIndex && uniqueIndex.has(value)) {
      return [uniqueIndex.get(value)!];
    }

    return [];
  }

  getIndexedFields(): string[] {
    return [...this.indexes.keys(), ...this.uniqueIndexes.keys()];
  }
}

// ==========================================
// COLECCIÓN EN MEMORIA MEJORADA
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

class InMemoryCollection<T extends IEntity> {
  private data = new Map<string | number, T>();
  private nextId: number = 1;
  private indexManager = new IndexManager<T>();
  private cache: LRUCache<T[]>;
  private commandHistory: ICommand<any>[] = [];
  private currentCommandIndex = -1;

  // Estadísticas
  private stats = {
    queries: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  constructor(
    private name: string,
    private observer: DatabaseObserver,
    cacheConfig: ICacheConfig = { maxSize: 1000, strategy: "lru" },
    initialData: T[] = [],
  ) {
    this.cache = new LRUCache<T[]>(cacheConfig.maxSize, cacheConfig.ttl);

    // Load initial data
    initialData.forEach((item) => {
      if (item.id) {
        this.data.set(item.id, item);
        const id =
          typeof item.id === "number" ? item.id : parseInt(item.id.toString());
        if (!isNaN(id)) {
          this.nextId = Math.max(this.nextId, id + 1);
        }
      }
    });
  }

  // Configuración de índices
  createIndex(config: IIndexConfig): void {
    this.indexManager.createIndex(config);

    // Rebuild index for existing data
    for (const item of this.data.values()) {
      try {
        this.indexManager.addToIndex(item);
      } catch (error: any) {
        // Handle unique constraint violations during rebuild
        console.warn(`Failed to add existing item to index: ${error}`);
      }
    }
  }

  // CRUD Operations with Command Pattern
  insert(item: Omit<T, "id">): T {
    const command = new InsertCommand(this, item);
    const result = this.executeCommand(command);
    return result;
  }

  update(id: string | number, updates: Partial<T>): T | undefined {
    const command = new UpdateCommand(this, id, updates);
    try {
      return this.executeCommand(command);
    } catch (error: any) {
      return undefined;
    }
  }

  // Direct methods for command pattern (not exposed publicly)
  directInsert(item: Omit<T, "id"> | T): T {
    const newItem =
      "id" in item && item.id
        ? (item as T)
        : ({ ...item, id: this.nextId++ } as T);

    this.indexManager.addToIndex(newItem);
    this.data.set(newItem.id!, newItem);
    this.cache.clear(); // Invalidate cache
    this.observer.notify("insert", this.name, newItem);
    return newItem;
  }

  directUpdate(id: string | number, updates: Partial<T>): T | undefined {
    const existingItem = this.data.get(id);
    if (!existingItem) return undefined;

    this.indexManager.removeFromIndex(existingItem);
    const updatedItem = { ...existingItem, ...updates, id } as T;

    this.indexManager.addToIndex(updatedItem);
    this.data.set(id, updatedItem);
    this.cache.clear(); // Invalidate cache
    this.observer.notify("update", this.name, updatedItem);
    return updatedItem;
  }

  directDelete(id: string | number): boolean {
    const item = this.data.get(id);
    if (!item) return false;

    this.indexManager.removeFromIndex(item);
    this.data.delete(id);
    this.cache.clear(); // Invalidate cache
    this.observer.notify("delete", this.name, item);
    return true;
  }

  directFindById(id: string | number): T | undefined {
    return this.data.get(id);
  }

  // Query Operations with Caching
  findById(id: string | number): T | undefined {
    this.stats.queries++;
    return this.data.get(id);
  }

  findAll(options: IAdvancedQueryOptions = {}): T[] {
    this.stats.queries++;
    const cacheKey = JSON.stringify(options);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.cacheMisses++;
    let result = Array.from(this.data.values());

    // Apply distinct
    if (options.distinct && options.select) {
      const seen = new Set();
      result = result.filter((item) => {
        const key = options.select!.map((field) => item[field]).join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    // Apply sorting
    if (options.sortBy) {
      result.sort((a, b) => {
        const aVal = a[options.sortBy!];
        const bVal = b[options.sortBy!];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return options.sortOrder === "desc" ? -comparison : comparison;
      });
    }

    // Apply pagination
    const start = options.offset || 0;
    const end = options.limit ? start + options.limit : undefined;
    result = result.slice(start, end);

    // Apply selection
    if (options.select) {
      result = result.map((item) => {
        const selected: any = { id: item.id };
        options.select!.forEach((field) => {
          selected[field] = item[field];
        });
        return selected;
      });
    }

    // Cache result
    this.cache.set(cacheKey, result);
    return result;
  }

  findBy(predicate: (item: T) => boolean, options: IQueryOptions = {}): T[] {
    this.stats.queries++;
    let result = Array.from(this.data.values()).filter(predicate);

    // Apply sorting and pagination
    if (options.sortBy) {
      result.sort((a, b) => {
        const aVal = a[options.sortBy!];
        const bVal = b[options.sortBy!];
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return options.sortOrder === "desc" ? -comparison : comparison;
      });
    }

    const start = options.offset || 0;
    const end = options.limit ? start + options.limit : undefined;
    return result.slice(start, end);
  }

  findByField(field: string, value: any, useIndex: boolean = true): T[] {
    this.stats.queries++;

    if (useIndex && this.indexManager.getIndexedFields().includes(field)) {
      return this.indexManager.findByIndex(field, value);
    }

    return Array.from(this.data.values()).filter(
      (item) => item[field] === value,
    );
  }

  delete(id: string | number): boolean {
    const item = this.data.get(id);
    if (!item) return false;

    return this.directDelete(id);
  }

  clear(): void {
    this.data.clear();
    this.cache.clear();
    this.commandHistory = [];
    this.currentCommandIndex = -1;
    this.nextId = 1;
    this.observer.notify("clear", this.name);
  }

  count(): number {
    return this.data.size;
  }

  // Command Pattern - Undo/Redo
  private executeCommand<R>(command: ICommand<R>): R {
    // Remove commands after current index (for redo functionality)
    this.commandHistory = this.commandHistory.slice(
      0,
      this.currentCommandIndex + 1,
    );

    const result = command.execute();
    this.commandHistory.push(command);
    this.currentCommandIndex++;

    return result;
  }

  undo(): boolean {
    if (this.currentCommandIndex < 0) return false;

    const command = this.commandHistory[this.currentCommandIndex];
    command.undo();
    this.currentCommandIndex--;
    this.cache.clear(); // Invalidate cache
    return true;
  }

  redo(): boolean {
    if (this.currentCommandIndex >= this.commandHistory.length - 1)
      return false;

    this.currentCommandIndex++;
    const command = this.commandHistory[this.currentCommandIndex];
    command.redo();
    this.cache.clear(); // Invalidate cache
    return true;
  }

  // Aggregation operations
  aggregate(pipeline: Array<{ [operation: string]: any }>): any[] {
    let result: any[] = Array.from(this.data.values());

    for (const stage of pipeline) {
      if (stage.$match) {
        result = result.filter((item) => {
          return Object.entries(stage.$match).every(
            ([key, value]) => item[key] === value,
          );
        });
      }

      if (stage.$group) {
        const grouped = new Map();
        result.forEach((item) => {
          const key = stage.$group._id ? item[stage.$group._id] : null;
          if (!grouped.has(key)) {
            grouped.set(key, []);
          }
          grouped.get(key).push(item);
        });

        result = Array.from(grouped.entries()).map(([key, items]) => {
          const group: any = { _id: key };
          Object.entries(stage.$group).forEach(
            ([field, operation]: [string, any]) => {
              if (field === "_id") return;

              if (operation.$sum) {
                group[field] = items.reduce(
                  (sum: number, item: any) => sum + (item[operation.$sum] || 0),
                  0,
                );
              }
              if (operation.$count) {
                group[field] = items.length;
              }
              if (operation.$avg) {
                const values = items.map(
                  (item: any) => item[operation.$avg] || 0,
                );
                group[field] =
                  values.reduce((sum: number, val: number) => sum + val, 0) /
                  values.length;
              }
            },
          );
          return group;
        });
      }
    }

    return result;
  }

  // Statistics
  getStats() {
    return {
      ...this.stats,
      totalRecords: this.data.size,
      cacheSize: this.cache.size(),
      indexedFields: this.indexManager.getIndexedFields(),
      commandHistorySize: this.commandHistory.length,
    };
  }

  // Internal methods
  getData(): T[] {
    return Array.from(this.data.values());
  }

  setData(data: T[]): void {
    this.data.clear();
    this.cache.clear();

    data.forEach((item) => {
      if (item.id) {
        this.data.set(item.id, item);
        const id =
          typeof item.id === "number" ? item.id : parseInt(item.id.toString());
        if (!isNaN(id)) {
          this.nextId = Math.max(this.nextId, id + 1);
        }
      }
    });
  }
}

// ==========================================
// BASE DE DATOS EN MEMORIA PRINCIPAL
// ==========================================

class InMemoryDatabase {
  private static instance: InMemoryDatabase;
  private collections = new Map<string, InMemoryCollection<any>>();
  private observer = new DatabaseObserver();
  private memento = new DatabaseMemento();
  // private globalStats: IGlobalStats = {
  //     startTime: Date.now(),
  //     totalQueries: 0,
  //     totalCacheHits: 0,
  //     totalCacheMisses: 0
  // };

  private constructor() {}

  // Singleton Pattern
  static getInstance(): InMemoryDatabase {
    if (!InMemoryDatabase.instance) {
      InMemoryDatabase.instance = new InMemoryDatabase();
    }
    return InMemoryDatabase.instance;
  }

  // Collection Factory
  collection<T extends IEntity>(
    name: string,
    cacheConfig?: ICacheConfig,
  ): InMemoryCollection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(
        name,
        new InMemoryCollection<T>(name, this.observer, cacheConfig),
      );
    }
    return this.collections.get(name)!;
  }

  // Snapshot Management
  createSnapshot(description?: string): string {
    return this.memento.createSnapshot(this.collections, description);
  }

  restoreSnapshot(snapshotId: string): boolean {
    const snapshot = this.memento.restoreSnapshot(snapshotId);
    if (!snapshot) return false;

    // Clear current collections
    this.collections.clear();

    // Restore collections from snapshot
    for (const [name, data] of snapshot.collections) {
      const collection = new InMemoryCollection<any>(name, this.observer);
      collection.setData(data);
      this.collections.set(name, collection);
    }

    return true;
  }

  listSnapshots(): ISnapshot[] {
    return this.memento.listSnapshots();
  }

  deleteSnapshot(snapshotId: string): boolean {
    return this.memento.deleteSnapshot(snapshotId);
  }

  // Database Management
  getCollectionNames(): string[] {
    return Array.from(this.collections.keys());
  }

  dropCollection(name: string): boolean {
    return this.collections.delete(name);
  }

  clear(): void {
    this.collections.clear();
    // this.globalStats = {
    //     startTime: Date.now(),
    //     totalQueries: 0,
    //     totalCacheHits: 0,
    //     totalCacheMisses: 0
    // };
  }

  // Statistics
  getStats(): IDatabaseStats {
    let totalRecords = 0;
    let queryCount = 0;
    let cacheHits = 0;
    let cacheMisses = 0;

    for (const collection of this.collections.values()) {
      const stats = collection.getStats();
      totalRecords += stats.totalRecords;
      queryCount += stats.queries;
      cacheHits += stats.cacheHits;
      cacheMisses += stats.cacheMisses;
    }

    return {
      collections: this.collections.size,
      totalRecords,
      memoryUsage: this.estimateMemoryUsage(),
      queryCount,
      cacheHits,
      cacheMisses,
    };
  }

  private estimateMemoryUsage(): number {
    // Rough estimation in bytes
    let size = 0;
    for (const collection of this.collections.values()) {
      const data = collection.getData();
      size += JSON.stringify(data).length * 2; // Rough estimation
    }
    return size;
  }

  // Observer Pattern
  subscribe(observer: IObserver): void {
    this.observer.subscribe(observer);
  }

  unsubscribe(observer: IObserver): void {
    this.observer.unsubscribe(observer);
  }

  // Bulk operations
  import(collections: { [name: string]: any[] }): void {
    for (const [name, data] of Object.entries(collections)) {
      const collection = this.collection(name);
      collection.clear();
      data.forEach((item) => collection.insert(item));
    }
  }

  export(): { [name: string]: any[] } {
    const result: { [name: string]: any[] } = {};
    for (const [name, collection] of this.collections) {
      result[name] = collection.getData();
    }
    return result;
  }
}

/*
// ==========================================
// EJEMPLO DE USO AVANZADO
// ==========================================

// Definir tipos
interface User extends IEntity {
    name: string;
    email: string;
    age: number;
    department: string;
}

interface Product extends IEntity {
    name: string;
    price: number;
    category: string;
    tags: string[];
}

// Observer personalizado con métricas
class MetricsObserver implements IObserver {
    private metrics = {
        inserts: 0,
        updates: 0,
        deletes: 0
    };

    update(event: EventType, collection: string, _data?: any): void {
        this.metrics[event === 'insert' ? 'inserts' : event === 'update' ? 'updates' : 'deletes']++;
        console.log(`[METRICS] ${event.toUpperCase()} in ${collection}. Total: ${JSON.stringify(this.metrics)}`);
    }

    getMetrics() {
        return { ...this.metrics };
    }
}

// Función de demostración
function demonstrateInMemoryDatabase() {
    // Inicializar base de datos
    const db = InMemoryDatabase.getInstance();

    // Configurar observador
    const metricsObserver = new MetricsObserver();
    db.subscribe(metricsObserver);

    // Crear colecciones con configuración de caché
    const users = db.collection<User>('users', {
        maxSize: 100,
        ttl: 60000,
        strategy: 'lru'
    });

    const products = db.collection<Product>('products');

    // Crear índices
    users.createIndex({ field: 'email', type: 'unique' });
    users.createIndex({ field: 'department', type: 'hash' });
    products.createIndex({ field: 'category', type: 'hash' });

    // Insertar datos de prueba
    users.insert({
        name: 'Ana García',
        email: 'ana@company.com',
        age: 28,
        department: 'Engineering'
    });

    users.insert({
        name: 'Carlos López',
        email: 'carlos@company.com',
        age: 32,
        department: 'Sales'
    });

    products.insert({
        name: 'Laptop Pro',
        price: 1299.99,
        category: 'Electronics',
        tags: ['computer', 'professional']
    });

    // Búsquedas optimizadas con índices
    console.log('Users in Engineering:', users.findByField('department', 'Engineering'));

    // Operaciones de agregación
    const departmentStats = users.aggregate([
        { $group: { _id: 'department', count: { $count: 1 }, avgAge: { $avg: 'age' } } }
    ]);
    console.log('Department Stats:', departmentStats);

    // Crear snapshot
    const snapshotId = db.createSnapshot('Initial data load');
    console.log('Snapshot created:', snapshotId);

}
*/
