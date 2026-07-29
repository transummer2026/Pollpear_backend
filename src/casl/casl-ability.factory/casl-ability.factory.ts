import { Injectable } from '@nestjs/common';
import { AbilityBuilder } from '@casl/ability';
import { Action } from 'src/generated/prisma/client';
import { createPrismaAbility } from '@casl/prisma';
import { AppAbility } from '../casl-prisma';
import type { User } from 'src/generated/prisma/client';

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
  // this is as admin or moderator
  createForUser(user: User) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createPrismaAbility,
    );
    if (user.role === 'admin') {
      can(Action.manage, 'all');
    } else if (user.role === 'moderator') {
      can(Action.delete, 'Poll');
      can(Action.delete, 'Room');
      can(Action.delete, 'Hashtag');
      can(Action.delete, 'Message');
      can(Action.update, 'User');

      can(Action.update, 'Ban', ['banReason', 'userId']);
    } else {
      cannot(Action.manage, 'all');
    }
    return build();
  }

  // as me the user these are the things i can do
  createForOwner(user: User) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(
      createPrismaAbility,
    );
    if (
      user.role === 'user' ||
      user.role === 'admin' ||
      user.role === 'moderator'
    ) {
      can(Action.read, 'all');
      cannot(Action.read, 'Poll', { status: 'pending' });
      can(Action.read, 'Poll', { status: 'pending', createdById: user.id });

      can(Action.create, 'Poll');
      can(Action.create, 'Room');
      can(Action.create, 'Hashtag');
      can(Action.create, 'Message');
      can(Action.create, 'FriendShip');

      can(Action.update, 'User', { id: user.id });
      can(Action.update, 'Poll', { createdById: user.id });
      can(Action.update, 'Room', { createdById: user.id });

      can(Action.delete, 'Poll', { createdById: user.id });
      cannot(Action.delete, 'Poll', { status: 'active' });
      can(Action.delete, 'Room', { createdById: user.id });
    }
    if (user.role === 'moderator' || user.role === 'admin') {
      can(Action.delete, 'Poll');
      can(Action.delete, 'Room');
      can(Action.delete, 'Hashtag');
      can(Action.delete, 'Message');

      can(Action.update, 'Ban', ['banReason', 'userId']);
    }
    if (user.role === 'admin') {
      can(Action.manage, 'all');
    }
    return build();
  }
}
