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

export interface Move {
    from: Position;
    to: Position;
    capturedPiece?: Piece | null;
    isEnPassant?: boolean;
    isCastling?: boolean;
    promotionPiece?: PieceType;
}

export interface Piece {
    type: PieceType;
    color: Color;
    hasMoved: boolean;
} 