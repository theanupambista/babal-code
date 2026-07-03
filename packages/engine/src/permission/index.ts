/**
 * The permission broker: a capability-based approval layer the coding tools
 * `await` before a side-effecting action — the AI SDK owns our agent loop, so the
 * seam is each tool's own `execute`). See `service.ts` for the singleton.
 */
export { permission, type PermissionService } from "./service";
export {
  PermissionDeniedError,
  PermissionRejectedError,
  type PendingPermission,
  type PermissionAction,
  type PermissionDecision,
  type PermissionRequest,
} from "./types";
export type { PermissionConfig } from "./store";
