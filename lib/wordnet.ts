import * as fs from 'fs/promises';

const SPACE_CHAR = ' ';
const KEY_PREFIX = '@__';
const EXTENSIONS_MAP: Record<string, string> = {
  'adj': 'a',
  'adv': 'r',
  'noun': 'n',
  'verb': 'v'
};

const SYNSET_TYPE_MAP: Record<string, string> = {
  'n': 'noun',
  'v': 'verb',
  'a': 'adjective',
  's': 'adjective satellite',
  'r': 'adverb'
};

interface WordNetIndex {
  [key: string]: ParsedIndexLine[];
}

interface WordNetData {
  [pos: string]: string; // Store file paths instead of FileHandle
}

interface Definition {
  pos: string;
  synsetOffset: number;
}

export interface ParsedIndexLine {
  lemma: string;
  pos: string;
  synsetCount: number;
  pointerCount: number;
  pointers: string[];
  senseCount: number;
  tagSenseCount: number;
  synsetOffset: number;
  isComment?: boolean;
}

export interface Word {
  word: string;
  lexId: number;
}

export interface Pointer {
  pointerSymbol: string;
  synsetOffset: number;
  pos: string;
  sourceTargetHex: string;
  data?: ParsedDataLine;
}

export interface ParsedDataLine {
  glossary: string;
  meta: {
    synsetOffset: number;
    lexFilenum: number;
    synsetType: string;
    wordCount: number;
    words: Word[];
    pointerCount: number;
    pointers: Pointer[];
  };
}

// These hold the data in memory.
let _index: WordNetIndex = {};
let _data: WordNetData = {};

// Utilities.
function toNumber(str: string, radix: number = 10): number { return parseInt(str, radix) }
function getKey(word: string): string { return `${KEY_PREFIX}${word}` }


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

  if (!databaseDir) {
    databaseDir = __dirname + '/../db';
  }

  // Read data from all index files into memory.
  // NOTE: We have to run this serially in order to ensure consistent results.
  for (const ext of extensions) {
    await readIndex(`${databaseDir}/index.${ext}`);
  }

  // Store the paths to the data files.
  await Promise.all(extensions.map(async (ext) => {
    _data[EXTENSIONS_MAP[ext]] = `${databaseDir}/data.${ext}`;
  }));
}

/**
 * Lists all the words.
 *
 * @return {Array} List of all words.
 */
export function list(): string[] {
  return Object.keys(_index).map(function(key) {
    return key.substring(KEY_PREFIX.length).replace(/_/g, SPACE_CHAR);
  });
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
  let key = getKey(normalizedWord);
  let definitions = _index[key];

  if (!definitions) {
    return Promise.reject(new Error(`No definition(s) found for "${word}".`))
  }

  let promises = definitions.map((definition) => {
    return readData(definition, skipPointers);
  });

  return Promise.all(promises) as Promise<ParsedDataLine[]>;
}


/**
 * Reads the data for specified synctactic category.
 *
 * @param {Object} definition Index definition of the word.
 * @param {Boolean} skipPointers Whether to skip inclusion of pointer data.
 */
async function readData(definition: Definition, skipPointers: boolean): Promise<ParsedDataLine | undefined> {
  let { pos, synsetOffset } = definition;

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
  const line = content.split('\n')[0];

  return parseDataLine(line, skipPointers);
}

async function readIndex(filePath: string): Promise<void> {
  const fileContent = await Bun.file(filePath).text();
  const lines = fileContent.split('\n');

  for (const line of lines) {
    if (line.trim() === '') { // Skip empty lines
      continue;
    }
    const result = parseIndexLine(line);

    if (!result.isComment) {
      // Prefix not to break any built-in properties.
      let key = getKey(result.lemma);
      if (!_index[key]) {
        _index[key] = [];
      }
      _index[key].push(result);
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

  let [ lemma, pos, synsetCountStr, ...parts ] = line.trim().split(SPACE_CHAR);
  let pointerCountStr = parts.shift();
  let pointerCount = toNumber(pointerCountStr!); // Use ! for non-null assertion

  // Iterate through the pointers.
  let pointers: string[] = [];
  for (let index = 0; index < pointerCount; index++) {
    pointers.push(parts.shift()!); // Use ! for non-null assertion
  }

  // Extract remaining values.
  let [ senseCountStr, tagSenseCountStr, synsetOffsetStr, ...additionalSynsetOffsets] = parts;

  return {
    lemma,
    pos,
    synsetCount: toNumber(synsetCountStr), // Corrected to use synsetCountStr
    pointerCount,
    pointers,
    senseCount: toNumber(senseCountStr),
    tagSenseCount: toNumber(tagSenseCountStr),
    synsetOffset: toNumber(synsetOffsetStr)
  }
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
  let metaAndGlossary = [line.slice(0, glossIndex), line.slice(glossIndex + 1)];
  let metadata = metaAndGlossary[0].split(' ');
  let glossary = metaAndGlossary[1] ? metaAndGlossary[1].trim() : '';

  // Extract the metadata.
  let [ synsetOffsetStr, lexFilenumStr, synsetType, ...parts ] = metadata;

  // Extract the words.
  let wordCount = toNumber(parts.shift()!, 16);
  let words: Word[] = [];
  for (let wordIdx = 0; wordIdx < wordCount; wordIdx++) {
    words.push({
      word: parts.shift()!,
      lexId: toNumber(parts.shift()!, 16)
    });
  }

  // Extract the pointers.
  let pointerCount = toNumber(parts.shift()!);
  let pointers: Pointer[] = [];
  for (let pointerIdx = 0; pointerIdx < pointerCount; pointerIdx++) {
    pointers.push({
      pointerSymbol: parts.shift()!,
      synsetOffset: parseInt(parts.shift()!, 10),
      pos: parts.shift()!,
      sourceTargetHex: parts.shift()!
    });
  }

  if (!skipPointers) {
    // Get the data for each pointer.
    let pointersData = await Promise.all(pointers.map((pointer) => {
      // Don't recurse further than one degree.
      return readData(pointer, true);
    }));
    // NOTE: this mutates the pointer objects.
    pointersData.forEach((data, index) => {
      if (data) {
        pointers[index].data = data;
      }
    });
  }

  return {
    glossary,
    meta: {
      synsetOffset: toNumber(synsetOffsetStr),
      lexFilenum: toNumber(lexFilenumStr),
      synsetType: SYNSET_TYPE_MAP[synsetType],
      wordCount,
      words,
      pointerCount,
      pointers
    }
  };
}
