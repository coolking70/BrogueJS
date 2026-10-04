import definitions from '../data/definitions.json';

/** A deliberately small keeper-only package for schema, budget, session and
 * transaction unit tests. Keep installed-content and real-Game tests on the
 * complete production pack; adding a story must not change these test inputs. */
export function keeperOnlyContentFixture(): typeof definitions {
    const pack = structuredClone(definitions);
    const only = <T extends { id: string }>(rows: T[], id: string): T[] => {
        const row = rows.find(value => value.id === id);
        if (!row) throw new Error(`Missing keeper fixture definition: ${id}`);
        return [row];
    };
    pack.flags = only(pack.flags, 'archive.read');
    pack.counters = [];
    pack.npcs = only(pack.npcs, 'archive.keeper');
    pack.dialogues = only(pack.dialogues, 'archive.greeting');
    pack.journal = only(pack.journal, 'archive.note');
    pack.storyEvents = only(pack.storyEvents, 'archive.read-done');
    pack.triggers = only(pack.triggers, 'archive.reward');
    return pack;
}
