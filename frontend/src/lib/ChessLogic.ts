// Piece types and colors
export enum PieceType {
    KING = 'king',
    QUEEN = 'queen',
    ROOK = 'rook',
    BISHOP = 'bishop',
    KNIGHT = 'knight',
    PAWN = 'pawn'
}

export enum Color {
    WHITE = 'white',
    BLACK = 'black'
}

export interface Position {
    row: number;
    col: number;
}

export interface Piece {
    type: PieceType;
    color: Color;
    hasMoved: boolean;
}

export interface Move {
    from: Position;
    to: Position;
    capturedPiece?: Piece | null;
    isEnPassant?: boolean;
    isCastling?: boolean;
    promotionPiece?: PieceType;
}

export class ChessBoard {
    private board: (Piece | null)[][];
    private currentTurn: Color;
    private moveHistory: Move[];
    private lastMove?: Move;

    constructor() {
        this.board = this.initializeBoard();
        this.currentTurn = Color.WHITE;
        this.moveHistory = [];
    }

    private initializeBoard(): (Piece | null)[][] {
        const board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Initialize pawns
        for (let col = 0; col < 8; col++) {
            board[1][col] = { type: PieceType.PAWN, color: Color.WHITE, hasMoved: false };
            board[6][col] = { type: PieceType.PAWN, color: Color.BLACK, hasMoved: false };
        }

        // Initialize other pieces
        const backRankPieces = [
            PieceType.ROOK, PieceType.KNIGHT, PieceType.BISHOP, PieceType.QUEEN,
            PieceType.KING, PieceType.BISHOP, PieceType.KNIGHT, PieceType.ROOK
        ];

        for (let col = 0; col < 8; col++) {
            board[0][col] = { type: backRankPieces[col], color: Color.WHITE, hasMoved: false };
            board[7][col] = { type: backRankPieces[col], color: Color.BLACK, hasMoved: false };
        }

        return board;
    }

    public isValidMove(from: Position, to: Position): boolean {
        const piece = this.board[from.row][from.col];
        if (!piece || piece.color !== this.currentTurn) return false;
        
        const possibleMoves = this.getValidMovesForPiece(from);
        return possibleMoves.some(move => 
            move.to.row === to.row && move.to.col === to.col
        );
    }

    public makeMove(from: Position, to: Position): boolean {
        if (!this.isValidMove(from, to)) return false;

        const piece = this.board[from.row][from.col]!;
        const move: Move = { from, to };

        // Handle special moves
        if (piece.type === PieceType.PAWN) {
            this.handlePawnSpecialMoves(move, piece);
        } else if (piece.type === PieceType.KING && Math.abs(to.col - from.col) === 2) {
            this.handleCastling(move);
        }

        // Execute move
        this.board[to.row][to.col] = { ...piece, hasMoved: true };
        this.board[from.row][from.col] = null;
        
        this.lastMove = move;
        this.moveHistory.push(move);
        this.currentTurn = this.currentTurn === Color.WHITE ? Color.BLACK : Color.WHITE;

        return true;
    }

    public getValidMovesForPiece(pos: Position): Move[] {
        const piece = this.board[pos.row][pos.col];
        if (!piece) return [];

        const moves: Move[] = [];

        switch (piece.type) {
            case PieceType.PAWN:
                this.addPawnMoves(pos, moves);
                break;
            case PieceType.KNIGHT:
                this.addKnightMoves(pos, moves);
                break;
            case PieceType.BISHOP:
                this.addBishopMoves(pos, moves);
                break;
            case PieceType.ROOK:
                this.addRookMoves(pos, moves);
                break;
            case PieceType.QUEEN:
                this.addQueenMoves(pos, moves);
                break;
            case PieceType.KING:
                this.addKingMoves(pos, moves);
                break;
        }

        return moves.filter(move => !this.wouldResultInCheck(move, piece.color));
    }

