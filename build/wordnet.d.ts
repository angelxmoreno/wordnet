import type { IterateSynsetsOptions, ParsedDataLine, ParsedIndexLine, PartOfSpeech } from './types';
/**
 * Parses the database files and loads them into memory.
 *
 * @return {Promise} Empty promise object.
 */
export declare function init(databaseDir?: string): Promise<void>;
/**
 * Lists all the words.
 *
 * @return {Array} List of all words.
 */
export declare function list(): string[];
export declare function listIndexEntries(): ParsedIndexLine[];
export declare function iterateSynsets(pos?: PartOfSpeech, options?: IterateSynsetsOptions): AsyncGenerator<ParsedDataLine>;
/**
 * Looks up a word.
 *
 * @param {String} word Word to search.
 * @param {Boolean} skipPointers Whether to skip inclusion of pointer data.
 * @return {Promise} Resolves with definitions for the given word.
 */
export declare function lookup(word: string, skipPointers?: boolean): Promise<ParsedDataLine[]>;
