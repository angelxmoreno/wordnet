import * as wordnet from '../lib/wordnet';

// Simple argument parsing, replacing commander
const args = process.argv.slice(2);
let word: string | undefined;
let databaseDir: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-d' || args[i] === '--database') {
    databaseDir = args[++i];
  } else if (!word) {
    word = args[i];
  }
}

if (!word) {
  console.log('Usage: bun run lookup <word> [-d <database-path>]');
  process.exit(1);
}

function printWord(def: wordnet.ParsedDataLine, includePointers: boolean) {
  let words = def.meta.words.reduce((str, wordObj) => {
    return `${str} ${wordObj.word}`;
  }, '');

  console.log(`  type: ${def.meta.synsetType}`)
  console.log(`  words: ${words.trim()}`);
  console.log(`  ${def.glossary}\n`);

  /* Print pointers */
  if (includePointers) {
    def.meta.pointers.forEach(function(pointer) {
      if (!pointer.data || !pointer.data.meta) {
        return;
      }

      /* Print the word only if contains (or prefixes) the look up expression */
      let found = false;
      pointer.data.meta.words.forEach(function(aWord) {
        if (aWord.word.indexOf(word!) === 0) { // Use non-null assertion for 'word'
          found = true;
        }
      });

      if (found || ['*', '='].indexOf(pointer.pointerSymbol) > -1) {
        printWord(pointer.data, false);
      }
    });
  }
}

(async () => {
  await wordnet.init(databaseDir);

  try {
    const definitions = await wordnet.lookup(word);
    console.log(`\n  ${word}\n`);

    definitions.forEach((definition) => {
      printWord(definition, true);
    });
  } catch (e: any) {
    console.error(e.message);
  }
})();
