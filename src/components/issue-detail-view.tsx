import { MarkdownViewport, type MarkdownTheme } from "@kud/ink-markdown"
import { Badge, colors, FooterHints, KeyValue, type Hint } from "@kud/ink-ui"
import { Box, Text, useInput } from "ink"
import { useState, type ReactNode } from "react"
import { relativeAge } from "../lib/board.js"
import type { IssueDetail } from "../lib/issue-detail.js"
import { priorityMarker } from "./priority-marker.js"

const truncate = (s: string, max: number): string =>
  s.length <= max ? s : `${s.slice(0, Math.max(0, max - 1))}…`

const originOf = (a: IssueDetail["attachments"][number]): string =>
  a.origins
    .map((o) =>
      o.kind === "comment"
        ? `comment by ${o.author ?? "unknown"}`
        : o.kind === "description"
          ? "description"
          : "issue",
    )
    .join(", ")

const humanSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"]
  const e = Math.min(
    units.length - 1,
    Math.floor(Math.log(Math.max(bytes, 1)) / Math.log(1024)),
  )
  const value = bytes / 1024 ** e
  return `${e === 0 ? value : value.toFixed(1)}${units[e]}`
}

const ago = (iso: string): string => {
  const rel = relativeAge(iso)
  return rel ? `${rel} ago` : iso
}

/**
 * The whole ticket as ONE Markdown document: description, then the comments
 * under their own heading, then the attachments as an appendix.
 *
 * It was three tabs — Description, Comments, Attachments — and every one of
 * them was a Markdown viewport scrolled with ↑↓, which is to say they owned
 * identical keys and were only ever jump targets. A tab is a place you go to
 * DO something; here there was nothing different to do. One document reads
 * top to bottom, the header above it counts what is further down so the
 * reader knows there is something to scroll to, and ←→ are free.
 *
 * Attachments last because they are an appendix: the description and the
 * comments already name them inline, and the header's count is what says
 * they exist.
 */
const documentOf = (issue: IssueDetail): string => {
  const parts = [issue.description || "_No description._"]
  if (issue.comments.length > 0)
    parts.push(
      `## Comments (${issue.comments.length})`,
      ...issue.comments.map(
        (c) => `**${c.author}** · ${ago(c.created)}\n\n${c.body}`,
      ),
    )
  if (issue.attachments.length > 0)
    parts.push(
      `## Attachments (${issue.attachments.length})`,
      issue.attachments
        .map(
          (a) =>
            `- \`${a.filename}\` — ${a.mimeType}, ${humanSize(a.size)} · from ${originOf(a)}\n  \`jira attachment read ${issue.key} ${a.filename}\``,
        )
        .join("\n"),
    )
  return parts.join("\n\n")
}

export type IssueDetailViewProps = {
  issue: IssueDetail
  height: number
  width: number
  onBack: () => void
  /**
   * The write actions are optional, and a key whose handler is absent is
   * neither bound nor hinted. A host that only READS — cockpit's ticket drill —
   * mounts the same screen jira-cli's TUI does, minus the verbs it has no way
   * to honour, rather than a hint row promising `t` and `c` that do nothing.
   */
  onTransition?: () => void
  onComment?: () => void
  onAssign?: () => void
  onOpenBrowser?: () => void
  /**
   * A host that draws its own chrome — a bordered drill frame with the title
   * on top and the hints pinned at the foot — takes the screen in parts and
   * places them. The view then draws neither its title line nor its footer,
   * so nothing appears twice. `height` is still the whole area the host has
   * given the body, frame excluded.
   */
  frame?: (parts: {
    title: string
    subtitle: string
    hints: Hint[]
    body: ReactNode
  }) => ReactNode
  /** Colours for the Markdown body; a host passes its own tokens so links, code and headings sit in its palette. */
  theme?: MarkdownTheme
}

/**
 * The facts a reader skims rather than acts on, on one dim line under the
 * rows: priority leads and is the one bright cell — glyph in its hue, the
 * name beside it — and only when it is placed away from the default, since
 * "normal" is not news; then the reporter, the labels, and how much there is
 * to scroll to. The rows above it are what you act on; vertical order is
 * importance order.
 */
const FactsLine = ({ issue }: { issue: IssueDetail }) => {
  const priority = priorityMarker(issue.priority ?? null)
  const lead =
    priority.marker !== " " && priority.marker !== "=" ? (
      <>
        <Text color={priority.color}>{priority.marker}</Text>
        <Text> {issue.priority}</Text>
      </>
    ) : null
  const plural = (n: number, word: string) =>
    `${n} ${word}${n === 1 ? "" : "s"}`
  const facts = [
    `by ${issue.reporter}`,
    ...(issue.labels.length > 0 ? [`labels ${issue.labels.join(", ")}`] : []),
    plural(issue.comments.length, "comment"),
    ...(issue.attachments.length > 0
      ? [plural(issue.attachments.length, "attachment")]
      : []),
  ]
  return (
    <Box>
      {lead}
      <Text color={colors.muted}>
        {(lead ? " · " : "") + facts.join(" · ")}
      </Text>
    </Box>
  )
}

