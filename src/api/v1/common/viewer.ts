// src/api/v1/common/viewer.ts
import type { User } from 'src/generated/prisma/client';
import type { AppAbility } from 'src/casl/casl-prisma';

export type Viewer = {
  id: number;
  ability: AppAbility;
};

export function viewerOf(user: User, ability: AppAbility): Viewer {
  return { id: user.id, ability };
}
