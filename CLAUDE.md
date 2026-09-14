# @kud/jira-ink

Ink components for viewing Jira issues: the board and the issue detail screen, shared by
[`@kud/jira-cli`](https://github.com/kud/jira-cli)'s TUI and ambre's cockpit.

## Two hosts, one contract

This package has no host of its own — it is consumed by two independent
projects: `@kud/jira-cli`'s full-screen TUI, and ambre's cockpit as an
embedded pane. **A change to an exported prop ripples to both.** Before
renaming, narrowing, or removing anything from `src/index.ts`, check how each
host actually uses it rather than assuming one call site is representative.

## Terminal UI

The TUI here is built with [`@kud/ink-ui`](https://github.com/kud/ink-ui), the house Ink design system — pre-styled components, the `useTabs`/`useListCursor` keyboard hooks, and `colors`/`spacing` design tokens.

**Before writing or changing any UI component, read `node_modules/@kud/ink-ui/AGENTS.md`.** It ships with the package and carries what the type definitions cannot express: which components own their own Ink `useInput` versus which are presentational, what to compose for a given screen, and the known traps. The exhaustive component surface is `node_modules/@kud/ink-ui/dist/index.d.ts`.

Never hand-roll a component without checking there first — bordered panes, scrolling viewports, selectable rows, tables, tab bars, spinners, progress bars and key-hint footers are all provided. Colour comes from the `colors` token object, never a string literal.

## Two halves per screen

Every screen is a `lib/` half that fetches and shapes (`issueDetailOf`, `boardOf`) and a `components/` half that draws it. The view never touches a raw `JiraIssue`; a host that fakes the fetch gets a screen it can predict. Keep it that way for anything new.

## Keys the views do not own

An exported view takes `onBack` / `onExit` and callbacks and **never binds `q`, and never a back key of its own** — the host mounts ink-ui's `useAppKeys` once and its peel routes to the view when it is the topmost layer. A view may bind only the keys that open and close layers it pushes itself (a search box, a legend). Otherwise the mounted view and the host both fire on the same key. See kud/ink-ui#5 for the fleet contract.
