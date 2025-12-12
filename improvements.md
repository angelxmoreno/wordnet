# Improvements Roadmap

## 1. Make Data-Line Reads Streaming and Resilient

`readData` currently reads a 15 KB slice from the data file and assumes the line ends inside that slice (
`lib/wordnet.ts:122-134`). WordNet releases occasionally add longer glossaries, so a hard limit risks truncating a
record and producing silent parse errors. Switching to a streaming read that advances until the newline (or buffering
additional chunks until a newline appears) would eliminate that upper-bound assumption. It also simplifies future
support for custom corpora with different formatting.

## 2. Cache Parsed Synsets Across Lookups

Each call to `lookup` iterates over all synset offsets and re-reads every matching line from disk (
`lib/wordnet.ts:78-135`). Popular words are often looked up multiple times inside one process (e.g., API servers), so
the repeated file slicing + parsing adds avoidable I/O. Keeping an in-memory `Map` keyed by `${pos}:${synsetOffset}`
that stores the parsed `ParsedDataLine` (respecting the `skipPointers` flag) would cut repeated disk reads and make
chained lookups far faster without changing the public API.

## 3. Strengthen Test Coverage and Fixtures

`test/wordnet.test.ts` validates the happy path and a single error case, but it does not exercise `skipPointers`, repeat
`init` calls, Unicode normalization, or failure modes like missing POS data (`test/wordnet.test.ts:1-78`). Adding
focused tests plus lightweight fixtures (e.g., a tiny two-word database) would make regression detection easier and
unlock confident refactors of the parsing code. The modernization plan already called out "Expand test coverage" (
`modern-review.md:34-38`); implementing that TODO remains valuable.

## 4. Publish Modern Entry Points

`package.json` only exposes CommonJS via `main`/`types` (`package.json:1-34`). Downstream Bun, Node ESM, and bundler
users would benefit from an explicit `exports` map that surfaces both CJS (`require`) and an ESM build, plus subpath
exports like `./db`. Generating an additional ESM bundle via `bun build ... --format esm` during `bun run build` and
declaring it in `exports` would make the package tree-shakeable and future-proof while keeping existing consumers
working.
