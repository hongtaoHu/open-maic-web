// SPDX-License-Identifier: AGPL-3.0
/** Agent role types for /api/agent-roles endpoints. */

export type AgentRoleKind = 'teacher' | 'assistant' | 'student';

export interface AgentRoleDropdownItem {
  id: string;
  name: string;
  role: AgentRoleKind;
  color: string | null;
}

/** GET /api/agent-roles 列表项 */
export interface AgentRoleListItem {
  id: string;
  name: string;
  role: AgentRoleKind;
  persona: string;
  avatar: string;
  color: string | null;
  allowedActions: string[];
  priority: number;
  isDefault?: boolean;
  createdAt?: number;
  updatedAt?: number;
}
