import type { JiraClient, JiraIssue } from "@kud/jira"
import { describe, expect, it, vi } from "vitest"
import {
  blockIndexOfStop,
  blocksFor,
  boardOf,
  countsFor,
  OFF_BOARD,
  priorityGlyph,
  relativeAge,
  subtreeOf,
  tabOf,
  tabsFromBoard,
  tabsFromCategories,
  tabsFromConfig,
  toBoardRow,
  treePrefix,
  visibleTabs,
  type Block,
  type BoardRow,
} from "./board.js"

const row = (over: Partial<BoardRow>): BoardRow => ({
  key: "SHOP-1",
  summary: "a summary",
  status: "Anything",
  statusId: "1",
  category: "indeterminate",
  type: "Task",
  container: false,
  priority: null,
  assignee: "Ada Okafor",
  updated: "2026-08-14T09:12:00.000Z",
  ...over,
})

const epic = { key: "SHOP-300", summary: "Checkout" }

describe("toBoardRow", () => {
  it("answers the container question from hierarchyLevel, then the name", () => {
    const issue = (issuetype: JiraIssue["fields"]["issuetype"]): JiraIssue => ({
      id: "1",
      key: "SHOP-1",
      self: "",
      fields: { summary: "s", status: { id: "10", name: "Open" }, issuetype },
    })
    expect(
      toBoardRow(issue({ id: "1", name: "Initiative", hierarchyLevel: 2 }))
        .container,
    ).toBe(true)
    expect(toBoardRow(issue({ id: "2", name: "Epic" })).container).toBe(true)
    expect(
      toBoardRow(issue({ id: "3", name: "Story", hierarchyLevel: 0 }))
        .container,
    ).toBe(false)
    expect(toBoardRow(issue({ id: "1", name: "Bug" })).statusId).toBe("10")
  })
})

describe("tabs", () => {
  it("categories file every row somewhere, unknown included", () => {
    const tabs = tabsFromCategories()
    expect(tabOf(row({ category: "new" }), tabs)).toBe("todo")
    expect(tabOf(row({ category: "done" }), tabs)).toBe("done")
    expect(tabOf(row({ category: "unknown" }), tabs)).toBe("doing")
  })

  it("board columns claim statuses by id, and the rest go Off board", () => {
    const tabs = tabsFromBoard({
      id: 1,
      name: "Team",
      columnConfig: {
        columns: [
          { name: "Ready", statuses: [{ id: "10" }] },
          { name: "Building", statuses: [{ id: "20" }, { id: "21" }] },
        ],
      },
    })!
    expect(tabs.source).toBe("board")
    expect(tabs.tabs.map((t) => t.label)).toEqual([
      "Ready",
      "Building",
      "Off board",
    ])
    expect(tabOf(row({ statusId: "21", status: "Nope" }), tabs)).toBe(
      "column:1",
    )
    expect(tabOf(row({ statusId: "99" }), tabs)).toBe(OFF_BOARD)
  })

  it("a board with no columns yields nothing, so the caller falls through", () => {
    expect(tabsFromBoard({ id: 1, name: "Empty" })).toBeNull()
    expect(
      tabsFromBoard({ id: 1, name: "Empty", columnConfig: { columns: [] } }),
    ).toBeNull()
  })

  it("config tabs match by id or name, and an unmatched tab still draws at 0", () => {
    const tabs = tabsFromConfig([
      { label: "Now", statuses: ["10", "In Review"] },
      { label: "Ghost", statuses: ["does-not-exist"] },
    ])
    const rows = [
      row({ statusId: "10" }),
      row({ key: "B", status: "In Review", statusId: "77" }),
    ]
    const counts = countsFor(rows, tabs)
    expect(counts["config:0"]).toBe(2)
    expect(counts["config:1"]).toBe(0)
    expect(visibleTabs(tabs, counts).map((t) => t.label)).toEqual([
      "Now",
      "Ghost",
    ])
  })

  it("Off board is drawn only when it holds something", () => {
    const tabs = tabsFromConfig([{ label: "Now", statuses: ["10"] }])
    expect(
      visibleTabs(tabs, countsFor([row({ statusId: "10" })], tabs)).map(
        (t) => t.label,
      ),
    ).toEqual(["Now"])
    expect(
      visibleTabs(tabs, countsFor([row({ statusId: "11" })], tabs)).map(
        (t) => t.label,
      ),
    ).toEqual(["Now", "Off board"])
  })

  it("counts sum to the rows given", () => {
    const tabs = tabsFromCategories()
    const rows = [
      row({ key: "A-1", category: "new" }),
      row({ key: "A-2", category: "indeterminate" }),
      row({ key: "A-3", category: "done" }),
      row({ key: "A-4", category: "unknown" }),
    ]
    const counts = countsFor(rows, tabs)
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(rows.length)
  })
})

