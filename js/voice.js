/* ===== VOICE CHAT MODULE (WebRTC via PeerJS) ===== */

class VoiceChat {
    constructor() {
        this.localStream = null;
        this.calls = new Map(); // peerId -> MediaConnection
        this.isActive = false;
        this.isMuted = false;

        this.toggleBtn = document.getElementById('voice-toggle-btn');
        this.voiceIcon = this.toggleBtn.querySelector('.voice-icon');
        this.voiceStatus = this.toggleBtn.querySelector('.voice-status');

        this.toggleBtn.addEventListener('click', () => this.toggle());
    }

    async toggle() {
        if (this.isActive) {
            this.stop();
        } else {
            await this.start();
        }
    }

    async start() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });

            this.isActive = true;
            this.updateUI();

            // Call all connected peers
            const net = window.networkManager;
            if (!net || !net.peer) return;

            if (net.isHost) {
                net.connections.forEach(({ conn }, peerId) => {
                    this.callPeer(peerId);
                });
            } else if (net.hostConnection) {
                // Call the host
                const hostPeerId = 'chess-arena-' + net.roomCode;
                this.callPeer(hostPeerId);
            }

            // Listen for incoming calls
            net.peer.on('call', (call) => {
                call.answer(this.localStream);
                this.handleCall(call);
            });

            showToast('Voice chat enabled', 'success');

        } catch (err) {
            console.error('[Voice] Error:', err);
            if (err.name === 'NotAllowedError') {
                showToast('Microphone permission denied', 'error');
            } else {
                showToast('Could not start voice chat', 'error');
            }
        }
    }

    callPeer(peerId) {
        const net = window.networkManager;
        if (!net.peer || !this.localStream) return;

        const call = net.peer.call(peerId, this.localStream);
        if (call) {
            this.handleCall(call);
        }
    }

    handleCall(call) {
        call.on('stream', (remoteStream) => {
            // Play remote audio
            const audio = new Audio();
            audio.srcObject = remoteStream;
            audio.play().catch(() => { });
            this.calls.set(call.peer, { call, audio });
        });

        call.on('close', () => {
            if (this.calls.has(call.peer)) {
                const { audio } = this.calls.get(call.peer);
                if (audio) audio.pause();
                this.calls.delete(call.peer);
            }
        });
    }

    stop() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }

        this.calls.forEach(({ call, audio }) => {
            call.close();
            if (audio) audio.pause();
        });
        this.calls.clear();

        this.isActive = false;
        this.isMuted = false;
        this.updateUI();
        showToast('Voice chat disabled', 'info');
    }

    toggleMute() {
        if (!this.localStream) return;
        this.isMuted = !this.isMuted;
        this.localStream.getAudioTracks().forEach(t => {
            t.enabled = !this.isMuted;
        });
        this.updateUI();
    }

    updateUI() {
        if (this.isActive) {
            this.toggleBtn.classList.add('active');
            this.toggleBtn.classList.remove('muted');
            this.voiceIcon.textContent = this.isMuted ? '🔇' : '🎤';
            this.voiceStatus.textContent = this.isMuted ? 'Muted' : 'On';

            if (this.isMuted) {
                this.toggleBtn.classList.add('muted');
                this.toggleBtn.classList.remove('active');
            }
        } else {
            this.toggleBtn.classList.remove('active', 'muted');
            this.voiceIcon.textContent = '🎤';
            this.voiceStatus.textContent = 'Off';
        }
    }

    // Call new peer when they join
    onPeerJoined(peerId) {
        if (this.isActive && this.localStream) {
            setTimeout(() => this.callPeer(peerId), 500);
        }
    }

    cleanup() {
        this.stop();
    }
}

// Global instance (initialized in app.js)
window.voiceChat = null;
