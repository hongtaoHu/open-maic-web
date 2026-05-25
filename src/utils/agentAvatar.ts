// SPDX-License-Identifier: AGPL-3.0
/** Map backend avatar paths to bundled frontend assets. */

import assistantAvatar from '@/assets/avatars/assistant.svg';
import clownAvatar from '@/assets/avatars/clown.svg';
import curiousAvatar from '@/assets/avatars/curious.svg';
import notesAvatar from '@/assets/avatars/notes.svg';
import teacherAvatar from '@/assets/avatars/teacher.svg';
import thinkerAvatar from '@/assets/avatars/thinker.svg';

const AVATAR_BY_BACKEND_PATH: Record<string, string> = {
  '/avatars/teacher.png': teacherAvatar,
  '/avatars/assist.png': assistantAvatar,
  '/avatars/clown.png': clownAvatar,
  '/avatars/curious.png': curiousAvatar,
  '/avatars/note-taker.png': notesAvatar,
  '/avatars/thinker.png': thinkerAvatar,
};

const AVATAR_BY_AGENT_ID: Record<string, string> = {
  'default-1': teacherAvatar,
  'default-2': assistantAvatar,
  'default-3': clownAvatar,
  'default-4': curiousAvatar,
  'default-5': notesAvatar,
  'default-6': thinkerAvatar,
};

export function resolveAgentAvatarUrl(
  agentId: string,
  avatarPath?: string | null,
): string | undefined {
  if (avatarPath && AVATAR_BY_BACKEND_PATH[avatarPath]) {
    return AVATAR_BY_BACKEND_PATH[avatarPath];
  }
  return AVATAR_BY_AGENT_ID[agentId];
}
