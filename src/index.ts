// mcp-flema-engram — MCP server for Engram memory system

// Adapters
export { LocalEngramAdapter } from "./adapters/local.js";
export { CloudEngramAdapter } from "./adapters/cloud.js";
export type { CloudAdapterOptions } from "./adapters/cloud.js";
export { CompositeEngramAdapter } from "./adapters/composite.js";

// Types
export type {
  EngramAdapter,
  HealthStatus,
  Project,
  Observation,
  ListObservationsOpts,
  SearchOpts,
  Session,
  SessionWithObservations,
  ListSessionsOpts,
  LocalAdapterOptions,
} from "./adapters/types.js";

// Schemas
export { observationSchema } from "./schemas/observation.js";
export { projectSchema } from "./schemas/project.js";
export { sessionSchema, sessionWithObservationsSchema } from "./schemas/session.js";

// Errors
export { EngramUnavailable, ValidationError, NotImplemented } from "./utils/errors.js";

// Utils
export { resolveProjectName, normalizeProjectName } from "./utils/project-resolver.js";
export type { ProjectResolutionOptions } from "./utils/project-resolver.js";
export {
  collectBlockers,
  deriveChangeState,
  groupByChange,
  normalizePhase,
  parseSDDTopicKey,
  SDD_PHASES,
} from "./utils/sdd-detector.js";
export type {
  SDDArtifact,
  SDDChange,
  SDDChangeState,
  SDDPhase,
  SDDPhaseName,
} from "./utils/sdd-detector.js";

// MCP Server
export { EngramMcpServer } from "./mcp/server.js";
export type { McpServerConfig } from "./mcp/server.js";

// MCP Tools
export { ListProjectsInput, listProjectsHandler } from "./mcp/tools/list-projects.js";
export { GetProjectStateInput, getProjectStateHandler } from "./mcp/tools/get-project-state.js";
export { ListObservationsInput, listObservationsHandler } from "./mcp/tools/list-observations.js";
export { GetObservationInput, getObservationHandler } from "./mcp/tools/get-observation.js";
export { SearchObservationsInput, searchObservationsHandler } from "./mcp/tools/search-observations.js";
export { ListSessionsInput, listSessionsHandler } from "./mcp/tools/list-sessions.js";
export { GetSessionInput, getSessionHandler } from "./mcp/tools/get-session.js";

// MCP Resources
export { healthResourceHandler } from "./mcp/resources/engram-health.js";
export { projectsResourceHandler } from "./mcp/resources/engram-projects.js";
export { projectResourceHandler } from "./mcp/resources/engram-project.js";
export { observationResourceHandler } from "./mcp/resources/engram-observation.js";
export { sessionResourceHandler } from "./mcp/resources/engram-session.js";
export { changesResourceHandler } from "./mcp/resources/engram-changes.js";
export { changeStateResourceHandler } from "./mcp/resources/engram-change-state.js";
export { changeArtifactsResourceHandler } from "./mcp/resources/engram-change-artifacts.js";

// Official OpenCode TUI plugin (SolidJS / sidebar_content)
export { createEngramTuiPlugin, EngramSidebar } from "./sidebar/plugin.js";
export type {
  EngramSidebarProps,
  EngramTuiDependencies,
  EngramTuiOptions,
} from "./sidebar/plugin.js";
export { ProjectList } from "./sidebar/components/project-list.js";
export type { ProjectListProps } from "./sidebar/components/project-list.js";
export { PhaseProgress } from "./sidebar/components/phase-progress.js";
export type { PhaseProgressProps } from "./sidebar/components/phase-progress.js";
export { Blockers } from "./sidebar/components/blockers.js";
export type { BlockersProps } from "./sidebar/components/blockers.js";
export { ActivityFeed } from "./sidebar/components/activity-feed.js";
export type { ActivityFeedProps } from "./sidebar/components/activity-feed.js";
export { useEngram } from "./sidebar/hooks/use-engram.js";
export type {
  SidebarHealth,
  SidebarRefreshInput,
  SidebarViewModel,
  UseEngramOptions,
  UseEngramReturn,
} from "./sidebar/hooks/use-engram.js";
export { launchDashboard, checkDashboardExists } from "./sidebar/dashboard-launcher.js";
export type { DashboardLauncherOptions, LaunchResult } from "./sidebar/dashboard-launcher.js";
