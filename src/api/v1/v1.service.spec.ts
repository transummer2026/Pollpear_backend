import { ApiV1Module } from './v1.module';
import { apiV1 } from './common/api-v1';

/**
 * La decouverte est un contrat : ce qu'elle annonce doit repondre. Compare la
 * liste aux modules reellement enregistres, pour qu'une ressource retiree du
 * cablage ne continue pas d'etre proposee a un client qui n'y trouvera qu'un
 * 404 - et pour qu'une ressource ajoutee soit annoncee.
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
