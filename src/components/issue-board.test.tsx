import { renderFrames } from "@kud/cli-testing"
import { render } from "ink-testing-library"
import { Box, Text } from "ink"
import { describe, expect, it, vi } from "vitest"
import { mockBoard } from "../lib/board-mock.js"
import { tabsFromCategories } from "../lib/board.js"
import {
  IssueBoard,
  IssueBoardSkeleton,
  type BoardFrameParts,
  type IssueBoardProps,
} from "./issue-board.js"

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const LEFT = "\u001b[D"
const DOWN = "\u001b[B"
const RIGHT = "\u001b[C"
const ENTER = "\r"
const SLASH = "/"

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

  describe("isActive", () => {
    it("disables all key handlers when false", async () => {
      const onOpen = vi.fn()
      const onCursor = vi.fn()
      const onSearch = vi.fn()
      const onToggleAll = vi.fn()
      const onRefresh = vi.fn()
      const onClearSearch = vi.fn()
      const r = mount({
        isActive: false,
        onOpen,
        onCursor,
        onSearch,
        onToggleAll,
        onRefresh,
        onClearSearch,
      })
      await r.waitFor("SHOP-412")
      const frameBefore = r.lastFrame()

      // Press down arrow (cursor movement)
      r.write(DOWN)
      await settle()
      expect(r.lastFrame()).toBe(frameBefore)
      // onCursor is called once on mount with initial cursor position
      // After that, no more calls should happen when keys are pressed while inactive
      expect(onCursor).toHaveBeenCalledTimes(1)

      // Press right arrow (tab switch)
      r.write(RIGHT)
      await settle()
      expect(r.lastFrame()).toBe(frameBefore)

      // Press Enter (open)
      r.write(ENTER)
      await settle()
      expect(r.lastFrame()).toBe(frameBefore)
      expect(onOpen).not.toHaveBeenCalled()

      // Press / (search)
      r.write(SLASH)
      await settle()
      expect(r.lastFrame()).toBe(frameBefore)
      expect(onSearch).not.toHaveBeenCalled()

      // Press a (toggle all)
      r.write("a")
      await settle()
      expect(onToggleAll).not.toHaveBeenCalled()

      // Press r (refresh)
      r.write("r")
      await settle()
      expect(onRefresh).not.toHaveBeenCalled()

      r.unmount()
    })

    it("preserves cursor, tab, and search state when toggled off and on", async () => {
      const onOpen = vi.fn()
      const onCursor = vi.fn()
      const onSearch = vi.fn()
      const onToggleAll = vi.fn()
      const onRefresh = vi.fn()
      const onClearSearch = vi.fn()

      const makeElement = (isActive: boolean) => (
        <IssueBoard<string>
          model={mockBoard()}
          viewer="Ada Okafor"
          loadedAt={Date.now()}
          scope={{ kind: "mine" }}
          showingAll={false}
          searchError={null}
          width={100}
          height={24}
          isActive={isActive}
          onOpen={onOpen}
          onCursor={onCursor}
          onSearch={onSearch}
          onToggleAll={onToggleAll}
          onRefresh={onRefresh}
          onClearSearch={onClearSearch}
        />
      )

      const instance = render(makeElement(true))

      const waitFor = async (needle: string | RegExp) => {
        const deadline = Date.now() + 3000
        for (;;) {
          const current = instance.frames.join("\n")
          const found =
            typeof needle === "string"
              ? current.includes(needle)
              : needle.test(current)
          if (found) return current
          if (Date.now() >= deadline) {
            throw new Error(`Timed out waiting for ${needle}`)
          }
          await settle()
        }
      }

      const waitForFrameChange = async (prevFrame: string) => {
        const deadline = Date.now() + 2000
        for (;;) {
          const current = instance.lastFrame() ?? ""
          if (current !== prevFrame) return current
          if (Date.now() >= deadline) {
            throw new Error("Timed out waiting for frame change")
          }
          await settle()
        }
      }

      await waitFor("SHOP-412")
      await settle()

      // Move cursor down to second item (first child of epic)
      const frameBeforeMove = instance.lastFrame() ?? ""
      instance.stdin.write(DOWN)
      await settle()

      // Wait for frame to change (cursor moved)
      const frameWithCursorDown = await waitForFrameChange(frameBeforeMove)

      // Deactivate
      instance.rerender(makeElement(false))
      await settle()

      // Press keys while inactive — nothing should change
      instance.stdin.write(DOWN)
      await settle()
      instance.stdin.write(RIGHT)
      await settle()
      instance.stdin.write(ENTER)
      await settle()
      expect(instance.lastFrame() ?? "").toBe(frameWithCursorDown)
      expect(onOpen).not.toHaveBeenCalled()

      // Reactivate
      instance.rerender(makeElement(true))
      await settle()

      // Cursor should still be on second item (SHOP-412)
      expect(instance.lastFrame() ?? "").toBe(frameWithCursorDown)

      // Keys should work again — press Enter to open SHOP-412
      instance.stdin.write(ENTER)
      await settle()
      expect(onOpen).toHaveBeenCalledWith("SHOP-412")

      // Another down arrow should move cursor
      instance.stdin.write(DOWN)
      await settle()
      expect(instance.lastFrame() ?? "").not.toBe(frameWithCursorDown)

      instance.unmount()
    })

    it("ignores typing into an open search box once deactivated", async () => {
      const onSearch = vi.fn()
      const element = (isActive: boolean) => (
        <IssueBoard<string>
          model={mockBoard()}
          viewer="Ada Okafor"
          loadedAt={Date.now()}
          scope={{ kind: "mine" }}
          showingAll={false}
          searchError={null}
          width={100}
          height={24}
          isActive={isActive}
          onOpen={vi.fn()}
          onToggleAll={vi.fn()}
          onRefresh={vi.fn()}
          onSearch={onSearch}
          onClearSearch={vi.fn()}
        />
      )
      const instance = render(element(true))
      await settle()
      instance.stdin.write(SLASH)
      await settle()
      expect(instance.lastFrame()).toContain("words, or JQL")

      instance.rerender(element(false))
      await settle()
      const frameWithEmptySearch = instance.lastFrame()
      instance.stdin.write("bug")
      await settle()
      instance.stdin.write(ENTER)
      await settle()

      expect(instance.lastFrame()).toBe(frameWithEmptySearch)
      expect(onSearch).not.toHaveBeenCalled()
      instance.unmount()
    })
  })
})

