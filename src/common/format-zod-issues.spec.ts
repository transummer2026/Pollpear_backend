import { z, ZodError, ZodType } from 'zod';
import { formatZodIssues } from './format-zod-issues';

function zodErrorFrom(schema: ZodType, value: unknown): ZodError {
  const result = schema.safeParse(value);
  if (result.success) throw new Error('expected the schema to reject');
  return result.error;
}

describe('formatZodIssues', () => {
  it('renders a single issue as "path: message"', () => {
    const schema = z.object({ name: z.string({ error: 'name is required' }) });

    const error = zodErrorFrom(schema, {});

    expect(formatZodIssues(error)).toBe('name: name is required');
  });

  it('joins the segments of a nested path with a dot', () => {
    const schema = z.object({
      profile: z.object({ email: z.string({ error: 'must be a string' }) }),
    });

    const error = zodErrorFrom(schema, { profile: { email: 1 } });

    expect(formatZodIssues(error)).toBe('profile.email: must be a string');
  });

  it('joins multiple issues with a comma', () => {
    const schema = z.object({
      name: z.string({ error: 'name is required' }),
      age: z.number({ error: 'age is required' }),
    });

    const error = zodErrorFrom(schema, {});

    expect(formatZodIssues(error)).toBe(
      'name: name is required, age: age is required',
    );
  });

  it('renders a root-level issue with an empty path as ": message"', () => {
    const schema = z.string({ error: 'expected a string' });

    const error = zodErrorFrom(schema, 42);

    expect(formatZodIssues(error)).toBe(': expected a string');
  });
});
