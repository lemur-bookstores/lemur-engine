import { KernelConfig } from '../types';
import { ConfigChangeEvent } from '../events/ConfigEventManager';

export interface ConfigChangeListener {
    /**
     * Método llamado cuando la configuración cambia
     * @param oldConfig Configuración anterior
     * @param newConfig Nueva configuración
     */
    onConfigChange?(oldConfig: KernelConfig, newConfig: KernelConfig): void;

    /**
     * Método llamado para cualquier evento de configuración
     * @param event Evento de configuración
     */
    onEvent?(event: ConfigChangeEvent): void;
}
