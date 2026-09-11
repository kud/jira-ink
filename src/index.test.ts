import { describe, expect, it } from "vitest"

describe("@kud/jira-ink", () => {
  it("exports the screen in both shapes and the fetch behind it", async () => {
    const mod = await import("./index.js")

    expect(typeof mod.IssueDetailView).toBe("function")
    expect(typeof mod.IssueBody).toBe("function")
    expect(typeof mod.issueDetailOf).toBe("function")
    expect(typeof mod.transitionsOf).toBe("function")
  })
})
