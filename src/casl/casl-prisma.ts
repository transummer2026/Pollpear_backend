import {
  accessibleBy,
  createPrismaAbility,
  ParsingQueryError,
  prismaQuery,
  type Model,
  type PrismaQueryOf,
  type Subjects,
  type WhereInputOf,
} from '@casl/prisma/runtime';
import type {
  Hashtag,
  Message,
  Poll,
  Prisma,
  Room,
  User,
  Friendship,
  Ban,
} from '../generated/prisma/client';
import { Ability } from '@casl/ability';

export { accessibleBy, createPrismaAbility, ParsingQueryError, prismaQuery };

export type PrismaQuery<
  T extends Model<Record<string, any>, string> = Model<
    Record<string, any>,
    string
  >,
> = PrismaQueryOf<Prisma.TypeMap, T>;
export type WhereInput<TModelName extends Prisma.ModelName> = WhereInputOf<
  Prisma.TypeMap,
  TModelName
>;
export type AppSubjects =
  | 'all'
  | Subjects<{
      User: User;
      Poll: Poll;
      Hashtag: Hashtag;
      Message: Message;
      Room: Room;
      FriendShip: Friendship;
      Ban: Ban;
    }>;

export type AppAbility = Ability<
  ['manage' | 'create' | 'read' | 'update' | 'delete', 'all' | AppSubjects],
  PrismaQuery
>;
