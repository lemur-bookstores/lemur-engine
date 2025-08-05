import { KernelConfig } from "../types";
import { ConfigChangeEvent } from "./ConfigEventManager";
import { ConfigBatchEvent } from "./types";

export interface ConfigChangeListener {
  /**
   * Método llamado cuando la configuración cambia
   * @param oldConfig Configuración anterior
   * @param newConfig Nueva configuración
   */
  onConfigChange(
    oldConfig: KernelConfig,
    newConfig: KernelConfig,
  ): Promise<void> | void;

  /**
   * Método opcional para manejar eventos específicos
   * @param event Evento de cambio de configuración
   */
  onEvent?(event: ConfigChangeEvent): Promise<void> | void;

  /**
   * Método opcional para manejar eventos en lote
   * @param batchEvent Evento que contiene un lote de eventos de configuración
   */
  onBatchEvent?(batchEvent: ConfigBatchEvent): Promise<void> | void;
}
