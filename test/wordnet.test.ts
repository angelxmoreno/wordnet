import { test, expect } from "bun:test";
import * as wordnet from '../lib/wordnet';
import fixture from './fixture.json';

interface FixtureDefinition {
  glossary: string;
  meta: any; // You might want to define a more specific type for meta
}

test('api', async () => {
  const WORD = 'test';
  const expected: FixtureDefinition[] = fixture[WORD];

  // TODO: Add tests for expected failure cases:
  // - Calling API functions before init.
  // - Searching for a word not in the database.

  // TODO: Add test for initializing with a custom path.
  await wordnet.init();

  let list = await wordnet.list();
  expect(list.length).toBe(147306); // "Check database size."

  let definitions = await wordnet.lookup(WORD);

  expect(definitions.length).toBe(expected.length); // "Check number of definitions."

  definitions.forEach((definition, index) => {
    expect(definition.glossary).toBe(expected[index].glossary); // "Check definitions match."
    expect(definition.meta).toEqual(expected[index].meta); // "Check meta matches."
  });
});
