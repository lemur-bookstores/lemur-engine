import { KernelConfig } from "../types";
import { ConfigChangeListener } from "./ConfigChangeListener";

export interface IConfigLoader {
  /**
   * Carga la configuración desde una fuente específica
   * @param configPath Ruta opcional al archivo de configuración
   */
  loadConfig(configPath?: string): Promise<KernelConfig>;

  /**
   * Valida la configuración cargada
   * @param config Configuración a validar
   */
  validateConfig(config: KernelConfig): void;

  /**
   * Suscribe un listener para cambios en la configuración
   * @param listener Listener a suscribir
   */
  subscribe(listener: ConfigChangeListener): void;

  /**
   * Desuscribe un listener
   * @param listener Listener a desuscribir
   */
  unsubscribe(listener: ConfigChangeListener): void;
}
