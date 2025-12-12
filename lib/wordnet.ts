import path from 'node:path';

const SPACE_CHAR = ' ';
const KEY_PREFIX = '@__';
const EXTENSIONS_MAP: Record<string, string> = {
    adj: 'a',
    adv: 'r',
    noun: 'n',
    verb: 'v',
};

const SYNSET_TYPE_MAP: Record<string, string> = {
    n: 'noun',
    v: 'verb',
    a: 'adjective',
    s: 'adjective satellite',
    r: 'adverb',
};

import type { Definition, ParsedDataLine, ParsedIndexLine, Pointer, Word, WordNetData, WordNetIndex } from './types';

// These hold the data in memory.
let _index: WordNetIndex = {};
let _data: WordNetData = {};

// Utilities.
function getKey(word: string): string {
    return `${KEY_PREFIX}${word}`;
}

/**
 * Parses the database files and loads them into memory.
 *
 * @return {Promise} Empty promise object.
 */
export async function init(databaseDir?: string): Promise<void> {
    // Reset state
    _index = {};
    _data = {};

    const extensions = Object.keys(EXTENSIONS_MAP);

    const dir = databaseDir || path.join(__dirname, '..', 'db');

    // Read data from all index files into memory.
    // NOTE: We have to run this serially in order to ensure consistent results.
    for (const ext of extensions) {
        await readIndex(path.join(dir, `index.${ext}`));
    }

    // Store the paths to the data files.
    await Promise.all(
        extensions.map(async (ext) => {
            const extKey = EXTENSIONS_MAP[ext];
            if (extKey) {
                _data[extKey] = path.join(dir, `data.${ext}`);
            }
        })
    );
}

/**
 * Lists all the words.
 *
 * @return {Array} List of all words.
 */
export function list(): string[] {
    return Object.keys(_index).map((key) => key.substring(KEY_PREFIX.length).replace(/_/g, SPACE_CHAR));
}

/**
 * Looks up a word.
 *
 * @param {String} word Word to search.
 * @param {Boolean} skipPointers Whether to skip inclusion of pointer data.
 * @return {Promise} Resolves with definitions for the given word.
 */
export async function lookup(word: string, skipPointers: boolean = false): Promise<ParsedDataLine[]> {
    // Normalize all Unicode whitespace to underscores and apply Unicode normalization
    const normalizedWord = word
        .normalize('NFKC')
        .replace(/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g, '_');
    const key = getKey(normalizedWord);
    const definitions = _index[key];

    if (!definitions) {
        return Promise.reject(new Error(`No definition(s) found for "${word}".`));
    }

    const promises = definitions.flatMap((definition: ParsedIndexLine) => {
        if (!definition.synsetOffsets) {
            return [];
        }
        return definition.synsetOffsets.map((synsetOffset) =>
            readData({ pos: definition.pos, synsetOffset }, skipPointers)
        );
    });

    const results = await Promise.all(promises);
    return results.filter((r: ParsedDataLine | undefined): r is ParsedDataLine => r !== undefined);
}

/**
 * Reads the data for specified synctactic category.
 *
 * @param {Object} definition Index definition of the word.
 * @param {Boolean} skipPointers Whether to skip inclusion of pointer data.
 */
async function readData(definition: Definition, skipPointers: boolean): Promise<ParsedDataLine | undefined> {
    const { pos, synsetOffset } = definition;

    if (!pos) {
        return Promise.resolve(undefined);
    }

    // Get the file path from _data
    const filePath = _data[pos];
    if (!filePath) {
        return Promise.reject(new Error(`No file path found for POS: ${pos}`));
    }

    // The goal is to read one line. The longest line in the WordNet data files is
    // around 13000 bytes. We'll read a chunk of 15000 bytes to be safe.
    const maxReadLength = 15000;
    const file = Bun.file(filePath);
    const slicedFile = file.slice(synsetOffset, synsetOffset + maxReadLength);
    const content = await slicedFile.text();
    const line = content.split('\n').shift();

    if (!line) {
        return Promise.resolve(undefined);
    }

    return parseDataLine(line, skipPointers);
}

async function readIndex(filePath: string): Promise<void> {
    const fileContent = await Bun.file(filePath).text();
    const lines = fileContent.split('\n');

    for (const line of lines) {
        if (line.trim() === '') {
            // Skip empty lines
            continue;
        }
        const result = parseIndexLine(line);

        if (!result.isComment) {
            // Prefix not to break any built-in properties.
            const key = getKey(result.lemma);
            if (!_index[key]) {
                _index[key] = [];
            }
            const indexEntry = _index[key];
            if (indexEntry) {
                indexEntry.push(result);
            }
        }
    }
}

/**
 * Parses an index line.
 *
 * @param {String} line Index line to parse.
 * @return {Object} Attributes of the parsed line.
 */
