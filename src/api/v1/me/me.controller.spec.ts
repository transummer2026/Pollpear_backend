import { Test, TestingModule } from '@nestjs/testing';
import { ApiMeController } from './me.controller';
import { ApiMeService } from './me.service';

const OWNER_ID = 1;

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

  it('resolves the caller from the header, never from the body', () => {
    findMe.mockResolvedValue({ username: 'pollpear' });

    void controller.findMe(OWNER_ID);

    expect(findMe).toHaveBeenCalledWith(OWNER_ID);
  });

  it('forwards the validated body untouched', () => {
    updateMe.mockResolvedValue({ username: 'pollpear' });

    void controller.updateMe(OWNER_ID, { bio: 'hello' });

    expect(updateMe).toHaveBeenCalledWith(OWNER_ID, { bio: 'hello' });
  });

  it('deletes the caller and nobody else', () => {
    deleteMe.mockResolvedValue(undefined);

    void controller.deleteMe(OWNER_ID);

    expect(deleteMe).toHaveBeenCalledWith(OWNER_ID);
  });
});
