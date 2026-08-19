import { HierarchicalNSW } from "hnswlib-node";
import { describe, expect, it } from "vitest";

const usableBenchmarkQuery = (value: string | undefined) => Boolean(value?.trim() && value.trim().length > 8);

describe("HNSW retrieval runtime", () => {
  it("indexes and returns the nearest cosine neighbour", () => {
    const index = new HierarchicalNSW("cosine", 3);
    index.initIndex({ maxElements: 3, m: 8, efConstruction: 40, randomSeed: 43 });
    index.addPoint([1, 0, 0], 0);
    index.addPoint([0, 1, 0], 1);
    index.addPoint([0, 0, 1], 2);
    index.setEf(16);

    expect(index.searchKnn([0.99, 0.01, 0], 1).neighbors).toEqual([0]);
  });

  it("excludes blank source-query metadata from benchmark selection", () => {
    expect(["", "          ", undefined, "valid query"].filter(usableBenchmarkQuery)).toEqual(["valid query"]);
  });
});
