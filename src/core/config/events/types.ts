import { ConfigChangeEventType, ConfigChangeEvent } from "./ConfigEventManager";

export interface ConfigChangeFilter {
  eventTypes?: ConfigChangeEventType[];
  environmentFilter?: ("development" | "staging" | "production")[];
  propertyFilter?: string[]; // Propiedades específicas que han cambiado
}

export interface ConfigChangeListenerOptions {
  priority?: number; // Mayor número = mayor prioridad
  filter?: ConfigChangeFilter;
  debounceTime?: number; // Tiempo en ms para debounce
  batchSize?: number; // Número de eventos a acumular antes de notificar
  async?: boolean; // Si el listener debe ejecutarse de forma asíncrona
}

export interface ConfigBatchEvent {
  events: ConfigChangeEvent[];
  timestamp: Date;
}
