/**
 * Access to the `code-for-ibmi.*` settings that shape the shared views.
 *
 * These are contributed and read by the base extension, not by this one: the values are
 * fetched through its exported API so that the defaults and bounds (page size floor,
 * auto-refresh fallback) live in exactly one place. Re-reading the raw configuration
 * here would mean the two extensions could drift apart — and a page size that disagrees
 * with the one the table was rendered with produces silently wrong pagination.
 *
 * @module config
 */

import { loadBase } from './ibmi';

/** Settings key for the auto-refresh interval, for use with `affectsConfiguration`. */
export const AUTO_REFRESH_INTERVAL_KEY = `code-for-ibmi.views.autoRefreshInterval`;

/** Settings key for the page size, for use with `affectsConfiguration`. */
export const ITEMS_PER_PAGE_KEY = `code-for-ibmi.tables.itemsPerPage`;

/**
 * Page size for every paginated view, from `code-for-ibmi.tables.itemsPerPage`.
 * Views that paginate server-side must use this for their own LIMIT/OFFSET too,
 * otherwise the page count shown by the table won't match the rows it receives.
 */
export function getItemsPerPage(): number {
  return loadBase()!.viewSettings.getItemsPerPage();
}

/**
 * Auto-refresh interval in milliseconds, from `code-for-ibmi.views.autoRefreshInterval`
 * (which is expressed in seconds). Returns 0 when auto-refresh is disabled.
 */
export function getAutoRefreshInterval(): number {
  return loadBase()!.viewSettings.getAutoRefreshInterval();
}
