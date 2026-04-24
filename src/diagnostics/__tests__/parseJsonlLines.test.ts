import { parseJsonlLines } from "../parseJsonlLines";

describe("parseJsonlLines", () => {
  it("returns empty array for empty string", () => {
    expect(parseJsonlLines("")).toEqual([]);
  });

  it("parses valid lines and skips blanks", () => {
    const line1 = JSON.stringify({
      ts: "2026-01-01T00:00:00.000Z",
      kind: "uncaught_js",
      name: "Error",
      message: "boom",
      stack: "at x",
    });
    const line2 = JSON.stringify({
      ts: "2026-01-02T00:00:00.000Z",
      kind: "react",
      name: "Error",
      message: "render",
    });
    const raw = `${line1}\n\n${line2}\n`;
    const rows = parseJsonlLines(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.message).toBe("boom");
    expect(rows[1]?.kind).toBe("react");
  });

  it("skips invalid JSON and lines missing required fields", () => {
    const good = JSON.stringify({
      ts: "2026-01-01T00:00:00.000Z",
      kind: "manual",
      name: "Error",
      message: "ok",
    });
    const raw = `{not json}\n${good}\n{"ts":"x"}\n`;
    expect(parseJsonlLines(raw)).toHaveLength(1);
    expect(parseJsonlLines(raw)[0]?.message).toBe("ok");
  });
});
