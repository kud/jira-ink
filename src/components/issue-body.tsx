import { exec } from "node:child_process";
import type { JiraClient } from "@kud/jira";
import { LoadingScreen, StatusMessage } from "@kud/ink-ui";
import { Box, useInput, useStdout } from "ink";
import { useEffect, useState } from "react";
import { issueDetailOf, type IssueDetail } from "../lib/issue-detail.js";
import { IssueDetailView } from "./issue-detail-view.js";

const useTermSize = () => {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    cols: stdout.columns || 80,
    rows: stdout.rows || 24,
  });
  useEffect(() => {
    const onResize = () =>
      setSize({ cols: stdout.columns || 80, rows: stdout.rows || 24 });
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  return size;
};

const openInBrowser = (url: string) => {
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  exec(`${opener} "${url}"`);
};

type Loading =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; issue: IssueDetail };

export type IssueBodyProps = {
  client: JiraClient;
  /** Instance URL, as `loadConfig` resolves it; only used to build the browser link. */
  baseUrl: string;
  issueKey: string;
  onExit: () => void;
  /** Override the terminal-derived size when the host draws inside a frame. */
  width?: number;
  height?: number;
};

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
}: IssueBodyProps) => {
  const term = useTermSize();
  const [state, setState] = useState<Loading>({ phase: "loading" });

  useEffect(() => {
    let live = true;
    setState({ phase: "loading" });
    issueDetailOf(client, baseUrl, issueKey)
      .then((issue) => live && setState({ phase: "ready", issue }))
      .catch(
        (e: unknown) =>
          live &&
          setState({
            phase: "error",
            message: e instanceof Error ? e.message : String(e),
          }),
      );
    return () => {
      live = false;
    };
  }, [client, baseUrl, issueKey]);

  // The detail view binds its own keys once mounted; until then, esc still
  // has to leave, or a slow fetch holds the host hostage.
  useInput(
    (_input, key) => {
      if (key.escape) onExit();
    },
    { isActive: state.phase !== "ready" },
  );

  if (state.phase === "loading")
    return <LoadingScreen label={`Loading ${issueKey}…`} />;
  if (state.phase === "error")
    return (
      <Box flexDirection="column">
        <StatusMessage variant="error">
          {issueKey}: {state.message}
        </StatusMessage>
      </Box>
    );

  return (
    <IssueDetailView
      issue={state.issue}
      width={width ?? term.cols}
      height={height ?? term.rows}
      onBack={onExit}
      onOpenBrowser={() => openInBrowser(state.issue.url)}
    />
  );
};
