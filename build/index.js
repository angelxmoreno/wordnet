var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __moduleCache = /* @__PURE__ */ new WeakMap;
var __toCommonJS = (from) => {
  var entry = __moduleCache.get(from), desc;
  if (entry)
    return entry;
  entry = __defProp({}, "__esModule", { value: true });
  if (from && typeof from === "object" || typeof from === "function")
    __getOwnPropNames(from).map((key) => !__hasOwnProp.call(entry, key) && __defProp(entry, key, {
      get: () => from[key],
      enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
    }));
  __moduleCache.set(from, entry);
  return entry;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, {
      get: all[name],
      enumerable: true,
      configurable: true,
      set: (newValue) => all[name] = () => newValue
    });
};

// lib/index.ts
var exports_lib = {};
__export(exports_lib, {
  lookup: () => lookup,
  listIndexEntries: () => listIndexEntries,
  list: () => list,
  iterateSynsets: () => iterateSynsets,
  init: () => init
});
module.exports = __toCommonJS(exports_lib);

// lib/wordnet.ts
var import_node_path = __toESM(require("node:path"));
var __dirname = "/Users/amoreno/Projects/wordnet/lib";
var SPACE_CHAR = " ";
var KEY_PREFIX = "@__";
var EXTENSIONS_MAP = {
  adj: "a",
  adv: "r",
  noun: "n",
  verb: "v"
};
var SYNSET_TYPE_MAP = {
  n: "noun",
  v: "verb",
  a: "adjective",
  s: "adjective satellite",
  r: "adverb"
};
var DATA_PARTS = ["n", "v", "a", "r"];
var POS_TO_DATA_POS = {
  n: "n",
  v: "v",
  a: "a",
  r: "r",
  s: "a"
};
var _index = {};
var _data = {};
function getKey(word) {
  return `${KEY_PREFIX}${word}`;
}
async function init(databaseDir) {
  _index = {};
  _data = {};
  const extensions = Object.keys(EXTENSIONS_MAP);
  const dir = databaseDir || import_node_path.default.join(__dirname, "..", "db");
  for (const ext of extensions) {
    await readIndex(import_node_path.default.join(dir, `index.${ext}`));
  }
  await Promise.all(extensions.map(async (ext) => {
    const extKey = EXTENSIONS_MAP[ext];
    if (extKey) {
      _data[extKey] = import_node_path.default.join(dir, `data.${ext}`);
    }
  }));
}
function list() {
  return Object.keys(_index).map((key) => key.substring(KEY_PREFIX.length).replace(/_/g, SPACE_CHAR));
}
function listIndexEntries() {
  if (Object.keys(_index).length === 0) {
    throw new Error("WordNet database is not initialized. Call init() before accessing the index.");
  }
  return Object.keys(_index).flatMap((key) => {
    const entries = _index[key];
    return entries ? entries.slice() : [];
  });
}
async function* iterateSynsets(pos, options) {
  if (Object.keys(_data).length === 0) {
    throw new Error("WordNet data is not initialized. Call init() before iterating synsets.");
  }
  const skipPointers = options?.skipPointers ?? false;
  const dataTargets = pos ? [resolveDataPos(pos)] : DATA_PARTS;
  for (const target of dataTargets) {
    const filePath = _data[target];
    if (!filePath) {
      continue;
    }
    for await (const synset of streamSynsetsFromFile(filePath, skipPointers)) {
      if (pos && synset.meta.pos !== pos) {
        continue;
      }
      yield synset;
    }
  }
}
async function lookup(word, skipPointers = false) {
  const normalizedWord = word.normalize("NFKC").replace(/[\s\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]+/g, "_");
  const key = getKey(normalizedWord);
  const definitions = _index[key];
  if (!definitions) {
    return Promise.reject(new Error(`No definition(s) found for "${word}".`));
  }
  const promises = definitions.flatMap((definition) => {
    if (!definition.synsetOffsets) {
      return [];
    }
    return definition.synsetOffsets.map((synsetOffset) => readData({ pos: definition.pos, synsetOffset }, skipPointers));
  });
  const results = await Promise.all(promises);
  return results.filter((r) => r !== undefined);
}
async function readData(definition, skipPointers) {
  const { pos, synsetOffset } = definition;
  if (!pos) {
    return Promise.resolve(undefined);
  }
  const resolvedPos = resolveDataPos(pos);
  const filePath = _data[resolvedPos];
  if (!filePath) {
    return Promise.reject(new Error(`No file path found for POS: ${pos}`));
  }
  const maxReadLength = 15000;
  const file = Bun.file(filePath);
  const slicedFile = file.slice(synsetOffset, synsetOffset + maxReadLength);
  const content = await slicedFile.text();
  const line = content.split(`
`).shift();
  if (!line) {
    return Promise.resolve(undefined);
  }
  return parseDataLine(line, skipPointers);
}
function resolveDataPos(pos) {
  return POS_TO_DATA_POS[pos];
}
async function* streamSynsetsFromFile(filePath, skipPointers) {
  for await (const rawLine of readLinesFromFile(filePath)) {
    const normalizedLine = rawLine.replace(/\r$/, "").trimStart();
    if (!/^[0-9]{8}\s/.test(normalizedLine)) {
      continue;
    }
    const parsed = await parseDataLine(normalizedLine, skipPointers);
    yield parsed;
  }
}
async function* readLinesFromFile(filePath) {
  const reader = Bun.file(filePath).stream().getReader();
  const decoder = new TextDecoder;
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }
      let newlineIndex = buffer.indexOf(`
`);
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        yield line;
        newlineIndex = buffer.indexOf(`
`);
      }
    }
    if (buffer.length > 0) {
      yield buffer;
    }
  } finally {
    reader.releaseLock();
  }
}
async function readIndex(filePath) {
  const fileContent = await Bun.file(filePath).text();
  const lines = fileContent.split(`
`);
  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }
    const result = parseIndexLine(line);
    if (!result.isComment) {
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
function parseIndexLine(line) {
  if (line.charAt(0) === SPACE_CHAR) {
    return { isComment: true };
  }
  const [lemma, pos, synsetCountStr, ...parts] = line.trim().split(SPACE_CHAR);
  if (!lemma || !pos || !synsetCountStr) {
    throw new Error(`Invalid index line format: missing lemma, pos, or synsetCount in line "${line}"`);
  }
  const parsedPos = pos;
  const pointerCountStr = parts.shift();
  if (pointerCountStr === undefined) {
    throw new Error(`Invalid index line format: missing pointer count in line "${line}"`);
  }
  const pointerCount = parseInt(pointerCountStr, 10);
  const pointers = [];
  for (let index = 0;index < pointerCount; index++) {
    const ptr = parts.shift();
    if (ptr === undefined) {
      throw new Error(`Invalid index line format: missing pointer at index ${index} in line "${line}"`);
    }
    pointers.push(ptr);
  }
  const [senseCountStr, tagSenseCountStr, ...offsetStrs] = parts;
  if (!senseCountStr || !tagSenseCountStr) {
    throw new Error(`Invalid index line format: missing senseCount or tagSenseCount in line "${line}"`);
  }
  const synsetOffsets = offsetStrs.map((offset) => parseInt(offset, 10));
  return {
    lemma,
    pos: parsedPos,
    synsetCount: parseInt(synsetCountStr, 10),
    pointerCount,
    pointers,
    senseCount: parseInt(senseCountStr, 10),
    tagSenseCount: parseInt(tagSenseCountStr, 10),
    synsetOffsets
  };
}
async function parseDataLine(line, skipPointers) {
  const glossIndex = line.indexOf("|");
  let metadata;
  let glossary;
  if (glossIndex >= 0) {
    metadata = line.slice(0, glossIndex).trim().split(" ");
    glossary = line.slice(glossIndex + 1).trim();
  } else {
    metadata = line.trim().split(" ");
    glossary = "";
  }
  const [synsetOffsetStr, lexFilenumStr, synsetType, ...parts] = metadata;
  if (!synsetOffsetStr || !lexFilenumStr || !synsetType) {
    throw new Error(`Invalid data line format: missing synsetOffset, lexFilenum, or synsetType in line "${line}"`);
  }
  const wordCountStr = parts.shift();
  if (wordCountStr === undefined) {
    throw new Error(`Invalid data line format: missing word count in line "${line}"`);
  }
  const wordCount = parseInt(wordCountStr, 16);
  const words = [];
  for (let wordIdx = 0;wordIdx < wordCount; wordIdx++) {
    const w = parts.shift();
    const lId = parts.shift();
    if (w === undefined || lId === undefined) {
      throw new Error(`Invalid data line format: missing word or lexId at index ${wordIdx} in line "${line}"`);
    }
    words.push({
      word: w,
      lexId: parseInt(lId, 16)
    });
  }
  const pointerCountStr = parts.shift();
  if (pointerCountStr === undefined) {
    throw new Error(`Invalid data line format: missing pointer count in line "${line}"`);
  }
  const pointerCount = parseInt(pointerCountStr, 10);
  const pointers = [];
  for (let pointerIdx = 0;pointerIdx < pointerCount; pointerIdx++) {
    const pointerSymbol = parts.shift();
    const synsetOffsetStr2 = parts.shift();
    const pos2 = parts.shift();
    const sourceTargetHex = parts.shift();
    if (pointerSymbol === undefined || synsetOffsetStr2 === undefined || pos2 === undefined || sourceTargetHex === undefined) {
      throw new Error(`Invalid data line format: missing pointer details at index ${pointerIdx} in line "${line}"`);
    }
    const pointerPos = pos2;
    pointers.push({
      pointerSymbol,
      synsetOffset: parseInt(synsetOffsetStr2, 10),
      pos: pointerPos,
      sourceTargetHex
    });
  }
  if (!skipPointers) {
    const pointersData = await Promise.all(pointers.map((pointer) => {
      return readData(pointer, true);
    }));
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
  const pos = synsetType;
  return {
    glossary,
    meta: {
      pos,
      synsetOffset: parseInt(synsetOffsetStr, 10),
      lexFilenum: parseInt(lexFilenumStr, 10),
      synsetType: synsetTypeMapped,
      wordCount,
      words,
      pointerCount,
      pointers
    }
  };
}
