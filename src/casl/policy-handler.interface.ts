import { AppAbility } from './casl-prisma';

/** A policy written as a class: anything exposing a handle() taking the ability. */
interface IPolicyHandler {
  handle(ability: AppAbility): boolean;
}

/** The same policy written inline, e.g. (ability) => ability.can('read', 'Poll'). */
type PolicyHandlerCallback = (ability: AppAbility) => boolean;

export type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;
