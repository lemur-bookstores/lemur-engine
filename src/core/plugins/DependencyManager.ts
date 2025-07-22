import { Plugin } from './PluginInterfaces';
import { Graph } from '../utils/Graph';
import semver from 'semver';

export class DependencyManager {
    private dependencyGraph: Graph;
    private plugins: Map<string, Plugin>;

    constructor() {
        this.dependencyGraph = new Graph();
        this.plugins = new Map();
    }

    /**
     * Valida y ordena las dependencias de los plugins
     */
    validateAndOrderDependencies(plugins: Map<string, Plugin>): Plugin[] {
        this.plugins = new Map(plugins);
        this.buildDependencyGraph(plugins);

        // Validar que todas las dependencias existan
        this.validateAllDependenciesExist(plugins);

        if (this.hasCyclicDependencies()) {
            const cycles = this.findCycles();
            throw new Error(`Circular dependencies detected: ${JSON.stringify(cycles)}`);
        }

        return this.getLoadOrder();
    }

    /**
     * Valida que todas las dependencias declaradas existan
     */
    private validateAllDependenciesExist(plugins: Map<string, Plugin>): void {
        const missingDependencies = new Map<string, string[]>();

        plugins.forEach((plugin) => {
            const missing = this.getMissingDependencies(plugin, plugins);
            if (missing.length > 0) {
                missingDependencies.set(plugin.metadata.name, missing);
            }
        });

        if (missingDependencies.size > 0) {
            const errorMessage = Array.from(missingDependencies.entries())
                .map(([plugin, deps]) => `${plugin}: [${deps.join(', ')}]`)
                .join(', ');
            throw new Error(`Missing dependencies for plugins: ${errorMessage}`);
        }
    }

    /**
     * Obtiene las dependencias faltantes de un plugin
     */
    private getMissingDependencies(plugin: Plugin, availablePlugins: Map<string, Plugin>): string[] {
        const dependencies = plugin.metadata.dependencies || [];
        return dependencies.filter(dep => {
            const [depName] = dep.split('@'); // Separar nombre de versión si existe
            return !availablePlugins.has(depName);
        });
    }

    /**
     * Encuentra todos los ciclos en el grafo de dependencias
     */
    private findCycles(): string[][] {
        return this.dependencyGraph.findCycles();
    }

    /**
     * Verifica compatibilidad de versiones
     */
    validateVersionCompatibility(plugin: Plugin, dependency: Plugin): boolean {
        const requiredVersion = this.getRequiredVersion(plugin, dependency.metadata.name);
        return semver.satisfies(dependency.metadata.version, requiredVersion);
    }

    /**
     * Detecta y resuelve conflictos de dependencias
     */
    resolveConflicts(plugins: Map<string, Plugin>): Map<string, Plugin> {
        const resolved = new Map<string, Plugin>();
        const conflicts = this.findVersionConflicts(plugins);

        for (const [name, versions] of conflicts) {
            const bestVersion = this.selectBestVersion(versions);
            resolved.set(name, bestVersion);
        }

        return resolved;
    }

    private buildDependencyGraph(plugins: Map<string, Plugin>): void {
        plugins.forEach(plugin => {
            this.dependencyGraph.addNode(plugin.metadata.name);

            if (plugin.metadata.dependencies) {
                plugin.metadata.dependencies.forEach(dep => {
                    this.dependencyGraph.addEdge(plugin.metadata.name, dep);
                });
            }
        });
    }

    private hasCyclicDependencies(): boolean {
        return this.dependencyGraph.hasCycle();
    }

    private getLoadOrder(): Plugin[] {
        const sortedNames = this.dependencyGraph.topologicalSort();
        const plugins: Plugin[] = [];

        // Convertimos los nombres ordenados en plugins
        sortedNames.forEach(name => {
            const plugin = Array.from(this.plugins.values()).find(p => p.metadata.name === name);
            if (plugin) {
                plugins.push(plugin);
            }
        });

        return plugins;
    }

    private getRequiredVersion(plugin: Plugin, dependencyName: string): string {
        // Si el plugin tiene dependencias definidas con versiones
        if (plugin.metadata.dependencies) {
            const dependency = plugin.metadata.dependencies.find(dep => {
                // Asumimos que las dependencias están en formato "nombre@version"
                const [name] = dep.split('@');
                return name === dependencyName;
            });

            if (dependency) {
                const [, version] = dependency.split('@');
                return version || '*';
            }
        }

        return '*'; // Por defecto, cualquier versión
    }

    private findVersionConflicts(plugins: Map<string, Plugin>): Map<string, Plugin[]> {
        const conflicts = new Map<string, Plugin[]>();

        plugins.forEach(plugin => {
            if (!conflicts.has(plugin.metadata.name)) {
                conflicts.set(plugin.metadata.name, []);
            }
            conflicts.get(plugin.metadata.name)!.push(plugin);
        });

        return new Map([...conflicts.entries()].filter(([_, versions]) => versions.length > 1));
    }

    private selectBestVersion(versions: Plugin[]): Plugin {
        return versions.reduce((best, current) => {
            if (!best || semver.gt(current.metadata.version, best.metadata.version)) {
                return current;
            }
            return best;
        });
    }
}
