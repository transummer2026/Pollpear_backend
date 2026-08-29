import { Test, TestingModule } from '@nestjs/testing';
import { ApiPollsController } from './polls.controller';
import { ApiPollsService } from './polls.service';
import type { User } from 'src/generated/prisma/client';

const caller = { id: 7, role: 'user' } as unknown as User;

describe('ApiPollsController', () => {
  let controller: ApiPollsController;
  const findAllPolls = jest.fn();
  const findOnePoll = jest.fn();
  const createPoll = jest.fn();
  const updatePoll = jest.fn();
  const removePoll = jest.fn();

  beforeEach(async () => {
    [findAllPolls, findOnePoll, createPoll, updatePoll, removePoll].forEach(
      (fn) => fn.mockReset(),
    );
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiPollsController],
      providers: [
        {
          provide: ApiPollsService,
          useValue: {
            findAllPolls,
            findOnePoll,
            createPoll,
            updatePoll,
            removePoll,
          },
        },
      ],
    }).compile();

    controller = module.get<ApiPollsController>(ApiPollsController);
  });

  it('forwards the paging query and the caller', () => {
    void controller.findAllPolls({ page: 1, limit: 20 }, caller);

    expect(findAllPolls).toHaveBeenCalledWith({ page: 1, limit: 20 }, caller);
  });

  it('never lets the body decide who the author is', () => {
    const body = {
      title: 'Best fruit',
      type: 'single_choice' as const,
      visibility: 'public' as const,
      allowChangeVote: true,
      isAnonymous: false,
      endsAt: new Date('2026-12-01'),
      options: [],
    };

    void controller.createPoll(body, caller);

    expect(createPoll).toHaveBeenCalledWith(body, caller);
    expect(Object.keys(body)).not.toContain('createdById');
  });

  it('forwards the id as a number', () => {
    void controller.findOnePoll(42, caller);
    void controller.removePoll(42, caller);

    expect(findOnePoll).toHaveBeenCalledWith(42, caller);
    expect(removePoll).toHaveBeenCalledWith(42, caller);
  });
});
