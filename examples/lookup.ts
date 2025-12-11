import type { ParsedDataLine, Pointer, Word } from '../lib/types';
import * as wordnet from '../lib/wordnet';

// Simple argument parsing, replacing commander
const args = process.argv.slice(2);
let word: string | undefined;
let databaseDir: string | undefined;

for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-d' || args[i] === '--database') && i + 1 < args.length) {
        databaseDir = args[++i];
    } else if (!word) {
        word = args[i];
    }
}

if (!word) {
    console.log('Usage: bun run lookup <word> [-d <database-path>]');
    process.exit(1);
}

function printWord(def: ParsedDataLine, includePointers: boolean) {
    if (word) {
        const words = def.meta.words.map((w: Word) => w.word).join(' ');

        console.log(`  type: ${def.meta.synsetType}`);
        console.log(`  words: ${words.trim()}`);
        console.log(`  ${def.glossary}\n`);

        /* Print pointers */
        if (includePointers) {
            def.meta.pointers.forEach((pointer: Pointer) => {
                if (!pointer.data || !pointer.data.meta) {
                    return;
                }

                /* Print the word only if contains (or prefixes) the look up expression */
                let found = false;
                pointer.data.meta.words.forEach((aWord: Word) => {
                    if (aWord.word.indexOf(word) === 0) {
                        found = true;
                    }
                });

                if (found || ['*', '='].indexOf(pointer.pointerSymbol) > -1) {
                    printWord(pointer.data, false);
                }
            });
        }
    }
}

(async () => {
    try {
        await wordnet.init(databaseDir);
        const definitions = await wordnet.lookup(word);
        console.log(`\n  ${word}\n`);

        definitions.forEach((definition) => {
            printWord(definition, true);
        });
    } catch (e: unknown) {
        if (e instanceof Error) {
            console.error(e.stack || e);
        } else {
            console.error(e);
        }
    }
})();
