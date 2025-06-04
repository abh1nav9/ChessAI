/**
 * Converts a number to its binary representation as a string with a fixed number of bits.
 * Pads with leading zeros if necessary.
 *
 * @param num - The number to convert.
 * @param bits - The total number of bits the binary string should have.
 * @returns A string representing the binary form of the number.
 */
export function toBinaryString(num: number, bits: number): string {
  const binary = num.toString(2);
  return binary.padStart(bits, '0');
}

/**
 * Calculates a simple checksum for a buffer to verify file integrity.
 * Uses a basic hash function that's fast but effective for data validation.
 * 
 * @param buffer - The buffer to calculate a checksum for
 * @returns A string representation of the checksum
 */
export function calculateChecksum(buffer: Buffer): string {
  // Simple implementation of FNV-1a hash algorithm
  let hash = 2166136261; // FNV offset basis (32-bit)
  const fnvPrime = 16777619; // FNV prime (32-bit)

  for (let i = 0; i < buffer.length; i++) {
    hash ^= buffer[i];
    hash = Math.imul(hash, fnvPrime);
  }

  // Convert to hex string
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Returns a mapping of common character decoding errors and their correct values
 * This helps fix issues with special characters that might be incorrectly decoded
 * 
 * @returns An object mapping incorrect characters to their correct values
 */
export function getCharacterFixes(): Record<string, string> {
  return {
    // Known problem characters and their correct values
    '7': '?',      // Question mark issue
    '(': '+',      // Plus sign issue
    ':': '=',      // Equal sign issue
    'Y': '\\',     // Backslash issue
    '?': '<',   // Question mark variant - commented out as it causes problems
    '^': '*',      // Asterisk can become caret
    '|': '/',      // Slash can become pipe
    '&': '%',      // Percent can become ampersand
    'p': 's',      // 's' can become 'p' at the end of words
    // Add more mappings as new issues are discovered
    'hah': 'hai'   // The classic "hai" issue
  };
}

/**
 * Utility function to dump text as binary for debugging purposes
 * 
 * @param text - The text to analyze
 * @returns A detailed representation of the text's binary encoding
 */
export function dumpTextBinary(text: string): string {
  let result = 'Text binary analysis:\n';
  result += `Input text (${text.length} chars): "${text}"\n`;
  result += 'Character breakdown:\n';

  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text.charAt(i);
    const codePoint = text.codePointAt(i) || 0;
    const binary = toBinaryString(codePoint, 8);
    bytes.push(codePoint);

    result += `[${i}] '${char}' = ${codePoint} (0x${codePoint.toString(16)}) = ${binary}\n`;
  }

  // Show the full binary representation
  const fullBinary = bytes.map(b => toBinaryString(b, 8)).join('');
  result += `\nFull binary (${fullBinary.length} bits):\n${fullBinary}\n`;

  // Group by bytes for easier reading
  let groupedBinary = '';
  for (let i = 0; i < fullBinary.length; i += 8) {
    groupedBinary += fullBinary.substring(i, i + 8) + ' ';
  }
  result += `\nGrouped by bytes:\n${groupedBinary}\n`;

  return result;
}

/**
 * Splits a PGN string containing one or more games into an array of PGN game strings.
 * This version is more lenient and tries to process even non-standard PGN formats.
 * It preserves headers including the important FileSize metadata.
 *
 * @param pgnString - The PGN string containing one or more games.
 * @returns An array of PGN game strings.
 */
export function getPgnGames(pgnString: string): string[] {
  if (!pgnString || pgnString.trim() === '') {
    return [];
  }

  // Normalize line endings
  const normalizedPgn = pgnString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Check if the PGN contains metadata headers
  const hasMetadata = normalizedPgn.includes('[FileSize "') ||
    normalizedPgn.includes('[Checksum "') ||
    normalizedPgn.includes('[EncodingVersion "');
  console.log('PGN contains metadata:', hasMetadata);

  // First try to split by standard double newline separator
  const doubleSplit = normalizedPgn.split(/\n\s*\n/);

  // If we got more than one game or it has our metadata, use this splitting
  if (doubleSplit.length > 1 || hasMetadata) {
    return doubleSplit
      .map(game => game.trim())
      .filter(game => game.length > 0);
  }

  // Try to detect if this is a standard PGN format
  const singleGame = normalizedPgn.trim();
  const hasStandardFormat = singleGame.includes('[') &&
    singleGame.includes(']') &&
    /\d+\./.test(singleGame);

  if (!hasStandardFormat) {
    // If it's not standard format, don't do any filtering
    console.log('Non-standard PGN format detected, treating entire content as a single game');
    return [singleGame];
  }

  // Look for sequences of PGN tags to split into multiple games
  const tagRegex = /\[\s*(\w+)\s+"([^"]*)"\s*\]/g;
  const potentialGames = [];
  let lastTagIndex = -1;
  let match;

  while ((match = tagRegex.exec(normalizedPgn)) !== null) {
    // If this is an "Event" tag and not the first tag, it might be a new game
    if (match[1] === 'Event' && lastTagIndex !== -1) {
      potentialGames.push(normalizedPgn.substring(lastTagIndex, match.index).trim());
      lastTagIndex = match.index;
    } else if (lastTagIndex === -1) {
      lastTagIndex = match.index;
    }
  }

  // Add the last game
  if (lastTagIndex !== -1) {
    potentialGames.push(normalizedPgn.substring(lastTagIndex).trim());
  }

  // If we found potential games this way, use them
  if (potentialGames.length > 1) {
    return potentialGames.filter(game => game.length > 0);
  }

  // Fallback: just return the single game
  return [singleGame];
}
