import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "Home.tsx"), "utf8");

describe("Vaani keyboard interaction contract", () => {
  it("keeps primary actions native and keyboard reachable", () => {
    expect(source).toContain("<button onClick={mode === \"listening\" ? stopListening : startListening}");
    expect(source).toContain("<form className=\"mt-7\" onSubmit={sendText}");
    expect(source).toContain("<button type=\"submit\"");
    expect(source).toContain("<details className=\"source-collapsible group py-5\"");
    expect(source).toContain("<summary className=\"flex items-start gap-4\"");
    expect(source).toContain("onClick={() => benchmark.mutate()}");
  });
});
