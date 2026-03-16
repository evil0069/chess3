/* ===== CHESS BOARD RENDERER ===== */

const PIECE_SYMBOLS = {
    'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
    'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

class ChessBoard {
    constructor(boardEl, options = {}) {
        this.boardEl = boardEl;
        this.flipped = options.flipped || false;
        this.interactive = options.interactive !== false;
        this.onMove = options.onMove || null;

        this.selectedSquare = null;
        this.legalMoves = [];
        this.lastMove = null;
        this.squares = {};

        this.build();
    }

    build() {
        this.boardEl.innerHTML = '';
        this.squares = {};

        const filesOrder = this.flipped ? [...FILES].reverse() : FILES;
        const ranksOrder = this.flipped ? [...RANKS].reverse() : RANKS;

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const sq = filesOrder[f] + ranksOrder[r];
                const div = document.createElement('div');
                const isLight = (f + r) % 2 === 0;
                div.className = `square ${isLight ? 'light' : 'dark'}`;
                div.dataset.square = sq;

                if (this.interactive) {
                    div.addEventListener('click', () => this.handleClick(sq));
                }

                this.boardEl.appendChild(div);
                this.squares[sq] = div;
            }
        }
    }

    render(chess) {
        const board = chess.board();
        // board is 8x8 array, [row][col], row 0 = rank 8

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const sq = FILES[f] + RANKS[r];
                const div = this.squares[sq];
                if (!div) continue;

                // Clear previous state classes but keep light/dark
                const isLight = div.classList.contains('light');
                div.className = `square ${isLight ? 'light' : 'dark'}`;

                // Piece
                const piece = board[r][f];
                if (piece) {
                    const key = (piece.color === 'w' ? 'w' : 'b') + piece.type.toUpperCase();
                    div.innerHTML = `<span class="piece">${PIECE_SYMBOLS[key]}</span>`;
                    if (piece.type !== 'p' && piece.type !== 'P') {
                        div.classList.add('has-piece');
                    } else {
                        div.classList.add('has-piece');
                    }
                } else {
                    div.innerHTML = '';
                }
            }
        }

        // Highlight last move
        if (this.lastMove) {
            if (this.squares[this.lastMove.from]) this.squares[this.lastMove.from].classList.add('last-move');
            if (this.squares[this.lastMove.to]) this.squares[this.lastMove.to].classList.add('last-move');
        }

        // Highlight check
        if (chess.in_check()) {
            const turn = chess.turn();
            // Find king
            for (let r = 0; r < 8; r++) {
                for (let f = 0; f < 8; f++) {
                    const piece = board[r][f];
                    if (piece && piece.type === 'k' && piece.color === turn) {
                        const sq = FILES[f] + RANKS[r];
                        if (this.squares[sq]) this.squares[sq].classList.add('check');
                    }
                }
            }
        }

        // Re-highlight selected and legal moves
        if (this.selectedSquare) {
            if (this.squares[this.selectedSquare]) {
                this.squares[this.selectedSquare].classList.add('selected');
            }
            this.legalMoves.forEach(m => {
                if (this.squares[m.to]) {
                    this.squares[m.to].classList.add('legal');
                }
            });
        }
    }

    handleClick(sq) {
        if (!this.interactive) return;
        if (!window.gameController) return;

        const chess = window.gameController.chess;
        if (!chess) return;

        // If a square is already selected
        if (this.selectedSquare) {
            const move = this.legalMoves.find(m => m.to === sq);
            if (move) {
                // Check if promotion
                if (move.flags && (move.flags.includes('p') || move.promotion)) {
                    this.showPromotion(this.selectedSquare, sq, chess.turn());
                } else {
                    // Check if this move could be a promotion (pawn reaching last rank)
                    const piece = chess.get(this.selectedSquare);
                    if (piece && piece.type === 'p') {
                        const targetRank = sq[1];
                        if ((piece.color === 'w' && targetRank === '8') || (piece.color === 'b' && targetRank === '1')) {
                            this.showPromotion(this.selectedSquare, sq, piece.color);
                            return;
                        }
                    }
                    this.makeMove(this.selectedSquare, sq);
                }
                return;
            }

            // Deselect
            this.clearSelection();

            // If clicked on own piece, select it
            const piece = chess.get(sq);
            if (piece && piece.color === chess.turn()) {
                this.selectSquare(sq, chess);
            }
            this.render(chess);
            return;
        }

        // Select a piece
        const piece = chess.get(sq);
        if (piece && piece.color === chess.turn()) {
            this.selectSquare(sq, chess);
            this.render(chess);
        }
    }

    selectSquare(sq, chess) {
        this.selectedSquare = sq;
        this.legalMoves = chess.moves({ square: sq, verbose: true });
    }

    clearSelection() {
        this.selectedSquare = null;
        this.legalMoves = [];
    }

    makeMove(from, to, promotion) {
        if (this.onMove) {
            this.onMove(from, to, promotion);
        }
        this.clearSelection();
    }

    showPromotion(from, to, color) {
        const dialog = document.getElementById('promotion-dialog');
        const piecesEl = document.getElementById('promotion-pieces');
        dialog.style.display = 'flex';

        const pieces = ['q', 'r', 'b', 'n'];
        const symbols = color === 'w'
            ? { q: '♕', r: '♖', b: '♗', n: '♘' }
            : { q: '♛', r: '♜', b: '♝', n: '♞' };

        piecesEl.innerHTML = pieces.map(p =>
            `<div class="promotion-piece" data-piece="${p}">${symbols[p]}</div>`
        ).join('');

        piecesEl.querySelectorAll('.promotion-piece').forEach(el => {
            el.addEventListener('click', () => {
                dialog.style.display = 'none';
                this.makeMove(from, to, el.dataset.piece);
            });
        });
    }

    setFlipped(flipped) {
        this.flipped = flipped;
        this.build();
    }

    setInteractive(interactive) {
        this.interactive = interactive;
    }

    setLastMove(from, to) {
        this.lastMove = { from, to };
    }

    updateCoordinates() {
        const filesOrder = this.flipped ? [...FILES].reverse() : FILES;
        const ranksOrder = this.flipped ? [...RANKS].reverse() : RANKS;

        document.querySelectorAll('.board-coordinates-top span, .board-coordinates-bottom span').forEach((el, i) => {
            el.textContent = filesOrder[i];
        });

        document.querySelectorAll('.board-coordinates-left span, .board-coordinates-right span').forEach((el, i) => {
            el.textContent = ranksOrder[i];
        });
    }
}