    private addPawnMoves(pos: Position, moves: Move[]): void {
        const piece = this.board[pos.row][pos.col]!;
        const direction = piece.color === Color.WHITE ? 1 : -1;
        
        // Forward move
        if (!this.board[pos.row + direction][pos.col]) {
            moves.push({ from: pos, to: { row: pos.row + direction, col: pos.col }});
            
            // Double move from starting position
            if (!piece.hasMoved && !this.board[pos.row + 2 * direction][pos.col]) {
                moves.push({ from: pos, to: { row: pos.row + 2 * direction, col: pos.col }});
            }
        }

        // Captures
        for (const colOffset of [-1, 1]) {
            const newCol = pos.col + colOffset;
            if (newCol >= 0 && newCol < 8) {
                const targetPos = { row: pos.row + direction, col: newCol };
                const targetPiece = this.board[targetPos.row][targetPos.col];
                
                if (targetPiece && targetPiece.color !== piece.color) {
                    moves.push({ from: pos, to: targetPos, capturedPiece: targetPiece });
                }
                
                // En passant
                if (this.isEnPassantPossible(pos, targetPos)) {
                    moves.push({
                        from: pos,
                        to: targetPos,
                        isEnPassant: true,
                        capturedPiece: this.board[pos.row][newCol]
                    });
                }
            }
        }
    }

    private addKnightMoves(pos: Position, moves: Move[]): void {
        const knightOffsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];

