import { Injectable } from '@nestjs/common';
import { AbilityBuilder } from '@casl/ability';
import { createPrismaAbility } from '@casl/prisma';
import { AppAbility } from './casl-prisma';
import { AuthorizationUser } from './permissions/role';
import { definePermissionsArray } from './permissions';
import { User } from 'src/generated/prisma/client';

/**
 * Builds the CASL ability a request is authorized against, from the caller's
 * id and role alone. The rules themselves live in permissions/, one module per
 * subject, and are all replayed here on the same builder: this factory holds
 * no policy of its own, so a rule that changes there changes everywhere,
 * including the prisma clauses `accessibleBy` derives from the same ability.
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: Pick<User, 'id' | 'role'>): AppAbility {
    const builder = new AbilityBuilder<AppAbility>(createPrismaAbility);

    const authorizationUser = new AuthorizationUser(user.id, user.role);

    definePermissionsArray.forEach((define) =>
      define(builder, authorizationUser),
    );

    return builder.build();
  }
}
