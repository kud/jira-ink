import {
  isContainerType,
  jqlEscape,
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
  /**
   * Set when the row's own status lags the evidence — an epic Off board with
   * a child already started, a task whose PR is ahead of it. The board draws
   * the word `behind` bright, then this string dim as the reason; pass `""`
   * when the head's own note already says why. **Presence is the flag, so
   * test `behind !== undefined`, never `if (row.behind)`.**
   *
   * Host-filled, because only the host knows the evidence outside Jira.
   * `withBehind` fills the two cases the board can see for itself.
   */
  behind?: string
  /**
   * A transition in flight: the label of the tab it is moving to, drawn as
   * `⋯ → QA` until `transitionRow` or `settleRow` clears it.
   */
  pending?: string
}

const CATEGORIES: StatusCategory[] = ["new", "indeterminate", "done"]

export const categoryOf = (key: string | undefined): StatusCategory =>
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

// ─── placement ────────────────────────────────────────────────────────────────

const offBoardValue = (tabs: BoardTabs): string | undefined =>
  tabs.tabs.find((t) => t.offBoard)?.value

export type Placement = {
  /** The tabs a row is drawn in, in tab order. A container can be in several. */
  tabsOf: (key: string) => string[]
  /** The rows the board holds that call this one parent. */
  childrenOf: (key: string) => BoardRow[]
}

/**
 * Where every row goes, read BOTTOM-UP. A task sits in the tab of its own
 * status; a container is placed by its CHILDREN, heading a group in each tab
 * that holds one — so an epic In Development whose tasks are all in Backlog
 * is absent from In progress and heads them Off board. Its own status never
 * picks a tab; the board says it in a note instead.
 *
 * A container with no children on the board has nothing to be placed under,
 * and sits Off board rather than claiming a stage tab it is not working in.
 */
export const placementOf = (rows: BoardRow[], tabs: BoardTabs): Placement => {
  const children = new Map<string, BoardRow[]>()
  for (const row of rows) {
    if (row.container) continue
    const key = row.parent?.key
    if (key) children.set(key, [...(children.get(key) ?? []), row])
  }

  const order = new Map(tabs.tabs.map((t, i) => [t.value, i]))
  const placed = new Map<string, string[]>()
  for (const row of rows) {
    if (!row.container) {
      placed.set(row.key, [tabOf(row, tabs)])
      continue
    }
    const where = [
      ...new Set((children.get(row.key) ?? []).map((k) => tabOf(k, tabs))),
    ].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    placed.set(
      row.key,
      where.length ? where : [offBoardValue(tabs) ?? tabOf(row, tabs)],
    )
  }

  return {
    tabsOf: (key) => placed.get(key) ?? [],
    childrenOf: (key) => children.get(key) ?? [],
  }
}

/**
 * The rows one tab draws: the tasks whose own status is here, and the
 * container heading each of them. One filter does both halves, because a
 * container's placement already names every tab it has a child in.
 */
export const rowsInTab = (
  rows: BoardRow[],
  tabs: BoardTabs,
  tab: string,
  placement: Placement = placementOf(rows, tabs),
): BoardRow[] => rows.filter((r) => placement.tabsOf(r.key).includes(tab))

/**
 * The dim segments after a head's summary: its own status when it differs
 * from this tab, then where the rest of its children are, with counts. Only
 * rows the board holds are counted — never the epic-children query.
 */
export const headNote = (
  row: BoardRow,
  tabs: BoardTabs,
  tab: string,
  placement: Placement,
): string | undefined => {
  if (!row.container) return undefined
  const labelOf = (value: string): string =>
    tabs.tabs.find((t) => t.value === value)?.label ?? ""

  const own = tabOf(row, tabs)
  const segments = own === tab ? [] : [`own ${labelOf(own)}`]

  const elsewhere = new Map<string, number>()
  for (const kid of placement.childrenOf(row.key)) {
    const where = tabOf(kid, tabs)
    if (where !== tab) elsewhere.set(where, (elsewhere.get(where) ?? 0) + 1)
  }
  for (const t of tabs.tabs) {
    const n = elsewhere.get(t.value)
    if (n) segments.push(`${n} ${t.label}`)
  }

  return segments.length ? segments.join(" · ") : undefined
}