        for (const [rowOffset, colOffset] of knightOffsets) {
            const newRow = pos.row + rowOffset;
            const newCol = pos.col + colOffset;
            
            if (this.isValidPosition(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece || targetPiece.color !== this.currentTurn) {
                    moves.push({
                        from: pos,
                        to: { row: newRow, col: newCol },
                        capturedPiece: targetPiece
                    });
                }
            }
        }
    }

    private addBishopMoves(pos: Position, moves: Move[]): void {
        const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        this.addSlidingMoves(pos, moves, directions);
    }

    private addRookMoves(pos: Position, moves: Move[]): void {
        const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        this.addSlidingMoves(pos, moves, directions);
    }

    private addQueenMoves(pos: Position, moves: Move[]): void {
        this.addBishopMoves(pos, moves);
        this.addRookMoves(pos, moves);
    }

    private addKingMoves(pos: Position, moves: Move[]): void {
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];

        for (const [rowOffset, colOffset] of directions) {
            const newRow = pos.row + rowOffset;
            const newCol = pos.col + colOffset;
            
            if (this.isValidPosition(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece || targetPiece.color !== this.currentTurn) {
                    moves.push({
                        from: pos,
                        to: { row: newRow, col: newCol },
                        capturedPiece: targetPiece
                    });
                }
            }
        }

        // Castling
        this.addCastlingMoves(pos, moves);
    }

    private addSlidingMoves(pos: Position, moves: Move[], directions: number[][]): void {
        const piece = this.board[pos.row][pos.col]!;

        for (const [rowDir, colDir] of directions) {
            let newRow = pos.row + rowDir;
            let newCol = pos.col + colDir;

            while (this.isValidPosition(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                
                if (!targetPiece) {
                    moves.push({
                        from: pos,
                        to: { row: newRow, col: newCol }
                    });
                } else {
                    if (targetPiece.color !== piece.color) {
                        moves.push({
                            from: pos,
                            to: { row: newRow, col: newCol },
                            capturedPiece: targetPiece
                        });
                    }
                    break;
                }

                newRow += rowDir;
                newCol += colDir;
            }
        }
    }

    private isValidPosition(row: number, col: number): boolean {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }

    private wouldResultInCheck(move: Move, color: Color): boolean {
        // Make temporary move
        const originalBoard = this.board.map(row => [...row]);
        this.board[move.to.row][move.to.col] = this.board[move.from.row][move.from.col];
        this.board[move.from.row][move.from.col] = null;

        const isInCheck = this.isInCheck(color);

        // Restore board
        this.board = originalBoard;

        return isInCheck;
    }

    private isInCheck(color: Color): boolean {
        // Find king position
        const kingPos = this.findKing(color);
        if (!kingPos) return false;

        // Check if any opponent piece can capture the king
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color !== color) {
                    const moves = this.getValidMovesForPiece({ row, col });
                    if (moves.some(move => 
                        move.to.row === kingPos.row && 
                        move.to.col === kingPos.col
                    )) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private findKing(color: Color): Position | null {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece?.type === PieceType.KING && piece.color === color) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    private isEnPassantPossible(from: Position, to: Position): boolean {
        if (!this.lastMove) return false;

        const piece = this.board[from.row][from.col]!;
        if (piece.type !== PieceType.PAWN) return false;

        const lastPiece = this.board[this.lastMove.to.row][this.lastMove.to.col]!;
        return lastPiece.type === PieceType.PAWN &&
               Math.abs(this.lastMove.from.row - this.lastMove.to.row) === 2 &&
               this.lastMove.to.col === to.col &&
               from.row === (piece.color === Color.WHITE ? 4 : 3);
    }

    private handlePawnSpecialMoves(move: Move, piece: Piece): void {
        // Promotion
        if ((piece.color === Color.WHITE && move.to.row === 7) ||
            (piece.color === Color.BLACK && move.to.row === 0)) {
            move.promotionPiece = PieceType.QUEEN; // Default promotion to queen
        }

        // En passant capture
        if (move.isEnPassant) {
            this.board[move.from.row][move.to.col] = null;
        }
    }

    private handleCastling(move: Move): void {
        const row = move.from.row;
        const rookFromCol = move.to.col > move.from.col ? 7 : 0;
        const rookToCol = move.to.col > move.from.col ? 5 : 3;

        // Move rook
        this.board[row][rookToCol] = this.board[row][rookFromCol];
        this.board[row][rookFromCol] = null;
        move.isCastling = true;
    }

    private addCastlingMoves(pos: Position, moves: Move[]): void {
        const piece = this.board[pos.row][pos.col]!;
        if (piece.hasMoved || this.isInCheck(piece.color)) return;

        // Kingside castling
        if (this.canCastle(pos, true)) {
            moves.push({
                from: pos,
                to: { row: pos.row, col: pos.col + 2 },
                isCastling: true
            });
        }

        // Queenside castling
        if (this.canCastle(pos, false)) {
            moves.push({
                from: pos,
                to: { row: pos.row, col: pos.col - 2 },
                isCastling: true
            });
        }
    }

    private canCastle(kingPos: Position, isKingside: boolean): boolean {
        const row = kingPos.row;
        const rookCol = isKingside ? 7 : 0;
        const rook = this.board[row][rookCol];

        if (!rook || rook.type !== PieceType.ROOK || rook.hasMoved) {
            return false;
        }

        const direction = isKingside ? 1 : -1;
        const endCol = isKingside ? 6 : 2;

        // Check if squares between king and rook are empty
        for (let col = kingPos.col + direction; 
             isKingside ? col < endCol + 1 : col > endCol - 1; 
             col += direction) {
            if (this.board[row][col] !== null) return false;
        }

        // Check if squares the king moves through are not under attack
        for (let col = kingPos.col; 
             isKingside ? col <= endCol : col >= endCol; 
             col += direction) {
            const king = this.board[kingPos.row][kingPos.col]!;
            if (this.isSquareUnderAttack({ row, col }, king.color)) {
                return false;
            }
        }

        return true;
    }

    private isSquareUnderAttack(pos: Position, defendingColor: Color): boolean {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color !== defendingColor) {
                    const moves = this.getValidMovesForPiece({ row, col });
                    if (moves.some(move => 
                        move.to.row === pos.row && 
                        move.to.col === pos.col
                    )) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    public isCheckmate(): boolean {
        if (!this.isInCheck(this.currentTurn)) return false;

        // Check if any piece has valid moves
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === this.currentTurn) {
                    const moves = this.getValidMovesForPiece({ row, col });
                    if (moves.length > 0) return false;
                }
            }
        }

        return true;
    }

    public isStalemate(): boolean {
        if (this.isInCheck(this.currentTurn)) return false;

        // Check if any piece has valid moves
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === this.currentTurn) {
                    const moves = this.getValidMovesForPiece({ row, col });
                    if (moves.length > 0) return false;
                }
            }
        }

        return true;
    }

    public getBoard(): (Piece | null)[][] {
        return this.board;
    }

    public getCurrentTurn(): Color {
        return this.currentTurn;
    }
}
