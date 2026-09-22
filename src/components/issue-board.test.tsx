import { renderFrames } from "@kud/cli-testing"
import { Box, Text } from "ink"
import { describe, expect, it, vi } from "vitest"
import { mockBoard } from "../lib/board-mock.js"
import { IssueBoard, type IssueBoardProps } from "./issue-board.js"

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const LEFT = "[D"
const DOWN = "[B"

const mount = (over: Partial<IssueBoardProps<string>> = {}) =>
  renderFrames(
    <IssueBoard<string>
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
    // The epic is counted in each of the three tabs it heads a group in —
    // placement is bottom-up, so it is a row in all three and nowhere else.
    expect(f).toContain("To do (2)")
    expect(f).toContain("In progress (5)")
    expect(f).toContain("Done (2)")
    expect(f).not.toContain("Blocked")
    r.unmount()
  })

  it("hangs rows under a fence for a parent the board holds no row for", async () => {
    const r = mount()
    await r.waitFor("SHOP-412")
    const f = r.lastFrame()
    // SHOP-350 is nobody's row here, so it fences; SHOP-300 is a row and is
    // hauled in as a head instead, however far its own status is from this tab.
    expect(f).toContain("── Storefront refresh · SHOP-350")
    expect(f).not.toContain("── Basket and checkout correctness")
    expect(f).toContain("└─")
    expect(f).toContain("── No epic")
    r.unmount()
  })

  it("heads every tab its children are split across, noting its own status and the rest", async () => {
    const r = mount()
    await r.waitFor("SHOP-412")
    const head = r
      .lastFrame()
      .split("\n")
      .find((l) => l.includes("SHOP-300"))
    expect(head).toContain("own To do")
    expect(head).toMatch(/1 To do · 1 Done/)
    r.unmount()
  })

  it("draws a move in flight in place of the notes, and nothing else moves", async () => {
    const m = mockBoard()
    const r = mount({
      model: {
        ...m,
        rows: m.rows.map((row) =>
          row.key === "SHOP-412" ? { ...row, pending: "QA" } : row,
        ),
      },
    })
    await r.waitFor("⋯ → QA")
    const line = r
      .lastFrame()
      .split("\n")
      .find((l) => l.includes("SHOP-412"))!
    expect(line).toContain("⋯ → QA")
    expect(r.lastFrame()).toContain("In progress (5)")
    r.unmount()
  })

  it("says where a fenced parent is: the tab when it is yours, the owner when it is not", async () => {
    const m = mockBoard()
    const parent = {
      ...m.rows[0]!,
      key: "SHOP-350",
      summary: "Storefront refresh",
      assignee: "Priya Raman",
    }
    const r = mount({ model: m, parents: [parent] })
    await r.waitFor("SHOP-350")
    const fence = r
      .lastFrame()
      .split("\n")
      .find((l) => l.includes("SHOP-350"))!
    expect(fence).toContain("")
    expect(fence).not.toContain("To do")
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

  it("hangs a host's leaves under their row with a stem, and opens one on enter", async () => {
    const onOpen = vi.fn()
    const onOpenLeaf = vi.fn()
    const r = mount({
      onOpen,
      leaves: {
        under: (row) => (row.key === "SHOP-412" ? ["#128", "#131"] : []),
        keyOf: (l) => l,
        render: (l, { active, width }) => (
          <Text>{`PR ${l} ${active ? "on" : "off"} w${width}`}</Text>
        ),
        onOpen: onOpenLeaf,
      },
    })
    await r.waitFor("#131")
    const lines = r.lastFrame().split("\n")
    const task = lines.findIndex((l) => l.includes("SHOP-412"))
    expect(lines[task]).toContain("├─ ")
    expect(lines[task + 1]).toContain("│  ├─ PR #128 off w87")
    expect(lines[task + 2]).toContain("│  └─ PR #131 off w87")
    for (const _ of [0, 1]) {
      r.write(DOWN)
      await settle()
    }
    await r.waitFor("PR #128 on")
    r.write("\r")
    await settle()
    expect(onOpenLeaf).toHaveBeenCalledWith("#128")
    expect(onOpen).not.toHaveBeenCalled()
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

  it("reports the cursor and its subtree, so a host can bind keys of its own", async () => {
    const seen: string[][] = []
    const r = mount({
      leaves: {
        under: (row) => (row.key === "SHOP-412" ? ["#128"] : []),
        keyOf: (l) => l,
        render: (l) => <Text>{`PR ${l}`}</Text>,
        onOpen: vi.fn(),
      },
      onCursor: (at) =>
        seen.push(
          at
            ? at.subtree.map((b) =>
                b.kind === "leaf"
                  ? String(b.data)
                  : b.kind === "issue"
                    ? b.row.key
                    : b.kind,
              )
            : [],
        ),
    })
    await r.waitFor("#128")
    // The epic heads this tab, so the first report carries the whole group.
    expect(seen[seen.length - 1]).toEqual([
      "SHOP-300",
      "SHOP-412",
      "#128",
      "SHOP-401",
    ])
    r.write(DOWN)
    await settle()
    expect(seen[seen.length - 1]).toEqual(["SHOP-412", "#128"])
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
