import * as fs from 'fs';
import { Chess } from 'chess.js';
import { getPgnGames } from './util';

/**
 * Decodes a PGN string into a binary representation and writes it to a file.
 *
 * @param pgnString - The PGN data as a string (one or more games).
 * @param outputFilePath - The path to the output file.
 */
export function decode(pgnString: string, outputFilePath: string): void {
  const startTime = Date.now();
  let totalMoveCount = 0;

  // Load games from PGN string.
  try {
    const games = getPgnGames(pgnString);
    
    if (games.length === 0) {
      throw new Error('No valid chess games found in the PGN data');
    }

    console.log(`Found ${games.length} game(s) in the PGN data`);

    // Ensure parent directory exists
    const outputDir = outputFilePath.substring(0, Math.max(outputFilePath.lastIndexOf('/'), outputFilePath.lastIndexOf('\\')));
    if (outputDir && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create or clear the output file
    fs.writeFileSync(outputFilePath, '');

    // Open file in append mode
    const outputFd = fs.openSync(outputFilePath, 'a');
    let outputData = '';

    for (let gameIndex = 0; gameIndex < games.length; gameIndex++) {
      const gameStr = games[gameIndex];
      
      try {
        // Create a new chess board for each game.
        const chessBoard = new Chess();
        
        // Load the PGN string for this game
        try {
          chessBoard.loadPgn(gameStr);
        } catch (error) {
          console.error(`Error loading PGN game ${gameIndex + 1}:`, error);
          
          // Try a fallback approach: treat the content as raw data
          console.log(`Attempting fallback parsing for game ${gameIndex + 1}`);
          
          try {
            // Split the string into chunks that could potentially be moves
            const chunks = gameStr
              .replace(/[^a-zA-Z0-9\s]/g, ' ')  // Replace non-alphanumeric chars with spaces
              .split(/\s+/)                      // Split by whitespace
              .filter(chunk => chunk.length > 0); // Remove empty chunks
            
            // Try to extract byte data directly from the chunks
            // Each 8 characters can represent a byte
            const byteArray: number[] = [];
            for (let i = 0; i < chunks.length; i++) {
              const chunk = chunks[i];
              if (chunk.length >= 8) {
                // Take 8 bits at a time
                for (let j = 0; j < chunk.length - 7; j += 8) {
                  const byteStr = chunk.substring(j, j + 8);
                  // Convert to a binary string (0s and 1s)
                  const binaryStr = byteStr
                    .split('')
                    .map(char => (char.charCodeAt(0) % 2).toString())
                    .join('');
                  byteArray.push(parseInt(binaryStr, 2));
                }
              }
            }
            
            if (byteArray.length > 0) {
              // Write the byte array directly to the file
              fs.writeSync(outputFd, Buffer.from(byteArray));
              console.log(`Wrote ${byteArray.length} bytes using fallback method for game ${gameIndex + 1}`);
              continue; // Skip to the next game
            } else {
              console.warn(`Fallback parsing failed for game ${gameIndex + 1}, no valid data extracted`);
              continue; // Skip this game
            }
          } catch (fallbackError) {
            console.error(`Fallback parsing failed for game ${gameIndex + 1}:`, fallbackError);
            continue; // Skip this game
          }
        }

        // Get the moves after loading the PGN
        const gameMoves = chessBoard.history({ verbose: true });
        if (gameMoves.length === 0) {
          console.warn(`Game ${gameIndex + 1} has no moves, skipping`);
          continue;
        }
        
        totalMoveCount += gameMoves.length;

        // Reset the board to start position to replay moves
        chessBoard.reset();

        for (let moveIndex = 0; moveIndex < gameMoves.length; moveIndex++) {
          const move = gameMoves[moveIndex];
          
          // Generate legal moves in the current position.
          const legalMoves = chessBoard.moves({ verbose: true });
          if (legalMoves.length === 0) {
            console.warn(`No legal moves available at game ${gameIndex + 1}, move ${moveIndex + 1}, skipping`);
            break;
          }
          
          const legalMoveUcis = legalMoves.map(legalMove =>
            legalMove.from + legalMove.to + (legalMove.promotion ? legalMove.promotion : '')
          );

          // Find the index of the played move.
          const moveUci = move.from + move.to + (move.promotion ? move.promotion : '');
          const moveIndexInLegal = legalMoveUcis.indexOf(moveUci);
          
          if (moveIndexInLegal === -1) {
            console.error(`Move ${moveUci} not found in legal moves at game ${gameIndex + 1}, move ${moveIndex + 1}`);
            // Try to continue with the next move
            try {
              chessBoard.move({ from: move.from, to: move.to, promotion: move.promotion });
            } catch (e) {
              console.error(`Failed to execute move ${moveUci}:`, e);
              break; // Skip to the next game
            }
            continue;
          }

          // Skip moves if only one move is available (we can't encode any bits)
          if (legalMoves.length === 1) {
            chessBoard.move({ from: move.from, to: move.to, promotion: move.promotion });
            continue;
          }

          // Convert the index to binary.
          let moveBinary = moveIndexInLegal.toString(2);

          // Determine the maximum binary length.
          const maxMoveBits = Math.floor(Math.log2(legalMoves.length));
          
          let maxBinaryLength: number;
          // For the last move of the entire sequence, ensure we end on a byte boundary
          if (gameIndex === games.length - 1 && moveIndex === gameMoves.length - 1) {
            const totalBits = outputData.length + maxMoveBits;
            const remainder = totalBits % 8;
            if (remainder === 0) {
              maxBinaryLength = maxMoveBits;
            } else {
              // Calculate how many bits we need to make a complete byte
              const bitsNeeded = 8 - remainder;
              if (bitsNeeded <= maxMoveBits) {
                // We can encode enough bits to complete the byte
                maxBinaryLength = bitsNeeded;
              } else {
                // We can't complete the byte, so we'll pad later
                maxBinaryLength = maxMoveBits;
              }
            }
          } else {
            maxBinaryLength = maxMoveBits;
          }

          // Pad the binary string.
          moveBinary = moveBinary.padStart(maxBinaryLength, '0');

          // Make the move on the board.
          try {
            chessBoard.move({ from: move.from, to: move.to, promotion: move.promotion });
          } catch (e) {
            console.error(`Failed to execute move ${moveUci}:`, e);
            break; // Skip to the next game
          }

          // Append the move binary to the output data.
          outputData += moveBinary;

          // If outputData length is a multiple of 8, flush it to file.
          if (outputData.length >= 8) {
            const completeBytes = Math.floor(outputData.length / 8);
            const byteArray: number[] = [];
            for (let i = 0; i < completeBytes; i++) {
              const byteStr = outputData.slice(i * 8, i * 8 + 8);
              byteArray.push(parseInt(byteStr, 2));
            }
            fs.writeSync(outputFd, Buffer.from(byteArray));
            outputData = outputData.slice(completeBytes * 8);
          }
        }
      } catch (gameError) {
        console.error(`Error processing game ${gameIndex + 1}:`, gameError);
        // Continue with the next game
      }
    }

    // Handle any remaining bits
    if (outputData.length > 0) {
      if (outputData.length === 8) {
        // We have a complete byte
        fs.writeSync(outputFd, Buffer.from([parseInt(outputData, 2)]));
      } else if (outputData.length < 8) {
        // Pad to complete byte with zeros
        const paddedData = outputData.padEnd(8, '0');
        fs.writeSync(outputFd, Buffer.from([parseInt(paddedData, 2)]));
        console.warn(`Padded ${8 - outputData.length} bits to complete the last byte`);
      } else {
        throw new Error(`Unexpected remaining bits length: ${outputData.length}`);
      }
    }

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(3);
    console.log(`\nSuccessfully decoded PGN with ${games.length} game(s), ${totalMoveCount} total move(s) (${elapsedSeconds}s).`);

    fs.closeSync(outputFd);
  } catch (error) {
    console.error('Decode failed:', error);
    throw error;
  }
}
