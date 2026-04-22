import { describe, expect, it } from "vitest";
import { createDefaultProject } from "../schema";
import { validateDraftExpression } from "./validateDraftExpression";

describe("validateDraftExpression", () => {
  it("returns null for valid function text", () => {
    const p = createDefaultProject();
    expect(validateDraftExpression(p, "sin(x)")).toBeNull();
  });

  it("returns message for invalid symbol", () => {
    const p = createDefaultProject();
    const err = validateDraftExpression(p, "fooBar(x)");
    expect(err).toBeTruthy();
    expect(err).toMatch(/Unknown symbol|not allowed/i);
  });
});
