/**
 * Módulo de Avatar Interativo
 * Suporta animação por estados (idle, listening, thinking, speaking)
 * e integração com áudio/síntese de voz.
 */
class InteractiveAvatar {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error(`[Avatar] Contêiner #${containerId} não encontrado.`);
            return;
        }

        this.options = Object.assign({
            avatarUrl: options.avatarUrl || null, // Caminho para modelo GLB se existente
            primaryColor: '#0078d4',
            secondaryColor: '#00bcf2',
            size: 180
        }, options);

        this.currentState = 'idle';
        this.animationFrame = null;
        this.audioContext = null;
        this.analyser = null;

        this.init();
    }

    init() {
        this.container.innerHTML = '';
        this.container.classList.add('avatar-container');
        
        // Canvas de renderização
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.size;
        this.canvas.height = this.options.size;
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // Estado visual extra (badge de status)
        this.statusBadge = document.createElement('div');
        this.statusBadge.className = 'avatar-status-badge idle';
        this.container.appendChild(this.statusBadge);

        this.startAnimationLoop();
    }

    setState(newState) {
        const validStates = ['idle', 'listening', 'thinking', 'speaking'];
        if (!validStates.includes(newState)) return;

        this.currentState = newState;
        this.statusBadge.className = `avatar-status-badge ${newState}`;
        console.log(`[Avatar] Estado alterado para: ${newState}`);
    }

    attachAudioSource(mediaStreamOrAudioElement) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioCtx();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64;

            let source;
            if (mediaStreamOrAudioElement instanceof MediaStream) {
                source = this.audioContext.createMediaStreamSource(mediaStreamOrAudioElement);
            } else if (mediaStreamOrAudioElement instanceof HTMLAudioElement) {
                source = this.audioContext.createMediaElementSource(mediaStreamOrAudioElement);
            }

            if (source) {
                source.connect(this.analyser);
                if (mediaStreamOrAudioElement instanceof HTMLAudioElement) {
                    this.analyser.connect(this.audioContext.destination);
                }
            }
        } catch (e) {
            console.warn('[Avatar] Não foi possível conectar fonte de áudio:', e);
        }
    }

    getAudioAmplitude() {
        if (!this.analyser) return 0;
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        return sum / dataArray.length / 255; // Normalizado entre 0 e 1
    }

    startAnimationLoop() {
        let time = 0;

        const render = () => {
            time += 0.05;
            const width = this.canvas.width;
            const height = this.canvas.height;
            const centerX = width / 2;
            const centerY = height / 2;
            const baseRadius = width * 0.35;

            this.ctx.clearRect(0, 0, width, height);

            let currentRadius = baseRadius;
            let pulseOffset = Math.sin(time * 2) * 4;

            // Reatividade por estado
            if (this.currentState === 'idle') {
                currentRadius = baseRadius + pulseOffset;
            } else if (this.currentState === 'listening') {
                currentRadius = baseRadius + Math.sin(time * 5) * 8;
            } else if (this.currentState === 'thinking') {
                currentRadius = baseRadius;
            } else if (this.currentState === 'speaking') {
                const amp = this.getAudioAmplitude();
                currentRadius = baseRadius + (amp > 0 ? amp * 25 : Math.sin(time * 8) * 10);
            }

            // Desenhar aura externa
            const gradient = this.ctx.createRadialGradient(centerX, centerY, currentRadius * 0.5, centerX, centerY, currentRadius * 1.2);
            gradient.addColorStop(0, this.options.primaryColor);
            gradient.addColorStop(1, 'transparent');

            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, currentRadius * 1.2, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.globalAlpha = 0.4;
            this.ctx.fill();

            // Desenhar núcleo do avatar
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = this.options.primaryColor;
            this.ctx.globalAlpha = 1.0;
            this.ctx.fill();

            // Elementos faciais mínimos (Olhos interativos)
            const eyeOffset = currentRadius * 0.3;
            const eyeY = centerY - currentRadius * 0.1;
            const eyeRadius = currentRadius * 0.1;

            // Piscar periódico
            const isBlinking = Math.sin(time * 0.8) > 0.98;

            this.ctx.fillStyle = '#ffffff';
            if (!isBlinking) {
                // Olho esquerdo
                this.ctx.beginPath();
                this.ctx.arc(centerX - eyeOffset, eyeY, eyeRadius, 0, Math.PI * 2);
                this.ctx.fill();

                // Olho direito
                this.ctx.beginPath();
                this.ctx.arc(centerX + eyeOffset, eyeY, eyeRadius, 0, Math.PI * 2);
                this.ctx.fill();
            } else {
                // Linhas de olhos fechados
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.beginPath();
                this.ctx.moveTo(centerX - eyeOffset - eyeRadius, eyeY);
                this.ctx.lineTo(centerX - eyeOffset + eyeRadius, eyeY);
                this.ctx.moveTo(centerX + eyeOffset - eyeRadius, eyeY);
                this.ctx.lineTo(centerX + eyeOffset + eyeRadius, eyeY);
                this.ctx.stroke();
            }

            // Boca reativa para fala
            const mouthY = centerY + currentRadius * 0.3;
            this.ctx.beginPath();
            if (this.currentState === 'speaking') {
                const mouthOpen = 2 + (currentRadius - baseRadius);
                this.ctx.ellipse(centerX, mouthY, eyeOffset * 0.8, Math.max(2, mouthOpen), 0, 0, Math.PI * 2);
                this.ctx.fillStyle = '#ffffff';
                this.ctx.fill();
            } else {
                this.ctx.arc(centerX, mouthY - 2, eyeOffset * 0.5, 0, Math.PI);
                this.ctx.lineWidth = 2;
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.stroke();
            }

            this.animationFrame = requestAnimationFrame(render);
        };

        render();
    }

    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        if (this.audioContext) {
            this.audioContext.close();
        }
        this.container.innerHTML = '';
    }
}
