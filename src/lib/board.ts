import {
  isContainerType,
  type BoardTab as ConfiguredTab,
  type JiraBoardConfiguration,
  type JiraClient,
  type JiraIssue,
} from "@kud/jira"

/** Jira's own three, plus `unknown` for a status that arrives without one. */
export type StatusCategory = "new" | "indeterminate" | "done" | "unknown"

/**
 * One issue, as the board reads it: every field already a string, the
 * container question already answered. The view never touches a raw
 * `JiraIssue`, so a host that fakes the fetch gets a board it can predict.
 * The field names deliberately match the cockpit's own row vocabulary
 * (`key`, `container`, `parent`) without importing it.
 */
export type BoardRow = {
  key: string
  summary: string
  status: string
  statusId: string
  category: StatusCategory
  type: string
  container: boolean
  priority: string | null
  parent?: { key: string; summary: string }
  assignee: string
  /** ISO timestamp, kept whole so the view can draw a relative age. */
  updated: string
}

const CATEGORIES: StatusCategory[] = ["new", "indeterminate", "done"]

const categoryOf = (key: string | undefined): StatusCategory =>
  CATEGORIES.find((c) => c === key) ?? "unknown"

export const toBoardRow = (issue: JiraIssue): BoardRow => ({
  key: issue.key,
  summary: issue.fields.summary ?? "",
  status: issue.fields.status?.name ?? "—",
  statusId: issue.fields.status?.id ?? "",
  category: categoryOf(issue.fields.status?.statusCategory?.key),
  type: issue.fields.issuetype?.name ?? "",
  container: isContainerType(issue.fields.issuetype),
  priority: issue.fields.priority?.name ?? null,
  ...(issue.fields.parent
    ? {
        parent: {
          key: issue.fields.parent.key,
          summary: issue.fields.parent.fields?.summary ?? "",
        },
      }
    : {}),
  assignee: issue.fields.assignee?.displayName ?? "unassigned",
  updated: issue.fields.updated ?? "",
})

// ─── tabs ─────────────────────────────────────────────────────────────────────

/**
 * Where a board's tabs came from, in order of precedence: the user's own
 * `tabs` in the config file, then the board's column configuration, then
 * Jira's status categories — which every status on every instance carries,
 * so the last one needs no configuration and can never name one workflow's
 * vocabulary.
 */
export type TabSource = "config" | "board" | "categories"

export type BoardTab = {
  value: string
  label: string
  /** Status ids (or, for a config tab, names) this tab claims. Absent on a category tab. */
  statuses?: Set<string>
  category?: StatusCategory
  /** The derived tab holding statuses no other tab claims. */
  offBoard?: boolean
}

export type BoardTabs = { source: TabSource; tabs: BoardTab[] }

export const OFF_BOARD = "__off_board__"

const CATEGORY_TABS: BoardTab[] = [
  { value: "todo", label: "To do", category: "new" },
  { value: "doing", label: "In progress", category: "indeterminate" },
  { value: "done", label: "Done", category: "done" },
]

const withOffBoard = (tabs: BoardTab[]): BoardTab[] => [
  ...tabs,
  { value: OFF_BOARD, label: "Off board", offBoard: true },
]

export const tabsFromConfig = (configured: ConfiguredTab[]): BoardTabs => ({
  source: "config",
  tabs: withOffBoard(
    configured.map((t, i) => ({
      value: `config:${i}`,
      label: t.label,
      statuses: new Set(t.statuses.map((s) => s.toLowerCase())),
    })),
  ),
})

/**
 * Columns are matched to statuses by ID, never by name — name-matching is
 * how a transition table once silently stopped matching anything.
 */
export const tabsFromBoard = (
  configuration: JiraBoardConfiguration,
): BoardTabs | null => {
  const columns = configuration.columnConfig?.columns ?? []
  if (columns.length === 0) return null
  return {
    source: "board",
    tabs: withOffBoard(
      columns.map((c, i) => ({
        value: `column:${i}`,
        label: c.name,
        statuses: new Set(c.statuses.map((s) => s.id)),
      })),
    ),
  }
}

export const tabsFromCategories = (): BoardTabs => ({
  source: "categories",
  tabs: CATEGORY_TABS,
})

/** The tab a row belongs to. Nothing ever falls out: unclaimed rows go Off board, or In progress on a category board. */
export const tabOf = (row: BoardRow, { tabs }: BoardTabs): string => {
  const claimed = tabs.find(
    (t) =>
      t.statuses?.has(row.statusId) ||
      t.statuses?.has(row.status.toLowerCase()),
  )
  if (claimed) return claimed.value
  const byCategory = tabs.find((t) => t.category && t.category === row.category)
  if (byCategory) return byCategory.value
  return tabs.find((t) => t.offBoard)?.value ?? "doing"
}

export const countsFor = (
  rows: BoardRow[],
  tabs: BoardTabs,
): Record<string, number> => {
  const counts: Record<string, number> = Object.fromEntries(
    tabs.tabs.map((t) => [t.value, 0]),
  )
  for (const row of rows)
    counts[tabOf(row, tabs)] = (counts[tabOf(row, tabs)] ?? 0) + 1
  return counts
}

