import type { Route } from "./app";
import { getSetting, setSetting } from "./db";

/** Core daily workflow tabs — always available unless user hides them */
export const CORE_NAV_ROUTES: Route[] = [
  "dashboard",
  "callmode",
  "startwork",
  "leads",
  "pipeline",
  "followups",
  "import",
  "analytics",
];

/** Optional tabs user can disable in Settings */
export const OPTIONAL_NAV_ROUTES: Route[] = ["clients", "projects", "tasks", "calendar"];

export const ALL_TOGGLEABLE_ROUTES: Route[] = [...CORE_NAV_ROUTES, ...OPTIONAL_NAV_ROUTES];

export const NAV_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  callmode: "Call Mode",
  startwork: "Work Mode",
  leads: "Leads",
  pipeline: "Pipeline",
  followups: "Follow-ups",
  import: "Import",
  analytics: "Analytics",
  clients: "Clients",
  projects: "Projects",
  tasks: "Tasks",
  calendar: "Calendar",
  settings: "Settings",
};

/** Default: hide delivery tabs you said you don't use */
export const DEFAULT_HIDDEN_NAV: Route[] = ["clients", "projects", "tasks", "calendar"];

const KEY = "nav_hidden_routes";

export async function getHiddenNavRoutes(): Promise<Route[]> {
  const stored = await getSetting<Route[]>(KEY);
  if (Array.isArray(stored)) return stored;
  return DEFAULT_HIDDEN_NAV;
}

export async function setHiddenNavRoutes(routes: Route[]): Promise<void> {
  await setSetting(KEY, routes);
}

export function isNavVisible(route: Route, hidden: Route[]): boolean {
  if (route === "settings") return true;
  return !hidden.includes(route);
}
