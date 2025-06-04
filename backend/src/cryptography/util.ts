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
   * This version is more lenient and tries to process even non-standard PGN formats.
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
    
    // First try to split by standard PGN separators
    let games = normalizedPgn.split(/\n\s*\n/);
    
    // If we only got one game and it doesn't look like a standard PGN,
    // just return the whole content as one game
    if (games.length === 1) {
      const singleGame = games[0].trim();
      
      // Try to detect if this is a standard PGN format
      const hasStandardFormat = singleGame.includes('[') && 
                               singleGame.includes(']') && 
                               /\d+\./.test(singleGame);
      
      if (!hasStandardFormat) {
        // If it's not standard format, don't do any filtering
        console.log('Non-standard PGN format detected, treating entire content as a single game');
        return [singleGame];
      }
      
      // Look for sequences of PGN tags
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
      
      // If we found potential games this way, use them instead
      if (potentialGames.length > 1) {
        games = potentialGames;
      }
    }
    
    // Less strict filtering - just ensure we don't have empty games
    return games
      .map(game => game.trim())
      .filter(game => game.length > 0);
  }
  