/** Tabs worth drawing: every configured one, plus Off board only when it holds something. */
export const visibleTabs = (
  tabs: BoardTabs,
  counts: Record<string, number>,
): BoardTab[] =>
  tabs.tabs.filter((t) => !t.offBoard || (counts[t.value] ?? 0) > 0)

// ─── grouping ─────────────────────────────────────────────────────────────────

/**
 * What one tab draws, in order. A container that is itself in the tab HEADS
 * its group as a selectable row, its children hanging beneath it; a parent
 * that is not in the tab gets a dim fence instead, because there is no row
 * to select. Container-headed groups come first, then fenced ones, then rows
 * with no parent — and each group after the first is preceded by a blank
 * line. A tab where nothing has a parent and nothing is a container degrades
 * to a plain list, never to a lone fence.
 */
export type Block =
  | { kind: "gap" }
  | { kind: "fence"; key: string | null; summary: string }
  | { kind: "issue"; row: BoardRow; depth: 0 | 1 }

export const blocksFor = (rows: BoardRow[]): Block[] => {
  const hasStructure = rows.some((r) => r.parent || r.container)
  if (!hasStructure)
    return rows.map((row) => ({ kind: "issue", row, depth: 0 }))

  const heads = new Map(rows.filter((r) => r.container).map((r) => [r.key, r]))
  const children = new Map<string, BoardRow[]>()
  const orphans: BoardRow[] = []
  for (const row of rows) {
    if (row.container) continue
    const key = row.parent?.key
    if (!key) {
      orphans.push(row)
      continue
    }
    children.set(key, [...(children.get(key) ?? []), row])
  }

  const groups: Block[][] = []
  for (const [key, head] of heads)
    groups.push([
      { kind: "issue", row: head, depth: 0 },
      ...(children.get(key) ?? []).map((row): Block => ({
        kind: "issue",
        row,
        depth: 1,
      })),
    ])
  for (const [key, kids] of children) {
    if (heads.has(key)) continue
    groups.push([
      { kind: "fence", key, summary: kids[0]!.parent?.summary ?? "" },
      ...kids.map((row): Block => ({ kind: "issue", row, depth: 1 })),
    ])
  }
  if (orphans.length)
    groups.push([
      ...(groups.length
        ? [{ kind: "fence", key: null, summary: "No epic" } as Block]
        : []),
      ...orphans.map((row): Block => ({ kind: "issue", row, depth: 0 })),
    ])

  return groups.flatMap((group, i) =>
    i === 0 ? group : [{ kind: "gap" } as Block, ...group],
  )
}

/** Index into `blocks` of the n-th issue, so a cursor over issues maps to a line. */
export const blockIndexOfIssue = (
  blocks: Block[],
  issueIndex: number,
): number => {
  let seen = -1
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i]!.kind === "issue" && ++seen === issueIndex) return i
  }
  return 0
}

// ─── row glyphs ───────────────────────────────────────────────────────────────

/**
 * Priority names are per-instance, so this matches the default scheme, the
 * common renames and the P0–P4 ladder rather than an exact list. Medium — or
 * anything unrecognised — draws nothing: the glyph column marks the two ends
 * only.
 */
export const priorityGlyph = (name: string | null): "▲" | "▼" | " " => {
  const n = (name ?? "").trim().toLowerCase()
  if (/highest|high|critical|blocker|urgent|^p[01]$/.test(n)) return "▲"
  if (/lowest|low|minor|trivial|^p[3-5]$/.test(n)) return "▼"
  return " "
}

const UNITS: [number, string][] = [
  [60, "m"],
  [60, "h"],
  [24, "d"],
  [7, "w"],
]

export const relativeAge = (iso: string, now: number = Date.now()): string => {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ""
  let value = Math.max(0, Math.round((now - then) / 1000))
  let unit = "s"
  for (const [size, next] of UNITS) {
    if (value < size) break
    value = Math.round(value / size)
    unit = next
  }
  return `${value}${unit}`
}

export const pillVariantFor = (
  row: Pick<BoardRow, "type" | "container">,
): "group" | "info" | "error" | "muted" => {
  if (row.container) return "group"
  const t = row.type.toLowerCase()
  if (t === "bug") return "error"
  if (t === "story") return "info"
  return "muted"
}

// ─── fetch ────────────────────────────────────────────────────────────────────

export type BoardModel = { rows: BoardRow[]; tabs: BoardTabs }

export type BoardOptions = {
  /** Hand-written tabs from the config file — wins over everything. */
  tabs?: ConfiguredTab[]
  /** A board whose column configuration supplies the tabs. */
  board?: number
  limit?: number
}

/**
 * One assignee-scoped query, bucketed client-side. The board supplies the
 * VOCABULARY, never the population — `getBoardIssues` would drop your
 * tickets on every other board. A board with no columns, or none given,
 * falls through to categories.
 */
export const boardOf = async (
  client: JiraClient,
  jql: string,
  { tabs, board, limit = 200 }: BoardOptions = {},
): Promise<BoardModel> => {
  const [issues, derived] = await Promise.all([
    client.searchIssues(jql, { limit }),
    tabs?.length
      ? Promise.resolve(tabsFromConfig(tabs))
      : board !== undefined
        ? client.getBoardConfiguration(board).then(tabsFromBoard)
        : Promise.resolve(null),
  ])
  return { rows: issues.map(toBoardRow), tabs: derived ?? tabsFromCategories() }
}
