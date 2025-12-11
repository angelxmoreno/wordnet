import { expect, test } from 'bun:test';
import * as wordnet from '../lib/wordnet';
import fixture from './fixture.json';

interface FixtureDefinition {
    glossary: string;
    meta: wordnet.ParsedDataLine['meta'];
}

test('api', async () => {
    const WORD = 'test';
    const expected: FixtureDefinition[] = fixture[WORD];

    // TODO: Add tests for expected failure cases:
    // - Calling API functions before init.
    // - Searching for a word not in the database.

    // TODO: Add test for initializing with a custom path.
    await wordnet.init();

    const list = await wordnet.list();
    // The expected size of the WordNet database is static.
    expect(list.length).toBe(147306); // "Check database size."

    const definitions = await wordnet.lookup(WORD);

    expect(definitions.length).toBe(expected.length); // "Check number of definitions."

    definitions.forEach((definition, index) => {
        expect(definition.glossary).toBe(expected[index].glossary); // "Check definitions match."
        expect(definition.meta).toEqual(expected[index].meta); // "Check meta matches."
    });
});

test('initializes and operates with a custom database path', async () => {
    const customDbPath = './test/fixtures/wordnet-custom.db';
    await wordnet.init(customDbPath);

    const list = await wordnet.list();
    // The expected size of the WordNet database is static.
    expect(list.length).toBe(147306); // "Check database size for custom path."

    const WORD = 'test';
    const expected: FixtureDefinition[] = fixture[WORD];
    const definitions = await wordnet.lookup(WORD);

    expect(definitions.length).toBe(expected.length); // "Check number of definitions for custom path."

    definitions.forEach((definition, index) => {
        expect(definition.glossary).toBe(expected[index].glossary); // "Check definitions match for custom path."
        expect(definition.meta).toEqual(expected[index].meta); // "Check meta matches for custom path."
    });
});
