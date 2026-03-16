/* ===== APP CONTROLLER — Main Application Logic ===== */

// ===== TOAST NOTIFICATIONS =====
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== PARTICLES BACKGROUND =====
function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationId;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 2 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5;
            this.opacity = Math.random() * 0.4 + 0.1;
        }
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
                this.reset();
            }
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(124, 58, 237, ${this.opacity})`;
            ctx.fill();
        }
    }

    for (let i = 0; i < 60; i++) {
        particles.push(new Particle());
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 150) {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(124, 58, 237, ${0.08 * (1 - dist / 150)})`;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }

        particles.forEach(p => {
            p.update();
            p.draw();
        });
        animationId = requestAnimationFrame(animate);
    }
    animate();
}

// ===== PAGE NAVIGATION =====
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
        page.style.animation = 'none';
        // Force reflow
        void page.offsetHeight;
        page.style.animation = 'fadeIn 0.4s ease';
    }
}

function goHome() {
    // Cleanup any active game/connections
    if (window.networkManager) {
        window.networkManager.disconnect();
    }
    if (window.voiceChat) {
        window.voiceChat.cleanup();
    }
    showPage('landing-page');
}

// ===== PANEL TABS =====
function initPanelTabs() {
    const tabs = document.querySelectorAll('.panel-tab');
    const panels = document.querySelectorAll('.panel-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            panels.forEach(p => p.classList.remove('active'));
            const targetPanel = document.getElementById(target + '-panel');
            if (targetPanel) targetPanel.classList.add('active');

            // Mark chat as read
            if (target === 'chat' && window.chatManager) {
                window.chatManager.setActive(true);
            } else if (window.chatManager) {
                window.chatManager.setActive(false);
            }
        });
    });
}

// ===== SINGLEPLAYER SETUP =====
function initAISetup() {
    const diffCards = document.querySelectorAll('.diff-card');
    const colorBtns = document.querySelectorAll('.color-btn');

    let selectedDepth = 3;
    let selectedColor = 'w';

    diffCards.forEach(card => {
        card.addEventListener('click', () => {
            diffCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedDepth = parseInt(card.dataset.depth);
        });
    });

    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedColor = btn.dataset.color;
        });
    });

    document.getElementById('start-ai-game').addEventListener('click', () => {
        let color = selectedColor;
        if (color === 'random') {
            color = Math.random() < 0.5 ? 'w' : 'b';
        }

        startAIGame(color, selectedDepth);
    });
}

function startAIGame(color, depth) {
    showPage('game-page');

    const gc = window.gameController;
    const boardEl = document.getElementById('chess-board');

    gc.board = new ChessBoard(boardEl, {
        flipped: color === 'b',
        interactive: true,
        onMove: (from, to, promotion) => {
            if (gc.isMyTurn()) {
                gc.tryMove(from, to, promotion);
            }
        }
    });

    gc.board.updateCoordinates();
    gc.newGame('ai', { color, depth });
}

// ===== MULTIPLAYER SETUP =====
function initMultiSetup() {
    document.getElementById('create-multi-game').addEventListener('click', async () => {
        try {
            showToast('Creating game...', 'info');
            const code = await window.networkManager.createRoom('multi');

            document.getElementById('multi-code-display').style.display = 'block';
            document.getElementById('multi-code-value').textContent = code;
            document.getElementById('multi-waiting').style.display = 'flex';
            document.getElementById('create-multi-game').style.display = 'none';

            // Setup network handlers
            setupNetworkHandlers('w', false);

        } catch (err) {
            showToast('Failed to create game: ' + err.message, 'error');
        }
    });

    document.getElementById('multi-copy-btn').addEventListener('click', () => {
        const code = document.getElementById('multi-code-value').textContent;
        navigator.clipboard.writeText(code).then(() => {
            showToast('Code copied!', 'success');
        }).catch(() => {
            showToast('Copy failed. Code: ' + code, 'info');
        });
    });

    document.getElementById('join-multi-btn').addEventListener('click', async () => {
        const code = document.getElementById('multi-code-input').value.trim();
        if (!code) {
            showToast('Please enter a game code', 'error');
            return;
        }

        try {
            showToast('Joining game...', 'info');
            await window.networkManager.joinRoom(code, false);

            // Setup network handlers — joiner gets black
            setupNetworkHandlers('b', false);

        } catch (err) {
            showToast('Failed to join: ' + err.message, 'error');
        }
    });
}

