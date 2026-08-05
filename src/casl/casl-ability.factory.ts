import { Injectable } from '@nestjs/common';
import { AbilityBuilder } from '@casl/ability';
import { createPrismaAbility } from '@casl/prisma';
import { AppAbility } from './casl-prisma';
import { AuthorizationUser } from './permissions/role';
import { definePermissionsArray } from './permissions';
import { User } from 'src/generated/prisma/client';

/**
 * CASL is a isomorphic authorization library.
 * Admins can manage (create/read/update/delete)
 * Users have read-only access to everything
 * Users can update their Poll Poll.createdById=== userId
 * Polls that are published cannot be removed
 * Action has been added to schema.prisma.ts with manage, update, delete, create
 * all is a special word that represents any subject
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User): AppAbility {
    const builder = new AbilityBuilder<AppAbility>(createPrismaAbility);

    const authorizationUser = new AuthorizationUser(user.id, user.role);

    definePermissionsArray.forEach((define) =>
      define(builder, authorizationUser),
    );

    return builder.build();
  }
}
