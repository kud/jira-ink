# Changelog

All notable changes to this project are documented here.

---

## 0.2.0 — 2026-09-11

### Highlights

- `IssueDetailView` and `IssueBody` now accept an optional `frame` render prop, so a host with its own chrome — a bordered drill frame, say — can take over layout: it receives `{ title, subtitle, hints, body }` and places them itself, while the view stops drawing its own title line and footer. The type row folds into the title (`KEY · Type`, with the summary as subtitle) so nothing is said twice, and `IssueBody` frames its loading and error states too, so the host's panel is up before the fetch even answers. ([d843d80](https://github.com/kud/jira-ink/commit/d843d80de6b8fbb5d1bcb638602cf7f88421e930))
- Both components take an optional `theme` (`MarkdownTheme` from `@kud/ink-markdown`), threaded through to the Markdown viewport, so a host can render links, code and headings in its own tokens rather than the view's defaults. ([d843d80](https://github.com/kud/jira-ink/commit/d843d80de6b8fbb5d1bcb638602cf7f88421e930))
- `IssueBody` now answers `q` as well as `esc` to leave, in every phase — matching the cockpit convention. This is bound on `IssueBody` only, since jira-cli's own TUI already uses `q` to quit. ([d843d80](https://github.com/kud/jira-ink/commit/d843d80de6b8fbb5d1bcb638602cf7f88421e930))
- `@kud/ink-markdown` bumped to 0.2.0, which adds a blank line between Markdown blocks and autolinks bare URLs — both now visible wherever this view renders a description or comment. ([d843d80](https://github.com/kud/jira-ink/commit/d843d80de6b8fbb5d1bcb638602cf7f88421e930))

### Fixes

- `←` no longer leaves the view. It was firing `onBack` on the same keypress the tabs hook used to switch section — one line below a hint promising `←→ section` — and the unmount was winning the race. ([d843d80](https://github.com/kud/jira-ink/commit/d843d80de6b8fbb5d1bcb638602cf7f88421e930))

---