describe("IssueBoardSkeleton", () => {
  const BAR = /█/

  it("draws the real tab labels with unknown counts", async () => {
    const r = renderFrames(
      <IssueBoardSkeleton
        tabs={tabsFromCategories()}
        width={100}
        height={24}
      />,
    )
    await r.waitFor("To do")
    const f = r.lastFrame()
    expect(f).toContain("To do  (–)")
    expect(f).toContain("In progress  (–)")
    expect(f).toContain("Done  (–)")
    r.unmount()
  })

  it("draws six bar rows in two groups of three, with no tree", async () => {
    const r = renderFrames(
      <IssueBoardSkeleton
        tabs={tabsFromCategories()}
        width={100}
        height={24}
      />,
    )
    await r.waitFor("█")
    const lines = r.lastFrame().split("\n")
    const first = lines.findIndex((l) => BAR.test(l))
    const run = lines.slice(first, first + 7)
    expect(run.map((l) => BAR.test(l))).toEqual([
      true,
      true,
      true,
      false,
      true,
      true,
      true,
    ])
    expect(run[3]!.trim()).toBe("")
    expect(lines.filter((l) => BAR.test(l))).toHaveLength(6)
    expect(r.lastFrame()).not.toMatch(/[├└│]/)
    r.unmount()
  })

  it("hands the same frame its parts: unknown count, busy status, no hints of its own", async () => {
    let parts: BoardFrameParts | undefined
    const frame = vi.fn((p: BoardFrameParts) => {
      parts = p
      return (
        <Box flexDirection="column">
          <Text>FRAMED</Text>
          {p.body}
        </Box>
      )
    })
    const r = renderFrames(
      <IssueBoardSkeleton
        tabs={tabsFromCategories()}
        width={100}
        height={24}
        frame={frame}
      />,
    )
    await r.waitFor("FRAMED")
    expect(frame).toHaveBeenCalled()
    expect(parts?.title.count).toBeNull()
    expect(parts?.title.status).toEqual({
      text: "reading the board",
      tone: "busy",
    })
    expect(parts?.hints).toEqual([])
    r.unmount()
  })

  it("ends its own footer with q quit and nothing else when unframed", async () => {
    const r = renderFrames(
      <IssueBoardSkeleton
        tabs={tabsFromCategories()}
        width={100}
        height={24}
      />,
    )
    await r.waitFor("quit")
    const last = r.lastFrame().trimEnd().split("\n").at(-1)!
    expect(last.trim()).toBe("q quit")
    r.unmount()
  })
})
