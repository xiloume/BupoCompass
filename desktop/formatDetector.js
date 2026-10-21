const fs = require('fs');
const zlib = require('zlib');

// Magic byte signatures for various file formats
const MAGIC_BYTES = [
  { magic: [0x50, 0x4b, 0x03, 0x04], format: 'zip' },
  { magic: [0x1f, 0x8b], format: 'gzip' },
  { magic: [0x78, 0x9c], format: 'zlib' },
  { magic: [0x78, 0xda], format: 'zlib' },
  { magic: [0x78, 0x01], format: 'zlib' },
  { magic: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65], format: 'sqlite' },
  { magic: [0x42, 0x5a, 0x68], format: 'bzip2' },
  { magic: [0xfd, 0x37, 0x7a, 0x58, 0x5a], format: 'xz' },
  { magic: [0x7f, 0x45, 0x4c, 0x46], format: 'elf' },
  { magic: [0x4d, 0x5a], format: 'pe' },
  { magic: [0x89, 0x50, 0x4e, 0x47], format: 'png' },
  { magic: [0xff, 0xd8, 0xff], format: 'jpg' },
];

const TEXT_SIGNATURES = [
  { test: (s) => s.startsWith('<?xml'), format: 'xml' },
  { test: (s) => s.trimStart().startsWith('<') && s.includes('</'), format: 'xml' },
  { test: (s) => s.trimStart().startsWith('{') || s.trimStart().startsWith('['), format: 'json' },
  { test: (s) => /^---\s*$/m.test(s) || s.includes(': ') && /^\w+:\s*[\w-]/.test(s), format: 'yaml' },
  { test: (s) => /^\[[^\]]+\]/m.test(s) && /=\s*"/.test(s), format: 'toml' },
  { test: (s) => /^\[[^\]]+\]/m.test(s) && /^[^=]+=/m.test(s), format: 'ini' },
  { test: (s) => s.includes('\n') && s.split('\n')[0].split(',').length > 1, format: 'csv' },
];

// Detect format by reading first 512 bytes
function detectFormat(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(512);
    const bytesRead = fs.readSync(fd, buf, 0, 512, 0);
    fs.closeSync(fd);

    const slice = buf.slice(0, bytesRead);

    // Binary magic bytes
    for (const { magic, format } of MAGIC_BYTES) {
      if (slice.length >= magic.length) {
        let match = true;
        for (let i = 0; i < magic.length; i++) {
          if (slice[i] !== magic[i]) {
            match = false;
            break;
          }
        }
        if (match) return format;
      }
    }

    // NBT files often start with 0x0A (TAG_Compound) or 0x1F 0x8B (gzipped NBT)
    if (slice[0] === 0x0a) return 'nbt';

    // Try as text
    const isText = isLikelyText(slice);
    if (isText) {
      const text = slice.toString('utf8');
      for (const { test, format } of TEXT_SIGNATURES) {
        if (test(text)) return format;
      }
      return 'text';
    }

    return 'binary';
  } catch {
    return 'unknown';
  }
}

function isLikelyText(buf) {
  let textChars = 0;
  for (let i = 0; i < buf.length; i++) {
    const c = buf[i];
    if (c === 0) return false;
    if ((c >= 32 && c < 127) || c === 9 || c === 10 || c === 13) {
      textChars++;
    }
  }
  return textChars / buf.length > 0.85;
}

// Try to gunzip a buffer; returns the original on failure
function tryGunzip(buf) {
  try {
    return zlib.gunzipSync(buf);
  } catch {
    return buf;
  }
}

module.exports = { detectFormat, isLikelyText, tryGunzip };
