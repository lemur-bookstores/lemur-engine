# DISCUSIÓN PARA IN-MEMORY DB

## (Arquitectura):

- Eliminaremos la capa de persistencia en disco
- Añadiremos caché inteligente con LRU
- Implementaremos índices avanzados (B-Tree simulado con Map)
- Sistema de snapshots para backup en memoria
- Pool de conexiones para operaciones concurrentes
- Estadísticas de rendimiento en tiempo real

## (Patrones de Diseño):

- Flyweight Pattern para optimizar memoria compartida
- Command Pattern para operaciones reversibles (undo/redo)
- Memento Pattern para snapshots
- Chain of Responsibility para validaciones
- Decorator Pattern para operaciones con caché
- Template Method para diferentes tipos de índices

`También implementaremos el patrón Object Pool para reutilización de objetos.`
