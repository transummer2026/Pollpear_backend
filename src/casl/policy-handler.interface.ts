import { AppAbility } from './casl-prisma';

//any object that satisfies the interface shape (one handle function that takes an abilit and sends baclk bool)
interface IPolicyHandler {
  handle(ability: AppAbility): boolean;
}

//this maps out to (ability: AppAbility) => ability.can(read, 'article')
type PolicyHandlerCallback = (ability: AppAbility) => boolean; //fallback function

export type PolicyHandler = IPolicyHandler | PolicyHandlerCallback;
