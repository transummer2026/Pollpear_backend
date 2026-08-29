import { Test, TestingModule } from '@nestjs/testing';
import { ApiPollVoteController } from './vote.controller';
import { ApiPollVoteService } from './vote.service';
import type { User } from 'src/generated/prisma/client';
import type { ApiVoteCastDTO } from '../../common/schemas/api-votes.schema';

const voter = { id: 7, role: 'user' } as unknown as User;
const ballot: ApiVoteCastDTO = { type: 'single_choice', optionIds: [1] };

describe('ApiPollVoteController', () => {
  let controller: ApiPollVoteController;
  const findMyVote = jest.fn();
  const castVote = jest.fn();
  const changeVote = jest.fn();
  const withdrawVote = jest.fn();

  beforeEach(async () => {
    [findMyVote, castVote, changeVote, withdrawVote].forEach((fn) =>
      fn.mockReset(),
    );
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiPollVoteController],
      providers: [
        {
          provide: ApiPollVoteService,
          useValue: { findMyVote, castVote, changeVote, withdrawVote },
        },
      ],
    }).compile();

    controller = module.get(ApiPollVoteController);
  });

  it('reads with the poll id and the caller', () => {
    void controller.findMyVote(42, voter);

    expect(findMyVote).toHaveBeenCalledWith(42, voter);
  });

  it('casts with the ballot between the id and the caller', () => {
    void controller.castVote(42, ballot, voter);

    expect(castVote).toHaveBeenCalledWith(42, ballot, voter);
  });

  it('changes with the same three arguments', () => {
    void controller.changeVote(42, ballot, voter);

    expect(changeVote).toHaveBeenCalledWith(42, ballot, voter);
  });

  it('withdraws with the poll id and the caller', () => {
    void controller.withdrawVote(42, voter);

    expect(withdrawVote).toHaveBeenCalledWith(42, voter);
  });
});
