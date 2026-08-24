import { canonicalPair } from './friendship.pair';

describe('canonicalPair', () => {
  it('keeps the smallest id in the first slot', () => {
    expect(canonicalPair(1, 2)).toEqual({ userAId: 1, userBId: 2 });
  });

  it('sorts the pair when the caller comes second', () => {
    expect(canonicalPair(2, 1)).toEqual({ userAId: 1, userBId: 2 });
  });
});
