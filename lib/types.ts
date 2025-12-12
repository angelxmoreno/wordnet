// lib/types.ts

export interface ParsedIndexLine {
    lemma: string;
    pos: string;
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

export interface WordNetIndex {
    [key: string]: ParsedIndexLine[];
}

export interface WordNetData {
    [pos: string]: string;
}

export interface Definition {
    pos: string;
    synsetOffset: number;
}
