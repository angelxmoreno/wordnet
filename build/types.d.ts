export type PartOfSpeech = 'n' | 'v' | 'a' | 's' | 'r';
export type DataPartOfSpeech = 'n' | 'v' | 'a' | 'r';
export interface ParsedIndexLine {
    lemma: string;
    pos: PartOfSpeech;
    synsetCount: number;
    pointerCount: number;
    pointers: string[];
    senseCount: number;
    tagSenseCount: number;
    synsetOffsets: number[];
    isComment?: boolean;
}
export interface Word {
    word: string;
    lexId: number;
}
export interface Pointer {
    pointerSymbol: string;
    synsetOffset: number;
    pos: PartOfSpeech;
    sourceTargetHex: string;
    data?: ParsedDataLine;
}
export interface ParsedDataLine {
    glossary: string;
    meta: {
        pos: PartOfSpeech;
        synsetOffset: number;
        lexFilenum: number;
        synsetType: string;
        wordCount: number;
        words: Word[];
        pointerCount: number;
        pointers: Pointer[];
    };
}
export interface WordNetIndex {
    [key: string]: ParsedIndexLine[];
}
export interface WordNetData {
    [pos: string]: string;
}
export interface Definition {
    pos: PartOfSpeech;
    synsetOffset: number;
}
export interface IterateSynsetsOptions {
    skipPointers?: boolean;
}
