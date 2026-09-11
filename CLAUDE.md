# @kud/jira-ink

Ink components for viewing Jira issues: the issue detail screen, shared by
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
