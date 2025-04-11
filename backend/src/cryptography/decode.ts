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
  const games = getPgnGames(pgnString);

  // Ensure parent directory exists
  const outputDir = outputFilePath.substring(0, Math.max(outputFilePath.lastIndexOf('/'), outputFilePath.lastIndexOf('\\')));
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Create or clear the output file
  fs.writeFileSync(outputFilePath, '');

  // Open file in append mode
  const outputFd = fs.openSync(outputFilePath, 'a');
  let outputData = '';

  games.forEach((gameStr, gameIndex) => {
    // Create a new chess board for each game.
    const chessBoard = new Chess();
    
    // Load the PGN string for this game
    chessBoard.loadPgn(gameStr);

    // Get the moves after loading the PGN
    const gameMoves = chessBoard.history({ verbose: true });
    totalMoveCount += gameMoves.length;

    // Reset the board to start position to replay moves
    chessBoard.reset();

    gameMoves.forEach((move, moveIndex) => {
      // Generate legal moves in the current position.
      const legalMoves = chessBoard.moves({ verbose: true });
      const legalMoveUcis = legalMoves.map(legalMove =>
        legalMove.from + legalMove.to + (legalMove.promotion ? legalMove.promotion : '')
      );

      // Find the index of the played move.
      const moveUci = move.from + move.to + (move.promotion ? move.promotion : '');
      const moveIndexInLegal = legalMoveUcis.indexOf(moveUci);
      if (moveIndexInLegal === -1) {
        throw new Error(`Move ${moveUci} not found in legal moves at game ${gameIndex + 1}, move ${moveIndex + 1}`);
      }

      // Convert the index to binary.
      let moveBinary = moveIndexInLegal.toString(2);

      // Determine the maximum binary length.
      const maxMoveBits = Math.floor(Math.log2(legalMoveUcis.length));
      let maxBinaryLength: number;
      if (gameIndex === games.length - 1 && moveIndex === gameMoves.length - 1) {
        // For the last move, adjust so that the total bit string is a multiple of 8.
        const totalBits = outputData.length + maxMoveBits;
        const remainder = totalBits % 8;
        maxBinaryLength = remainder === 0 ? maxMoveBits : maxMoveBits - remainder;
      } else {
        maxBinaryLength = maxMoveBits;
      }

      // Pad the binary string.
      moveBinary = moveBinary.padStart(maxBinaryLength, '0');

      // Make the move on the board.
      chessBoard.move({ from: move.from, to: move.to, promotion: move.promotion });

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
    });
  });

  // Write any remaining bits (should be a complete byte)
  if (outputData.length > 0) {
    if (outputData.length !== 8) {
      throw new Error(`Remaining bits (${outputData.length}) do not form a complete byte`);
    }
    fs.writeSync(outputFd, Buffer.from([parseInt(outputData, 2)]));
  }

  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(3);
  console.log(`\nsuccessfully decoded pgn with ${games.length} game(s), ${totalMoveCount} total move(s) (${elapsedSeconds}s).`);

  fs.closeSync(outputFd);
}