export const IssueDetailView = ({
  issue,
  height,
  width,
  onBack,
  onTransition,
  onComment,
  onAssign,
  onOpenBrowser,
  frame,
  theme,
}: IssueDetailViewProps) => {
  const [scroll, setScroll] = useState(0)

  // Esc is not bound here: the back keys are the host's (ink-ui's `useAppKeys`),
  // whose peel calls `onBack` when this view is the topmost layer. Binding it
  // here too would fire both. ←→ are bound to nothing either: the document
  // has no tabs to move between any more.
  useInput((input, key) => {
    if (input === "t" && onTransition) return onTransition()
    if (input === "c" && onComment) return onComment()
    if (input === "a" && onAssign) return onAssign()
    if (input === "o" && onOpenBrowser) return onOpenBrowser()
    if (key.downArrow || input === "j") setScroll((s) => s + 1)
    if (key.upArrow || input === "k") setScroll((s) => Math.max(0, s - 1))
  })

  const source = documentOf(issue)

  // The lines the view spends above the viewport, counted from the rows it
  // actually draws: the key/value block varies with parent, the facts line is
  // one, the gap under the header one. Framed, the host has already paid for
  // the title, the footer and the `type` row the frame's title carries.
  const keyValueRows = 2 + (issue.parent ? 1 : 0) + (frame ? 0 : 1)
  const chromeLines = keyValueRows + 1 + 1 + (frame ? 0 : 4)
  const bodyHeight = Math.max(3, height - chromeLines)

  const hints: Hint[] = [
    ["↑↓", "scroll"],
    ...(onTransition ? ([["t", "move"]] as Hint[]) : []),
    ...(onComment ? ([["c", "comment"]] as Hint[]) : []),
    ...(onAssign ? ([["a", "assign"]] as Hint[]) : []),
    ...(onOpenBrowser ? ([["o", "browser"]] as Hint[]) : []),
    ["⌫", "back"],
  ]

  // Rows first, facts line under them, then the document. `status` leads
  // because it is the one Jira fact that can be wrong BY YOU, so it is the row
  // that can call; `assignee` asks whether it is yours; `parent` is the
  // breadcrumb back to the list's epic header, its key a reference you follow
  // rather than the answer. Status is state and stays a badge; type is
  // identity and, framed, moves up into the title beside the key the way
  // `#123 · repo` carries a PR's — a header that says "Task" twice in five
  // rows reads as nobody having checked. The reporter and the labels are
  // neither state nor acted on, so they leave the rows for the facts line.
  const body = (
    <Box flexDirection="column">
      <Box flexDirection="column">
        <KeyValue label="status" value={<Badge>{issue.status}</Badge>} />
        {frame ? null : <KeyValue label="type" value={issue.type} />}
        <KeyValue
          label="assignee"
          value={
            issue.assignee === "unassigned" ? (
              <Text color={colors.muted}>unassigned</Text>
            ) : (
              issue.assignee
            )
          }
        />
        {issue.parent && (
          <KeyValue
            label="parent"
            value={
              <>
                <Text color={colors.secondary}>{issue.parent.key}</Text>
                <Text>{`  ${truncate(issue.parent.summary, 60)}`}</Text>
              </>
            }
          />
        )}
        <FactsLine issue={issue} />
      </Box>

      {/* Clipped, because a viewport whose last sliced line is a paragraph gap
          ends its text in a newline and Ink draws that as one extra row —
          which is where "the description does not fill the space" came from. */}
      <Box marginTop={1} height={bodyHeight} overflow="hidden">
        <MarkdownViewport
          source={source}
          width={Math.max(20, width - 2)}
          height={bodyHeight}
          scrollOffset={scroll}
          theme={theme}
        />
      </Box>
    </Box>
  )

  if (frame)
    return frame({
      title: `${issue.key} · ${issue.type}`,
      subtitle: issue.summary,
      hints,
      body,
    })

  return (
    <Box flexDirection="column">
      <Text bold>
        {issue.key} {issue.summary}
      </Text>

      <Box marginTop={1}>{body}</Box>

      <Box marginTop={1}>
        <FooterHints hints={hints} />
      </Box>
    </Box>
  )
}
