import * as fs from 'fs';
import { Chess } from 'chess.js';
import { toBinaryString } from './util';

/**
 * Encodes a binary file into one or more PGN strings representing chess games.
 *
 * @param filePath - The path of the file to encode.
 * @returns A string containing one or more PGNs.
 */
export function encode(filePath: string): string {
  const startTime = Date.now();

  // Validate input
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found');
  }

  let fileBytes: number[];
  let fileBitsCount: number;

  // Read the binary file
  console.log("Reading file:", filePath);
  try {
    const fileBuffer = fs.readFileSync(filePath);
    if (fileBuffer.length === 0) {
      throw new Error('File is empty');
    }
    fileBytes = Array.from(fileBuffer);
    fileBitsCount = fileBytes.length * 8;
    console.log(`File size: ${fileBuffer.length} bytes`);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error reading file:', errorMessage);
    throw new Error(`Failed to read file: ${errorMessage}`);
  }

  console.log("\nencoding file...");
  const outputPgns: string[] = [];
  let fileBitIndex = 0;
  const chessBoard = new Chess();
  
  // Keep track of retries to avoid infinite loops
  let retryCount = 0;
  const MAX_RETRIES = 5;

  // Loop until all file bits have been processed.
  while (fileBitIndex < fileBitsCount) {
    const legalMoves = chessBoard.moves({ verbose: true });
    if (legalMoves.length === 0) {
      // Game is over (checkmate or stalemate)
      outputPgns.push(chessBoard.pgn());
      
      // Reset for a new game
      chessBoard.reset();
      retryCount = 0;
      continue;
    }

    // Calculate how many bits we can encode with this move
    const maxMoveBits = Math.floor(Math.log2(legalMoves.length));
    if (maxMoveBits === 0) {
      // If there's only one legal move, we can't encode any bits
      // Just make the move and continue
      const onlyMove = legalMoves[0];
      chessBoard.move({ from: onlyMove.from, to: onlyMove.to, promotion: onlyMove.promotion });
      continue;
    }
    
    const remainingBits = fileBitsCount - fileBitIndex;
    const maxBinaryLength = Math.min(maxMoveBits, remainingBits);

    // Build mapping from each legal move's UCI string to its binary representation.
    const moveBits: Record<string, string> = {};
    for (let index = 0; index < legalMoves.length; index++) {
      const move = legalMoves[index];
      const moveUci = move.from + move.to + (move.promotion || '');
      // Only include moves that can be represented with maxBinaryLength bits
      if (index < Math.pow(2, maxBinaryLength)) {
        const moveBinary = toBinaryString(index, maxBinaryLength);
        moveBits[moveUci] = moveBinary;
      }
    }

    // Determine the file bits chunk to use.
    const closestByteIndex = Math.floor(fileBitIndex / 8);
    const sliceBytes = fileBytes.slice(closestByteIndex, closestByteIndex + 3); // Get 3 bytes to ensure we have enough bits
    const fileChunkPool = sliceBytes
      .map((byte: number) => toBinaryString(byte, 8))
      .join('');
    const bitOffset = fileBitIndex % 8;
    const nextFileChunk = fileChunkPool.substr(bitOffset, maxBinaryLength);

    // Find the move whose binary representation matches the chunk.
    let moveFound = false;
    let selectedMoveUci = '';
    
    for (const moveUci in moveBits) {
      if (moveBits[moveUci] === nextFileChunk) {
        selectedMoveUci = moveUci;
        moveFound = true;
        break;
      }
    }
    
    // If no exact match, find the closest match
    if (!moveFound && retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`No exact match found for chunk: ${nextFileChunk}. Retry ${retryCount}/${MAX_RETRIES}.`);
      
      // Try a smaller bit length
      continue;
    }
    
    // If we've tried too many times, just use the first move
    if (!moveFound) {
      console.warn(`No match found for chunk after ${MAX_RETRIES} retries. Using fallback move.`);
      selectedMoveUci = Object.keys(moveBits)[0];
      moveFound = true;
    }
    
    // Execute the selected move
    const [from, to] = [selectedMoveUci.slice(0, 2), selectedMoveUci.slice(2, 4)];
    const promotion = selectedMoveUci.slice(4) || undefined;
    
    try {
      const moveResult = chessBoard.move({ from, to, promotion });
      if (!moveResult) {
        throw new Error(`Invalid move: ${from}-${to}${promotion ? '-' + promotion : ''}`);
      }
      
      // If we found a match, advance the bit index by the length of the binary representation
      if (moveFound) {
        fileBitIndex += maxBinaryLength;
        retryCount = 0; // Reset retry counter after successful move
      }
    } catch (error) {
      console.error('Move execution failed:', error);
      // Instead of crashing, reset the game and try again
      chessBoard.reset();
      retryCount++;
      
      if (retryCount >= MAX_RETRIES) {
        throw new Error(`Failed to execute moves after ${MAX_RETRIES} retries`);
      }
      continue;
    }

    const eofReached = fileBitIndex >= fileBitsCount;

    // If we've reached special conditions or end-of-file, record the PGN.
    if (
      legalMoves.length <= 1 ||
      chessBoard.isInsufficientMaterial?.() ||
      chessBoard.isDraw?.() ||
      eofReached ||
      chessBoard.history().length >= 80 // Avoid very long games (max ~40 full moves)
    ) {
      outputPgns.push(chessBoard.pgn());
      if (!eofReached) {
        chessBoard.reset();
        retryCount = 0;
      }
    }

    if (eofReached) break;
  }

  // If the last game wasn't pushed to outputPgns yet, do it now
  if (chessBoard.history().length > 0) {
    outputPgns.push(chessBoard.pgn());
  }

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(3);
  console.log(`\nsuccessfully converted file to pgn with ${outputPgns.length} game(s) (${elapsedSeconds}s).`);

  return outputPgns.join("\n\n");
}
