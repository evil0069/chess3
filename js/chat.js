/* ===== TEXT CHAT MODULE ===== */

class ChatManager {
    constructor() {
        this.messagesEl = document.getElementById('chat-messages');
        this.inputEl = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('chat-send-btn');
        this.badgeEl = document.getElementById('chat-badge');
        this.tabBtn = document.getElementById('tab-chat');
        this.unreadCount = 0;
        this.isActive = false;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    sendMessage() {
        const text = this.inputEl.value.trim();
        if (!text) return;

        this.addMessage(text, 'You', true);
        this.inputEl.value = '';

        // Send via network
        if (window.networkManager) {
            window.networkManager.sendChat(text, 'Opponent');
        }
    }

    addMessage(text, sender, isSelf = false) {
        const msgEl = document.createElement('div');
        msgEl.className = `chat-msg${isSelf ? ' self' : ''}`;

        const now = new Date();
        const time = now.getHours().toString().padStart(2, '0') + ':' +
            now.getMinutes().toString().padStart(2, '0');

        msgEl.innerHTML = `
            <span class="chat-msg-sender">${sender}</span>
            <span class="chat-msg-text">${this.escapeHtml(text)}</span>
            <span class="chat-msg-time">${time}</span>
        `;

        this.messagesEl.appendChild(msgEl);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;

        // Update badge if chat tab is not active
        if (!isSelf && !this.isActive) {
            this.unreadCount++;
            this.badgeEl.textContent = this.unreadCount;
            this.badgeEl.style.display = 'inline';

            // Play notification sound
            this.playNotifSound();
        }
    }

    addSystemMessage(text) {
        const msgEl = document.createElement('div');
        msgEl.className = 'chat-system-msg';
        msgEl.textContent = text;
        this.messagesEl.appendChild(msgEl);
        this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    setActive(active) {
        this.isActive = active;
        if (active) {
            this.unreadCount = 0;
            this.badgeEl.style.display = 'none';
        }
    }

    clearMessages() {
        this.messagesEl.innerHTML = '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    playNotifSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            osc.type = 'sine';
            gain.gain.value = 0.06;
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
        } catch (e) { }
    }
}

// Global instance (initialized in app.js)
window.chatManager = null;