// ===== ROOM SETUP =====
function initRoomSetup() {
    document.getElementById('create-room-btn').addEventListener('click', async () => {
        try {
            showToast('Creating room...', 'info');
            const code = await window.networkManager.createRoom('room');

            document.getElementById('room-code-value').textContent = code;
            showPage('room-waiting-page');

            // Setup network handlers
            setupNetworkHandlers('w', false);

            updatePlayersList();

        } catch (err) {
            showToast('Failed to create room: ' + err.message, 'error');
        }
    });

    document.getElementById('copy-room-code').addEventListener('click', () => {
        const code = document.getElementById('room-code-value').textContent;
        navigator.clipboard.writeText(code).then(() => {
            showToast('Room code copied!', 'success');
        }).catch(() => {
            showToast('Copy failed. Code: ' + code, 'info');
        });
    });

    document.getElementById('join-room-btn').addEventListener('click', async () => {
        const code = document.getElementById('room-code-input').value.trim();
        if (!code) {
            showToast('Please enter a room code', 'error');
            return;
        }

        const asSpectator = document.getElementById('spectator-checkbox').checked;

        try {
            showToast('Joining room...', 'info');
            await window.networkManager.joinRoom(code, asSpectator);

            setupNetworkHandlers(asSpectator ? 'w' : 'b', asSpectator);

        } catch (err) {
            showToast('Failed to join room: ' + err.message, 'error');
        }
    });
}

function updatePlayersList() {
    const ul = document.getElementById('players-ul');
    if (!ul) return;

    ul.innerHTML = '<li>🟢 You (Host - White)</li>';

    const net = window.networkManager;
    net.connections.forEach(({ type, name }) => {
        const icon = type === 'spectator' ? '👁' : '🟢';
        const role = type === 'spectator' ? 'Spectator' : 'Player (Black)';
        ul.innerHTML += `<li>${icon} ${role}</li>`;
    });
}

// ===== NETWORK HANDLERS =====
function setupNetworkHandlers(playerColor, isSpectator) {
    const net = window.networkManager;

    net.onPlayerJoined = (peerId, type, name) => {
        showToast(`${type === 'spectator' ? 'Spectator' : 'Player'} joined!`, 'success');

        if (window.chatManager) {
            window.chatManager.addSystemMessage(`${type === 'spectator' ? 'A spectator' : 'A player'} has joined.`);
        }

        if (window.voiceChat) {
            window.voiceChat.onPeerJoined(peerId);
        }

        updatePlayersList();

        // If host and a player joined (not spectator), start the game
        if (net.isHost && type === 'player') {
            // Start game for host
            startNetworkGame('w', false);

            // Send game start to the joiner
            net.connections.forEach(({ conn, type: t }) => {
                if (t === 'player' && conn.open) {
                    conn.send({
                        type: 'game-start',
                        color: 'b',
                        spectator: false
                    });
                }
            });
        }
    };

    net.onPlayerDisconnected = (peerId) => {
        showToast('A player disconnected.', 'error');
        if (window.chatManager) {
            window.chatManager.addSystemMessage('A player disconnected.');
        }
        updatePlayersList();
    };

    net.onMoveReceived = (move) => {
        const gc = window.gameController;
        gc.applyMove(move);
    };

    net.onChatReceived = (message, sender) => {
        if (window.chatManager) {
            window.chatManager.addMessage(message, sender, false);
        }
    };

    net.onGameStart = (data) => {
        if (data.rematch) {
            // Rematch — swap colors
            const gc = window.gameController;
            const newColor = gc.playerColor === 'w' ? 'b' : 'w';
            startNetworkGame(newColor, false);
            return;
        }

        const color = data.color || playerColor;
        const spectator = data.spectator || isSpectator;
        startNetworkGame(color, spectator);
    };

    net.onStateSync = (data) => {
        const gc = window.gameController;
        const color = data.playerColor || playerColor;

        // Start game with synced state
        startNetworkGame(color, isSpectator);

        // Replay moves
        if (data.history && data.history.length > 0) {
            for (const move of data.history) {
                gc.applyMove(move);
            }
        }
    };

    net.onResign = (peerId) => {
        showToast('Opponent resigned!', 'info');
        const overlay = document.getElementById('game-over-overlay');
        const icon = document.getElementById('game-over-icon');
        const title = document.getElementById('game-over-title');
        const msg = document.getElementById('game-over-message');

        icon.textContent = '🏳️';
        title.textContent = 'Resignation';
        msg.textContent = 'Your opponent resigned. You win!';
        overlay.style.display = 'flex';
    };

    net.onDrawOffer = (peerId) => {
        if (confirm('Your opponent offers a draw. Accept?')) {
            // Accept draw
            const overlay = document.getElementById('game-over-overlay');
            const icon = document.getElementById('game-over-icon');
            const title = document.getElementById('game-over-title');
            const msg = document.getElementById('game-over-message');

            icon.textContent = '🤝';
            title.textContent = 'Draw';
            msg.textContent = 'Draw by agreement.';
            overlay.style.display = 'flex';

            // Notify opponent
            if (net.isHost) {
                net.connections.forEach(({ conn }) => {
                    if (conn.open) conn.send({ type: 'draw-accept' });
                });
            } else if (net.hostConnection?.open) {
                net.hostConnection.send({ type: 'draw-accept' });
            }
        }
    };
}

