import { MarkdownViewport, type MarkdownTheme } from "@kud/ink-markdown"
import {
  Badge,
  FooterHints,
  KeyValue,
  Tabs,
  useTabs,
  type Hint,
  type TabItem,
} from "@kud/ink-ui"
import { Box, Text, useInput } from "ink"
import { useState, type ReactNode } from "react"
import type { IssueDetail } from "../lib/issue-detail.js"

type Section = "description" | "comments" | "attachments"

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

/** Comments become one Markdown document so they scroll as a single pane. */
const commentsAsMarkdown = (issue: IssueDetail): string =>
  issue.comments.length === 0
    ? "_No comments._"
    : issue.comments
        .map((c) => `**${c.author}** · ${c.created}\n\n${c.body}`)
        .join("\n\n---\n\n")

const attachmentsAsMarkdown = (issue: IssueDetail): string =>
  issue.attachments.length === 0
    ? "_No attachments._"
    : issue.attachments
        .map(
          (a) =>
            `- \`${a.filename}\` — ${a.mimeType}, ${humanSize(a.size)}\n  from ${originOf(a)}\n  \`jira attachment read ${issue.key} ${a.filename}\``,
        )
        .join("\n")

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
  const tabs: TabItem<Section>[] = [
    { value: "description", label: "Description" },
    { value: "comments", label: "Comments", count: issue.comments.length },
    {
      value: "attachments",
      label: "Attachments",
      count: issue.attachments.length,
    },
  ]
  const { active } = useTabs(tabs, { initial: "description" })
  const [scroll, setScroll] = useState(0)

  // Esc is not bound here: the back keys are the host's (ink-ui's `useAppKeys`),
  // whose peel calls `onBack` when this view is the topmost layer. Binding it
  // here too would fire both.
  useInput((input, key) => {
    if (input === "t" && onTransition) return onTransition()
    if (input === "c" && onComment) return onComment()
    if (input === "a" && onAssign) return onAssign()
    if (input === "o" && onOpenBrowser) return onOpenBrowser()
    // ←→ belong to useTabs; only vertical movement is ours to handle. ← used
    // to ALSO fire onBack here, one line above the hint promising it switches
    // sections — both handlers ran, and the unmount won.
    if (key.downArrow || input === "j") setScroll((s) => s + 1)
    if (key.upArrow || input === "k") setScroll((s) => Math.max(0, s - 1))
  })

  const source =
    active === "comments"
      ? commentsAsMarkdown(issue)
      : active === "attachments"
        ? attachmentsAsMarkdown(issue)
        : issue.description || "_No description._"

  // The lines the view spends above and below the viewport, counted from the
  // rows it actually draws — the key/value block varies with parent and
  // labels, and a constant here was one line over with both and three short
  // with neither, which read as a description that would not fill its space.
  // Framed, the host has already paid for the title, the footer and the
  // `type` row the frame's title carries.
  const keyValueRows =
    3 + (issue.parent ? 1 : 0) + (issue.labels.length > 0 ? 1 : 0) + (frame ? 0 : 1)
  const chromeLines = keyValueRows + 1 + 2 + 1 + (frame ? 0 : 4)
  const bodyHeight = Math.max(3, height - chromeLines)

  const hints: Hint[] = [
    ["←→", "section"],
    ["↑↓", "scroll"],
    ...(onTransition ? ([["t", "move"]] as Hint[]) : []),
    ...(onComment ? ([["c", "comment"]] as Hint[]) : []),
    ...(onAssign ? ([["a", "assign"]] as Hint[]) : []),
    ...(onOpenBrowser ? ([["o", "browser"]] as Hint[]) : []),
    ["⌫", "back"],
  ]

  // Status is state and stays a badge; type is identity and, framed, moves up
  // into the title beside the key the way `#123 · repo` carries a PR's — a
  // header that says "Task" twice in five rows reads as nobody having checked.
  const body = (
    <Box flexDirection="column">
      <Box flexDirection="column">
        {issue.parent && (
          <KeyValue
            label="parent"
            value={`${issue.parent.key}  ${truncate(issue.parent.summary, 60)}`}
          />
        )}
        <KeyValue label="status" value={<Badge>{issue.status}</Badge>} />
        {frame ? null : <KeyValue label="type" value={issue.type} />}
        <KeyValue label="assignee" value={issue.assignee} />
        <KeyValue label="reporter" value={issue.reporter} />
        {issue.labels.length > 0 && (
          <KeyValue label="labels" value={issue.labels.join(", ")} />
        )}
      </Box>

      <Box marginTop={1}>
        <Tabs items={tabs} active={active ?? "description"} />
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
