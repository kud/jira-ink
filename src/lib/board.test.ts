import type { JiraClient, JiraIssue } from "@kud/jira"
import { describe, expect, it, vi } from "vitest"
import {
  blockIndexOfStop,
  blocksFor,
  boardOf,
  countsFor,
  fenceNote,
  headNote,
  OFF_BOARD,
  parentsOf,
  pendingRow,
  placementOf,
  priorityGlyph,
  relativeAge,
  rowsInTab,
  settleRow,
  subtreeOf,
  tabLabelOf,
  tabOf,
  tabsFromBoard,
  tabsFromCategories,
  tabsFromConfig,
  toBoardRow,
  transitionRow,
  treePrefix,
  withBehind,
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

describe("bottom-up placement", () => {
  const tabs = tabsFromConfig([
    { label: "Backlog", statuses: ["To Do"] },
    { label: "In progress", statuses: ["In Progress"] },
    { label: "Review", statuses: ["Code Review"] },
  ])
  const at = (key: string, status: string, over: Partial<BoardRow> = {}) =>
    row({ key, status, statusId: status, ...over })
  const value = (label: string): string =>
    tabs.tabs.find((t) => t.label === label)!.value
  const where = (rows: BoardRow[], key: string): string[] =>
    placementOf(rows, tabs)
      .tabsOf(key)
      .map((v) => tabs.tabs.find((t) => t.value === v)!.label)

  it("places a container by its children, never by its own status", () => {
    const rows = [
      at("SHOP-300", "In Progress", { container: true }),
      at("A-1", "Anything", { parent: epic }),
      at("A-2", "Anything", { parent: epic }),
    ]
    expect(where(rows, "SHOP-300")).toEqual(["Off board"])
    expect(where(rows, "A-1")).toEqual(["Off board"])
  })

  it("heads a group in every tab its children are split across, in tab order", () => {
    const rows = [
      at("SHOP-300", "To Do", { container: true }),
      at("A-1", "Code Review", { parent: epic }),
      at("A-2", "To Do", { parent: epic }),
    ]
    expect(where(rows, "SHOP-300")).toEqual(["Backlog", "Review"])
  })

  it("sits a childless container Off board whatever its own status says", () => {
    const rows = [at("SHOP-300", "In Progress", { container: true })]
    expect(where(rows, "SHOP-300")).toEqual(["Off board"])
  })

  it("counts a head once per tab it appears in, and rowsInTab hauls it along", () => {
    const rows = [
      at("SHOP-300", "In Progress", { container: true }),
      at("A-1", "Code Review", { parent: epic }),
      at("A-2", "To Do", { parent: epic }),
    ]
    const counts = countsFor(rows, tabs)
    expect(counts[value("Review")]).toBe(2)
    expect(counts[value("Backlog")]).toBe(2)
    expect(counts[value("In progress")]).toBe(0)
    expect(rowsInTab(rows, tabs, value("Review")).map((r) => r.key)).toEqual([
      "SHOP-300",
      "A-1",
    ])
  })

  it("notes the head's own status when it differs, and where the rest of its children are", () => {
    const rows = [
      at("SHOP-300", "In Progress", { container: true }),
      at("A-1", "Code Review", { parent: epic }),
      at("A-2", "To Do", { parent: epic }),
      at("A-3", "To Do", { parent: epic }),
    ]
    const p = placementOf(rows, tabs)
    const head = rows[0]!
    expect(headNote(head, tabs, value("Review"), p)).toBe(
      "own In progress · 2 Backlog",
    )
    expect(headNote(head, tabs, value("Backlog"), p)).toBe(
      "own In progress · 1 Review",
    )
    expect(headNote(rows[1]!, tabs, value("Review"), p)).toBeUndefined()
  })

  it("omits the children note when every child is here", () => {
    const rows = [
      at("SHOP-300", "To Do", { container: true }),
      at("A-1", "To Do", { parent: epic }),
    ]
    expect(
      headNote(rows[0]!, tabs, value("Backlog"), placementOf(rows, tabs)),
    ).toBeUndefined()
  })

  it("counts only the rows the board holds, never an epic-children query", () => {
    const rows = [
      at("SHOP-300", "To Do", { container: true }),
      at("A-1", "Code Review", { parent: epic }),
    ]
    expect(
      headNote(rows[0]!, tabs, value("Review"), placementOf(rows, tabs)),
    ).toBe("own Backlog")
  })
})

describe("behind", () => {
  const tabs = tabsFromConfig([
    { label: "Backlog", statuses: ["Backlog"] },
    { label: "In progress", statuses: ["In Progress"] },
    { label: "Review", statuses: ["Code Review"] },
  ])
  const at = (key: string, status: string, category: BoardRow["category"], over: Partial<BoardRow> = {}) =>
    row({ key, status, statusId: status, category, ...over })

  it("marks an epic parked Off board once a child has started", () => {
    const rows = withBehind(
      [
        at("SHOP-300", "Someday", "new", { container: true }),
        at("A-1", "Code Review", "indeterminate", { parent: epic }),
      ],
      tabs,
    )
    expect(rows[0]!.behind).toBe("")
    expect(rows[1]!.behind).toBeUndefined()
  })

  it("leaves an epic Off board alone while every child is still new", () => {
    const rows = withBehind(
      [
        at("SHOP-300", "Someday", "new", { container: true }),
        at("A-1", "Backlog", "new", { parent: epic }),
      ],
      tabs,
    )
    expect(rows[0]!.behind).toBeUndefined()
  })

  it("marks an epic still open when every child is done", () => {
    const rows = withBehind(
      [
        at("SHOP-300", "In Progress", "indeterminate", { container: true }),
        at("A-1", "Done", "done", { parent: epic }),
        at("A-2", "Done", "done", { parent: epic }),
      ],
      tabs,
    )
    expect(rows[0]!.behind).toBe("")
  })

  it("never overwrites a reason the host filled in", () => {
    const rows = withBehind(
      [
        at("SHOP-300", "Someday", "new", { container: true, behind: "PR #12 open" }),
        at("A-1", "Code Review", "indeterminate", { parent: epic }),
      ],
      tabs,
    )
    expect(rows[0]!.behind).toBe("PR #12 open")
  })
})

describe("fence notes", () => {
  const tabs = tabsFromConfig([
    { label: "Backlog", statuses: ["Backlog"] },
    { label: "Review", statuses: ["Code Review"] },
  ])
  const mine = { viewer: "Ada Okafor", mine: true }
  const parent = (over: Partial<BoardRow>) =>
    row({ key: "SHOP-350", container: true, status: "Backlog", statusId: "Backlog", ...over })

  it("names the tab when the parent is the viewer's own", () => {
    expect(fenceNote(parent({}), tabs, mine)).toEqual({
      segment: "Backlog",
      behind: false,
    })
  })

  it("names the owner when the parent is someone else's, and never both", () => {
    expect(fenceNote(parent({ assignee: "Priya Raman" }), tabs, mine)).toEqual({
      segment: "@Priya",
      behind: false,
    })
    expect(fenceNote(parent({ assignee: "unassigned" }), tabs, mine)).toEqual({
      segment: "unassigned",
      behind: false,
    })
  })

  it("carries behind only when the parent is the viewer's", () => {
    expect(fenceNote(parent({ behind: "" }), tabs, mine).behind).toBe(true)
    expect(
      fenceNote(parent({ behind: "", assignee: "Priya Raman" }), tabs, mine)
        .behind,
    ).toBe(false)
  })

  it("names the owner on a board that is not scoped to one assignee", () => {
    expect(
      fenceNote(parent({}), tabs, { viewer: "Ada Okafor", mine: false }).segment,
    ).toBe("@Ada")
  })

  it("stays empty until the lookup lands", () => {
    expect(fenceNote(undefined, tabs, mine)).toEqual({
      segment: "",
      behind: false,
    })
  })
})

describe("transitions", () => {
  const tabs = tabsFromConfig([
    { label: "Backlog", statuses: ["Backlog"] },
    { label: "QA", statuses: ["10500"] },
  ])
  const model = {
    tabs,
    rows: [row({ key: "A-1", status: "Backlog", statusId: "Backlog" })],
  }
  const to = { id: "10500", name: "Ready for QA", category: "indeterminate" as const }

  it("names the tab a transition lands in, by id and not by name", () => {
    expect(tabLabelOf(to, tabs)).toBe("QA")
  })

  it("marks the row without moving it", () => {
    const next = pendingRow(model, "A-1", to)
    expect(next.rows[0]!.pending).toBe("QA")
    expect(tabOf(next.rows[0]!, tabs)).toBe(tabOf(model.rows[0]!, tabs))
  })

  it("rewrites the status on the 204 so the tab follows, and clears the marker", () => {
    const next = transitionRow(pendingRow(model, "A-1", to), "A-1", to)
    expect(next.rows[0]!.pending).toBeUndefined()
    expect(next.rows[0]!.status).toBe("Ready for QA")
    expect(next.rows[0]!.statusId).toBe("10500")
    expect(next.rows[0]!.category).toBe("indeterminate")
    expect(tabOf(next.rows[0]!, tabs)).toBe(
      tabs.tabs.find((t) => t.label === "QA")!.value,
    )
  })

  it("leaves a rejected move exactly where it was", () => {
    const next = settleRow(pendingRow(model, "A-1", to), "A-1")
    expect(next.rows[0]!.pending).toBeUndefined()
    expect(next.rows[0]!.status).toBe("Backlog")
  })

  it("touches no other row", () => {
    const two = { ...model, rows: [...model.rows, row({ key: "A-2" })] }
    expect(pendingRow(two, "A-1", to).rows[1]).toBe(two.rows[1])
  })
})

describe("parentsOf", () => {
  const issue = (key: string): JiraIssue =>
    ({ key, fields: { summary: key, assignee: { displayName: "Priya Raman" } } }) as JiraIssue

  it("asks once for every parent the board holds no row for, and never twice for one", async () => {
    const searchIssues = vi.fn(async () => [issue("SHOP-350")])
    const rows = [
      row({ key: "A-1", parent: { key: "SHOP-350", summary: "Storefront" } }),
      row({ key: "A-2", parent: { key: "SHOP-350", summary: "Storefront" } }),
      row({ key: "SHOP-300", container: true }),
      row({ key: "A-3", parent: epic }),
    ]
    const got = await parentsOf({ searchIssues } as unknown as JiraClient, rows)
    expect(searchIssues).toHaveBeenCalledTimes(1)
    expect(searchIssues.mock.calls[0]![0]).toBe('key in ("SHOP-350")')
    expect(got.map((p) => p.assignee)).toEqual(["Priya Raman"])
  })

  it("makes no call when every parent is already a row", async () => {
    const searchIssues = vi.fn()
    expect(
      await parentsOf({ searchIssues } as unknown as JiraClient, [
        row({ key: "SHOP-300", container: true }),
        row({ key: "A-1", parent: epic }),
      ]),
    ).toEqual([])
    expect(searchIssues).not.toHaveBeenCalled()
  })
})
