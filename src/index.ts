// Public surface of @kud/jira-ink — the issue screen, in the two shapes a host
// wants it: `IssueDetailView` for a host that already holds an `IssueDetail`
// and owns the prompts behind the write verbs (jira-cli's TUI), and `IssueBody`
// for one that has a client and a key and wants the screen to fetch itself
// (cockpit's ticket drill). Both draw the same thing.
export {
  IssueDetailView,
  type IssueDetailViewProps,
} from "./components/issue-detail-view.js"
export { IssueBody, type IssueBodyProps } from "./components/issue-body.js"
export {
  issueDetailOf,
  transitionsOf,
  type IssueDetail,
  type Transition,
} from "./lib/issue-detail.js"
export {
  IssueBoard,
  type BoardLeaves,
  type BoardScope,
  type CursorAt,
  type IssueBoardProps,
} from "./components/issue-board.js"
export {
  priorityMarker,
  type PriorityMarker,
} from "./components/priority-marker.js"
export {
  blockIndexOfStop,
  blocksFor,
  boardOf,
  countsFor,
  fenceNote,
  headNote,
  isStop,
  OFF_BOARD,
  parentsOf,
  pendingRow,
  pillVariantFor,
  placementOf,
  priorityGlyph,
  type PriorityGlyph,
  relativeAge,
  rowsInTab,
  settleRow,
  stopsOf,
  treePrefix,
  subtreeOf,
  tabLabelOf,
  tabOf,
  tabsFromBoard,
  tabsFromCategories,
  tabsFromConfig,
  toBoardRow,
  transitionRow,
  withBehind,
  visibleTabs,
  type Block,
  type BoardModel,
  type BoardOptions,
  type BoardRow,
  type BoardTab,
  type BoardTabs,
  type Placement,
  type StatusCategory,
  type Stop,
  type TransitionTarget,
  type TabSource,
} from "./lib/board.js"
export { MOCK_BOARD_ROWS, mockBoard } from "./lib/board-mock.js"
