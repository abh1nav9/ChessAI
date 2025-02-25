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
   * Splits a PGN string containing one or more games into an array of PGN game strings.
   *
   * Note: This is a simplified implementation. For a full PGN parser, consider using a dedicated library.
   *
   * @param pgnString - The PGN string containing one or more games.
   * @returns An array of PGN game strings.
   */
  export function getPgnGames(pgnString: string): string[] {
    const games: string[] = [];
    // This simple approach splits games by blank lines.
    const gameStrings = pgnString.split(/\n\s*\n/);
    for (const gameStr of gameStrings) {
      const trimmed = gameStr.trim();
      if (trimmed) {
        games.push(trimmed);
      }
    }
    return games;
  }
  