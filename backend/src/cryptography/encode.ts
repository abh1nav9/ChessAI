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

  // Loop until all file bits have been processed.
  while (true) {
    const legalMoves = chessBoard.moves({ verbose: true });
    if (legalMoves.length === 0) {
      // Game is over (checkmate or stalemate)
      outputPgns.push(chessBoard.pgn());
      if (fileBitIndex < fileBitsCount) {
        // If there are more bits to process, start a new game
        chessBoard.reset();
        continue;
      }
      break;
    }

    const maxMoveBits = Math.floor(Math.log2(legalMoves.length));
    const remainingBits = fileBitsCount - fileBitIndex;
    const maxBinaryLength = Math.min(maxMoveBits, remainingBits);

    // Build mapping from each legal move's UCI string to its binary representation.
    const moveBits: Record<string, string> = {};
    for (let index = 0; index < legalMoves.length; index++) {
      const move = legalMoves[index];
      const moveUci = move.from + move.to + (move.promotion || '');
      const moveBinary = toBinaryString(index, maxBinaryLength);
      if (moveBinary.length > maxBinaryLength) {
        break;
      }
      moveBits[moveUci] = moveBinary;
    }

    // Determine the file bits chunk to use.
    const closestByteIndex = Math.floor(fileBitIndex / 8);
    const sliceBytes = fileBytes.slice(closestByteIndex, closestByteIndex + 2);
    const fileChunkPool = sliceBytes
      .map((byte: number) => toBinaryString(byte, 8))
      .join('');
    const bitOffset = fileBitIndex % 8;
    const nextFileChunk = fileChunkPool.substr(bitOffset, maxBinaryLength);

    // Find the move whose binary representation matches the chunk.
    let moveFound = false;
    for (const moveUci in moveBits) {
      if (moveBits[moveUci] === nextFileChunk) {
        // Execute the move.
        const [from, to] = [moveUci.slice(0, 2), moveUci.slice(2, 4)];
        const promotion = moveUci.slice(4) || undefined;
        
        try {
          const moveResult = chessBoard.move({ from, to, promotion });
          if (!moveResult) {
            throw new Error(`Invalid move: ${from}-${to}${promotion ? '-' + promotion : ''}`);
          }
        } catch (error) {
          console.error('Move execution failed:', error);
          throw error;
        }
        
        moveFound = true;
        break;
      }
    }
    if (!moveFound) {
      throw new Error(`No matching move found for binary chunk: ${nextFileChunk}`);
    }

    // Advance the file bit index.
    fileBitIndex += maxBinaryLength;
    const eofReached = fileBitIndex >= fileBitsCount;

    // If game termination conditions are met or end-of-file is reached, record the PGN.
    if (
      legalMoves.length <= 1 ||
      chessBoard.isInsufficientMaterial?.() ||
      chessBoard.isDraw?.() ||
      eofReached
    ) {
      outputPgns.push(chessBoard.pgn());
      if (!eofReached) {
        chessBoard.reset();
      }
    }

    if (eofReached) break;
  }

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(3);
  console.log(`\nsuccessfully converted file to pgn with ${outputPgns.length} game(s) (${elapsedSeconds}s).`);

  return outputPgns.join("\n\n");
}
