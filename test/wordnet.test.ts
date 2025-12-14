import { describe, expect, test } from 'bun:test';
import type { ParsedDataLine } from '../lib/types';
import * as wordnet from '../lib/wordnet';
import fixture from './fixture.json';

type FixtureMeta = Omit<ParsedDataLine['meta'], 'pos'>;

interface FixtureDefinition {
    glossary: string;
    meta: FixtureMeta;
}

const typedFixture = fixture as unknown as Record<string, FixtureDefinition[]>;

test('api', async () => {
    const WORD = 'test';
    const expected: FixtureDefinition[] = typedFixture[WORD];

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
        const { pos: _pos, ...metaWithoutPos } = definition.meta;

        expect(metaWithoutPos).toEqual(expected[index].meta); // "Check meta matches."
    });
});

test('initializes and operates with a custom database path', async () => {
    const customDbPath = './test/fixtures/wordnet-custom.db';
    await wordnet.init(customDbPath);

    const list = wordnet.list();
    // The expected size of the WordNet database is static.
    expect(list.length).toBe(147306); // "Check database size for custom path."

    const WORD = 'test';
    const expected: FixtureDefinition[] = typedFixture[WORD];
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
        const { pos: _pos, ...metaWithoutPos } = definition.meta;

        expect(metaWithoutPos).toEqual(expected[index].meta); // "Check meta matches for custom path."
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

describe('new iteration APIs', () => {
    test('iterateSynsets yields results for the requested part of speech', async () => {
        await wordnet.init();

        const nounIterator = wordnet.iterateSynsets('n');
        const firstNoun = await nounIterator.next();
        expect(firstNoun.done).toBe(false);
        const nounValue = firstNoun.value;
        expect(nounValue).toBeDefined();
        if (!nounValue) {
            throw new Error('Expected a noun synset');
        }
        expect(nounValue.meta.pos).toBe('n');

        let satelliteCount = 0;
        for await (const synset of wordnet.iterateSynsets('s')) {
            expect(synset.meta.pos).toBe('s');
            satelliteCount += 1;
            if (satelliteCount >= 3) {
                break;
            }
        }
        expect(satelliteCount).toBeGreaterThan(0);
    });

    test('iterateSynsets honors skipPointers', async () => {
        await wordnet.init();

        let inspected = 0;
        let checked = false;
        for await (const synset of wordnet.iterateSynsets('n', { skipPointers: true })) {
            inspected += 1;
            if (synset.meta.pointerCount > 0) {
                expect(synset.meta.pointers.every((pointer) => pointer.data === undefined)).toBe(true);
                checked = true;
                break;
            }

            if (inspected > 500) {
                break;
            }
        }
        expect(checked).toBe(true);
    });

    test('listIndexEntries exposes lemmas', async () => {
        await wordnet.init();
        const entries = wordnet.listIndexEntries();
        expect(entries.length).toBeGreaterThan(0);
        expect(entries.some((entry) => entry.lemma === 'test')).toBe(true);
    });
});
