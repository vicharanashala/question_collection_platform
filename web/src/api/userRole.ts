import { request, cache } from "./client";

/** Roles a super admin can switch a user to. Keep in sync with the backend ASSIGNABLE_ROLES. */
export const ASSIGNABLE_ROLES = [
  "admin",
  "curator",
  "distributor",
  "finance",
] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<AssignableRole, string> = {
  admin: "Admin",
  curator: "Curator",
  distributor: "Distributor",
  finance: "Finance",
};

export interface ChangeUserRolePayload {
  role: AssignableRole;
  reason?: string;
}

export interface ChangeUserRoleResponse {
  success: boolean;
  userId: string;
  name: string;
  previousRole: string;
  newRole: AssignableRole;
}

export const userRoleApi = {
  changeRole: (userId: string, body: ChangeUserRolePayload) =>
    request<ChangeUserRoleResponse>(
      `/admin/users/${userId}/role`,
      { method: "PATCH", body: JSON.stringify(body) },
      false,
    ).finally(() => cache.invalidate("/api/admin")),
};
