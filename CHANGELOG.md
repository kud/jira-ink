# Changelog

All notable changes to this project are documented here.

---

## 0.10.0 — 2026-09-22

### Highlights

- **A host can now learn what's under the cursor.** The board owns the cursor, so a host that wanted to act on the selected row — a move menu bound to its own key, `C`/`O` over every URL hanging off it — had no way to find out which row that was; `onOpen` only ever answers on ↵. `IssueBoardProps.onCursor` fires on every move with `{ stop, subtree }` (the new exported `CursorAt<L>` type) — the stop under the cursor and its subtree, already walked with `subtreeOf` so the host needs no handle on the block list to do it itself. `null` while a tab holds nothing. Purely additive — no existing host needs to change. ([e26ad90](https://github.com/kud/jira-ink/commit/e26ad90ec909e661e59ab4ee23d4aebd75611483))

---

## 0.9.0 — 2026-09-22

### Highlights

- **An epic is now placed by where its children are, not by its own status.** A tab decides which tasks show; the epic comes along as the head of whatever group it has there — so an epic marked In Development whose tasks are all still in Backlog heads them there and is absent from In progress, and can head a group in several tabs at once if its children are spread across them. A childless epic, or one whose children have all left the board's window, sits Off board rather than claiming a stage it isn't working in. Its own status, when it disagrees with the tab it's heading, is drawn as a dim `own To do` note beside the summary; the rest of its children are folded into counts, `1 To do · 1 Done`. `placementOf(rows, tabs)` is the new bottom-up index (`tabsOf`, `childrenOf`) everything else reads from — `rowsInTab`, `headNote` and the `countsFor` rewrite below all take it, so a board and its counts never disagree about where an epic lives. **`countsFor` now counts by this placement**, so an epic is tallied once per tab it heads rather than once for its own status. ([1d1b094](https://github.com/kud/jira-ink/commit/1d1b094b826ff516829fc8243b2d580e1ab32f76))
- **`behind` — a bright word for a row whose own status has fallen behind the evidence.** An epic parked Off board while a child has already started, or one still open once every child is Done: the board can see both cases itself and sets them via `withBehind(rows, tabs)`; anything else — a task whose PR is ahead of its Jira status, say — is host-filled on `BoardRow.behind`, which the board never overwrites once set. The reason renders dim beside the word, or is left blank when the head's own note already explains it. ([1d1b094](https://github.com/kud/jira-ink/commit/1d1b094b826ff516829fc8243b2d580e1ab32f76))
- **A fence now says where its parent actually is.** Previously a fence for a task whose epic sits off-window said only "No epic" or the epic's key; it now names a tab (`In progress`) when the parent is the viewer's own and reachable, or `@FirstName` / `unassigned` when it belongs to someone else — the same `@` shorthand the title bar uses for scope. `parentsOf(client, rows)` fetches exactly those missing parents in one `key in (…)` search (empty in, empty out, no call for a board with nothing missing), and a fence stays blank until that lookup lands rather than guessing and correcting itself later. ([1d1b094](https://github.com/kud/jira-ink/commit/1d1b094b826ff516829fc8243b2d580e1ab32f76))
- **A moved row lands in its new tab within the second, without waiting for a refetch.** `pendingRow(model, key, to)` marks a row `⋯ → QA` the instant a transition request goes out; on the 204, `transitionRow` rewrites its status and it's drawn in the new tab immediately, while `settleRow` clears the marker on a rejected move without touching anything else. Nothing here is optimistic — the row only moves once Jira has said it moved — and the eventual refetch becomes reconciliation rather than the thing that makes the move visible. ([1d1b094](https://github.com/kud/jira-ink/commit/1d1b094b826ff516829fc8243b2d580e1ab32f76))
- **Hosts can now hang their own rows under a Jira row.** `IssueBoardProps.leaves` (`{ under, keyOf, render, onOpen }`) lets a host — cockpit hanging a task's pull requests, say — supply arbitrary non-Jira items that the board slots directly beneath their parent, before any children, so a row's subtree always reads as one contiguous run. The board never looks inside a leaf: it renders and opens through the host's own callbacks, and walks it with the cursor exactly like an issue via the new `Stop`/`isStop`/`stopsOf` types. ([303eee1](https://github.com/kud/jira-ink/commit/303eee167258ee76dc4ffec47d1eedefecbacd72))
- **The tree now draws a real branch, not a repeated corner.** Every child row used to open with `└─` regardless of position; it's now `├─` while a sibling still follows and `└─` for the last, with a `│` stem carried down for a depth-2 row whose depth-1 parent isn't itself last. `treePrefix` computes it from last-ness rather than leaving it to the renderer — three closing corners stacked in a column, tried once in gh-ink, drew no tree at all. ([303eee1](https://github.com/kud/jira-ink/commit/303eee167258ee76dc4ffec47d1eedefecbacd72))

**Breaking:** `blockIndexOfIssue` is renamed `blockIndexOfStop` — the cursor now walks leaves as well as issues, so "issue" stopped describing what it indexes. `Transition.to` is now the full status object Jira gives (`{ id?, name, category? }`) rather than a bare name string, so a host printing the target — jira-cli's TUI, cockpit's move confirmation — must print `` `${t.to.name}` `` in place of `` `${t.to}` ``; `tabLabelOf` and the new transition helpers take this shape directly. `countsFor` counting by placement (above) means a host reading per-tab totals for an epic-bearing board will see different numbers than 0.8.0 — correct ones, but different.

---

## 0.8.0 — 2026-09-15

### Highlights

- **`IssueDetailView` drops its three tabs for one continuous document.** Description, Comments, and Attachments were each a Markdown viewport scrolled with the same ↑↓ keys — nothing about them distinguished a place to act from a place to look, and a tab is supposed to be the former. The ticket now reads top to bottom: the description, then `## Comments (N)` with each comment under `**author** · 3d ago`, then `## Attachments (N)` as an appendix. The header becomes rows worth acting on — `status` (as a badge) leads, because it's the one fact that can be wrong on you; `assignee` follows (`unassigned` shown dim); then `parent`, its key in the secondary tier with the summary beside it. Below that sits a dim facts line — priority leads as the one bright cell (its glyph in colour plus the name, earned only by sitting away from the default), then `by reporter`, `labels …`, `N comments`, `N attachments`; reporter and labels have moved off the header rows onto this line. `←→` are unbound now there's nothing left to switch between — the hints read `↑↓ scroll` plus the wired verbs and `⌫ back`. `IssueDetail` gains `priority?: string`, and `comments[].created` now carries the full ISO timestamp rather than being truncated to the date. `IssueBody` takes an optional `summary` prop so a host that already knows the title from its list row can show it from the first frame instead of after the fetch. Designed with the room's designer: "a tab survives only if its panel owns keys the other cannot share." ([0b56fc6](https://github.com/kud/jira-ink/commit/0b56fc69307814153cc6f72ace83aa679599f364))

---

## 0.7.0 — 2026-09-15

### Highlights

- **The priority cell now ranks against the scheme's default rung, in Jira's own arrow grammar** — `⇈` two above, `↑` one above, `=` at the default, `↓` one below, `⇊` two below — instead of a two-ends `▲` / `▼` with nothing in between. On a four-rung scheme (P1–P4, the common shape) the old marker put a mark on half the rows, drew P2 as if it were normal, and left P3 and P4 identical; worse, a blank beside a marked row read as _missing_ rather than _normal_. `=` now says "we looked, it is normal" — the blank means only a priority that's absent or can't be placed. Name mapping: Highest/Blocker/Critical/P0/P1 → `⇈`, High/Urgent/Major/P2 → `↑`, Medium/Normal/P3 → `=`, Low/Minor/P4 → `↓`, Lowest/Trivial/P5 → `⇊`; deriving rank from the instance's own ordered priority list is the honest next step, names stay the fallback. `priorityGlyph` returns the new exported `PriorityGlyph` union, `priorityMarker` colours up marks `colors.warning`, down marks `colors.info`, and `=` `colors.muted`, and the board's legend has been updated to match. **Breaking:** a host on 0.6.0 that matched `▲` / `▼` by string must move to the new glyph set. ([d67116e](https://github.com/kud/jira-ink/commit/d67116ea7fbead5b7edcd348f753d87dcf7db213))

---

## 0.6.0 — 2026-09-15

### Highlights

- **The priority cell is now a single exported function.** `priorityMarker(name) → { marker: "▲" | "▼" | " ", color? }` returns the glyph and colour together, exactly as `IssueBoard` draws it — `colors.warning` for the high end, `colors.muted` for the low, no colour for the blank one-column case — and the board now draws through it instead of its own inline logic. A host that draws its own rows (cockpit, via gh-ink's `TaskRow.marker` / `markerColor`) previously had no way to match the board's cell short of a private table that could drift out of step; one shared site means the two can no longer disagree on a hue. `priorityGlyph` stays as the pure half, for a host that wants the glyph without the colour. ([631ec51](https://github.com/kud/jira-ink/commit/631ec510705efb71492733d16daffa817ccec63b))

---

## 0.5.2 — 2026-09-15

### Highlights

- **`@kud/ink-markdown` moves to 0.3.1, which renders a theme colour given as a hex.** A host passing its own tokens through the `theme` prop — cockpit's ticket drill hands orange links and cyan inline code — had them silently dropped; they now show. Nothing changes for a host on the default theme. ([064c71f](https://github.com/kud/jira-ink/commit/064c71fa4ba5c14e14fed2baea31a5d43bd27deb))

---

## 0.5.1 — 2026-09-15

### Highlights

- **`@kud/ink-ui` moves to 0.29.0, whose `useTabs` binds `←→` itself.** The detail view's `←→ section` hint has been true in wording only since it shipped — the arrows did nothing. They now switch sections, and the board drops the hand-bound arrow handler it carried instead, which would otherwise have fired alongside the hook's and switched tabs twice per press. Both directions wrap, as `Tab` already did. ([de072a5](https://github.com/kud/jira-ink/commit/de072a5bc0b151b6f84f522d8e560f487e42aae8))

---

## 0.5.0 — 2026-09-14

### Highlights

- **The board's `frame` slot hands over structured title parts** — `title: { count, user?, scope?, status }` beside the existing `facts` string — so a host drawing `@kud/ink-ui` 0.28's `Page` title row (the cockpit's: count, `@user`, scope, status, dotted rule) gets the segments rather than one string. ([cfd0510](https://github.com/kud/jira-ink/commit/cfd05101a30c3fb394b56138d7eb8edc8071c8ab))

---

## 0.4.3 — 2026-09-14

### Highlights

- **Shorter action hints on the detail view** — `t move`, `a assign` — so the row fits on one line beside the host's `⌫ back · ? help · q quit` tail at 100 columns instead of wrapping and costing a body row. ([3ccf7c1](https://github.com/kud/jira-ink/commit/3ccf7c1a7ee6ef0d0e5fbde385d0b4c9ed031733))

---

## 0.4.2 — 2026-09-14

### Highlights

- **The board's hints no longer carry `? legend` or `q quit`.** Those are the footer tail every page ends with, drawn by the host's frame from ink-ui's `FooterHints` `page` prop; the board hands over only its own keys. ([e525d37](https://github.com/kud/jira-ink/commit/e525d37df2b47125d093f21ab74ac2527d0322be))

---

## 0.4.1 — 2026-09-14

### Highlights

- **`IssueBoard` reports search focus.** `onInputFocus(focused)` fires as the `/` box takes and loses focus, so a host can stand its app keys down while `q` is a letter. ([922464f](https://github.com/kud/jira-ink/commit/922464f12ce3e5568c67a4b3461268fd45315d3b))

---

## 0.4.0 — 2026-09-14

### Highlights

- **The views no longer bind `esc` or `q`.** `IssueDetailView` and `IssueBody` take `onBack` / `onExit` and leave the keys to the host, which mounts `@kud/ink-ui`'s `useAppKeys` once and routes its peel to the view when it is the topmost layer — binding them in both places fired both. Hints say `⌫ back`. A host on 0.3.x that relied on the view closing itself must wire its peel before taking this. ([6aee7b9](https://github.com/kud/jira-ink/commit/6aee7b9fd5a70da9ca40fd389d6143238e1341dd))
- `@kud/ink-ui` pinned to 0.27.0.

---

## 0.3.1 — 2026-09-14

### Highlights

- **The description now fills the space the host gave it.** The framed detail view counted its chrome as a constant while its key/value block varies with parent and labels, so the Markdown viewport ran one line over with both and three short with neither. It is now counted from the rows actually drawn, and the viewport is clipped to its budget. ([54ac38a](https://github.com/kud/jira-ink/commit/54ac38ad006cb85aaa26f02b717dac760161905c))

---

## 0.3.0 — 2026-09-14

### Highlights

- The tabbed issue board moves here from jira-cli: `IssueBoard` groups rows under their epic, with container rows heading each group, a type pill, priority glyph and age column, `/` search over plain words or JQL, and `?` for the legend. A `frame` slot lets the host own the chrome, and the view binds no `q` or back key of its own. ([e93b930](https://github.com/kud/jira-ink/commit/e93b930))
- `boardOf` resolves tabs through three sources in order — configured tabs, board columns matched by status id, then status categories — with a derived "Off board" tab for anything none of them claim. ([e93b930](https://github.com/kud/jira-ink/commit/e93b930))
- `toBoardRow`, `blocksFor`, the glyph helpers, and `mockBoard` are now exported, so a host can build its own board rendering or tests against the same data. ([e93b930](https://github.com/kud/jira-ink/commit/e93b930))
- `@kud/jira` pinned to 0.4.0 for the board config support this relies on. ([e93b930](https://github.com/kud/jira-ink/commit/e93b930))

---

## 0.2.1 — 2026-09-11

### Highlights

- Jira tables render as tables. `@kud/ink-markdown` moved to 0.3.0, which lays a pipe table out as a padded grid with a rule segment under each header column, one line per row and `…` where a cell runs past its column — so a ticket's "Child tickets" or token table no longer arrives as one wrapped run of pipes. The same release lets a link's text carry the `[TAP]`-style brackets Jira puts in it. ([c638268](https://github.com/kud/jira-ink/commit/c638268))

## 0.2.0 — 2026-09-11

### Highlights

- `IssueDetailView` and `IssueBody` now accept an optional `frame` render prop, so a host with its own chrome — a bordered drill frame, say — can take over layout: it receives `{ title, subtitle, hints, body }` and places them itself, while the view stops drawing its own title line and footer. The type row folds into the title (`KEY · Type`, with the summary as subtitle) so nothing is said twice, and `IssueBody` frames its loading and error states too, so the host's panel is up before the fetch even answers. ([d843d80](https://github.com/kud/jira-ink/commit/d843d80de6b8fbb5d1bcb638602cf7f88421e930))
- Both components take an optional `theme` (`MarkdownTheme` from `@kud/ink-markdown`), threaded through to the Markdown viewport, so a host can render links, code and headings in its own tokens rather than the view's defaults. ([d843d80](https://github.com/kud/jira-ink/commit/d843d80de6b8fbb5d1bcb638602cf7f88421e930))
- `IssueBody` now answers `q` as well as `esc` to leave, in every phase — matching the cockpit convention. This is bound on `IssueBody` only, since jira-cli's own TUI already uses `q` to quit. ([d843d80](https://github.com/kud/jira-ink/commit/d843d80de6b8fbb5d1bcb638602cf7f88421e930))
- `@kud/ink-markdown` bumped to 0.2.0, which adds a blank line between Markdown blocks and autolinks bare URLs — both now visible wherever this view renders a description or comment. ([d843d80](https://github.com/kud/jira-ink/commit/d843d80de6b8fbb5d1bcb638602cf7f88421e930))

### Fixes

- `←` no longer leaves the view. It was firing `onBack` on the same keypress the tabs hook used to switch section — one line below a hint promising `←→ section` — and the unmount was winning the race. ([d843d80](https://github.com/kud/jira-ink/commit/d843d80de6b8fbb5d1bcb638602cf7f88421e930))

---
