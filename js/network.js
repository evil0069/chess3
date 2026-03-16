/* ===== NETWORK — PeerJS P2P Connections ===== */

class NetworkManager {
    constructor() {
        this.peer = null;
        this.connections = new Map(); // peerId -> { conn, type: 'player'|'spectator' }
        this.hostConnection = null; // Connection to host (if we're joining)
        this.isHost = false;
        this.roomCode = null;
        this.peerId = null;
        this.onMoveReceived = null;
        this.onChatReceived = null;
        this.onPlayerJoined = null;
        this.onPlayerDisconnected = null;
        this.onGameStart = null;
        this.onStateSync = null;
        this.onDrawOffer = null;
        this.onResign = null;
    }

    init() {
        return new Promise((resolve, reject) => {
            try {
                this.peer = new Peer(null, {
                    debug: 0
                });

                this.peer.on('open', (id) => {
                    this.peerId = id;
                    console.log('[Network] Peer ID:', id);
                    resolve(id);
                });

                this.peer.on('error', (err) => {
                    console.error('[Network] Peer error:', err);
                    if (err.type === 'peer-unavailable') {
                        showToast('Room not found. Check the code and try again.', 'error');
                    } else if (err.type === 'network' || err.type === 'server-error') {
                        showToast('Network error. Please try again.', 'error');
                    }
                });

                this.peer.on('connection', (conn) => {
                    this.handleIncomingConnection(conn);
                });

            } catch (e) {
                reject(e);
            }
        });
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    async createRoom(mode) {
        if (!this.peer) await this.init();

        this.isHost = true;
        // Use a deterministic peer ID based on room code for discoverability
        this.roomCode = this.generateRoomCode();

        // Destroy old peer and create with room-based ID
        this.peer.destroy();

        return new Promise((resolve, reject) => {
            const roomPeerId = 'chess-arena-' + this.roomCode;
            this.peer = new Peer(roomPeerId, { debug: 0 });

            this.peer.on('open', (id) => {
                this.peerId = id;
                console.log('[Network] Room created:', this.roomCode, 'Peer:', id);
                resolve(this.roomCode);
            });

            this.peer.on('error', (err) => {
                console.error('[Network] Room creation error:', err);
                if (err.type === 'unavailable-id') {
                    // Room code collision, try again
                    this.roomCode = this.generateRoomCode();
                    const newId = 'chess-arena-' + this.roomCode;
                    this.peer = new Peer(newId, { debug: 0 });
                    this.peer.on('open', (id) => {
                        this.peerId = id;
                        resolve(this.roomCode);
                    });
                    this.peer.on('connection', (conn) => this.handleIncomingConnection(conn));
                } else {
                    reject(err);
                }
            });

            this.peer.on('connection', (conn) => {
                this.handleIncomingConnection(conn);
            });
        });
    }

    async joinRoom(code, asSpectator = false) {
        if (!this.peer) await this.init();

        this.isHost = false;
        this.roomCode = code.toUpperCase();

        return new Promise((resolve, reject) => {
            const hostPeerId = 'chess-arena-' + this.roomCode;
            const conn = this.peer.connect(hostPeerId, {
                metadata: {
                    type: asSpectator ? 'spectator' : 'player',
                    name: asSpectator ? 'Spectator' : 'Player'
                },
                reliable: true
            });

            conn.on('open', () => {
                this.hostConnection = conn;
                console.log('[Network] Connected to room:', this.roomCode);
                resolve(conn);
            });

            conn.on('data', (data) => {
                this.handleData(data, conn);
            });

            conn.on('close', () => {
                console.log('[Network] Disconnected from room');
                if (this.onPlayerDisconnected) this.onPlayerDisconnected('host');
                showToast('Disconnected from room.', 'error');
            });

            conn.on('error', (err) => {
                console.error('[Network] Join error:', err);
                reject(err);
            });

            // Timeout
            setTimeout(() => {
                if (!conn.open) {
                    reject(new Error('Connection timeout'));
                }
            }, 10000);
        });
    }

    handleIncomingConnection(conn) {
        const type = conn.metadata?.type || 'player';
        const name = conn.metadata?.name || 'Player';

        console.log('[Network] Incoming connection:', type, conn.peer);

        conn.on('open', () => {
            this.connections.set(conn.peer, { conn, type, name });

            if (this.onPlayerJoined) {
                this.onPlayerJoined(conn.peer, type, name);
            }

            // If game is in progress, send state sync
            if (window.gameController && window.gameController.chess) {
                conn.send({
                    type: 'state-sync',
                    fen: window.gameController.getFen(),
                    history: window.gameController.moveHistory.map(m => ({
                        from: m.from,
                        to: m.to,
                        promotion: m.promotion
                    })),
                    playerColor: type === 'player' ? 'b' : null // Second player gets black
                });
            }
        });

        conn.on('data', (data) => {
            this.handleData(data, conn);
        });

        conn.on('close', () => {
            this.connections.delete(conn.peer);
            if (this.onPlayerDisconnected) {
                this.onPlayerDisconnected(conn.peer);
            }
        });
    }

    handleData(data, conn) {
        switch (data.type) {
            case 'move':
                if (this.onMoveReceived) this.onMoveReceived(data.move);
                // Relay to spectators if host
                if (this.isHost) this.broadcastToSpectators(data);
                break;

            case 'chat':
                if (this.onChatReceived) this.onChatReceived(data.message, data.sender);
                // Relay chat to all
                if (this.isHost) this.broadcastExcept(data, conn.peer);
                break;

            case 'state-sync':
                if (this.onStateSync) this.onStateSync(data);
                break;

            case 'game-start':
                if (this.onGameStart) this.onGameStart(data);
                break;

            case 'draw-offer':
                if (this.onDrawOffer) this.onDrawOffer(conn.peer);
                break;

            case 'draw-accept':
                showToast('Draw accepted!', 'info');
                break;

            case 'resign':
                if (this.onResign) this.onResign(conn.peer);
                break;

            case 'rematch':
                if (this.onGameStart) this.onGameStart({ rematch: true });
                break;
        }
    }

    sendMove(move) {
        const data = {
            type: 'move',
            move: { from: move.from, to: move.to, promotion: move.promotion }
        };

        if (this.isHost) {
            // Send to all connections
            this.connections.forEach(({ conn }) => {
                if (conn.open) conn.send(data);
            });
        } else if (this.hostConnection && this.hostConnection.open) {
            this.hostConnection.send(data);
        }
    }

    sendChat(message, sender) {
        const data = { type: 'chat', message, sender };

        if (this.isHost) {
            this.connections.forEach(({ conn }) => {
                if (conn.open) conn.send(data);
            });
        } else if (this.hostConnection && this.hostConnection.open) {
            this.hostConnection.send(data);
        }
    }

    sendResign() {
        const data = { type: 'resign' };
        if (this.isHost) {
            this.connections.forEach(({ conn }) => {
                if (conn.open) conn.send(data);
            });
        } else if (this.hostConnection?.open) {
            this.hostConnection.send(data);
        }
    }

    sendDrawOffer() {
        const data = { type: 'draw-offer' };
        if (this.isHost) {
            this.connections.forEach(({ conn, type }) => {
                if (type === 'player' && conn.open) conn.send(data);
            });
        } else if (this.hostConnection?.open) {
            this.hostConnection.send(data);
        }
    }

    sendRematch() {
        const data = { type: 'rematch' };
        if (this.isHost) {
            this.connections.forEach(({ conn }) => {
                if (conn.open) conn.send(data);
            });
        } else if (this.hostConnection?.open) {
            this.hostConnection.send(data);
        }
    }

    broadcastToSpectators(data) {
        this.connections.forEach(({ conn, type }) => {
            if (type === 'spectator' && conn.open) {
                conn.send(data);
            }
        });
    }

    broadcastExcept(data, excludePeerId) {
        this.connections.forEach(({ conn }, peerId) => {
            if (peerId !== excludePeerId && conn.open) {
                conn.send(data);
            }
        });
    }

    getPlayerCount() {
        let count = 1; // Self
        this.connections.forEach(({ type }) => {
            if (type === 'player') count++;
        });
        return count;
    }

    getSpectatorCount() {
        let count = 0;
        this.connections.forEach(({ type }) => {
            if (type === 'spectator') count++;
        });
        return count;
    }

    disconnect() {
        if (this.hostConnection) {
            this.hostConnection.close();
            this.hostConnection = null;
        }
        this.connections.forEach(({ conn }) => conn.close());
        this.connections.clear();
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        this.isHost = false;
        this.roomCode = null;
    }
}

// Global instance
window.networkManager = new NetworkManager();
