/* ===== GAME CONTROLLER — AI ENGINE + GAME STATE ===== */

class GameController {
    constructor() {
        this.chess = new Chess();
        this.board = null;
        this.mode = null; // 'ai', 'multi', 'room'
        this.playerColor = 'w';
        this.aiDepth = 3;
        this.isSpectator = false;
        this.moveHistory = [];

        // Piece values for AI
        this.PIECE_VALUES = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };

        // Position tables for smarter AI
        this.PST = {
            p: [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [5, 5, 5, 5, 5, 5, 5, 5],
                [1, 1, 2, 3, 3, 2, 1, 1],
                [0.5, 0.5, 1, 2.5, 2.5, 1, 0.5, 0.5],
                [0, 0, 0, 2, 2, 0, 0, 0],
                [0.5, -0.5, -1, 0, 0, -1, -0.5, 0.5],
                [0.5, 1, 1, -2, -2, 1, 1, 0.5],
                [0, 0, 0, 0, 0, 0, 0, 0]
            ],
            n: [
                [-5, -4, -3, -3, -3, -3, -4, -5],
                [-4, -2, 0, 0, 0, 0, -2, -4],
                [-3, 0, 1, 1.5, 1.5, 1, 0, -3],
                [-3, 0.5, 1.5, 2, 2, 1.5, 0.5, -3],
                [-3, 0, 1.5, 2, 2, 1.5, 0, -3],
                [-3, 0.5, 1, 1.5, 1.5, 1, 0.5, -3],
                [-4, -2, 0, 0.5, 0.5, 0, -2, -4],
                [-5, -4, -3, -3, -3, -3, -4, -5]
            ],
            b: [
                [-2, -1, -1, -1, -1, -1, -1, -2],
                [-1, 0, 0, 0, 0, 0, 0, -1],
                [-1, 0, 0.5, 1, 1, 0.5, 0, -1],
                [-1, 0.5, 0.5, 1, 1, 0.5, 0.5, -1],
                [-1, 0, 1, 1, 1, 1, 0, -1],
                [-1, 1, 1, 1, 1, 1, 1, -1],
                [-1, 0.5, 0, 0, 0, 0, 0.5, -1],
                [-2, -1, -1, -1, -1, -1, -1, -2]
            ],
            r: [
                [0, 0, 0, 0, 0, 0, 0, 0],
                [0.5, 1, 1, 1, 1, 1, 1, 0.5],
                [-0.5, 0, 0, 0, 0, 0, 0, -0.5],
                [-0.5, 0, 0, 0, 0, 0, 0, -0.5],
                [-0.5, 0, 0, 0, 0, 0, 0, -0.5],
                [-0.5, 0, 0, 0, 0, 0, 0, -0.5],
                [-0.5, 0, 0, 0, 0, 0, 0, -0.5],
                [0, 0, 0, 0.5, 0.5, 0, 0, 0]
            ],
            q: [
                [-2, -1, -1, -0.5, -0.5, -1, -1, -2],
                [-1, 0, 0, 0, 0, 0, 0, -1],
                [-1, 0, 0.5, 0.5, 0.5, 0.5, 0, -1],
                [-0.5, 0, 0.5, 0.5, 0.5, 0.5, 0, -0.5],
                [0, 0, 0.5, 0.5, 0.5, 0.5, 0, -0.5],
                [-1, 0.5, 0.5, 0.5, 0.5, 0.5, 0, -1],
                [-1, 0, 0.5, 0, 0, 0, 0, -1],
                [-2, -1, -1, -0.5, -0.5, -1, -1, -2]
            ],
            k: [
                [-3, -4, -4, -5, -5, -4, -4, -3],
                [-3, -4, -4, -5, -5, -4, -4, -3],
                [-3, -4, -4, -5, -5, -4, -4, -3],
                [-3, -4, -4, -5, -5, -4, -4, -3],
                [-2, -3, -3, -4, -4, -3, -3, -2],
                [-1, -2, -2, -2, -2, -2, -2, -1],
                [2, 2, 0, 0, 0, 0, 2, 2],
                [2, 3, 1, 0, 0, 1, 3, 2]
            ]
        };
    }

    newGame(mode, options = {}) {
        this.chess = new Chess();
        this.mode = mode;
        this.playerColor = options.color || 'w';
        this.aiDepth = options.depth || 3;
        this.isSpectator = options.spectator || false;
        this.moveHistory = [];

        this.updateUI();

        if (this.board) {
            const shouldFlip = this.playerColor === 'b' && !this.isSpectator;
            this.board.setFlipped(shouldFlip);
            this.board.updateCoordinates();
            this.board.setInteractive(!this.isSpectator);
            this.board.lastMove = null;
            this.board.clearSelection();
            this.board.render(this.chess);
        }

        this.updateMovesList();
        this.updatePlayerBars();
        this.updateTurnIndicator();

        // Hide game over
        document.getElementById('game-over-overlay').style.display = 'none';

        // Show spectator badge if spectating
        document.getElementById('spectator-badge').style.display = this.isSpectator ? 'flex' : 'none';

        // If AI game and AI goes first (player is black)
        if (mode === 'ai' && this.playerColor === 'b') {
            setTimeout(() => this.aiMove(), 400);
        }
    }

    tryMove(from, to, promotion) {
        const move = this.chess.move({
            from: from,
            to: to,
            promotion: promotion || 'q'
        });

        if (move) {
            this.moveHistory.push(move);
            this.board.setLastMove(from, to);
            this.board.clearSelection();
            this.board.render(this.chess);
            this.updateMovesList();
            this.updateTurnIndicator();
            this.updateCapturedPieces();
            this.playMoveSound(move);

            // Check game over
            if (this.checkGameOver()) return move;

            // If AI mode, trigger AI
            if (this.mode === 'ai' && this.chess.turn() !== this.playerColor) {
                this.board.setInteractive(false);
                setTimeout(() => {
                    this.aiMove();
                    this.board.setInteractive(true);
                }, 300);
            }

            return move;
        }
        return null;
    }

    applyMove(moveObj) {
        // Apply a move received from network
        const move = this.chess.move(moveObj);
        if (move) {
            this.moveHistory.push(move);
            this.board.setLastMove(move.from, move.to);
            this.board.clearSelection();
            this.board.render(this.chess);
            this.updateMovesList();
            this.updateTurnIndicator();
            this.updateCapturedPieces();
            this.playMoveSound(move);
            this.checkGameOver();
        }
        return move;
    }

    // ===== AI ENGINE =====

    aiMove() {
        if (this.chess.game_over()) return;

        let bestMove;
        if (this.aiDepth === 1) {
            // Random move for beginner
            const moves = this.chess.moves({ verbose: true });
            bestMove = moves[Math.floor(Math.random() * moves.length)];
        } else {
            bestMove = this.getBestMove(this.aiDepth);
        }

        if (bestMove) {
            const move = this.chess.move(bestMove);
            if (move) {
                this.moveHistory.push(move);
                this.board.setLastMove(move.from, move.to);
                this.board.render(this.chess);
                this.updateMovesList();
                this.updateTurnIndicator();
                this.updateCapturedPieces();
                this.playMoveSound(move);
                this.checkGameOver();
            }
        }
    }

    getBestMove(depth) {
        const isMaximizing = this.chess.turn() === 'w';
        let bestMove = null;
        let bestValue = isMaximizing ? -Infinity : Infinity;

        const moves = this.chess.moves({ verbose: true });
        // Shuffle for variety
        this.shuffle(moves);

        // Order captures first for better pruning
        moves.sort((a, b) => {
            if (a.captured && !b.captured) return -1;
            if (!a.captured && b.captured) return 1;
            return 0;
        });

        for (const move of moves) {
            this.chess.move(move);
            const value = this.minimax(depth - 1, -Infinity, Infinity, !isMaximizing);
            this.chess.undo();

            if (isMaximizing) {
                if (value > bestValue) {
                    bestValue = value;
                    bestMove = move;
                }
            } else {
                if (value < bestValue) {
                    bestValue = value;
                    bestMove = move;
                }
            }
        }

        return bestMove;
    }

    minimax(depth, alpha, beta, isMaximizing) {
        if (depth === 0) return this.evaluate();
        if (this.chess.game_over()) {
            if (this.chess.in_checkmate()) return isMaximizing ? -9999 : 9999;
            return 0; // draw
        }

        const moves = this.chess.moves({ verbose: true });

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                this.chess.move(move);
                const eval_ = this.minimax(depth - 1, alpha, beta, false);
                this.chess.undo();
                maxEval = Math.max(maxEval, eval_);
                alpha = Math.max(alpha, eval_);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                this.chess.move(move);
                const eval_ = this.minimax(depth - 1, alpha, beta, true);
                this.chess.undo();
                minEval = Math.min(minEval, eval_);
                beta = Math.min(beta, eval_);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    evaluate() {
        let score = 0;
        const board = this.chess.board();

        for (let r = 0; r < 8; r++) {
            for (let f = 0; f < 8; f++) {
                const piece = board[r][f];
                if (!piece) continue;

                const value = this.PIECE_VALUES[piece.type] || 0;
                const pst = this.PST[piece.type];
                let posValue = 0;

                if (pst) {
                    posValue = piece.color === 'w' ? pst[r][f] : pst[7 - r][f];
                }

                if (piece.color === 'w') {
                    score += value + posValue;
                } else {
                    score -= value + posValue;
                }
            }
        }

        return score;
    }

    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    // ===== UI UPDATES =====

    checkGameOver() {
        if (!this.chess.game_over()) return false;

        const overlay = document.getElementById('game-over-overlay');
        const icon = document.getElementById('game-over-icon');
        const title = document.getElementById('game-over-title');
        const msg = document.getElementById('game-over-message');

        if (this.chess.in_checkmate()) {
            const winner = this.chess.turn() === 'w' ? 'Black' : 'White';
            icon.textContent = '👑';
            title.textContent = 'Checkmate!';
            msg.textContent = `${winner} wins!`;
        } else if (this.chess.in_stalemate()) {
            icon.textContent = '🤝';
            title.textContent = 'Stalemate';
            msg.textContent = 'The game is a draw by stalemate.';
        } else if (this.chess.in_draw()) {
            icon.textContent = '🤝';
            title.textContent = 'Draw';
            msg.textContent = 'The game ended in a draw.';
        } else if (this.chess.in_threefold_repetition()) {
            icon.textContent = '🔄';
            title.textContent = 'Draw';
            msg.textContent = 'Draw by threefold repetition.';
        } else {
            icon.textContent = '🏁';
            title.textContent = 'Game Over';
            msg.textContent = 'The game has ended.';
        }

        overlay.style.display = 'flex';
        return true;
    }

    updateMovesList() {
        const list = document.getElementById('moves-list');
        list.innerHTML = '';

        for (let i = 0; i < this.moveHistory.length; i += 2) {
            const moveNum = Math.floor(i / 2) + 1;
            const row = document.createElement('div');
            row.className = 'move-row';

            const numEl = document.createElement('span');
            numEl.className = 'move-number';
            numEl.textContent = moveNum + '.';
            row.appendChild(numEl);

            const whiteMove = document.createElement('span');
            whiteMove.className = 'move-notation';
            whiteMove.textContent = this.moveHistory[i].san;
            if (i === this.moveHistory.length - 1) whiteMove.classList.add('last');
            row.appendChild(whiteMove);

            if (i + 1 < this.moveHistory.length) {
                const blackMove = document.createElement('span');
                blackMove.className = 'move-notation';
                blackMove.textContent = this.moveHistory[i + 1].san;
                if (i + 1 === this.moveHistory.length - 1) blackMove.classList.add('last');
                row.appendChild(blackMove);
            }

            list.appendChild(row);
        }

        list.scrollTop = list.scrollHeight;
    }

    updateTurnIndicator() {
        const topPlayer = document.getElementById('opponent-bar');
        const bottomPlayer = document.getElementById('player-bar');
        const currentTurn = this.chess.turn();

        if (this.isSpectator) {
            // Spectator: top = black, bottom = white
            topPlayer.classList.toggle('active-turn', currentTurn === 'b');
            bottomPlayer.classList.toggle('active-turn', currentTurn === 'w');
        } else {
            const opponentColor = this.playerColor === 'w' ? 'b' : 'w';
            topPlayer.classList.toggle('active-turn', currentTurn === opponentColor);
            bottomPlayer.classList.toggle('active-turn', currentTurn === this.playerColor);
        }
    }

    updatePlayerBars() {
        const opponentName = document.getElementById('opponent-name');
        const playerName = document.getElementById('player-name');
        const opponentStatus = document.getElementById('opponent-status');

        if (this.mode === 'ai') {
            const diffNames = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' };
            opponentName.textContent = 'Chess AI';
            opponentStatus.textContent = diffNames[this.aiDepth] || 'AI';
            playerName.textContent = 'You';

            document.querySelector('#opponent-bar .player-avatar').textContent =
                this.playerColor === 'w' ? '♟' : '♙';
            document.querySelector('#player-bar .player-avatar').textContent =
                this.playerColor === 'w' ? '♙' : '♟';
        } else if (this.isSpectator) {
            opponentName.textContent = 'Black';
            playerName.textContent = 'White';
            opponentStatus.textContent = 'Player';
        } else {
            opponentName.textContent = 'Opponent';
            playerName.textContent = 'You';
            opponentStatus.textContent = this.mode === 'room' ? 'Room Player' : 'Online';

            document.querySelector('#opponent-bar .player-avatar').textContent =
                this.playerColor === 'w' ? '♟' : '♙';
            document.querySelector('#player-bar .player-avatar').textContent =
                this.playerColor === 'w' ? '♙' : '♟';
        }
    }

    updateCapturedPieces() {
        const whiteCaptured = [];
        const blackCaptured = [];

        for (const move of this.moveHistory) {
            if (move.captured) {
                const symbol = PIECE_SYMBOLS[(move.color === 'w' ? 'b' : 'w') + move.captured.toUpperCase()];
                if (move.color === 'w') {
                    whiteCaptured.push(symbol);
                } else {
                    blackCaptured.push(symbol);
                }
            }
        }

        // Player captured = pieces the player took
        // Opponent captured = pieces opponent took
        const playerCapturedEl = document.getElementById('player-captured');
        const opponentCapturedEl = document.getElementById('opponent-captured');

        if (this.isSpectator) {
            playerCapturedEl.textContent = whiteCaptured.join(' ');
            opponentCapturedEl.textContent = blackCaptured.join(' ');
        } else {
            if (this.playerColor === 'w') {
                playerCapturedEl.textContent = whiteCaptured.join(' ');
                opponentCapturedEl.textContent = blackCaptured.join(' ');
            } else {
                playerCapturedEl.textContent = blackCaptured.join(' ');
                opponentCapturedEl.textContent = whiteCaptured.join(' ');
            }
        }
    }

    updateUI() {
        // Show/hide voice controls based on mode
        const voiceControls = document.getElementById('voice-controls');
        if (this.mode === 'ai') {
            voiceControls.style.display = 'none';
        } else {
            voiceControls.style.display = 'flex';
        }
    }

    playMoveSound(move) {
        // Simple audio feedback using Web Audio API
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            if (move.captured) {
                osc.frequency.value = 220;
                gain.gain.value = 0.15;
            } else {
                osc.frequency.value = 440;
                gain.gain.value = 0.08;
            }

            osc.type = 'sine';
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) {
            // Audio not supported
        }
    }

    isMyTurn() {
        if (this.isSpectator) return false;
        return this.chess.turn() === this.playerColor;
    }

    getFen() {
        return this.chess.fen();
    }

    loadFen(fen) {
        this.chess.load(fen);
        if (this.board) {
            this.board.clearSelection();
            this.board.render(this.chess);
        }
        this.updateTurnIndicator();
    }
}

// Global instance
window.gameController = new GameController();
