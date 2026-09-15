import { Box, Text } from "ink"
import { render } from "ink-testing-library"
import React from "react"
import { describe, expect, it } from "vitest"
import type { IssueDetail } from "../lib/issue-detail.js"
import { IssueDetailView } from "./issue-detail-view.js"

const issue = (extra: Partial<IssueDetail> = {}): IssueDetail => ({
  key: "SHOP-1234",
  summary: "bring the checkout config under terraform",
  status: "In Progress",
  type: "Task",
  assignee: "Sam Example",
  reporter: "Alex Example",
  labels: [],
  url: "https://example.atlassian.net/browse/SHOP-1234",
  description: "Move the three config maps into the module.",
  comments: [],
  attachments: [],
  ...extra,
})

const noop = () => {}

describe("IssueDetailView", () => {
  it("draws the header and the description", () => {
    const { lastFrame } = render(
      <IssueDetailView issue={issue()} width={80} height={30} onBack={noop} />,
    )
    const frame = lastFrame() ?? ""
    expect(frame).toContain(
      "SHOP-1234 bring the checkout config under terraform",
    )
    expect(frame).toContain("In Progress")
    expect(frame).toContain("Sam Example")
    expect(frame).toContain("Move the three config maps into the module.")
  })

  /*
   * A read-only host mounts the same screen minus the verbs it cannot honour.
   * The hint row is the contract: a key it advertises must do something, so a
   * verb whose handler is absent is neither hinted nor bound.
   */
  it("hints only the verbs the host wired", () => {
    const readOnly = render(
      <IssueDetailView
        issue={issue()}
        width={80}
        height={30}
        onBack={noop}
        onOpenBrowser={noop}
      />,
    )
    const frame = readOnly.lastFrame() ?? ""
    expect(frame).toContain("browser")
    expect(frame).not.toContain("t move")
    expect(frame).not.toContain("a assign")
    // The facts line says "0 comments"; the hint would say "c comment".
    expect(frame).not.toContain("c comment")

    const full = render(
      <IssueDetailView
        issue={issue()}
        width={80}
        height={30}
        onBack={noop}
        onTransition={noop}
        onComment={noop}
        onAssign={noop}
        onOpenBrowser={noop}
      />,
    )
    const fullFrame = full.lastFrame() ?? ""
    expect(fullFrame).toContain("t move")
    expect(fullFrame).toContain("a assign")
  })

  it("counts comments and attachments in the facts line, and draws them below", () => {
    const { lastFrame } = render(
      <IssueDetailView
        issue={issue({
          comments: [
            {
              id: "1",
              author: "Sam Example",
              created: "2026-09-10",
              body: "ok",
            },
            {
              id: "2",
              author: "Alex Example",
              created: "2026-09-11",
              body: "done",
            },
          ],
        })}
        width={80}
        height={30}
        onBack={noop}
      />,
    )
    const frame = lastFrame() ?? ""
    expect(frame).toContain("2 comments")
    // One document, not tabs: the comments follow the description under
    // their own heading, each with its author.
    expect(frame).toContain("Comments (2)")
    expect(frame).toMatch(/Sam Example ·/)
    expect(frame).not.toContain("Description")
  })

  // Priority leads the facts line and is its one bright cell — but only when
  // it is placed away from the default, since "normal" is not news.
  it("leads the facts line with a priority worth saying", () => {
    const high = render(
      <IssueDetailView
        issue={issue({ priority: "High" })}
        width={80}
        height={30}
        onBack={noop}
      />,
    ).lastFrame()
    expect(high).toContain("↑ High · by Alex Example")
    const medium = render(
      <IssueDetailView
        issue={issue({ priority: "Medium" })}
        width={80}
        height={30}
        onBack={noop}
      />,
    ).lastFrame()
    expect(medium).not.toContain("Medium")
    expect(medium).toContain("by Alex Example")
  })
})

describe("IssueDetailView, framed", () => {
  /*
   * A host with its own chrome takes the screen in parts. The view must then
   * draw neither its title line nor its footer — the frame owns both — and the
   * type row folds into the title so it is not said twice.
   */
  it("hands the host title, subtitle and hints, and draws no chrome of its own", () => {
    const seen: { title?: string; subtitle?: string; hints?: string[] } = {}
    const { lastFrame } = render(
      <IssueDetailView
        issue={issue()}
        width={80}
        height={30}
        onBack={noop}
        onOpenBrowser={noop}
        frame={({ title, subtitle, hints, body }) => {
          seen.title = title
          seen.subtitle = subtitle
          seen.hints = hints.map(([k]) => k)
          return body
        }}
      />,
    )
    const frame = lastFrame() ?? ""
    expect(seen.title).toBe("SHOP-1234 · Task")
    expect(seen.subtitle).toBe("bring the checkout config under terraform")
    expect(seen.hints).toEqual(["↑↓", "o", "⌫"])
    expect(frame).not.toContain("SHOP-1234 bring the checkout")
    expect(frame).not.toContain("browser")
    expect(frame).not.toMatch(/^\s*type/m)
    expect(frame).toContain("In Progress")
  })
})

describe("IssueDetailView, framed — the viewport fills what the host gave", () => {
  const long = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`).join("\n\n")
  const HOST_ROWS = 3
  const frame = ({ body }: { body: React.ReactNode }) => (
    <Box flexDirection="column">
      <Text>TOP</Text>
      {body}
      <Text>FOOT</Text>
    </Box>
  )

  const linesOf = (extra: Partial<IssueDetail>, height: number): number => {
    const { lastFrame } = render(
      <IssueDetailView
        issue={issue({ description: long, ...extra })}
        width={80}
        height={height}
        onBack={noop}
        frame={frame}
      />,
    )
    return (lastFrame() ?? "").split("\n").length
  }

  it("spends exactly `height` lines whatever the key/value block holds", () => {
    const bare = linesOf({}, 20)
    const full = linesOf(
      { parent: { key: "SHOP-1", summary: "parent" }, labels: ["a", "b"] },
      20,
    )
    // TOP and FOOT are the host's; everything between is the view's `height`.
    expect(bare - HOST_ROWS + 1).toBe(20)
    expect(full).toBe(bare)
  })
})
