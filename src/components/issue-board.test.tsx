import { renderFrames } from "@kud/cli-testing"
import { Box, Text } from "ink"
import { describe, expect, it, vi } from "vitest"
import { mockBoard } from "../lib/board-mock.js"
import { IssueBoard, type IssueBoardProps } from "./issue-board.js"

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const LEFT = "[D"

const mount = (over: Partial<IssueBoardProps> = {}) =>
  renderFrames(
    <IssueBoard
      model={mockBoard()}
      viewer="Ada Okafor"
      loadedAt={Date.now()}
      scope={{ kind: "mine" }}
      showingAll={false}
      searchError={null}
      width={100}
      height={24}
      onOpen={vi.fn()}
      onToggleAll={vi.fn()}
      onRefresh={vi.fn()}
      onSearch={vi.fn()}
      onClearSearch={vi.fn()}
      {...over}
    />,
  )

describe("IssueBoard", () => {
  it("tabs by category with counts, and never shows a status name", async () => {
    const r = mount()
    await r.waitFor("SHOP-412")
    const f = r.lastFrame()
    expect(f).toContain("To do (2)")
    expect(f).toContain("In progress (4)")
    expect(f).toContain("Done (1)")
    expect(f).not.toContain("Blocked")
    r.unmount()
  })

  it("hangs rows under a fence for a parent not in the tab, gaps between groups", async () => {
    const r = mount()
    await r.waitFor("SHOP-412")
    const f = r.lastFrame()
    expect(f).toContain("── Basket and checkout correctness · SHOP-300")
    expect(f).toContain("└─")
    expect(f).toContain("── No epic")
    r.unmount()
  })

  it("heads a group with the container's own row when it is in the tab", async () => {
    const r = mount()
    await r.waitFor("SHOP-412")
    await settle()
    r.write(LEFT)
    await r.waitFor("SHOP-397")
    const lines = r.lastFrame().split("\n")
    const head = lines.findIndex((l) => l.includes("SHOP-300"))
    const child = lines.findIndex((l) => l.includes("SHOP-397"))
    expect(lines[head]).toContain("epic")
    expect(lines[head]).not.toContain("──")
    expect(child).toBe(head + 1)
    r.unmount()
  })

  it("hands the host its facts, hints and body through the frame slot", async () => {
    const r = mount({
      frame: ({ facts, hints, body }) => (
        <Box flexDirection="column">
          <Text>{`TITLE ${facts}`}</Text>
          {body}
          <Text>{`HINTS ${hints.map(([k]) => k).join(",")}`}</Text>
        </Box>
      ),
    })
    await r.waitFor("SHOP-412")
    const f = r.lastFrame()
    expect(f).toContain("TITLE 7 items · @Ada Okafor · updated")
    expect(f).toMatch(/HINTS ↑↓,←→,enter,\/,a,r$/m)
    r.unmount()
  })

  it("narrows live on plain words and runs the query on enter", async () => {
    const onSearch = vi.fn()
    const r = mount({ onSearch })
    await r.waitFor("SHOP-412")
    await settle()
    r.write("/")
    await settle()
    r.write("coupon")
    await r.waitFor("1 of 7")
    expect(r.lastFrame()).toContain("plain")
    r.write("\r")
    await settle()
    expect(onSearch).toHaveBeenCalledWith("coupon", "auto")
    r.unmount()
  })

  it("recognises JQL by shape and does not narrow live", async () => {
    const r = mount()
    await r.waitFor("SHOP-412")
    await settle()
    r.write("/")
    await settle()
    r.write("status = Done")
    await r.waitFor("JQL")
    expect(r.lastFrame()).toContain("7 items")
    r.unmount()
  })

  it("keeps the rows and shows Jira's words when a query was rejected", async () => {
    const r = mount({
      scope: { kind: "search", query: "statsu = Done", mode: "jql" },
      searchError: "Field 'statsu' does not exist.",
    })
    await r.waitFor("statsu")
    const f = r.lastFrame()
    expect(f).toContain("✗ Field 'statsu' does not exist.")
    expect(f).toContain("SHOP-412")
    r.unmount()
  })

  it("points an empty tab at the ones that have rows", async () => {
    const model = mockBoard()
    model.rows = model.rows.filter((r) => r.category === "new")
    const r = mount({ model })
    await r.waitFor("Nothing here")
    expect(r.lastFrame()).toContain("To do (2)")
    r.unmount()
  })
})