/**
 * Fills `behind` for the two cases the board can see without leaving Jira:
 * an epic parked Off board while a child has already started, and an epic
 * still open when every child is Done. Both reasons are left empty — the
 * head's own note already names the status that lags. A `behind` the host
 * has already set is never overwritten.
 */
export const withBehind = (rows: BoardRow[], tabs: BoardTabs): BoardRow[] => {
  const placement = placementOf(rows, tabs)
  const off = offBoardValue(tabs)
  return rows.map((row) => {
    if (!row.container || row.behind !== undefined) return row
    const kids = placement.childrenOf(row.key)
    if (kids.length === 0) return row
    const started = kids.some((k) => k.category !== "new")
    const allDone = kids.every((k) => k.category === "done")
    const lags =
      (off !== undefined && tabOf(row, tabs) === off && started) ||
      (row.category !== "done" && allDone)
    return lags ? { ...row, behind: "" } : row
  })
}

export const countsFor = (
  rows: BoardRow[],
  tabs: BoardTabs,
  placement: Placement = placementOf(rows, tabs),
): Record<string, number> => {
  const counts: Record<string, number> = Object.fromEntries(
    tabs.tabs.map((t) => [t.value, 0]),
  )
  for (const row of rows)
    for (const tab of placement.tabsOf(row.key))
      counts[tab] = (counts[tab] ?? 0) + 1
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
 *
 * A LEAF is something the host hangs under a row that is not a Jira issue —
 * cockpit hangs a task's pull requests there. The board never looks inside
 * one: `L` is opaque, the host renders it and opens it. A leaf sits one
 * level under its row, directly beneath it and before any children, so a
 * row's subtree is always one contiguous run. Leaves are cursor stops like
 * issues; fences and gaps never are.
 */
export type Block<L = never> =
  | { kind: "gap" }
  | { kind: "fence"; key: string | null; summary: string; parent?: BoardRow }
  | { kind: "issue"; row: BoardRow; depth: 0 | 1 }
  | { kind: "leaf"; parent: BoardRow; depth: 1 | 2; data: L }

export type Stop<L = never> = Extract<Block<L>, { kind: "issue" | "leaf" }>

export const isStop = <L>(block: Block<L>): block is Stop<L> =>
  block.kind === "issue" || block.kind === "leaf"

/** The rows and leaves in cursor order — what ↑↓ walks and ↵ opens. */
export const stopsOf = <L>(blocks: Block<L>[]): Stop<L>[] =>
  blocks.filter(isStop)

export const blocksFor = <L = never>(
  rows: BoardRow[],
  under?: (row: BoardRow) => L[],
  /**
   * Parents the board holds no row for, looked up by the host — jira with one
   * extra `key in (…)` search, cockpit with the foreign-epics pass it already
   * runs. They are never drawn as rows; they tell a fence where its parent is.
   */
  parents?: BoardRow[],
): Block<L>[] => {
  const known = new Map((parents ?? []).map((p) => [p.key, p]))
  const withLeaves = (row: BoardRow, depth: 0 | 1): Block<L>[] => [
    { kind: "issue", row, depth },
    ...(under?.(row) ?? []).map((data): Block<L> => ({
      kind: "leaf",
      parent: row,
      depth: depth === 0 ? 1 : 2,
      data,
    })),
  ]

  const hasStructure = rows.some((r) => r.parent || r.container)
  if (!hasStructure) return rows.flatMap((row) => withLeaves(row, 0))

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

  const groups: Block<L>[][] = []
  for (const [key, head] of heads)
    groups.push([
      ...withLeaves(head, 0),
      ...(children.get(key) ?? []).flatMap((row) => withLeaves(row, 1)),
    ])
  for (const [key, kids] of children) {
    if (heads.has(key)) continue
    const parent = known.get(key)
    groups.push([
      {
        kind: "fence",
        key,
        summary: kids[0]!.parent?.summary ?? "",
        ...(parent ? { parent } : {}),
      },
      ...kids.flatMap((row) => withLeaves(row, 1)),
    ])
  }
  if (orphans.length)
    groups.push([
      ...(groups.length
        ? [{ kind: "fence", key: null, summary: "No epic" } as Block<L>]
        : []),
      ...orphans.flatMap((row) => withLeaves(row, 0)),
    ])

  return groups.flatMap((group, i) =>
    i === 0 ? group : [{ kind: "gap" } as Block<L>, ...group],
  )
}

const firstName = (assignee: string): string =>
  assignee === "unassigned" ? "unassigned" : `@${assignee.split(" ")[0]}`

/**
 * What a fence says after the parent's name, and whether it carries `behind`.
 *
 * Where the parent IS says it best: a tab label when the reader can press
 * through and find it, the OWNER when they cannot — `@` being the house glyph
 * for scope, as in the title bar's `@you`. On a `mine` board those two are
 * the same question asked twice, so a tab name means yours and `@name` means
 * not yours, and no fence ever says both. A board showing several assignees
 * has no such shorthand and always names the owner, as its rows do.
 *
 * `behind` is a judgement on someone's own work, so it goes on a fence only
 * when that someone is the viewer.
 *
 * Empty until the lookup lands: a fence that guessed would be wrong for a
 * frame and then silently correct itself, which is worse than a blank.
 */
export const fenceNote = (
  parent: BoardRow | undefined,
  tabs: BoardTabs,
  { viewer, mine }: { viewer: string; mine: boolean },
): { segment: string; behind: boolean } => {
  if (!parent) return { segment: "", behind: false }
  const theirs = parent.assignee !== viewer
  if (!mine || theirs)
    return { segment: firstName(parent.assignee), behind: false }
  const own = tabOf(parent, tabs)
  return {
    segment: tabs.tabs.find((t) => t.value === own)?.label ?? "",
    behind: parent.behind !== undefined,
  }
}

/** Index into `blocks` of the n-th stop, so a cursor over stops maps to a line. */
export const blockIndexOfStop = <L>(
  blocks: Block<L>[],
  stopIndex: number,
): number => {
  let seen = -1
  for (let i = 0; i < blocks.length; i++) {
    if (isStop(blocks[i]!) && ++seen === stopIndex) return i
  }
  return 0
}

/**
 * Whether the stop at `i` is the last among its siblings — the stops at its
 * depth before the tree returns to a shallower one or the group ends. Rows
 * and leaves count together, so an epic's own leaves and its children share
 * one run.
 */
const isLastAtDepth = <L>(blocks: Block<L>[], i: number): boolean => {
  const depth = (blocks[i] as Stop<L>).depth
  for (let j = i + 1; j < blocks.length; j++) {
    const b = blocks[j]!
    if (!isStop(b) || b.depth < depth) return true
    if (b.depth === depth) return false
  }
  return true
}

/**
 * The tree glyphs to the left of the stop at `i`, three columns per level:
 * `├─ ` while a sibling still follows, `└─ ` for the last, and ahead of a
 * depth-2 connector a `│  ` stem while its parent is not last. A `└─` on
 * every child was tried in gh-ink and rejected — three closing corners in a
 * column draw no tree at all — which is why last-ness is tracked here
 * rather than left to the renderer.
 */
export const treePrefix = <L>(blocks: Block<L>[], i: number): string => {
  const block = blocks[i]
  if (!block || !isStop(block) || block.depth === 0) return ""
  const own = isLastAtDepth(blocks, i) ? "└─ " : "├─ "
  if (block.depth === 1) return own
  let parent = i - 1
  while (parent >= 0 && (blocks[parent] as Stop<L>).depth !== 1) parent -= 1
  const stem = parent >= 0 && !isLastAtDepth(blocks, parent) ? "│  " : "   "
  return stem + own
}

/**
 * The block at `i` and everything hanging under it: a row's own leaves, its
 * children and theirs. Pure, so a host can walk a subtree for every URL in
 * it (`C` / `O`) without knowing how the tree was laid out. A leaf, a fence
 * or a gap has no subtree beyond itself.
 */
export const subtreeOf = <L>(blocks: Block<L>[], i: number): Block<L>[] => {
  const head = blocks[i]
  if (!head || head.kind !== "issue") return head ? [head] : []
  const out: Block<L>[] = [head]
  for (let j = i + 1; j < blocks.length; j++) {
    const b = blocks[j]!
    if (!isStop(b) || b.depth <= head.depth) break
    out.push(b)
  }
  return out
}

// ─── row glyphs ───────────────────────────────────────────────────────────────

export type PriorityGlyph = "⇈" | "↑" | "=" | "↓" | "⇊" | " "

/**
 * Rank against the scheme's default rung, in Jira's own arrow grammar: two
 * rungs above draws `⇈`, one `↑`, the default `=`, one below `↓`, two `⇊`.
 *
 * Five glyphs, not three, and the normal rung gets one. The column used to
 * mark the two ends only (`▲` / `▼`, nothing for normal), which on a four-rung
 * scheme — P1 to P4, the common shape — put a mark on half the rows, drew P2
 * as if it were normal, and made P3 and P4 identical. And a blank beside a
 * marked row read as MISSING rather than as normal: the absent-vs-zero
 * distinction, one glyph at a time. So `=` says "we looked, it is normal",
 * and the blank finally means only "no priority, or one we cannot place".
 *
 * Names are per-instance, so this matches the default scheme, the common
 * renames and the P0–P5 ladder rather than an exact list. Deriving rank from
 * the instance's ordered priority list, with its default flag, is the honest
 * version of this and where it goes next; the names are the fallback.
 */
export const priorityGlyph = (name: string | null): PriorityGlyph => {
  const n = (name ?? "").trim().toLowerCase()
  if (/^(highest|blocker|critical|p[01])$/.test(n)) return "⇈"
  if (/^(high|urgent|major|p2)$/.test(n)) return "↑"
  if (/^(medium|normal|p3)$/.test(n)) return "="
  if (/^(low|minor|p4)$/.test(n)) return "↓"
  if (/^(lowest|trivial|p5)$/.test(n)) return "⇊"
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

// ─── transitions ──────────────────────────────────────────────────────────────

/** A transition's target, as Jira gives it: id, name and category together. */
export type TransitionTarget = {
  id?: string
  name: string
  category?: StatusCategory
}

/** The label of the tab a status lands in — what `⋯ → QA` names. */
export const tabLabelOf = (to: TransitionTarget, tabs: BoardTabs): string => {
  const value = tabOf(
    {
      status: to.name,
      statusId: to.id ?? "",
      category: to.category ?? "unknown",
    } as BoardRow,
    tabs,
  )
  return tabs.tabs.find((t) => t.value === value)?.label ?? to.name
}

const mapRow = (
  model: BoardModel,
  key: string,
  f: (row: BoardRow) => BoardRow,
): BoardModel => ({
  ...model,
  rows: model.rows.map((row) => (row.key === key ? f(row) : row)),
})

/**
 * The hybrid move, in three pure steps. The row stays where it is under a
 * `⋯ → QA` marker while the request is out; on the 204 its status is
 * rewritten here and the tab follows within the same second, long before the
 * board refetches — the refetch stays as reconciliation, never as the thing
 * that makes the move visible. Nothing is optimistic: the row moves because
 * Jira said it moved.
 */
export const pendingRow = (
  model: BoardModel,
  key: string,
  to: TransitionTarget,
): BoardModel =>
  mapRow(model, key, (row) => ({
    ...row,
    pending: tabLabelOf(to, model.tabs),
  }))

export const transitionRow = (
  model: BoardModel,
  key: string,
  to: TransitionTarget,
): BoardModel =>
  mapRow(model, key, ({ pending: _, ...row }) => ({
    ...row,
    status: to.name,
    statusId: to.id ?? "",
    category: to.category ?? "unknown",
  }))

/** Clears the marker without moving anything — what a rejected move leaves. */
export const settleRow = (model: BoardModel, key: string): BoardModel =>
  mapRow(model, key, ({ pending: _, ...row }) => row)

export type BoardOptions = {
  /** Hand-written tabs from the config file — wins over everything. */
  tabs?: ConfiguredTab[]
  /** A board whose column configuration supplies the tabs. */
  board?: number
  limit?: number
}

/**
 * The parents the board holds no row for, in ONE `key in (…)` search — an
 * epic assigned to someone else, or one that fell outside the window while
 * its child stayed open. They are never drawn as rows; they are what lets a
 * fence say whose epic it is, which is the whole of their job here.
 *
 * Empty in, empty out, and no call made: a board of unparented rows must not
 * pay for a search that can only return nothing.
 */
export const parentsOf = async (
  client: JiraClient,
  rows: BoardRow[],
): Promise<BoardRow[]> => {
  const held = new Set(rows.map((r) => r.key))
  const missing = [
    ...new Set(
      rows
        .map((r) => r.parent?.key)
        .filter((key): key is string => key !== undefined && !held.has(key)),
    ),
  ]
  if (missing.length === 0) return []
  const issues = await client.searchIssues(
    `key in (${missing.map(jqlEscape).join(", ")})`,
    { limit: missing.length },
  )
  return issues.map(toBoardRow)
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