describe("boardOf", () => {
  const client = (config: unknown): JiraClient =>
    ({
      searchIssues: vi.fn(async () => []),
      getBoardConfiguration: vi.fn(async () => config),
    }) as unknown as JiraClient

  it("takes config tabs over the board, and the board over categories", async () => {
    const withColumns = {
      id: 1,
      name: "B",
      columnConfig: { columns: [{ name: "C", statuses: [{ id: "1" }] }] },
    }
    expect(
      (
        await boardOf(client(withColumns), "x", {
          tabs: [{ label: "T", statuses: ["1"] }],
          board: 1,
        })
      ).tabs.source,
    ).toBe("config")
    expect(
      (await boardOf(client(withColumns), "x", { board: 1 })).tabs.source,
    ).toBe("board")
    expect((await boardOf(client(withColumns), "x")).tabs.source).toBe(
      "categories",
    )
  })

  it("falls through to categories when the board has no columns", async () => {
    expect(
      (await boardOf(client({ id: 1, name: "B" }), "x", { board: 1 })).tabs
        .source,
    ).toBe("categories")
  })
})

describe("grouping by parent", () => {
  const shape = (blocks: Block<string>[]): string[] =>
    blocks.map((b) =>
      b.kind === "gap"
        ? "·"
        : b.kind === "fence"
          ? `F:${b.summary}`
          : b.kind === "leaf"
            ? `${"└".repeat(b.depth)}${b.data}`
            : `${"└".repeat(b.depth)}${b.row.key}`,
    )

  it("heads a group with the container row itself when it is in the tab", () => {
    const blocks = blocksFor([
      row({ key: "A-1", parent: epic }),
      row({ key: "SHOP-300", container: true, summary: "Checkout" }),
      row({ key: "A-2" }),
    ])
    expect(shape(blocks)).toEqual(["SHOP-300", "└A-1", "·", "F:No epic", "A-2"])
  })

  it("fences a parent that is not in the tab, with a gap between groups", () => {
    const other = { key: "SHOP-350", summary: "Storefront" }
    const blocks = blocksFor([
      row({ key: "A-1", parent: epic }),
      row({ key: "A-2", parent: other }),
      row({ key: "A-3", parent: epic }),
    ])
    expect(shape(blocks)).toEqual([
      "F:Checkout",
      "└A-1",
      "└A-3",
      "·",
      "F:Storefront",
      "└A-2",
    ])
  })

  it("puts a childless container at the top as a plain row, never under No epic", () => {
    const blocks = blocksFor([
      row({ key: "A-1" }),
      row({ key: "SHOP-300", container: true }),
    ])
    expect(shape(blocks)).toEqual(["SHOP-300", "·", "F:No epic", "A-1"])
  })

  it("degrades to a plain list when nothing has a parent and nothing is a container", () => {
    expect(
      shape(blocksFor([row({ key: "A-1" }), row({ key: "A-2" })])),
    ).toEqual(["A-1", "A-2"])
  })

  it("maps the n-th stop back to its line for the cursor, skipping gaps and fences", () => {
    const blocks = blocksFor([
      row({ key: "A-1", parent: epic }),
      row({ key: "A-2" }),
    ])
    expect(blockIndexOfStop(blocks, 0)).toBe(1)
    expect(blockIndexOfStop(blocks, 1)).toBe(4)
  })
})

