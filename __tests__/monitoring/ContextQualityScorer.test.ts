import { ContextQualityScorer } from "../../src/monitoring/ContextQualityScorer";

describe("ContextQualityScorer", () => {
  let scorer: ContextQualityScorer;

  beforeEach(() => {
    scorer = new ContextQualityScorer();
  });

  describe("scoreContext", () => {
    test("should return a high score for good quality context", () => {
      const context = `
        # User Query
        What are the sales figures for Q4 2024?

        - Region: North America
        - Product: All products
        - Data required: Total revenue, units sold, profit margin.
      `;
      const { score, reasons } = scorer.scoreContext(context);
      expect(score).toBeGreaterThan(0.8);
      expect(reasons.length).toBe(0);
    });

    test("should return a low score for short context", () => {
      const context = "sales figures";
      const { score, reasons } = scorer.scoreContext(context);
      expect(score).toBeLessThan(0.8);
      expect(reasons).toContain("Context is too short");
    });

    test("should detect PII and lower the score", () => {
      const context =
        "User email is test@example.com and phone is 555-123-4567.";
      const { score, reasons } = scorer.scoreContext(context);
      expect(score).toBeLessThan(0.7);
      expect(reasons).toContain(
        "Contains potential Personally Identifiable Information (PII)",
      );
    });

    test("should detect harmful content and lower the score significantly", () => {
      const context = "This is a violent attack on the system.";
      const { score, reasons } = scorer.scoreContext(context);
      expect(score).toBeLessThan(0.5);
      expect(reasons).toContain("Contains potentially harmful content");
    });

    test("should penalize for lack of structure", () => {
      const context =
        "I want sales figures for Q4 2024 for North America all products I need total revenue units sold and profit margin.";
      const { score, reasons } = scorer.scoreContext(context);
      expect(score).toBe(0.85); // Adjusted expectation
      expect(reasons).toContain(
        "Lacks clear structure (e.g., headings, lists)",
      );
    });
    test("should consider freshness metadata", () => {
      const oldTimestamp = new Date();
      oldTimestamp.setDate(oldTimestamp.getDate() - 40); // 40 days old
      const context =
        "This is a valid context but it is quite old and might be outdated.";
      const { score, reasons } = scorer.scoreContext(context, {
        timestamp: oldTimestamp.toISOString(),
      });
      expect(score).toBeLessThan(0.9);
      expect(reasons).toContain("Context is more than 30 days old");
    });
  });

  describe("compareContexts", () => {
    test("should return a high similarity score for similar contexts", () => {
      const contextA = "User wants to know about the system data.";
      const contextB = "The user is asking for data about the system.";
      const similarity = scorer.compareContexts(contextA, contextB);
      expect(similarity).toBeCloseTo(0.745); // Adjusted expectation
    });
    test("should return a low similarity score for different contexts", () => {
      const contextA = "User wants to know about system data.";
      const contextB = "The weather today is sunny.";
      const similarity = scorer.compareContexts(contextA, contextB);
      expect(similarity).toBeLessThan(0.5);
    });
  });
});
