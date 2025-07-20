import { KernelConfig } from '../types';

export interface ConfigChangeListener {
    /**
     * Método llamado cuando la configuración cambia
     * @param oldConfig Configuración anterior
     * @param newConfig Nueva configuración
     */
    onConfigChange(oldConfig: KernelConfig, newConfig: KernelConfig): void;
}
