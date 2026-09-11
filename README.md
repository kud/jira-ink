# @kud/jira-ink

Controlled [Ink](https://github.com/vadimdemedes/ink) components for viewing
Jira issues in the terminal — the issue detail screen, extracted from
[`@kud/jira-cli`](https://github.com/kud/jira-cli)'s TUI so it can be shared
with ambre's cockpit.

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

```tsx
import { IssueDetailView, issueDetailOf } from "@kud/jira-ink"

const detail = issueDetailOf(issue)

<IssueDetailView issue={detail} />
```

Planned exports:

| Export            | What it is                                     |
| ----------------- | ---------------------------------------------- |
| `IssueDetailView` | The full issue detail screen                   |
| `IssueBody`       | The description/comments body of an issue      |
| `issueDetailOf`   | Maps a `@kud/jira` issue into view-ready shape |

## Development

```sh
npm install
npm run typecheck
npm test          # ink-testing-library
npm run build     # tsup → dist/
```

## Licence

MIT © Erwann Mest
