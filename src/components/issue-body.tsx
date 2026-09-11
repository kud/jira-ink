import { exec } from "node:child_process"
import type { JiraClient } from "@kud/jira"
import { LoadingScreen, StatusMessage } from "@kud/ink-ui"
import { Box, useInput, useStdout } from "ink"
import { useEffect, useState, type ReactNode } from "react"
import { issueDetailOf, type IssueDetail } from "../lib/issue-detail.js"
import {
  IssueDetailView,
  type IssueDetailViewProps,
} from "./issue-detail-view.js"

const useTermSize = () => {
  const { stdout } = useStdout()
  const [size, setSize] = useState({
    cols: stdout.columns || 80,
    rows: stdout.rows || 24,
  })
  useEffect(() => {
    const onResize = () =>
      setSize({ cols: stdout.columns || 80, rows: stdout.rows || 24 })
    stdout.on("resize", onResize)
    return () => {
      stdout.off("resize", onResize)
    }
  }, [stdout])
  return size
}

const openInBrowser = (url: string) => {
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open"
  exec(`${opener} "${url}"`)
}

type Loading =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; issue: IssueDetail }

export type IssueBodyProps = {
  client: JiraClient
  /** Instance URL, as `loadConfig` resolves it; only used to build the browser link. */
  baseUrl: string
  issueKey: string
  onExit: () => void
  /** Override the terminal-derived size when the host draws inside a frame. */
  width?: number
  height?: number
  /** The host's chrome around the screen — see `IssueDetailView`. */
  frame?: IssueDetailViewProps["frame"]
  theme?: IssueDetailViewProps["theme"]
}

/**
 * The issue screen as a host mounts it: hand it a client and a key, and it
 * fetches, draws and reads its own keys until `onExit`. `JenkinsBody`'s shape,
 * for the same reason — a cockpit mounting a ticket over its list should not
 * have to know how an issue is fetched or what the loading states look like.
 *
 * Read-only by construction. The write verbs (`t`, `c`, `a`) exist on
 * `IssueDetailView` for jira-cli's own TUI, which owns the prompts they need;
 * here they are simply not wired, so the hint row does not offer them.
 */
export const IssueBody = ({
  client,
  baseUrl,
  issueKey,
  onExit,
  width,
  height,
  frame,
  theme,
}: IssueBodyProps) => {
  const term = useTermSize()
  const [state, setState] = useState<Loading>({ phase: "loading" })

  useEffect(() => {
    let live = true
    setState({ phase: "loading" })
    issueDetailOf(client, baseUrl, issueKey)
      .then((issue) => live && setState({ phase: "ready", issue }))
      .catch(
        (e: unknown) =>
          live &&
          setState({
            phase: "error",
            message: e instanceof Error ? e.message : String(e),
          }),
      )
    return () => {
      live = false
    }
  }, [client, baseUrl, issueKey])

  // `q` leaves from any phase — the cockpit's convention, where every mounted
  // drill answers `q` as well as esc. Bound here and not on IssueDetailView
  // because in jira-cli's own TUI `q` quits the app from anywhere, and a view
  // that also read it as "back" would fire both. Esc is only ours until the
  // detail view mounts and binds its own; before that a slow fetch would
  // otherwise hold the host hostage.
  useInput((input, key) => {
    if (input === "q") return onExit()
    if (key.escape && state.phase !== "ready") onExit()
  })

  // The frame goes up before the fetch answers, so a host sees the same panel
  // through loading, error and ready rather than a bare spinner that snaps
  // into a border a second later. The type is not known yet, so the title is
  // the key alone.
  const framed = (body: ReactNode): ReactNode =>
    frame
      ? frame({
          title: issueKey,
          subtitle: "",
          hints: [["esc", "back"]],
          body,
        })
      : body

  if (state.phase === "loading")
    return framed(<LoadingScreen label={`Loading ${issueKey}…`} />)
  if (state.phase === "error")
    return framed(
      <Box flexDirection="column">
        <StatusMessage variant="error">
          {issueKey}: {state.message}
        </StatusMessage>
      </Box>,
    )

  return (
    <IssueDetailView
      issue={state.issue}
      width={width ?? term.cols}
      height={height ?? term.rows}
      onBack={onExit}
      onOpenBrowser={() => openInBrowser(state.issue.url)}
      frame={frame}
      theme={theme}
    />
  )
}
