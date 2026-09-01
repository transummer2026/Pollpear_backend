import { ApiV1Module } from './v1.module';
import { apiV1 } from './common/api-v1';

/**
 * Discovery is a contract: whatever it announces has to answer. Compares the
 * list with the modules actually registered, so a resource dropped from the
 * wiring is not still offered to a client who would only find a 404 there —
 * and so an added resource gets announced.
 */
describe('apiV1.resources', () => {
  it('names exactly the modules v1 wires up', () => {
    const imported = (Reflect.getMetadata('imports', ApiV1Module) ?? []) as {
      name: string;
    }[];
    const wired = imported
      .map((module) => module.name.replace(/^Api|Module$/g, '').toLowerCase())
      .sort();

    expect([...apiV1.resources].sort()).toEqual(wired);
  });
});