describe("leaves", () => {
  const prs: Record<string, string[]> = {
    "SHOP-300": ["#1"],
    "A-1": ["#2", "#3"],
    "A-3": ["#4"],
  }
  const under = (r: BoardRow): string[] => prs[r.key] ?? []
  const shape = (blocks: Block<string>[]): string[] =>
    blocks.map((b) =>
      b.kind === "gap"
        ? "·"
        : b.kind === "fence"
          ? `F:${b.summary}`
          : b.kind === "leaf"
            ? `${"└".repeat(b.depth)}${b.data}`
            : `${"└".repeat(b.depth)}${b.row.key}`,
    )

  it("hangs a row's leaves directly under it, before its children, one level down", () => {
    const blocks = blocksFor(
      [
        row({ key: "SHOP-300", container: true }),
        row({ key: "A-1", parent: epic }),
        row({ key: "A-2", parent: epic }),
      ],
      under,
    )
    expect(shape(blocks)).toEqual([
      "SHOP-300",
      "└#1",
      "└A-1",
      "└└#2",
      "└└#3",
      "└A-2",
    ])
  })

  it("hangs leaves under a fenced row and under a plain-list row alike", () => {
    expect(shape(blocksFor([row({ key: "A-3", parent: epic })], under))).toEqual(
      ["F:Checkout", "└A-3", "└└#4"],
    )
    expect(shape(blocksFor([row({ key: "A-3" })], under))).toEqual([
      "A-3",
      "└#4",
    ])
  })

  it("counts leaves as cursor stops, never fences", () => {
    const blocks = blocksFor([row({ key: "A-3", parent: epic })], under)
    expect(blockIndexOfStop(blocks, 0)).toBe(1)
    expect(blockIndexOfStop(blocks, 1)).toBe(2)
  })

  it("subtreeOf takes a row with its leaves and children, and a leaf alone", () => {
    const blocks = blocksFor(
      [
        row({ key: "SHOP-300", container: true }),
        row({ key: "A-1", parent: epic }),
        row({ key: "A-2", parent: epic }),
        row({ key: "B-1" }),
      ],
      under,
    )
    expect(shape(subtreeOf(blocks, 0))).toEqual([
      "SHOP-300",
      "└#1",
      "└A-1",
      "└└#2",
      "└└#3",
      "└A-2",
    ])
    expect(shape(subtreeOf(blocks, 2))).toEqual(["└A-1", "└└#2", "└└#3"])
    expect(shape(subtreeOf(blocks, 3))).toEqual(["└└#2"])
    expect(shape(subtreeOf(blocks, 6))).toEqual(["·"])
    expect(subtreeOf(blocks, 99)).toEqual([])
  })

  it("draws ├─ while a sibling follows, └─ for the last, and a stem past a non-final parent", () => {
    const blocks = blocksFor(
      [
        row({ key: "SHOP-300", container: true }),
        row({ key: "A-1", parent: epic }),
        row({ key: "A-2", parent: epic }),
      ],
      under,
    )
    expect(blocks.map((_, i) => treePrefix(blocks, i))).toEqual([
      "",
      "├─ ",
      "├─ ",
      "│  ├─ ",
      "│  └─ ",
      "└─ ",
    ])
  })

  it("drops the stem under the last child, and a lone child closes at once", () => {
    const blocks = blocksFor(
      [row({ key: "SHOP-300", container: true }), row({ key: "A-1", parent: epic })],
      under,
    )
    expect(blocks.map((_, i) => treePrefix(blocks, i))).toEqual([
      "",
      "├─ ",
      "└─ ",
      "   ├─ ",
      "   └─ ",
    ])
    expect(treePrefix(blocksFor([row({ key: "A-3", parent: epic })]), 1)).toBe("└─ ")
  })
})

describe("row glyphs", () => {
  it("ranks a priority against the default rung, P-ladder included", () => {
    // Five rungs, in Jira's own arrow grammar, and the default rung gets a
    // glyph of its own — a blank beside a marked row read as MISSING, not as
    // normal. Only a priority we cannot place stays blank.
    expect(priorityGlyph("Highest")).toBe("⇈")
    expect(priorityGlyph("P1")).toBe("⇈")
    expect(priorityGlyph("High")).toBe("↑")
    expect(priorityGlyph("P2")).toBe("↑")
    expect(priorityGlyph("Medium")).toBe("=")
    expect(priorityGlyph("P3")).toBe("=")
    expect(priorityGlyph("Low")).toBe("↓")
    expect(priorityGlyph("P4")).toBe("↓")
    expect(priorityGlyph("Lowest")).toBe("⇊")
    expect(priorityGlyph(null)).toBe(" ")
    expect(priorityGlyph("Whenever")).toBe(" ")
  })

  it("renders age in the largest whole unit", () => {
    const now = Date.parse("2026-08-14T12:00:00.000Z")
    expect(relativeAge("2026-08-14T11:58:00.000Z", now)).toBe("2m")
    expect(relativeAge("2026-08-14T07:00:00.000Z", now)).toBe("5h")
    expect(relativeAge("2026-08-11T12:00:00.000Z", now)).toBe("3d")
    expect(relativeAge("2026-07-10T12:00:00.000Z", now)).toBe("5w")
    expect(relativeAge("not a date", now)).toBe("")
  })
})
