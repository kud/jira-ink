import { describe, expect, it } from "vitest"

describe("@kud/jira-ink", () => {
  it("has a public surface module that loads cleanly", async () => {
    const mod = await import("./index.js")

    expect(mod).toBeDefined()
  })
})
