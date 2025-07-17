import { Plugin } from '../types';

export class PluginRegistry {
    private plugins: Map<string, Plugin> = new Map();
    private dependencyGraph: Map<string, string[]> = new Map();

    register(plugin: Plugin): void {
        this.plugins.set(plugin.metadata.name, plugin);
        this.dependencyGraph.set(plugin.metadata.name, plugin.metadata.dependencies || []);
    }

    get(name: string): Plugin | undefined {
        return this.plugins.get(name);
    }

    /**
     * Retorna el mapa completo de plugins registrados
     */
    getPlugins(): Map<string, Plugin> {
        return new Map(this.plugins);
    }

    // Topological sort for dependency resolution
    getInitializationOrder(): string[] {
        const visited = new Set<string>();
        const visiting = new Set<string>();
        const result: string[] = [];

        const visit = (pluginName: string) => {
            if (visiting.has(pluginName)) {
                throw new Error(`Circular dependency detected: ${pluginName}`);
            }

            if (visited.has(pluginName)) return;

            visiting.add(pluginName);

            const dependencies = this.dependencyGraph.get(pluginName) || [];
            for (const dep of dependencies) {
                if (!this.plugins.has(dep)) {
                    throw new Error(`Missing dependency: ${dep} required by ${pluginName}`);
                }
                visit(dep);
            }

            visiting.delete(pluginName);
            visited.add(pluginName);
            result.push(pluginName);
        };

        for (const pluginName of this.plugins.keys()) {
            visit(pluginName);
        }

        return result;
    }
}
