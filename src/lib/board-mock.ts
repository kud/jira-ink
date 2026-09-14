import { tabsFromCategories, type BoardModel, type BoardRow } from "./board.js"

const CHECKOUT = { key: "SHOP-300", summary: "Basket and checkout correctness" }
const STOREFRONT = { key: "SHOP-350", summary: "Storefront refresh" }

/**
 * An invented board for screenshots and tests — every key, name and host is
 * made up. It carries what the contract must keep exercising: a container
 * that is itself in a tab with a child under it, a parent that is not, an
 * orphan, all three categories, and both ends of priority.
 */
export const MOCK_BOARD_ROWS: BoardRow[] = [
  {
    key: "SHOP-300",
    summary: CHECKOUT.summary,
    status: "To Do",
    statusId: "10000",
    category: "new",
    type: "Epic",
    container: true,
    priority: "Medium",
    assignee: "Ada Okafor",
    updated: "2026-08-14T10:00:00.000Z",
  },
  {
    key: "SHOP-412",
    summary: "Checkout total ignores the discount on the last item",
    status: "In Progress",
    statusId: "10001",
    category: "indeterminate",
    type: "Bug",
    container: false,
    priority: "High",
    parent: CHECKOUT,
    assignee: "Ada Okafor",
    updated: "2026-08-14T09:12:00.000Z",
  },
  {
    key: "SHOP-408",
    summary: "Add a dark theme to the storefront",
    status: "In Review",
    statusId: "10002",
    category: "indeterminate",
    type: "Story",
    container: false,
    priority: "Medium",
    parent: STOREFRONT,
    assignee: "Ada Okafor",
    updated: "2026-08-13T16:40:00.000Z",
  },
  {
    key: "SHOP-397",
    summary: "Search returns stale results after a filter change",
    status: "To Do",
    statusId: "10000",
    category: "new",
    type: "Bug",
    container: false,
    priority: "Medium",
    parent: CHECKOUT,
    assignee: "Ada Okafor",
    updated: "2026-08-11T08:00:00.000Z",
  },
  {
    key: "SHOP-401",
    summary: "Coupon field accepts whitespace-only codes",
    status: "In Progress",
    statusId: "10001",
    category: "indeterminate",
    type: "Bug",
    container: false,
    priority: "Low",
    parent: CHECKOUT,
    assignee: "Ada Okafor",
    updated: "2026-08-12T11:30:00.000Z",
  },
  {
    key: "PLAT-88",
    summary: "Rotate the staging database credentials",
    status: "Blocked",
    statusId: "10005",
    category: "indeterminate",
    type: "Task",
    container: false,
    priority: "Highest",
    assignee: "Ada Okafor",
    updated: "2026-08-09T14:05:00.000Z",
  },
  {
    key: "SHOP-390",
    summary: "Show the VAT breakdown on the order summary",
    status: "Done",
    statusId: "10003",
    category: "done",
    type: "Story",
    container: false,
    priority: "Medium",
    parent: CHECKOUT,
    assignee: "Ada Okafor",
    updated: "2026-08-08T10:00:00.000Z",
  },
]

export const mockBoard = (): BoardModel => ({
  rows: MOCK_BOARD_ROWS,
  tabs: tabsFromCategories(),
})
