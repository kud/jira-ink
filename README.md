# @kud/jira-ink

Controlled [Ink](https://github.com/vadimdemedes/ink) components for viewing
Jira issues in the terminal — the board and the issue detail screen, extracted
from [`@kud/jira-cli`](https://github.com/kud/jira-cli)'s TUI so they can be
shared with ambre's cockpit.

Every component is **presentation-only**: props in, no data fetching, no
app-level input. The consuming surface owns selection, navigation and loading,
so the same components drop into a full-screen CLI or a single pane inside a
larger dashboard. Data comes from [`@kud/jira`](https://github.com/kud/jira);
markdown rendering comes from [`@kud/ink-markdown`](https://github.com/kud/ink-markdown);
primitives and colour tokens come from [`@kud/ink-ui`](https://github.com/kud/ink-ui).

```
@kud/jira        headless core — client, types (framework-agnostic)
└─ @kud/jira-ink  this package — Ink rendering
```

## Install

```sh
npm install @kud/jira-ink @kud/jira @kud/ink-ui ink react
```

`ink` and `react` are peer dependencies.

## Usage

A host with a client and a key mounts the self-fetching body — the shape a cockpit wants:

```tsx
import { createJiraClient, loadConfig } from "@kud/jira"
import { IssueBody } from "@kud/jira-ink"

const loaded = loadConfig()
if ("missing" in loaded) throw new Error(loaded.missing.join(", "))
const client = createJiraClient(loaded.config)

<IssueBody
  client={client}
  baseUrl={loaded.config.baseUrl}
  issueKey="SHOP-1234"
  onExit={() => setScreen("list")}
/>
```

A host that already holds an `IssueDetail` and owns the prompts behind the write verbs — jira-cli's own TUI — mounts the view directly. A verb whose handler is absent is neither hinted nor bound, so a read-only host gets the same screen minus the keys it cannot honour:

```tsx
import { IssueDetailView, issueDetailOf } from "@kud/jira-ink"

const issue = await issueDetailOf(client, baseUrl, "SHOP-1234")

<IssueDetailView
  issue={issue}
  width={80}
  height={30}
  onBack={back}
  onTransition={transition}
  onComment={comment}
  onAssign={assign}
  onOpenBrowser={open}
/>
```

| Export            | What it is                                                               |
| ----------------- | ------------------------------------------------------------------------ |
| `IssueBody`       | Self-fetching issue screen: hand it a client and a key, read-only        |
| `IssueDetailView` | The issue screen over an `IssueDetail`, with optional write verbs        |
| `issueDetailOf`   | Fetches one issue through a `@kud/jira` client into the view-ready shape |
| `transitionsOf`   | The issue's available status transitions, `{ id, name, to }`             |
| `IssueDetail`     | The shape the view reads: strings throughout, ADF already Markdown       |

### The board

A tabbed list of issues: rows grouped under their epic, a type pill, a priority glyph and an age on each, and a `/` search that takes plain words or JQL. The host owns the frame, the fetch and the quit key; the board owns only the layers it pushes itself (its search box and its legend).

```tsx
import { boardOf, IssueBoard } from "@kud/jira-ink"

const model = await boardOf(client, "assignee = currentUser() ORDER BY updated DESC", {
  board: config.defaultBoard, // optional — its columns become the tabs
  tabs: config.tabs,          // optional — hand-written tabs win over the board
})

<IssueBoard
  model={model}
  viewer="you"
  loadedAt={Date.now()}
  scope={{ kind: "mine" }}
  showingAll={false}
  searchError={null}
  width={100}
  height={30}
  onOpen={openIssue}
  onToggleAll={toggleAll}
  onRefresh={refresh}
  onSearch={runSearch}
  onClearSearch={clearSearch}
  frame={({ facts, hints, body }) => <MyFrame facts={facts} hints={hints}>{body}</MyFrame>}
/>
```

**Tabs come from one of three places, in order of precedence.** Hand-written `tabs` in the config file (statuses by id or name); the board's own column configuration (`getBoardConfiguration`, statuses matched **by id**, never by name); or Jira's status categories — To do, In progress, Done — which every status on every instance carries, so the last needs no configuration and can never name one workflow's vocabulary. Statuses no configured tab claims go to a derived **Off board** tab, drawn only when it holds something; a board with no columns falls through to categories. The board supplies the *vocabulary*, never the population: the fetch stays one query, bucketed client-side.

| Export | What it is |
| --- | --- |
| `IssueBoard` | The tabbed board over a `BoardModel`; a `frame` slot hands the host its title facts, hints and body |
| `boardOf` | Runs one JQL through a `@kud/jira` client and derives the tabs |
| `toBoardRow` | One `JiraIssue` → `BoardRow`, the container question answered via `isContainerType` |
| `tabsFromConfig` · `tabsFromBoard` · `tabsFromCategories` | The three tab sources, each a `BoardTabs` with its `source` named |
| `tabOf` · `countsFor` · `visibleTabs` | Which tab a row belongs to, per-tab counts, which tabs to draw |
| `blocksFor` | One tab's rows as drawn: container rows head their group, absent parents get a fence, orphans last, a gap between groups |
| `priorityGlyph` · `relativeAge` · `pillVariantFor` | Row glyphs |
| `mockBoard` · `MOCK_BOARD_ROWS` | An invented board for screenshots and tests |
## Development

```sh
npm install
npm run typecheck
npm test          # ink-testing-library
npm run build     # tsup → dist/
```

## Licence

MIT © Erwann Mest
