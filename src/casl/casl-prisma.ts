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
  Block,
  Ban,
  Option,
  Vote,
  Invitation,
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
      PollOption: Option;
      Vote: Vote;
      Hashtag: Hashtag;
      Message: Message;
      Room: Room;
      Friendship: Friendship;
      Block: Block;
      Ban: Ban;
      Invitation: Invitation;
    }>;

export type AppAbility = Ability<
  [
    (
      | 'create'
      | 'read'
      | 'update'
      | 'delete'
      | 'ban'
      | 'report'
      | 'join'
      | 'invite'
      | 'kick'
      | 'leave'
    ),
    'all' | AppSubjects,
  ],
  PrismaQuery
>;
