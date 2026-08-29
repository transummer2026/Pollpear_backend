import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import type { User, UserRole } from 'src/generated/prisma/client';
import { viewerOf, type Viewer } from './viewer';

const abilities = new CaslAbilityFactory();

export function viewerAs(id: number, role: UserRole): Viewer {
  const user = { id, role } as User;
  return viewerOf(user, abilities.createForUser(user));
}
