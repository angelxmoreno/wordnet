import { describe, expect, test } from 'bun:test';
import type { ParsedDataLine } from '../lib/types';
import * as wordnet from '../lib/wordnet';
import fixture from './fixture.json';

interface FixtureDefinition {
    glossary: string;
    meta: ParsedDataLine['meta'];
}

test('api', async () => {
    const WORD = 'test';
    const expected: FixtureDefinition[] = fixture[WORD];

    // - Calling API functions before init.
    // - Searching for a word not in the database.

    await wordnet.init();

    const list = wordnet.list();
    // The expected size of the WordNet database is static.
    expect(list.length).toBe(147306); // "Check database size."

    const definitions = await wordnet.lookup(WORD);

    expect(definitions.length).toBe(expected.length); // "Check number of definitions."

    // Add a more specific assertion to check for a known glossary
    const glossaries = definitions.map((d) => d.glossary);
    expect(glossaries).toContain('a hard outer covering as of some amoebas and sea urchins');

    definitions.forEach((definition, index) => {
        expect(definition.glossary).toBe(expected[index].glossary); // "Check definitions match."

        // Remove the 'data' property from pointers before comparison
        definition.meta.pointers.forEach((p) => {
            delete p.data;
        });

        expect(definition.meta).toEqual(expected[index].meta); // "Check meta matches."
    });
});

test('initializes and operates with a custom database path', async () => {
    const customDbPath = './test/fixtures/wordnet-custom.db';
    await wordnet.init(customDbPath);

    const list = wordnet.list();
    // The expected size of the WordNet database is static.
    expect(list.length).toBe(147306); // "Check database size for custom path."

    const WORD = 'test';
    const expected: FixtureDefinition[] = fixture[WORD];
    const definitions = await wordnet.lookup(WORD);

    expect(definitions.length).toBe(expected.length); // "Check number of definitions for custom path."

    // Add a more specific assertion to check for a known glossary
    const glossaries = definitions.map((d) => d.glossary);
    expect(glossaries).toContain('a hard outer covering as of some amoebas and sea urchins');

    definitions.forEach((definition, index) => {
        expect(definition.glossary).toBe(expected[index].glossary); // "Check definitions match for custom path."

        // Remove the 'data' property from pointers before comparison
        definition.meta.pointers.forEach((p) => {
            delete p.data;
        });

        expect(definition.meta).toEqual(expected[index].meta); // "Check meta matches for custom path."
    });
});

describe('error handling', () => {
    test('lookup for a word not in the database rejects with an error', async () => {
        await wordnet.init();
        await expect(wordnet.lookup('notaword')).rejects.toThrow('No definition(s) found for "notaword".');
    });

    test('init with an invalid path rejects with an error', async () => {
        await expect(wordnet.init('./test/fixtures/empty.db')).rejects.toThrow();
    });
});
