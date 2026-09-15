import {
  adfToMarkdown,
  locateAttachments,
  type JiraClient,
  type LocatedAttachment,
} from "@kud/jira";

/**
 * One issue, as the detail screen reads it: every field already a string, ADF
 * already Markdown, attachments already located. The view never touches a raw
 * `JiraIssue`, so a host that fakes a `JiraClient` for a test or a screenshot
 * gets a screen it can predict, and one that fetched the issue by some other
 * route can build this shape by hand.
 */
export type IssueDetail = {
  key: string;
  summary: string;
  status: string;
  type: string;
  assignee: string;
  reporter: string;
  labels: string[];
  /** Jira's priority name, verbatim; absent when the field is off. */
  priority?: string;
  parent?: { key: string; summary: string };
  url: string;
  description: string;
  comments: { id: string; author: string; created: string; body: string }[];
  attachments: LocatedAttachment[];
};

export type Transition = { id: string; name: string; to: string };

export const issueDetailOf = async (
  client: JiraClient,
  baseUrl: string,
  key: string,
): Promise<IssueDetail> => {
  const issue = await client.getIssue(key);
  const attachments = locateAttachments(issue);
  const filenameOf = (id: string): string | undefined =>
    attachments.find((a) => a.id === id)?.filename;
  const f = issue.fields;

  return {
    key: issue.key,
    summary: f.summary ?? "",
    status: f.status?.name ?? "—",
    type: f.issuetype?.name ?? "—",
    assignee: f.assignee?.displayName ?? "unassigned",
    reporter: f.reporter?.displayName ?? "—",
    labels: f.labels ?? [],
    ...(f.priority?.name ? { priority: f.priority.name } : {}),
    parent: f.parent
      ? { key: f.parent.key, summary: f.parent.fields?.summary ?? "" }
      : undefined,
    url: `${baseUrl}/browse/${issue.key}`,
    description: adfToMarkdown(f.description, filenameOf),
    comments: (f.comment?.comments ?? []).map((c) => ({
      id: c.id,
      author: c.author?.displayName ?? "unknown",
      created: c.created ?? "",
      body: adfToMarkdown(c.body, filenameOf),
    })),
    attachments,
  };
};

export const transitionsOf = async (
  client: JiraClient,
  key: string,
): Promise<Transition[]> =>
  (await client.getTransitions(key)).transitions.map((t) => ({
    id: t.id,
    name: t.name,
    to: t.to?.name ?? t.name,
  }));
