import { Test, TestingModule } from '@nestjs/testing';
import { ApiMeController } from './me.controller';
import { ApiMeService } from './me.service';
import { CaslAbilityFactory } from 'src/casl/casl-ability.factory';
import { CHECK_POLICIES_KEY } from 'src/common/decorators/check-policies.decorator';
import type { PolicyHandler } from 'src/casl/policy-handler.interface';
import { UserRole, type User } from 'src/generated/prisma/client';

const OWNER_ID = 1;
const viewer = { id: OWNER_ID, role: 'user', deletedAt: null } as User;

describe('ApiMeController', () => {
  let controller: ApiMeController;
  const findMe = jest.fn();
  const updateMe = jest.fn();
  const deleteMe = jest.fn();

  beforeEach(async () => {
    findMe.mockReset();
    updateMe.mockReset();
    deleteMe.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiMeController],
      providers: [
        { provide: ApiMeService, useValue: { findMe, updateMe, deleteMe } },
      ],
    }).compile();

    controller = module.get<ApiMeController>(ApiMeController);
  });

  it('resolves the caller from the request, never from the body', () => {
    findMe.mockResolvedValue({ username: 'pollpear' });

    void controller.findMe(viewer);

    expect(findMe).toHaveBeenCalledWith(viewer);
  });

  it('forwards the validated body untouched', () => {
    updateMe.mockResolvedValue({ username: 'pollpear' });

    void controller.updateMe(viewer, { bio: 'hello' });

    expect(updateMe).toHaveBeenCalledWith(viewer, { bio: 'hello' });
  });

  it('deletes the caller and nobody else', () => {
    deleteMe.mockResolvedValue(undefined);

    void controller.deleteMe(viewer);

    expect(deleteMe).toHaveBeenCalledWith(viewer);
  });
});

/**
 * The route decorators are a coarse gate: they ask the policy about the
 * subject type, with no instance to match conditions against. That is on
 * purpose - the real decision is taken in the service, on the loaded row.
 * What this pins is that the gate stays coarse: tightening the User policy
 * until a plain account fails one of these would close its own /me, and
 * the service checks would never even run.
 */
describe('ApiMeController policy gates', () => {
  const ability = new CaslAbilityFactory().createForUser({
    id: 1,
    role: UserRole.user,
  });

  const handlers = ApiMeController.prototype as unknown as Record<
    string,
    object
  >;

  function gatesOf(route: string): PolicyHandler[] {
    return (
      (Reflect.getMetadata(
        CHECK_POLICIES_KEY,
        handlers[route],
      ) as PolicyHandler[]) ?? []
    );
  }

  it.each(['findMe', 'updateMe', 'deleteMe'])(
    'guards %s without locking a plain account out',
    (route) => {
      const gates = gatesOf(route);

      expect(gates).not.toHaveLength(0);
      for (const gate of gates) {
        const allowed =
          typeof gate === 'function' ? gate(ability) : gate.handle(ability);
        expect(allowed).toBe(true);
      }
    },
  );
});
