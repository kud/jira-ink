# Changelog

All notable changes to this project are documented here.

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
