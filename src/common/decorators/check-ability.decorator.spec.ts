import { AppAbility } from 'src/casl/casl-prisma';
import { CheckAbilities } from './check-ability.decorator';
import { CHECK_POLICIES_KEY } from './check-policies.decorator';

function handlersOf(target: object) {
  return Reflect.getMetadata(CHECK_POLICIES_KEY, target) as ((
    ability: AppAbility,
  ) => boolean)[];
}

describe('CheckAbilities', () => {
  @CheckAbilities(['ban', 'User'])
  class SingleAbilityHost {}

  @CheckAbilities(['ban', 'User'], ['update', 'User'])
  class ManyAbilitiesHost {}

  beforeEach(() => jest.clearAllMocks());

  it('stores one policy handler per ability tuple under CHECK_POLICIES_KEY', () => {
    expect(handlersOf(SingleAbilityHost)).toHaveLength(1);
    expect(handlersOf(ManyAbilitiesHost)).toHaveLength(2);
  });

  it('builds handlers that ask the ability for the exact action and subject', () => {
    const can = jest.fn().mockReturnValue(true);
    const ability = { can } as unknown as AppAbility;

    const [handler] = handlersOf(SingleAbilityHost);
    const verdict = handler(ability);

    expect(can).toHaveBeenCalledWith('ban', 'User');
    expect(verdict).toBe(true);
  });

  it('relays the ability verdict of each tuple separately', () => {
    const can = jest.fn((action: string) => action === 'ban');
    const ability = { can } as unknown as AppAbility;

    const [banHandler, updateHandler] = handlersOf(ManyAbilitiesHost);

    expect(banHandler(ability)).toBe(true);
    expect(updateHandler(ability)).toBe(false);
    expect(can).toHaveBeenNthCalledWith(1, 'ban', 'User');
    expect(can).toHaveBeenNthCalledWith(2, 'update', 'User');
  });
});
