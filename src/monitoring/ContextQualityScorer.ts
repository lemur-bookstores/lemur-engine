interface QualityScore {
  score: number;
  reasons: string[];
  suggestions: string[];
}

class ContextQualityScorer {
  private piiDetectionEnabled: boolean;
  private harmfulContentFilterEnabled: boolean;
  private biasDetectionEnabled: boolean;

  constructor(
    config: {
      piiDetectionEnabled?: boolean;
      harmfulContentFilterEnabled?: boolean;
      biasDetectionEnabled?: boolean;
    } = {},
  ) {
    this.piiDetectionEnabled = config.piiDetectionEnabled || true;
    this.harmfulContentFilterEnabled =
      config.harmfulContentFilterEnabled || true;
    this.biasDetectionEnabled = config.biasDetectionEnabled || false; // Experimental
  }

  // Score the quality of a given context
  scoreContext(
    context: string,
    metadata: Record<string, any> = {},
  ): QualityScore {
    let score = 1.0;
    const reasons: string[] = [];
    const suggestions: string[] = [];

    // 1. Length and verbosity
    if (context.length < 50) {
      score -= 0.2;
      reasons.push("Context is too short");
      suggestions.push("Provide more detailed context");
    }
    if (context.length > 5000) {
      score -= 0.1;
      reasons.push("Context is very long, may be inefficient");
      suggestions.push("Summarize the context or break it into smaller parts");
    }

    // 2. Clarity and structure
    if (!this.hasClearStructure(context)) {
      score -= 0.15;
      reasons.push("Lacks clear structure (e.g., headings, lists)");
      suggestions.push(
        "Use markdown or clear formatting to structure the context",
      );
    }

    // 3. Relevance (placeholder - requires more advanced NLP)
    // This is a simplified check
    if (metadata.relevanceScore && metadata.relevanceScore < 0.5) {
      score -= 0.2;
      reasons.push("Low relevance to the query");
      suggestions.push(
        "Ensure the context is directly related to the user's query",
      );
    }

    // 4. Safety and compliance checks
    if (this.piiDetectionEnabled && this.containsPII(context)) {
      score -= 0.3;
      reasons.push(
        "Contains potential Personally Identifiable Information (PII)",
      );
      suggestions.push("Sanitize the context to remove PII before processing");
    }
    if (
      this.harmfulContentFilterEnabled &&
      this.containsHarmfulContent(context)
    ) {
      score -= 0.5;
      reasons.push("Contains potentially harmful content");
      suggestions.push("Review and filter the context for harmful language");
    }
    if (this.biasDetectionEnabled && this.containsBias(context)) {
      score -= 0.1;
      reasons.push("Contains potential bias");
      suggestions.push("Review the context for neutral and unbiased language");
    }

    // 5. Freshness
    if (metadata.timestamp) {
      const contextAge =
        (new Date().getTime() - new Date(metadata.timestamp).getTime()) /
        (1000 * 3600 * 24); // in days
      if (contextAge > 30) {
        score -= 0.1;
        reasons.push("Context is more than 30 days old");
        suggestions.push("Provide more recent context if available");
      }
    }

    // Normalize score to be between 0 and 1
    score = Math.max(0, Math.min(1, score));

    return {
      score,
      reasons,
      suggestions,
    };
  }

  // Compare two contexts for similarity
  compareContexts(contextA: string, contextB: string): number {
    const vectorA = this.textToVector(contextA);
    const vectorB = this.textToVector(contextB);
    return this.cosineSimilarity(vectorA, vectorB);
  }

  // --- Private helper methods ---

  private hasClearStructure(text: string): boolean {
    // Simple checks for markdown or common structural elements
    const structureRegex = /(#+\s|\n-|\n\d\.\s)/;
    return structureRegex.test(text);
  }

  private containsPII(text: string): boolean {
    // Simplified PII detection using regex
    const piiRegex = {
      email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/,
    };
    return Object.values(piiRegex).some((regex) => regex.test(text));
  }

  private containsHarmfulContent(text: string): boolean {
    // Simplified check using a keyword list
    const harmfulKeywords = ["hate", "violence", "attack", "kill"]; // Example keywords
    const lowerText = text.toLowerCase();
    return harmfulKeywords.some((keyword) => lowerText.includes(keyword));
  }

  private containsBias(text: string): boolean {
    // Highly simplified bias detection
    const biasedPhrases = ["all politicians are", "everybody knows that"]; // Example phrases
    const lowerText = text.toLowerCase();
    return biasedPhrases.some((phrase) => lowerText.includes(phrase));
  }

  // --- Vectorization and Similarity (Simplified) ---

  private textToVector(text: string): number[] {
    // Simple TF-IDF like vectorization (term frequency)
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/);
    const termFrequency: Record<string, number> = {};
    words.forEach((word) => {
      if (word) {
        termFrequency[word] = (termFrequency[word] || 0) + 1;
      }
    });

    // For simplicity, use a fixed vocabulary of common English words
    const vocabulary = [
      "the",
      "a",
      "is",
      "in",
      "it",
      "of",
      "to",
      "for",
      "and",
      "with",
      "on",
      "that",
      "this",
      "user",
      "context",
      "data",
      "system",
    ];
    return vocabulary.map((vocabWord) => termFrequency[vocabWord] || 0);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error("Vectors must be of the same length");
    }

    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val * val, 0));

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export { ContextQualityScorer, QualityScore };