function startNetworkGame(color, isSpectator) {
    showPage('game-page');

    const gc = window.gameController;
    const boardEl = document.getElementById('chess-board');

    gc.board = new ChessBoard(boardEl, {
        flipped: color === 'b' && !isSpectator,
        interactive: !isSpectator,
        onMove: (from, to, promotion) => {
            if (!isSpectator && gc.isMyTurn()) {
                const move = gc.tryMove(from, to, promotion);
                if (move) {
                    window.networkManager.sendMove(move);
                }
            }
        }
    });

    gc.board.updateCoordinates();

    const mode = window.networkManager.connections.size > 0 || window.networkManager.hostConnection ? 'room' : 'multi';
    gc.newGame(mode, { color, spectator: isSpectator });

    // Initialize chat
    if (!window.chatManager) {
        window.chatManager = new ChatManager();
    }
    window.chatManager.clearMessages();
    window.chatManager.addSystemMessage('Connected! Chat is ready.');

    // Initialize voice
    if (!window.voiceChat) {
        window.voiceChat = new VoiceChat();
    }
}

// ===== GAME ACTIONS =====
function initGameActions() {
    document.getElementById('resign-btn').addEventListener('click', () => {
        const gc = window.gameController;
        if (gc.mode === 'ai') {
            if (confirm('Are you sure you want to resign?')) {
                const overlay = document.getElementById('game-over-overlay');
                const icon = document.getElementById('game-over-icon');
                const title = document.getElementById('game-over-title');
                const msg = document.getElementById('game-over-message');

                icon.textContent = '🏳️';
                title.textContent = 'You Resigned';
                msg.textContent = 'Better luck next time!';
                overlay.style.display = 'flex';
            }
        } else {
            if (confirm('Are you sure you want to resign?')) {
                window.networkManager.sendResign();
                const overlay = document.getElementById('game-over-overlay');
                const icon = document.getElementById('game-over-icon');
                const title = document.getElementById('game-over-title');
                const msg = document.getElementById('game-over-message');

                icon.textContent = '🏳️';
                title.textContent = 'You Resigned';
                msg.textContent = 'You resigned the game.';
                overlay.style.display = 'flex';
            }
        }
    });

    document.getElementById('draw-btn').addEventListener('click', () => {
        const gc = window.gameController;
        if (gc.mode === 'ai') {
            showToast('Cannot offer draw to AI', 'info');
        } else {
            window.networkManager.sendDrawOffer();
            showToast('Draw offer sent', 'info');
        }
    });

    document.getElementById('flip-btn').addEventListener('click', () => {
        const gc = window.gameController;
        if (gc.board) {
            gc.board.setFlipped(!gc.board.flipped);
            gc.board.updateCoordinates();
            gc.board.render(gc.chess);
        }
    });

    document.getElementById('rematch-btn').addEventListener('click', () => {
        const gc = window.gameController;
        document.getElementById('game-over-overlay').style.display = 'none';

        if (gc.mode === 'ai') {
            gc.newGame('ai', {
                color: gc.playerColor,
                depth: gc.aiDepth
            });
        } else {
            window.networkManager.sendRematch();
            // Swap colors
            const newColor = gc.playerColor === 'w' ? 'b' : 'w';
            startNetworkGame(newColor, gc.isSpectator);
        }
    });

    document.getElementById('home-btn').addEventListener('click', goHome);
}

// ===== BACK BUTTONS =====
function initBackButtons() {
    document.getElementById('ai-back-btn').addEventListener('click', goHome);
    document.getElementById('room-back-btn').addEventListener('click', goHome);
    document.getElementById('multi-back-btn').addEventListener('click', () => {
        window.networkManager.disconnect();
        // Reset UI
        document.getElementById('multi-code-display').style.display = 'none';
        document.getElementById('multi-waiting').style.display = 'none';
        document.getElementById('create-multi-game').style.display = 'block';
        goHome();
    });
    document.getElementById('waiting-back-btn').addEventListener('click', () => {
        window.networkManager.disconnect();
        goHome();
    });
}

// ===== MODE SELECTION =====
function initModeSelection() {
    document.getElementById('btn-singleplayer').addEventListener('click', () => {
        showPage('ai-setup-page');
    });

    document.getElementById('btn-multiplayer').addEventListener('click', () => {
        showPage('multi-setup-page');
    });

    document.getElementById('btn-room').addEventListener('click', () => {
        showPage('room-setup-page');
    });
}

// ===== KEYBOARD SHORTCUTS =====
function initKeyboard() {
    document.addEventListener('keydown', (e) => {
        // Escape to go home
        if (e.key === 'Escape') {
            const gamePage = document.getElementById('game-page');
            if (!gamePage.classList.contains('active')) {
                goHome();
            }
        }
    });
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initModeSelection();
    initAISetup();
    initMultiSetup();
    initRoomSetup();
    initPanelTabs();
    initGameActions();
    initBackButtons();
    initKeyboard();

    console.log('♔ Chess Arena loaded');
});
