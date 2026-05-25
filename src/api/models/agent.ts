// SPDX-License-Identifier: AGPL-3.0
/** Agent 角色 — /api/agent-roles */

import { http } from '@/api/instance';
import type { AgentRoleDropdownItem, AgentRoleListItem } from '@/types/agent';
import type { ApiResponse } from '@/types/chat';

const PREFIX = '/api/agent-roles';

export function fetchAgentRolesDropdown(): Promise<
  ApiResponse<{ agents: AgentRoleDropdownItem[] }>
> {
  return http.get(`${PREFIX}/dropdown`);
}

export function fetchAgentRoles(): Promise<
  ApiResponse<{ agents: AgentRoleListItem[] }>
> {
  return http.get(PREFIX);
}
