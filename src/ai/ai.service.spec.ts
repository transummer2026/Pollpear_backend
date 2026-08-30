import { ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai.service';
import type { VaultService } from 'src/vault/vault.service';

const AI_URL = 'http://ai:3002';

function makeService() {
  return new AiService({ app: { ai_url: AI_URL } } as unknown as VaultService);
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('AiService', () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('calls the recommender with the user id and the requested limit', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ user_id: 7, feed: [] }));

    await makeService().getFeed(7, 25);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(`${AI_URL}/feed/7?limit=25`);
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('returns the feed entries in the order the recommender scored them', async () => {
    const feed = [
      { poll_id: 4, title: 'b', score: 0.9 },
      { poll_id: 2, title: 'a', score: 0.5 },
    ];
    fetchSpy.mockResolvedValue(jsonResponse({ user_id: 7, feed }));

    await expect(makeService().getFeed(7, 9)).resolves.toEqual(feed);
  });

  it('turns a non-2xx answer into a 503', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}, false, 500));

    await expect(makeService().getFeed(7, 9)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('turns a network error or timeout into a 503', async () => {
    fetchSpy.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));

    await expect(makeService().getFeed(7, 9)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('turns an unexpected payload shape into a 503', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ feed: [{ poll_id: 'nope' }] }));

    await expect(makeService().getFeed(7, 9)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('cuts the result to the requested limit when the recommender over-returns', async () => {
    const feed = Array.from({ length: 9 }, (_, i) => ({
      poll_id: i + 1,
      title: `p${i + 1}`,
      score: 1 - i / 10,
    }));
    fetchSpy.mockResolvedValue(jsonResponse({ user_id: 7, feed }));

    const result = await makeService().getFeed(7, 5);

    expect(result.map((entry) => entry.poll_id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('turns a grossly oversized response into a 503', async () => {
    const feed = Array.from({ length: 51 }, (_, i) => ({
      poll_id: i + 1,
      title: `p${i + 1}`,
      score: 0.5,
    }));
    fetchSpy.mockResolvedValue(jsonResponse({ user_id: 7, feed }));

    await expect(makeService().getFeed(7, 50)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
