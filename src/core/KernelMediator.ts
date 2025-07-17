
/**
 * Interface para componentes del kernel que necesitan comunicarse
 */
export interface KernelComponent {
    getId(): string;
    handleMessage(message: any, sender: string): Promise<void>;
}

/**
 * Mediator para la comunicación entre componentes del kernel
 */
export class KernelMediator {
    private components: Map<string, KernelComponent> = new Map();

    register(component: KernelComponent): void {
        this.components.set(component.getId(), component);
    }

    unregister(componentId: string): void {
        this.components.delete(componentId);
    }

    async sendMessage(message: any, from: string, to?: string): Promise<void> {
        if (to) {
            // Envío directo a un componente específico
            const targetComponent = this.components.get(to);
            if (targetComponent) {
                await targetComponent.handleMessage(message, from);
            }
        } else {
            // Broadcast a todos los componentes excepto el remitente
            const promises = Array.from(this.components.entries())
                .filter(([id]) => id !== from)
                .map(([, component]) => component.handleMessage(message, from));

            await Promise.all(promises);
        }
    }

    getComponent(id: string): KernelComponent | undefined {
        return this.components.get(id);
    }

    getAllComponents(): KernelComponent[] {
        return Array.from(this.components.values());
    }
}