function parseIndexLine(line: string): ParsedIndexLine {
    // Documentation for index lines at https://wordnet.princeton.edu/documentation/wndb5wn
    // lemma  pos  synset_cnt  p_cnt  [ptr_symbol...]  sense_cnt  tagsense_cnt   synset_offset  [synset_offset...]

    // Ignore comments.
    if (line.charAt(0) === SPACE_CHAR) {
        return { isComment: true } as ParsedIndexLine; // Cast to ParsedIndexLine as it will be used as such
    }

    const [lemma, pos, synsetCountStr, ...parts] = line.trim().split(SPACE_CHAR);
    if (!lemma || !pos || !synsetCountStr) {
        throw new Error(`Invalid index line format: missing lemma, pos, or synsetCount in line "${line}"`);
    }
    const pointerCountStr = parts.shift();
    if (pointerCountStr === undefined) {
        throw new Error(`Invalid index line format: missing pointer count in line "${line}"`);
    }
    const pointerCount = parseInt(pointerCountStr, 10);

    // Iterate through the pointers.
    const pointers: string[] = [];
    for (let index = 0; index < pointerCount; index++) {
        const ptr = parts.shift();
        if (ptr === undefined) {
            throw new Error(`Invalid index line format: missing pointer at index ${index} in line "${line}"`);
        }
        pointers.push(ptr);
    }

    // Extract remaining values.
    const [senseCountStr, tagSenseCountStr, ...offsetStrs] = parts;
    if (!senseCountStr || !tagSenseCountStr) {
        throw new Error(`Invalid index line format: missing senseCount or tagSenseCount in line "${line}"`);
    }
    const synsetOffsets = offsetStrs.map((offset) => parseInt(offset, 10));

    return {
        lemma,
        pos,
        synsetCount: parseInt(synsetCountStr, 10),
        pointerCount,
        pointers,
        senseCount: parseInt(senseCountStr, 10),
        tagSenseCount: parseInt(tagSenseCountStr, 10),
        synsetOffsets,
    };
}

/**
 * Parses a data file line.
 *
 * @param {String} line Data line to parse.
 * @param {Boolean} skipPointers Whether to skip inclusion of pointer data.
 * @return {Object} Attributes of the parsed line.
 */
async function parseDataLine(line: string, skipPointers: boolean): Promise<ParsedDataLine> {
    // Documentation for data lines at https://wordnet.princeton.edu/documentation/wndb5wn
    // synset_offset  lex_filenum  ss_type  w_cnt  word  lex_id  [word  lex_id...]  p_cnt  [ptr...]  [frames...]  |   gloss

    // Separate metadata from glossary.
    const glossIndex = line.indexOf('|');
    let metadata: string[];
    let glossary: string;

    if (glossIndex >= 0) {
        metadata = line.slice(0, glossIndex).trim().split(' ');
        glossary = line.slice(glossIndex + 1).trim();
    } else {
        // If no glossary, the whole line is metadata
        metadata = line.trim().split(' ');
        glossary = '';
    }

    // Extract the metadata.
    const [synsetOffsetStr, lexFilenumStr, synsetType, ...parts] = metadata;
    if (!synsetOffsetStr || !lexFilenumStr || !synsetType) {
        throw new Error(`Invalid data line format: missing synsetOffset, lexFilenum, or synsetType in line "${line}"`);
    }

    // Extract the words.
    const wordCountStr = parts.shift();
    if (wordCountStr === undefined) {
        throw new Error(`Invalid data line format: missing word count in line "${line}"`);
    }
    const wordCount = parseInt(wordCountStr, 16);
    const words: Word[] = [];
    for (let wordIdx = 0; wordIdx < wordCount; wordIdx++) {
        const w = parts.shift();
        const lId = parts.shift();
        if (w === undefined || lId === undefined) {
            throw new Error(`Invalid data line format: missing word or lexId at index ${wordIdx} in line "${line}"`);
        }
        words.push({
            word: w,
            lexId: parseInt(lId, 16),
        });
    }

    // Extract the pointers.
    const pointerCountStr = parts.shift();
    if (pointerCountStr === undefined) {
        throw new Error(`Invalid data line format: missing pointer count in line "${line}"`);
    }
    const pointerCount = parseInt(pointerCountStr, 10);
    const pointers: Pointer[] = [];
    for (let pointerIdx = 0; pointerIdx < pointerCount; pointerIdx++) {
        const pointerSymbol = parts.shift();
        const synsetOffsetStr = parts.shift();
        const pos = parts.shift();
        const sourceTargetHex = parts.shift();

        if (
            pointerSymbol === undefined ||
            synsetOffsetStr === undefined ||
            pos === undefined ||
            sourceTargetHex === undefined
        ) {
            throw new Error(
                `Invalid data line format: missing pointer details at index ${pointerIdx} in line "${line}"`
            );
        }

        pointers.push({
            pointerSymbol,
            synsetOffset: parseInt(synsetOffsetStr, 10),
            pos,
            sourceTargetHex,
        });
    }

    if (!skipPointers) {
        // Get the data for each pointer.
        const pointersData = await Promise.all(
            pointers.map((pointer) => {
                // Don't recurse further than one degree.
                return readData(pointer, true);
            })
        );
        // NOTE: this mutates the pointer objects.
        pointersData.forEach((data, index) => {
            if (data) {
                const pointer = pointers[index];
                if (pointer) {
                    pointer.data = data;
                }
            }
        });
    }

    const synsetTypeMapped = SYNSET_TYPE_MAP[synsetType];
    if (!synsetTypeMapped) {
        throw new Error(`Invalid synset type: ${synsetType}`);
    }

    return {
        glossary,
        meta: {
            synsetOffset: parseInt(synsetOffsetStr, 10),
            lexFilenum: parseInt(lexFilenumStr, 10),
            synsetType: synsetTypeMapped,
            wordCount,
            words,
            pointerCount,
            pointers,
        },
    };
}
