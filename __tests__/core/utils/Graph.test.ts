import { Graph } from "../../../src/core/utils/Graph";

describe("Graph", () => {
  let graph: Graph;

  beforeEach(() => {
    graph = new Graph();
  });

  describe("Constructor", () => {
    it("should create empty graph", () => {
      expect(graph).toBeInstanceOf(Graph);
    });
  });

  describe("addNode", () => {
    it("should add single node", () => {
      graph.addNode("A");
      expect(graph.topologicalSort()).toContain("A");
    });

    it("should not add duplicate nodes", () => {
      graph.addNode("A");
      graph.addNode("A");
      const sorted = graph.topologicalSort();
      expect(sorted.filter((node) => node === "A")).toHaveLength(1);
    });

    it("should add multiple nodes", () => {
      graph.addNode("A");
      graph.addNode("B");
      graph.addNode("C");
      const sorted = graph.topologicalSort();
      expect(sorted).toContain("A");
      expect(sorted).toContain("B");
      expect(sorted).toContain("C");
    });
  });

  describe("addEdge", () => {
    it("should add edge between existing nodes", () => {
      graph.addNode("A");
      graph.addNode("B");
      graph.addEdge("A", "B");

      const sorted = graph.topologicalSort();
      expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("B"));
    });

    it("should create nodes when adding edge to non-existing nodes", () => {
      graph.addEdge("A", "B");
      const sorted = graph.topologicalSort();
      expect(sorted).toContain("A");
      expect(sorted).toContain("B");
      expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("B"));
    });

    it("should handle multiple edges from same node", () => {
      graph.addEdge("A", "B");
      graph.addEdge("A", "C");

      const sorted = graph.topologicalSort();
      expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("B"));
      expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("C"));
    });

    it("should handle complex dependency chain", () => {
      graph.addEdge("A", "B");
      graph.addEdge("B", "C");
      graph.addEdge("A", "D");
      graph.addEdge("D", "C");

      const sorted = graph.topologicalSort();
      expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("B"));
      expect(sorted.indexOf("B")).toBeLessThan(sorted.indexOf("C"));
      expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("D"));
      expect(sorted.indexOf("D")).toBeLessThan(sorted.indexOf("C"));
    });
  });

  describe("hasCycle", () => {
    it("should return false for empty graph", () => {
      expect(graph.hasCycle()).toBe(false);
    });

    it("should return false for single node", () => {
      graph.addNode("A");
      expect(graph.hasCycle()).toBe(false);
    });

    it("should return false for acyclic graph", () => {
      graph.addEdge("A", "B");
      graph.addEdge("B", "C");
      graph.addEdge("A", "D");
      expect(graph.hasCycle()).toBe(false);
    });

    it("should return true for simple cycle", () => {
      graph.addEdge("A", "B");
      graph.addEdge("B", "A");
      expect(graph.hasCycle()).toBe(true);
    });

    it("should return true for complex cycle", () => {
      graph.addEdge("A", "B");
      graph.addEdge("B", "C");
      graph.addEdge("C", "A");
      expect(graph.hasCycle()).toBe(true);
    });

    it("should return true for self-loop", () => {
      graph.addEdge("A", "A");
      expect(graph.hasCycle()).toBe(true);
    });

    it("should detect cycle in larger graph", () => {
      graph.addEdge("A", "B");
      graph.addEdge("B", "C");
      graph.addEdge("C", "D");
      graph.addEdge("D", "E");
      graph.addEdge("E", "B"); // Creates cycle B -> C -> D -> E -> B
      expect(graph.hasCycle()).toBe(true);
    });

    it("should handle disconnected components with cycle", () => {
      // First component - no cycle
      graph.addEdge("A", "B");
      graph.addEdge("B", "C");

      // Second component - has cycle
      graph.addEdge("X", "Y");
      graph.addEdge("Y", "X");

      expect(graph.hasCycle()).toBe(true);
    });

    it("should handle disconnected components without cycle", () => {
      // First component
      graph.addEdge("A", "B");
      graph.addEdge("B", "C");

      // Second component
      graph.addEdge("X", "Y");
      graph.addEdge("Y", "Z");

      expect(graph.hasCycle()).toBe(false);
    });
  });

  describe("topologicalSort", () => {
    it("should return empty array for empty graph", () => {
      expect(graph.topologicalSort()).toEqual([]);
    });

    it("should return single node for single node graph", () => {
      graph.addNode("A");
      expect(graph.topologicalSort()).toEqual(["A"]);
    });

    it("should sort simple linear dependency", () => {
      graph.addEdge("A", "B");
      graph.addEdge("B", "C");

      const sorted = graph.topologicalSort();
      expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("B"));
      expect(sorted.indexOf("B")).toBeLessThan(sorted.indexOf("C"));
    });

    it("should sort complex dependencies", () => {
      graph.addEdge("A", "C");
      graph.addEdge("B", "C");
      graph.addEdge("C", "D");

      const sorted = graph.topologicalSort();
      expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("C"));
      expect(sorted.indexOf("B")).toBeLessThan(sorted.indexOf("C"));
      expect(sorted.indexOf("C")).toBeLessThan(sorted.indexOf("D"));
    });

    it("should handle diamond dependency pattern", () => {
      graph.addEdge("A", "B");
      graph.addEdge("A", "C");
      graph.addEdge("B", "D");
      graph.addEdge("C", "D");

      const sorted = graph.topologicalSort();
      expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("B"));
      expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("C"));
      expect(sorted.indexOf("B")).toBeLessThan(sorted.indexOf("D"));
      expect(sorted.indexOf("C")).toBeLessThan(sorted.indexOf("D"));
    });

    it("should handle disconnected components", () => {
      // First component
      graph.addEdge("A", "B");

      // Second component
      graph.addEdge("X", "Y");

      // Isolated node
      graph.addNode("Z");

      const sorted = graph.topologicalSort();
      expect(sorted).toHaveLength(5);
      expect(sorted.indexOf("A")).toBeLessThan(sorted.indexOf("B"));
      expect(sorted.indexOf("X")).toBeLessThan(sorted.indexOf("Y"));
      expect(sorted).toContain("Z");
    });

    it("should return all nodes in valid topological order", () => {
      graph.addEdge("compiler", "linker");
      graph.addEdge("preprocessor", "compiler");
      graph.addEdge("editor", "preprocessor");

      const sorted = graph.topologicalSort();
      expect(sorted).toHaveLength(4);
      expect(sorted.indexOf("editor")).toBeLessThan(
        sorted.indexOf("preprocessor"),
      );
      expect(sorted.indexOf("preprocessor")).toBeLessThan(
        sorted.indexOf("compiler"),
      );
      expect(sorted.indexOf("compiler")).toBeLessThan(sorted.indexOf("linker"));
    });
  });

  describe("Integration tests", () => {
    it("should handle plugin dependency resolution scenario", () => {
      // Simulate plugin dependencies
      graph.addEdge("core", "auth");
      graph.addEdge("auth", "database");
      graph.addEdge("core", "logging");
      graph.addEdge("api", "auth");
      graph.addEdge("api", "logging");

      expect(graph.hasCycle()).toBe(false);

      const sorted = graph.topologicalSort();
      expect(sorted.indexOf("core")).toBeLessThan(sorted.indexOf("auth"));
      expect(sorted.indexOf("auth")).toBeLessThan(sorted.indexOf("database"));
      expect(sorted.indexOf("core")).toBeLessThan(sorted.indexOf("logging"));
      expect(sorted.indexOf("api")).toBeLessThan(sorted.indexOf("auth"));
      expect(sorted.indexOf("api")).toBeLessThan(sorted.indexOf("logging"));
    });

    it("should detect circular plugin dependencies", () => {
      graph.addEdge("pluginA", "pluginB");
      graph.addEdge("pluginB", "pluginC");
      graph.addEdge("pluginC", "pluginA");

      expect(graph.hasCycle()).toBe(true);
    });
  });
});
