export class Graph {
    private adjacencyList: Map<string, Set<string>>;

    constructor() {
        this.adjacencyList = new Map();
    }

    addNode(node: string): void {
        if (!this.adjacencyList.has(node)) {
            this.adjacencyList.set(node, new Set());
        }
    }

    addEdge(from: string, to: string): void {
        this.addNode(from);
        this.addNode(to);
        this.adjacencyList.get(from)!.add(to);
    }

    hasCycle(): boolean {
        const visited = new Set<string>();
        const recStack = new Set<string>();

        const hasCycleUtil = (node: string): boolean => {
            if (!visited.has(node)) {
                visited.add(node);
                recStack.add(node);

                const neighbors = this.adjacencyList.get(node) || new Set();
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor) && hasCycleUtil(neighbor)) {
                        return true;
                    } else if (recStack.has(neighbor)) {
                        return true;
                    }
                }
            }
            recStack.delete(node);
            return false;
        };

        for (const node of this.adjacencyList.keys()) {
            if (hasCycleUtil(node)) {
                return true;
            }
        }
        return false;
    }

    topologicalSort(): string[] {
        const visited = new Set<string>();
        const stack: string[] = [];

        const topologicalSortUtil = (node: string): void => {
            visited.add(node);

            const neighbors = this.adjacencyList.get(node) || new Set();
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    topologicalSortUtil(neighbor);
                }
            }

            stack.unshift(node);
        };

        for (const node of this.adjacencyList.keys()) {
            if (!visited.has(node)) {
                topologicalSortUtil(node);
            }
        }

        return stack;
    }
}
