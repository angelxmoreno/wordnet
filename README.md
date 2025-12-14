# WordNet.js (Modernized Fork)

This project is a modernized fork of the original [words/wordnet](https://github.com/words/wordnet) Node.js module. The goal of this fork is to bring the library up to modern JavaScript/TypeScript standards, improve maintainability, and leverage contemporary tooling.

## Key Differences from Original

*   **Runtime Environment**: Migrated from Node.js to **Bun**, utilizing its performance benefits and integrated tooling.
*   **Language**: Rewritten entirely in **TypeScript** for enhanced type safety, better maintainability, and improved developer experience.
*   **Modern Tooling**:
  *   **Bun**: Used as the primary package manager, test runner (`bun:test`), and runtime.
  *   **BiomeJS**: Integrated for comprehensive linting and formatting.
  *   **Lefthook**: Configured for Git hooks (e.g., pre-commit checks).
  *   **Conventional Commits**: Adopted for standardized commit messages.
*   **Improved Logic**: Addressed a critical bug where only the first sense of a word was returned; the modernized version now correctly retrieves all available senses.
*   **API Enhancements**: The API has been updated to reflect TypeScript types and modern asynchronous patterns.

# Installation

Install straight from GitHub (the `prepare` script builds the package during install, so no registry is required):

```bash
bun add github:angelxmoreno/wordnet#dev
```

# Usage

```typescript
import * as wordnet from 'wordnet';

// (Required) Load the WordNet database. This is an async operation.
await wordnet.init();

// List all available words (synchronous after init).
const allWords = wordnet.list();
console.log(`Total words: ${allWords.length}`);

// Look up a word (returns a Promise).
try {
  const definitions: ParsedDataLine[] = await wordnet.lookup('test');
  console.log(`\nDefinitions for "test":`);
  definitions.forEach((def) => {
    console.log(`  type: ${def.meta.synsetType}`);
    console.log(`  glossary: ${def.glossary}\n`);
  });
} catch (e) {
  console.error(e);
}
```

Check out the [examples folder](examples) for more.

# API

## `wordnet.init([databaseDir])`

Loads the WordNet database. This is an `async` function.
Takes an optional folder path (as a `String`) to the WordNet index and data files. If not provided, it defaults to the `db/` directory included with this package.
Resets the internal state (`_index`, `_data`) on each call, preventing state pollution.
Returns a `Promise<void>`. Rejects with an error if the `databaseDir` is invalid or files are missing.

## `wordnet.lookup(word, [skipPointers])`

Looks up a word in the loaded database. This is an `async` function.
Returns a `Promise<ParsedDataLine[]>`, resolving with definitions (metadata and glossary) for the given word.
The definitions include pointers to related words, which can be omitted by passing `skipPointers = true`.
Now correctly retrieves all senses of a word from the WordNet database.
Rejects with an error if no definitions are found for the word.

## `wordnet.list()`

Lists all available words in the WordNet database. This is a `synchronous` function and should only be called after `wordnet.init()` has completed.
Returns `string[]` (an array of all words).
If called before `wordnet.init()` finishes, or if `init` was called with an empty database, it will return an empty array (or throw an error if `init` failed).

## `wordnet.iterateSynsets([pos[, options]])`

Streams every synset directly from the WordNet data files. When `pos` (`'n' | 'v' | 'a' | 'r' | 's'`) is omitted, all parts of speech are emitted. Pass `{ skipPointers: true }` to avoid recursively loading pointer synsets, which speeds up bulk exports.

```typescript
await wordnet.init();

for await (const synset of wordnet.iterateSynsets('n', { skipPointers: true })) {
  console.log(synset.meta.pos, synset.meta.synsetOffset, synset.glossary);
  // break early if you only need a handful
}
```

Each yielded object matches the `ParsedDataLine` shape returned by `lookup`, with an additional `meta.pos` flag so you know which POS the synset belongs to.

## `wordnet.listIndexEntries()`

Returns all parsed index entries (`ParsedIndexLine[]`) currently loaded in memory. Use this to inspect lemmas or iterate over bolts without triggering `lookup`.

# License

MIT License


# 3rd-party License

[Princeton University's WordNet License](http://wordnet.princeton.edu/wordnet/license/)
