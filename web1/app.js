// ==========================================
// 1. انیمیشن اسپلاش اسکرین و پس‌زمینه
// ==========================================
function initSplashScreen() {
    const canvas = document.getElementById('splash-canvas');
    const ctx = canvas.getContext('2d');
    const splashScreen = document.getElementById('splash-screen');
    const dashboard = document.getElementById('dashboard');
    
    function resize() { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
    window.addEventListener('resize', resize); resize();

    let progress = 0; let startTime = null; const duration = 1600;

    function draw(timestamp) {
        if (!startTime) startTime = timestamp;
        let elapsed = timestamp - startTime;
        progress = Math.min(elapsed / duration, 1);
        let easedProgress = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2; const cy = canvas.height / 2; const baseSize = Math.min(cx, cy) * 0.3;
        let scale = 0; let speakerAlpha = 0;

        if (easedProgress < 0.3) { let p = easedProgress / 0.3; scale = 0.6 + 0.4 * p; speakerAlpha = p; } 
        else if (easedProgress < 0.6) { scale = 1; speakerAlpha = 1; } 
        else if (easedProgress < 0.8) { let p = (easedProgress - 0.6) / 0.2; scale = 1 + 0.2 * p; speakerAlpha = 1 - p; }

        if (speakerAlpha > 0) {
            ctx.save(); ctx.translate(cx, cy); ctx.scale(scale, scale);
            ctx.beginPath(); ctx.moveTo(-baseSize, -baseSize * 0.3); ctx.lineTo(-baseSize * 0.4, -baseSize * 0.3);
            ctx.lineTo(baseSize * 0.3, -baseSize * 0.9); ctx.lineTo(baseSize * 0.3, baseSize * 0.9);
            ctx.lineTo(-baseSize * 0.4, baseSize * 0.3); ctx.lineTo(-baseSize, baseSize * 0.3); ctx.closePath();
            ctx.fillStyle = `rgba(0, 255, 255, ${speakerAlpha})`; ctx.fill(); ctx.restore();
        }

        if (easedProgress > 0.2 && easedProgress < 0.8) {
            let wp = (easedProgress - 0.2) / 0.6; let maxRadius = Math.hypot(cx, cy);
            let radius = baseSize + (maxRadius * wp); let baseAlpha = 1 - wp;
            ctx.beginPath(); ctx.arc(cx + baseSize * 0.3, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 0, 255, ${baseAlpha * 0.4})`; ctx.lineWidth = 16; ctx.stroke();
            ctx.strokeStyle = `rgba(255, 255, 255, ${baseAlpha})`; ctx.lineWidth = 6; ctx.stroke();
        }

        if (progress < 1) requestAnimationFrame(draw);
        else {
            splashScreen.style.opacity = '0';
            setTimeout(() => { splashScreen.style.display = 'none'; dashboard.classList.add('active'); }, 500);
        }
    }
    requestAnimationFrame(draw);
}

function initQuantumGrid() {
    const canvas = document.getElementById('quantum-grid');
    const ctx = canvas.getContext('2d');
    function resize() { canvas.width = canvas.parentElement.clientWidth; canvas.height = canvas.parentElement.clientHeight; }
    window.addEventListener('resize', resize); resize();

    const particles = []; const colors = ['#00FFFF', '#FF00FF', '#00FF66'];
    for (let i = 0; i < 25; i++) {
        particles.push({ x: Math.random(), y: Math.random(), speed: 0.001 + Math.random() * 0.003, size: 2 + Math.random() * 5, phase: Math.random() * Math.PI * 2, color: colors[Math.floor(Math.random() * colors.length)] });
    }
    let globalTime = 0; let gridOffset = 0;

    function draw() {
        ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const cx = canvas.width / 2; const horizonY = canvas.height * 0.35;
        const grad = ctx.createRadialGradient(cx, horizonY, 0, cx, horizonY, canvas.width * 0.8);
        grad.addColorStop(0, 'rgba(255, 0, 255, 0.07)'); grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

        globalTime += 0.02; gridOffset += 0.01; if (gridOffset > 1) gridOffset = 0;

        particles.forEach(p => {
            p.y -= p.speed; if (p.y < 0) { p.y = 1; p.x = Math.random(); }
            let px = p.x * canvas.width; let py = p.y * canvas.height;
            let alpha = (Math.sin(p.phase + globalTime) + 1) / 2;
            ctx.globalAlpha = alpha * 0.3; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(px, py, p.size * 3, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(px, py, p.size, 0, Math.PI * 2); ctx.fill();
        });

        ctx.strokeStyle = '#00FFFF';
        for (let i = -8; i <= 8; i++) {
            ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.moveTo(cx, horizonY); ctx.lineTo(cx + (i * canvas.width * 0.2), canvas.height); ctx.stroke();
        }
        for (let i = 0; i < 14; i++) {
            let progress = (i + gridOffset) / 14;
            let py = horizonY + (canvas.height - horizonY) * (progress * progress * progress);
            ctx.globalAlpha = progress * 0.5; ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(canvas.width, py); ctx.stroke();
        }
        ctx.globalAlpha = 1; requestAnimationFrame(draw);
    }
    draw();
}

// ==========================================
// 2. موتور صوتی (Audio Engine)
// ==========================================
class AudioEngine {
    constructor() {
        this.ctx = null; this.oscillator = null; this.gainNode = null; this.waveShaper = null;
        this.amNode = null; this.amOsc = null;
        this.isPlaying = false; this.sweepInterval = null;
    }
    init() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    // شبیه‌سازی دقیق Math.tanh اندروید برای خشن کردن صدا
    makeTanhCurve() {
        const n_samples = 44100; const curve = new Float32Array(n_samples);
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = Math.tanh(x * 2.5);
        }
        return curve;
    }
    play(freq, type = 'sine') {
        this.init(); this.stop(); 
        this.oscillator = this.ctx.createOscillator(); this.gainNode = this.ctx.createGain();
        this.oscillator.type = type; this.oscillator.frequency.setValueAtTime(freq, this.ctx.currentTime);
        this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.05);

        this.waveShaper = this.ctx.createWaveShaper();
        this.waveShaper.curve = this.makeTanhCurve();
        this.waveShaper.oversample = '4x';

        this.oscillator.connect(this.waveShaper); this.waveShaper.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        this.oscillator.start(); this.isPlaying = true;
    }
    // پخش با پالس (AM) برای هشدار حیوانات و اسپیکر
    playPulse(freq, type = 'sine', amFreq = 2.5) {
        this.init(); this.stop();
        this.oscillator = this.ctx.createOscillator();
        this.oscillator.type = type; this.oscillator.frequency.value = freq;

        this.amNode = this.ctx.createGain(); this.amNode.gain.value = 0.5;
        this.amOsc = this.ctx.createOscillator(); this.amOsc.type = 'square'; this.amOsc.frequency.value = amFreq;
        
        const lfoScale = this.ctx.createGain(); lfoScale.gain.value = 0.5;
        this.amOsc.connect(lfoScale); lfoScale.connect(this.amNode.gain);

        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.05);

        this.waveShaper = this.ctx.createWaveShaper();
        this.waveShaper.curve = this.makeTanhCurve();
        this.waveShaper.oversample = '4x';

        this.oscillator.connect(this.amNode); this.amNode.connect(this.waveShaper);
        this.waveShaper.connect(this.gainNode); this.gainNode.connect(this.ctx.destination);

        this.oscillator.start(); this.amOsc.start(); this.isPlaying = true;
    }
    stop() {
        this.stopSweep();
        if (this.oscillator && this.isPlaying) {
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.ctx.currentTime);
            this.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
            const osc = this.oscillator; const amOsc = this.amOsc;
            setTimeout(() => { 
                try { osc.stop(); osc.disconnect(); } catch (e) {} 
                try { if(amOsc) { amOsc.stop(); amOsc.disconnect(); } } catch (e) {} 
            }, 50);
            this.isPlaying = false;
        }
    }
    setFrequency(freq) {
        if (this.oscillator && this.isPlaying) this.oscillator.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    }
    setWaveform(type) {
        if (this.oscillator && this.isPlaying) {
            const freq = this.oscillator.frequency.value; this.play(freq, type);
        }
    }
    startSweep(minFreq, maxFreq, step, speedMs, type = 'sine') {
        this.play(minFreq, type);
        let currentFreq = minFreq; let up = true;
        this.sweepInterval = setInterval(() => {
            if (up) { currentFreq += step * (1000/speedMs); if (currentFreq >= maxFreq) up = false; } 
            else { currentFreq -= step * (1000/speedMs); if (currentFreq <= minFreq) up = true; }
            this.oscillator.frequency.linearRampToValueAtTime(currentFreq, this.ctx.currentTime + (speedMs/1000));
        }, speedMs);
    }
    stopSweep() {
        if (this.sweepInterval) { clearInterval(this.sweepInterval); this.sweepInterval = null; }
    }
}
const audio = new AudioEngine();

// موتور صوتی حیوانات (کنسول آموزش) - شبیه‌سازی دقیق بافر PCM اندروید
class PetAudioEngine {
    constructor() {
        this.ctx = null; this.source = null; this.osc = null; this.gain = null; this.lfo = null;
    }
    init() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }
    stop() {
        if (this.source) { try { this.source.stop(); this.source.disconnect(); } catch(e){} this.source = null; }
        if (this.osc) { try { this.osc.stop(); this.osc.disconnect(); } catch(e){} this.osc = null; }
        if (this.lfo) { try { this.lfo.stop(); this.lfo.disconnect(); } catch(e){} this.lfo = null; }
        if (this.gain) { try { this.gain.disconnect(); } catch(e){} this.gain = null; }
    }
    playBuffer(duration, generatorFunc) {
        this.init(); this.stop();
        const sampleRate = this.ctx.sampleRate;
        const length = Math.floor(sampleRate * duration);
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) data[i] = generatorFunc(i / sampleRate);
        this.source = this.ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.connect(this.ctx.destination);
        this.source.start();
    }
    playClick() {
        this.playBuffer(0.08, (time) => {
            let env = Math.exp(-time * 120);
            let noise = (Math.random() * 2.0) - 1.0;
            let highFreq = Math.sin(2 * Math.PI * 16000 * time);
            let mechFreq = Math.sin(2 * Math.PI * 2500 * time);
            return ((noise * 0.3) + (highFreq * 0.5) + (mechFreq * 0.2)) * env;
        });
    }
    playAttention() {
        this.playBuffer(0.3, (time) => {
            let freq = 8000 + (4000 * (time / 0.3));
            let env = Math.sin(Math.PI * (time / 0.3));
            return Math.sin(2 * Math.PI * freq * time) * env;
        });
    }
    playNo() {
        this.playBuffer(0.4, (time) => {
            let freq = 250;
            let val = 2.0 * (time * freq - Math.floor(time * freq + 0.5));
            let env = time < 0.1 ? (time / 0.1) : (time > 0.3 ? (0.4 - time) / 0.1 : 1.0);
            return val * env * 0.5;
        });
    }
    playSit() {
        this.playBuffer(0.3, (time) => {
            let env = 0;
            if (time < 0.1) env = Math.sin(Math.PI * (time / 0.1));
            else if (time > 0.2) env = Math.sin(Math.PI * ((time - 0.2) / 0.1));
            return Math.sin(2 * Math.PI * 12000 * time) * env;
        });
    }
    playStay() {
        this.playBuffer(0.8, (time) => {
            let env = time < 0.1 ? (time / 0.1) : (time > 0.7 ? (0.8 - time) / 0.1 : 1.0);
            return Math.sin(2 * Math.PI * 10000 * time) * env;
        });
    }
    startCome() {
        this.init(); this.stop();
        this.osc = this.ctx.createOscillator(); this.gain = this.ctx.createGain(); this.lfo = this.ctx.createOscillator();
        this.osc.type = 'sine'; this.osc.frequency.value = 11000;
        this.lfo.type = 'sine'; this.lfo.frequency.value = 4;
        let lfoGain = this.ctx.createGain(); lfoGain.gain.value = 1000;
        this.lfo.connect(lfoGain); lfoGain.connect(this.osc.frequency);
        this.gain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.gain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + 0.1);
        this.osc.connect(this.gain); this.gain.connect(this.ctx.destination);
        this.osc.start(); this.lfo.start();
    }
    stopCome() {
        if (this.gain) {
            this.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
            setTimeout(() => this.stop(), 100);
        }
    }
}
const petAudio = new PetAudioEngine();

// ==========================================
// 3. انیمیشن‌های سه‌بعدی ابزارها (Canvas)
// ==========================================

class OscilloscopeAnim {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.isActive = false; this.freq = 440; this.type = 'sine'; this.color = '#00FFFF'; this.phase = 0;
        this.resize(); window.addEventListener('resize', () => this.resize());
    }
    resize() { this.canvas.width = this.canvas.parentElement.clientWidth; this.canvas.height = 220; }
    update(active, freq, type, color) { this.isActive = active; this.freq = freq; this.type = type; this.color = color; }
    draw() {
        const w = this.canvas.width; const h = this.canvas.height; const cx = w / 2; const cy = h / 2;
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)'; this.ctx.fillRect(0, 0, w, h);
        this.ctx.strokeStyle = this.isActive ? this.color : '#333'; this.ctx.globalAlpha = this.isActive ? 0.3 : 0.1; this.ctx.lineWidth = 1;
        
        const perspectiveY = h * 0.7;
        for (let i = 1; i <= 8; i++) {
            let yOffset = Math.pow(i, 1.5) * 10;
            if (perspectiveY + yOffset < h) { this.ctx.beginPath(); this.ctx.moveTo(0, perspectiveY + yOffset); this.ctx.lineTo(w, perspectiveY + yOffset); this.ctx.stroke(); }
            if (perspectiveY - yOffset > 0) { this.ctx.beginPath(); this.ctx.moveTo(0, perspectiveY - yOffset); this.ctx.lineTo(w, perspectiveY - yOffset); this.ctx.stroke(); }
        }
        for (let angle = 10; angle < 180; angle += 20) {
            let rad = angle * Math.PI / 180; let dx = Math.cos(rad) * w; let dy = Math.sin(rad) * h;
            this.ctx.beginPath(); this.ctx.moveTo(cx - dx, perspectiveY - dy); this.ctx.lineTo(cx + dx, perspectiveY + dy); this.ctx.stroke();
        }

        this.ctx.globalAlpha = 1; this.ctx.strokeStyle = this.isActive ? this.color : '#FFF'; this.ctx.lineWidth = 3; this.ctx.beginPath();
        let visibleCycles = Math.max(1, Math.min(15, this.freq / 150.0)); let amplitude = h * 0.25;
        if (this.isActive) this.phase += 0.1;

        for (let x = 0; x < w; x++) {
            let t = x / w; let p = (t * visibleCycles * Math.PI * 2) - (this.isActive ? this.phase : 0);
            let signal = 0;
            if (this.type === 'sine') signal = Math.sin(p);
            else if (this.type === 'square') signal = Math.sin(p) > 0 ? 1 : -1;
            else if (this.type === 'sawtooth') signal = 2 * ((p % (2 * Math.PI)) / (2 * Math.PI)) - 1;
            else if (this.type === 'triangle') signal = 2 * Math.abs(2 * ((p % (2 * Math.PI)) / (2 * Math.PI)) - 1) - 1;
            let y = cy - (signal * amplitude);
            if (x === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y);
        }
        this.ctx.stroke();
        if (this.isActive) { this.ctx.shadowBlur = 15; this.ctx.shadowColor = this.color; this.ctx.stroke(); this.ctx.shadowBlur = 0; }
    }
}

class RadarAnim {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.isActive = false; this.waves = [{p: 0}, {p: 0.33}, {p: 0.66}]; this.globalTime = 0;
        this.resize(); window.addEventListener('resize', () => this.resize());
    }
    resize() { this.canvas.width = this.canvas.parentElement.clientWidth; this.canvas.height = 220; }
    draw() {
        const w = this.canvas.width; const h = this.canvas.height; const cx = w / 2; const cy = h / 2;
        this.ctx.clearRect(0, 0, w, h);
        let maxRx = w * 0.45; let maxRy = maxRx * 0.35;

        if (this.isActive) {
            this.globalTime += 0.05;
            this.waves.forEach(wave => {
                wave.p += 0.01; if (wave.p > 1) wave.p = 0;
                let easeOut = Math.sin(wave.p * Math.PI / 2);
                let rx = maxRx * easeOut; let ry = maxRy * easeOut; let alpha = 1 - wave.p;
                this.ctx.beginPath(); this.ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                this.ctx.strokeStyle = `rgba(255, 51, 102, ${alpha})`; this.ctx.lineWidth = 2 + (10 * wave.p); this.ctx.stroke();
            });
            let pulse = 1 + 0.2 * Math.sin(this.globalTime);
            this.ctx.beginPath(); this.ctx.arc(cx, cy, 15 * pulse, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 51, 102, 0.5)'; this.ctx.fill();
            this.ctx.beginPath(); this.ctx.arc(cx, cy, 6, 0, Math.PI * 2); this.ctx.fillStyle = '#FFF'; this.ctx.fill();
        } else {
            this.ctx.beginPath(); this.ctx.ellipse(cx, cy, maxRx, maxRy, 0, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(255, 51, 102, 0.2)'; this.ctx.lineWidth = 2; this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.arc(cx, cy, 10, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 51, 102, 0.3)'; this.ctx.fill();
        }
    }
}

class EmitterAnim {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.isActive = false; this.angle = 0; this.globalTime = 0;
        this.resize(); window.addEventListener('resize', () => this.resize());
    }
    resize() { this.canvas.width = this.canvas.parentElement.clientWidth; this.canvas.height = 220; }
    draw() {
        const w = this.canvas.width; const h = this.canvas.height; const cx = w / 2; const cy = h / 2;
        this.ctx.clearRect(0, 0, w, h);
        this.ctx.save(); this.ctx.translate(cx, cy); this.ctx.scale(1, 0.6);
        let maxR = Math.min(cx, cy) * 0.85;

        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)'; this.ctx.lineWidth = 2;
        for (let i = 1; i <= 4; i++) { this.ctx.beginPath(); this.ctx.arc(0, 0, maxR * (i / 4), 0, Math.PI * 2); this.ctx.stroke(); }
        this.ctx.beginPath(); this.ctx.moveTo(-maxR, 0); this.ctx.lineTo(maxR, 0); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.moveTo(0, -maxR); this.ctx.lineTo(0, maxR); this.ctx.stroke();

        if (this.isActive) {
            this.angle += 0.05; this.globalTime += 0.05;
            this.ctx.save(); this.ctx.rotate(this.angle);
            this.ctx.beginPath(); this.ctx.moveTo(0, 0); this.ctx.arc(0, 0, maxR, 0, Math.PI / 4); this.ctx.closePath();
            this.ctx.fillStyle = 'rgba(0, 255, 255, 0.3)'; this.ctx.fill(); this.ctx.restore();

            for (let i = 0; i < 3; i++) {
                let p = (this.globalTime * 0.5 + (i * 0.33)) % 1;
                this.ctx.beginPath(); this.ctx.arc(0, 0, maxR * p, 0, Math.PI * 2);
                this.ctx.strokeStyle = `rgba(0, 255, 255, ${1 - p})`; this.ctx.lineWidth = 4; this.ctx.stroke();
            }
        } else {
            this.ctx.beginPath(); this.ctx.arc(0, 0, maxR * 0.2, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)'; this.ctx.lineWidth = 4; this.ctx.stroke();
        }
        this.ctx.restore();
    }
}

class WaterEjectAnim {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.isActive = false; this.progress = 0; this.rotation = 0; this.globalTime = 0;
        this.drops = []; for(let i=0; i<40; i++) this.drops.push({active: false});
        this.resize(); window.addEventListener('resize', () => this.resize());
    }
    resize() { this.canvas.width = this.canvas.parentElement.clientWidth; this.canvas.height = 280; }
    draw() {
        const w = this.canvas.width; const h = this.canvas.height; const cx = w / 2; const cy = h / 2;
        this.ctx.clearRect(0, 0, w, h);
        let baseRadius = Math.min(cx, cy) * 0.65;

        this.ctx.beginPath(); this.ctx.arc(cx, cy, baseRadius + 20, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255,255,255,0.1)'; this.ctx.lineWidth = 8; this.ctx.stroke();
        
        if (this.progress > 0) {
            this.ctx.save(); this.ctx.translate(cx, cy); this.ctx.rotate(this.rotation * Math.PI / 180 - Math.PI/2);
            this.ctx.beginPath(); this.ctx.arc(0, 0, baseRadius + 20, 0, this.progress * Math.PI * 2);
            this.ctx.strokeStyle = '#00E5FF'; this.ctx.lineWidth = 8; this.ctx.stroke();
            this.ctx.restore();
        }

        let scale = 1;
        if (this.isActive) {
            this.globalTime += 0.5; this.rotation += 2;
            scale = 0.92 + 0.08 * Math.sin(this.globalTime);
            
            this.drops.forEach(d => {
                if (!d.active && Math.random() < 0.2) {
                    d.x = cx + (Math.random() - 0.5) * 60; d.y = cy + (Math.random() - 0.5) * 60;
                    let angle = Math.random() * Math.PI + Math.PI;
                    let speed = Math.random() * 15 + 10;
                    d.vx = Math.cos(angle) * speed * 0.5; d.vy = Math.sin(angle) * speed;
                    d.radius = Math.random() * 5 + 2; d.alpha = 1; d.active = true;
                } else if (d.active) {
                    d.x += d.vx; d.y += d.vy; d.vy += 0.8;
                    d.alpha -= 0.03; if (d.alpha <= 0 || d.y > h) d.active = false;
                }
            });
        } else {
            this.drops.forEach(d => d.active = false);
        }

        this.ctx.save(); this.ctx.translate(cx, cy); this.ctx.scale(scale, scale);
        const grad = this.ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius);
        grad.addColorStop(0, '#0A0A15'); grad.addColorStop(1, '#020205');
        this.ctx.fillStyle = grad; this.ctx.beginPath(); this.ctx.arc(0, 0, baseRadius, 0, Math.PI * 2); this.ctx.fill();

        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)'; this.ctx.lineWidth = 3;
        for (let i = 1; i <= 4; i++) { this.ctx.beginPath(); this.ctx.arc(0, 0, baseRadius * (i / 4), 0, Math.PI * 2); this.ctx.stroke(); }
        
        this.ctx.fillStyle = '#1A1A25'; this.ctx.beginPath(); this.ctx.arc(0, 0, baseRadius * 0.3, 0, Math.PI * 2); this.ctx.fill();
        this.ctx.restore();

        if (this.isActive) {
            this.drops.forEach(d => {
                if (d.active) {
                    this.ctx.beginPath(); this.ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
                    this.ctx.fillStyle = `rgba(0, 229, 255, ${d.alpha})`; this.ctx.fill();
                }
            });
        }
    }
}

class AudiometerAnim {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.progress = 0;
        this.resize(); window.addEventListener('resize', () => this.resize());
    }
    resize() { this.canvas.width = this.canvas.parentElement.clientWidth; this.canvas.height = 280; }
    draw() {
        const w = this.canvas.width; const h = this.canvas.height; const cx = w / 2; const cy = h / 2 + 30;
        this.ctx.clearRect(0, 0, w, h);
        let radius = Math.min(cx, cy) * 0.8;

        this.ctx.lineWidth = 2;
        for (let i = 0; i <= 40; i++) {
            let angle = 135 + (i * (270 / 40)); let rad = angle * Math.PI / 180;
            let startX = cx + (radius + 20) * Math.cos(rad); let startY = cy + (radius + 20) * Math.sin(rad);
            let endX = cx + (radius + 35) * Math.cos(rad); let endY = cy + (radius + 35) * Math.sin(rad);
            this.ctx.strokeStyle = (i / 40) <= this.progress ? '#00FFFF' : '#444';
            this.ctx.beginPath(); this.ctx.moveTo(startX, startY); this.ctx.lineTo(endX, endY); this.ctx.stroke();
        }

        this.ctx.beginPath(); this.ctx.arc(cx, cy, radius, 135 * Math.PI / 180, 405 * Math.PI / 180);
        this.ctx.strokeStyle = '#1A1A1A'; this.ctx.lineWidth = 12; this.ctx.lineCap = 'round'; this.ctx.stroke();

        if (this.progress > 0) {
            this.ctx.beginPath(); this.ctx.arc(cx, cy, radius, 135 * Math.PI / 180, (135 + 270 * this.progress) * Math.PI / 180);
            this.ctx.strokeStyle = '#3366FF'; this.ctx.lineWidth = 12; this.ctx.lineCap = 'round';
            this.ctx.shadowBlur = 20; this.ctx.shadowColor = '#3366FF';
            this.ctx.stroke(); this.ctx.shadowBlur = 0;
        }
    }
}

class Frequency3DVisualizerAnim {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.color = '#444444'; this.rotation = 0; this.buffer = null;
        this.resize(); window.addEventListener('resize', () => this.resize());
    }
    resize() { this.canvas.width = this.canvas.parentElement.clientWidth; this.canvas.height = 280; }
    update(buffer, color) { this.buffer = buffer; this.color = color; this.rotation += 0.5; if(this.rotation > 360) this.rotation = 0; }
    draw() {
        const w = this.canvas.width; const h = this.canvas.height; const cx = w / 2; const cy = h / 2 + 20;
        this.ctx.clearRect(0, 0, w, h);

        this.ctx.strokeStyle = this.color; this.ctx.globalAlpha = 0.2; this.ctx.lineWidth = 1;
        for (let i = 1; i <= 10; i++) {
            let yOffset = Math.pow(i, 1.8) * 10;
            if (cy + yOffset < h) { this.ctx.beginPath(); this.ctx.moveTo(0, cy + yOffset); this.ctx.lineTo(w, cy + yOffset); this.ctx.stroke(); }
            if (cy - yOffset > 0) { this.ctx.beginPath(); this.ctx.moveTo(0, cy - yOffset); this.ctx.lineTo(w, cy - yOffset); this.ctx.stroke(); }
        }
        for (let angle = 0; angle < 180; angle += 15) {
            let rad = angle * Math.PI / 180; let dx = Math.cos(rad) * w; let dy = Math.sin(rad) * h * 0.35;
            this.ctx.beginPath(); this.ctx.moveTo(cx - dx, cy - dy); this.ctx.lineTo(cx + dx, cy + dy); this.ctx.stroke();
        }

        this.ctx.globalAlpha = 0.3;
        const grad = this.ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.6);
        grad.addColorStop(0, this.color); grad.addColorStop(1, 'transparent');
        this.ctx.fillStyle = grad; this.ctx.fillRect(0, 0, w, h);

        this.ctx.globalAlpha = 1;
        let baseRadius = w * 0.4; let perspectiveY = 0.35;
        this.ctx.beginPath();
        let isFirst = true;
        for (let angle = 0; angle <= 360; angle += 2) {
            let amplitude = 0;
            if (this.buffer && this.buffer.length > 0) {
                let index = Math.floor(((angle + this.rotation) % 360) / 360 * (this.buffer.length - 1));
                amplitude = (this.buffer[index] / 128.0 - 1.0) * (baseRadius * 0.5);
            }
            let r = baseRadius + amplitude; let rad = angle * Math.PI / 180;
            let x = cx + r * Math.cos(rad); let y = cy + r * Math.sin(rad) * perspectiveY;
            if (isFirst) { this.ctx.moveTo(x, y); isFirst = false; } else { this.ctx.lineTo(x, y); }
        }
        this.ctx.closePath();
        this.ctx.strokeStyle = this.color; this.ctx.lineWidth = 4;
        this.ctx.shadowBlur = 20; this.ctx.shadowColor = this.color;
        this.ctx.stroke(); this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = '#FFF'; this.ctx.lineWidth = 2; this.ctx.stroke();
    }
}

class HexagonPulseAnim {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.isActive = false; this.globalTime = 0;
        this.resize(); window.addEventListener('resize', () => this.resize());
    }
    resize() { this.canvas.width = this.canvas.parentElement.clientWidth; this.canvas.height = 220; }
    drawHexagon(cx, cy, radius, alpha) {
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            let angle = (60 * i - 30) * Math.PI / 180;
            let x = cx + radius * Math.cos(angle); let y = cy + radius * Math.sin(angle);
            if (i === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        if (this.isActive && alpha > 0.6) {
            this.ctx.fillStyle = `rgba(255, 215, 0, ${alpha * 0.3})`;
            this.ctx.shadowBlur = 25; this.ctx.shadowColor = '#FFD700';
            this.ctx.fill(); this.ctx.shadowBlur = 0;
        }
        this.ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`; this.ctx.lineWidth = 4; this.ctx.stroke();
    }
    draw() {
        const w = this.canvas.width; const h = this.canvas.height; const cx = w / 2; const cy = h / 2;
        this.ctx.clearRect(0, 0, w, h);
        if (this.isActive) this.globalTime += 0.05;

        let radius = Math.min(cx, cy) * 0.18;
        this.ctx.save(); this.ctx.translate(cx, cy); this.ctx.scale(1, 0.65);

        let xOffset = radius * Math.sqrt(3); let yOffset = radius * 2 * 0.75;
        const grid = [
            [0,0], [1,0], [-1,0], [0,1], [0,-1], [1,-1], [-1,1], [2,0], [-2,0],
            [1,1], [-1,-1], [0,2], [0,-2], [2,-1], [-2,1], [1,-2], [-1,2], [2,-2], [-2,2]
        ];

        grid.forEach(pos => {
            let q = pos[0]; let r = pos[1];
            let x = (q * xOffset) + (r * xOffset / 2); let y = (r * yOffset);
            let dist = Math.sqrt(q*q + r*r);
            let alpha = 0.15;
            if (this.isActive) {
                let wave = (Math.sin(dist * 1.5 - this.globalTime) + 1) / 2;
                alpha = 0.15 + (0.85 * wave);
            }
            this.drawHexagon(x, y, radius * 0.9, alpha);
        });
        this.ctx.restore();
    }
}

class SirenPulseAnim {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId); this.ctx = this.canvas.getContext('2d');
        this.isActive = false; this.time = 0;
        this.resize(); window.addEventListener('resize', () => this.resize());
    }
    resize() { this.canvas.width = this.canvas.parentElement.clientWidth; this.canvas.height = 220; }
    drawJagged(cx, cy, radius, alpha) {
        this.ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
            let angle = i * 2 * Math.PI / 40;
            let r = radius + (i % 2 === 0 ? radius * 0.15 : -radius * 0.15);
            let x = cx + r * Math.cos(angle); let y = cy + r * Math.sin(angle);
            if (i === 0) this.ctx.moveTo(x, y); else this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        this.ctx.strokeStyle = `rgba(255, 51, 102, ${alpha})`;
        this.ctx.lineWidth = 6;
        if (this.isActive) {
            this.ctx.shadowBlur = 30; this.ctx.shadowColor = '#FF3366';
            this.ctx.stroke(); this.ctx.shadowBlur = 0;
        } else {
            this.ctx.stroke();
        }
    }
    draw() {
        const w = this.canvas.width; const h = this.canvas.height; const cx = w / 2; const cy = h / 2;
        this.ctx.clearRect(0, 0, w, h);
        let maxRadius = Math.min(cx, cy) * 0.8;

        this.ctx.save(); this.ctx.translate(cx, cy); this.ctx.scale(1, 0.4);

        if (this.isActive) {
            this.time += 0.05;
            for (let i = 0; i < 3; i++) {
                let p = (this.time + (i * 0.33)) % 1;
                this.drawJagged(0, 0, maxRadius * p, 1 - p);
            }
            let shakeX = (Math.random() * 10) - 5; let shakeY = (Math.random() * 10) - 5;
            this.ctx.fillStyle = '#FFF'; this.ctx.shadowBlur = 40; this.ctx.shadowColor = '#FF3366';
            this.ctx.beginPath(); this.ctx.moveTo(shakeX, shakeY - 40); this.ctx.lineTo(shakeX + 40, shakeY + 32); this.ctx.lineTo(shakeX - 40, shakeY + 32); this.ctx.closePath(); this.ctx.fill(); this.ctx.shadowBlur = 0;
        } else {
            this.drawJagged(0, 0, maxRadius * 0.5, 0.15);
            this.drawJagged(0, 0, maxRadius, 0.15);
            this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
            this.ctx.beginPath(); this.ctx.moveTo(0, -40); this.ctx.lineTo(40, 32); this.ctx.lineTo(-40, 32); this.ctx.closePath(); this.ctx.fill();
        }
        this.ctx.restore();
    }
}

// ==========================================
// 4. منطق ابزارها و مدیریت صفحات
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initQuantumGrid();
    initSplashScreen();

    const dashboard = document.getElementById('dashboard');
    const toolView = document.getElementById('tool-view');
    const backBtn = document.getElementById('back-btn');
    const toolTitle = document.getElementById('tool-title');
    const cards = document.querySelectorAll('.neon-card');
    const toolUIs = document.querySelectorAll('.tool-ui');

    const oscAnim = new OscilloscopeAnim('canvas-oscilloscope');
    const radarAnim = new RadarAnim('canvas-radar');
    const emitterAnim = new EmitterAnim('canvas-emitter');
    const ejectAnim = new WaterEjectAnim('canvas-speaker');
    const audioMeterAnim = new AudiometerAnim('canvas-hearing');
    const detectorAnim = new Frequency3DVisualizerAnim('canvas-detector');
    const beeAnim = new HexagonPulseAnim('canvas-bee');
    const animalAnim = new SirenPulseAnim('canvas-animal');

    function renderLoop() {
        oscAnim.draw(); radarAnim.draw(); emitterAnim.draw(); ejectAnim.draw(); 
        audioMeterAnim.draw(); detectorAnim.draw(); beeAnim.draw(); animalAnim.draw();
        requestAnimationFrame(renderLoop);
    }
    renderLoop();

    cards.forEach(card => {
        card.addEventListener('click', () => {
            const title = card.querySelector('span').innerText;
            const toolId = card.getAttribute('data-tool');
            toolTitle.textContent = title;

            toolUIs.forEach(ui => ui.classList.add('hidden'));
            const activeUI = document.getElementById(`ui-${toolId}`);
            if (activeUI) activeUI.classList.remove('hidden');
            else document.getElementById('ui-placeholder').classList.remove('hidden');

            dashboard.classList.remove('active');
            setTimeout(() => toolView.classList.add('active'), 50);
        });
    });

    backBtn.addEventListener('click', () => {
        audio.stop(); 
        resetAllPlayButtons();
        if (isDetecting) stopDetection();
        toolView.classList.remove('active');
        setTimeout(() => dashboard.classList.add('active'), 50);
    });

    // --- ژنراتور فرکانس ---
    const genSlider = document.getElementById('gen-slider');
    const genFreqDisplay = document.getElementById('gen-freq-display');
    const genWaveBtns = document.querySelectorAll('#ui-generator .wave-btn');
    const genTuneBtns = document.querySelectorAll('#ui-generator .tune-btn');
    const genPlayBtn = document.getElementById('gen-play-btn');
    let genFreq = 440; let genWave = 'sine'; let genIsPlaying = false;

    function getFreqColor(freq) {
        const minLog = Math.log10(20); const maxLog = Math.log10(20000);
        const currentLog = Math.log10(Math.max(20, Math.min(freq, 20000)));
        const percent = (currentLog - minLog) / (maxLog - minLog);
        return `hsl(${percent * 300}, 100%, 60%)`;
    }

    function updateGenUI() {
        genFreqDisplay.textContent = `${Math.round(genFreq)} Hz`;
        const color = getFreqColor(genFreq);
        genFreqDisplay.style.setProperty('--active-color', color);
        genPlayBtn.style.setProperty('--active-color', color);
        const minLog = Math.log10(1); const maxLog = Math.log10(22000);
        genSlider.value = ((Math.log10(genFreq) - minLog) / (maxLog - minLog)) * 1000;

        genWaveBtns.forEach(b => {
            if(b.getAttribute('data-wave') === genWave) { b.classList.add('active'); b.style.setProperty('--active-color', color); } 
            else { b.classList.remove('active'); b.style.removeProperty('--active-color'); }
        });
        oscAnim.update(genIsPlaying, genFreq, genWave, color);
        if (genIsPlaying) audio.setFrequency(genFreq);
    }

    genSlider.addEventListener('input', (e) => {
        const minLog = Math.log10(1); const maxLog = Math.log10(22000);
        const scale = (maxLog - minLog) / 1000;
        genFreq = Math.pow(10, minLog + (e.target.value * scale));
        updateGenUI();
    });

    genTuneBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            genFreq += parseInt(btn.getAttribute('data-val'));
            if(genFreq < 1) genFreq = 1; if(genFreq > 22000) genFreq = 22000;
            updateGenUI();
        });
    });

    genWaveBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            genWave = btn.getAttribute('data-wave');
            if (genIsPlaying) audio.setWaveform(genWave);
            updateGenUI();
        });
    });

    genPlayBtn.addEventListener('click', () => {
        genIsPlaying = !genIsPlaying;
        if (genIsPlaying) { audio.play(genFreq, genWave); genPlayBtn.textContent = 'توقف فرکانس'; genPlayBtn.classList.add('playing'); } 
        else { audio.stop(); genPlayBtn.textContent = 'پخش فرکانس'; genPlayBtn.classList.remove('playing'); }
        updateGenUI();
    });

    // --- دافع حشرات، سوت سگ، زنبور، حیوانات ---
    function setupPresetTool(toolPrefix, defaultColor, animObj, isAnimalMode = false) {
        const presetBtns = document.querySelectorAll(`#ui-${toolPrefix} .preset-btn`);
        const statusText = document.getElementById(`${toolPrefix}-status`);
        let currentFreq = 0; let isSweep = false; let isPlaying = false; let currentMode = 0;

        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.classList.contains('active') && isPlaying) {
                    audio.stop(); isPlaying = false;
                    btn.classList.remove('active'); btn.style.removeProperty('--active-color');
                    statusText.textContent = 'آماده پخش'; statusText.style.color = '#888';
                    animObj.isActive = false; return;
                }
                presetBtns.forEach(b => { b.classList.remove('active'); b.style.removeProperty('--active-color'); });
                btn.classList.add('active'); btn.style.setProperty('--active-color', defaultColor);
                
                audio.stopSweep();
                if (isAnimalMode) {
                    currentMode = parseInt(btn.getAttribute('data-mode'));
                    if (currentMode === 1) audio.startSweep(2000, 4000, 50, 20, 'sawtooth');
                    else if (currentMode === 2) audio.playPulse(3000, 'square', 6.66);
                    else if (currentMode === 3) audio.play(18000, 'square');
                    statusText.textContent = 'هشدار فعال است!';
                } else {
                    isSweep = btn.hasAttribute('data-sweep');
                    if (!isSweep) currentFreq = parseInt(btn.getAttribute('data-freq'));
                    if (isSweep) audio.startSweep(15000, 20000, 50, 20, 'sine');
                    else audio.play(currentFreq, 'sine');
                    statusText.textContent = `در حال ارسال سیگنال: ${isSweep ? 'موج متغیر' : currentFreq + ' Hz'}`;
                }
                
                isPlaying = true;
                statusText.style.color = defaultColor;
                animObj.isActive = true;
            });
        });
    }
    setupPresetTool('insect', '#FF3366', radarAnim);
    setupPresetTool('dog', '#00FFFF', emitterAnim);
    setupPresetTool('bee', '#FFD700', beeAnim);
    setupPresetTool('animal', '#FF3366', animalAnim, true);

    // --- پاک‌کننده اسپیکر ---
    const speakerPlayBtn = document.getElementById('speaker-play-btn');
    const speakerPhaseText = document.getElementById('speaker-phase-text');
    const speakerStatusText = document.getElementById('speaker-status');
    let speakerIsPlaying = false; let speakerTimer = null; let speakerStartTime = 0;

    function updateSpeakerPhase() {
        if (!speakerIsPlaying) return;
        let elapsed = Date.now() - speakerStartTime;
        let loopTime = elapsed % 45000;
        ejectAnim.progress = loopTime / 45000;

        if (loopTime < 15000) {
            if (speakerPhaseText.textContent !== "مرحله ۱: لرزش عمیق") {
                speakerPhaseText.textContent = "مرحله ۱: لرزش عمیق";
                speakerStatusText.textContent = "در حال جدا کردن قطرات آب از دیواره اسپیکر...";
                audio.stopSweep(); audio.play(165, 'sine');
            }
        } else if (loopTime < 30000) {
            if (speakerPhaseText.textContent !== "مرحله ۲: جاروب فرکانسی") {
                speakerPhaseText.textContent = "مرحله ۲: جاروب فرکانسی";
                speakerStatusText.textContent = "در حال هدایت آب به سمت خروجی...";
                audio.stopSweep(); audio.startSweep(100, 250, 2, 20, 'sine');
            }
        } else {
            if (speakerPhaseText.textContent !== "مرحله ۳: شوک ضربه‌ای") {
                speakerPhaseText.textContent = "مرحله ۳: شوک ضربه‌ای";
                speakerStatusText.textContent = "پرتاب نهایی قطرات به بیرون...";
                audio.stopSweep(); audio.playPulse(165, 'sine', 2.5);
            }
        }
    }

    speakerPlayBtn.addEventListener('click', () => {
        speakerIsPlaying = !speakerIsPlaying;
        if (speakerIsPlaying) {
            speakerStartTime = Date.now(); ejectAnim.isActive = true;
            speakerPlayBtn.textContent = 'توقف عملیات'; speakerPlayBtn.classList.add('playing');
            speakerTimer = setInterval(updateSpeakerPhase, 50); updateSpeakerPhase();
        } else {
            audio.stop(); clearInterval(speakerTimer);
            ejectAnim.isActive = false; ejectAnim.progress = 0;
            speakerPlayBtn.textContent = 'شروع پاک‌سازی خودکار'; speakerPlayBtn.classList.remove('playing');
            speakerPhaseText.textContent = "آماده برای پاک‌سازی";
            speakerStatusText.textContent = "ولوم را روی حداکثر قرار دهید و گوشی را برگردانید";
        }
    });

    // --- تست شنوایی ---
    const hearingSlider = document.getElementById('hearing-slider');
    const hearingFreqDisplay = document.getElementById('hearing-freq-display');
    const hearingAgeDisplay = document.getElementById('hearing-age');
    const hearingPlayBtn = document.getElementById('hearing-play-btn');
    let hearingFreq = 8000; let hearingIsPlaying = false;

    function calculateHearingAge(freq) {
        if (freq < 10000) return "طبیعی (همه سنین)"; if (freq < 12000) return "حدود ۶۰ سال";
        if (freq < 14000) return "حدود ۵۰ سال"; if (freq < 15000) return "حدود ۴۰ سال";
        if (freq < 16000) return "حدود ۳۰ سال"; if (freq < 17000) return "حدود ۲۴ سال";
        if (freq < 18000) return "حدود ۲۰ سال"; if (freq < 19000) return "حدود ۱۸ سال";
        if (freq < 20000) return "حدود ۱۶ سال"; if (freq < 21000) return "زیر ۱۴ سال";
        return "خارج از محدوده انسان";
    }

    hearingSlider.addEventListener('input', (e) => {
        const minFreq = 8000; const maxFreq = 22000; const val = e.target.value / 1000;
        hearingFreq = Math.round(minFreq + (val * (maxFreq - minFreq)));
        hearingFreqDisplay.textContent = `${hearingFreq} Hz`;
        hearingAgeDisplay.textContent = `سن شنوایی: ${calculateHearingAge(hearingFreq)}`;
        audioMeterAnim.progress = val;
        if (hearingIsPlaying) audio.setFrequency(hearingFreq);
    });

    hearingPlayBtn.addEventListener('click', () => {
        hearingIsPlaying = !hearingIsPlaying;
        if (hearingIsPlaying) { audio.play(hearingFreq, 'sine'); hearingPlayBtn.textContent = 'توقف تست'; hearingPlayBtn.classList.add('playing'); } 
        else { audio.stop(); hearingPlayBtn.textContent = 'شروع تست'; hearingPlayBtn.classList.remove('playing'); }
    });

    // --- تشخیص فرکانس (میکروفون) ---
    let audioCtxMic = null; let analyser = null; let microphone = null; let detectorReq = null; let isDetecting = false;
    const detectorFreqDisplay = document.getElementById('detector-freq-display');
    const detectorNoteDisplay = document.getElementById('detector-note');
    const detectorStatus = document.getElementById('detector-status');
    const detectorStartBtn = document.getElementById('detector-start-btn');

    function getMusicalNote(frequency) {
        if (frequency < 20 || frequency > 8000) return "--";
        const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const pitchIndex = Math.round(12 * (Math.log(frequency / 440.0) / Math.log(2))) + 69;
        if (pitchIndex < 0) return "--";
        return notes[pitchIndex % 12] + (Math.floor(pitchIndex / 12) - 1);
    }

    function autoCorrelate(buf, sampleRate) {
        let SIZE = buf.length; let rms = 0;
        for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return -1;
        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) if (Math.abs(buf[i]) < thres) { r1 = i; break; }
        for (let i = 1; i < SIZE / 2; i++) if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
        buf = buf.slice(r1, r2); SIZE = buf.length;
        let c = new Array(SIZE).fill(0);
        for (let i = 0; i < SIZE; i++) for (let j = 0; j < SIZE - i; j++) c[i] = c[i] + buf[j] * buf[j + i];
        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < SIZE; i++) { if (c[i] > maxval) { maxval = c[i]; maxpos = i; } }
        let T0 = maxpos; let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        let a = (x1 + x3 - 2 * x2) / 2; let b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);
        return sampleRate / T0;
    }

    function updatePitch() {
        if (!isDetecting) return;
        const buffer = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(buffer);
        const ac = autoCorrelate(buffer, audioCtxMic.sampleRate);

        if (ac !== -1) {
            let freq = ac;
            detectorFreqDisplay.textContent = `${freq.toFixed(1)} Hz`;
            detectorNoteDisplay.textContent = getMusicalNote(freq);
            detectorStatus.textContent = "سیگنال دریافت شد"; detectorStatus.style.color = "#00FF66";
            
            const color = getFreqColor(freq);
            detectorFreqDisplay.style.setProperty('--active-color', color);
            detectorNoteDisplay.style.color = color; detectorNoteDisplay.style.textShadow = `0 0 15px ${color}`;
            
            const byteBuffer = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteTimeDomainData(byteBuffer);
            detectorAnim.update(byteBuffer, color);
        } else {
            detectorFreqDisplay.textContent = "0.0 Hz"; detectorNoteDisplay.textContent = "--";
            detectorStatus.textContent = "در انتظار صدا..."; detectorStatus.style.color = "#888";
            detectorFreqDisplay.style.setProperty('--active-color', 'transparent');
            detectorNoteDisplay.style.color = "#FFF"; detectorNoteDisplay.style.textShadow = "0 0 15px rgba(255,255,255,0.5)";
            detectorAnim.update(null, '#444444');
        }
        detectorReq = requestAnimationFrame(updatePitch);
    }

    function stopDetection() {
        isDetecting = false; cancelAnimationFrame(detectorReq);
        if (microphone) { microphone.disconnect(); microphone.mediaStream.getTracks().forEach(t => t.stop()); }
        detectorStartBtn.textContent = 'شروع تشخیص'; detectorStartBtn.classList.remove('playing');
        detectorStatus.textContent = "متوقف شد";
        detectorAnim.update(null, '#444444');
    }

    detectorStartBtn.addEventListener('click', async () => {
        if (isDetecting) { stopDetection(); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!audioCtxMic) audioCtxMic = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtxMic.state === 'suspended') audioCtxMic.resume();
            analyser = audioCtxMic.createAnalyser(); analyser.fftSize = 2048;
            microphone = audioCtxMic.createMediaStreamSource(stream); microphone.connect(analyser);
            isDetecting = true; detectorStartBtn.textContent = 'توقف تشخیص'; detectorStartBtn.classList.add('playing');
            detectorStatus.textContent = "در حال شنیدن..."; updatePitch();
        } catch (err) { alert('دسترسی به میکروفون داده نشد.'); }
    });

    // --- کنسول آموزش ---
    const pads = document.querySelectorAll('.neon-pad');
    pads.forEach(pad => {
        pad.addEventListener('mousedown', () => {
            pad.classList.add('active');
            let sound = pad.getAttribute('data-sound');
            if(sound === 'click') petAudio.playClick();
            else if(sound === 'attention') petAudio.playAttention();
            else if(sound === 'no') petAudio.playNo();
            else if(sound === 'sit') petAudio.playSit();
            else if(sound === 'stay') petAudio.playStay();
            else if(sound === 'come') petAudio.startCome();
        });
        pad.addEventListener('mouseup', () => {
            pad.classList.remove('active');
            if(pad.getAttribute('data-sound') === 'come') petAudio.stopCome();
        });
        pad.addEventListener('mouseleave', () => {
            pad.classList.remove('active');
            if(pad.getAttribute('data-sound') === 'come') petAudio.stopCome();
        });
        pad.addEventListener('touchstart', (e) => {
            e.preventDefault(); pad.classList.add('active');
            let sound = pad.getAttribute('data-sound');
            if(sound === 'click') petAudio.playClick();
            else if(sound === 'attention') petAudio.playAttention();
            else if(sound === 'no') petAudio.playNo();
            else if(sound === 'sit') petAudio.playSit();
            else if(sound === 'stay') petAudio.playStay();
            else if(sound === 'come') petAudio.startCome();
        });
        pad.addEventListener('touchend', (e) => {
            e.preventDefault(); pad.classList.remove('active');
            if(pad.getAttribute('data-sound') === 'come') petAudio.stopCome();
        });
    });

    // --- تابع کمکی ریست ---
    function resetAllPlayButtons() {
        genIsPlaying = false; genPlayBtn.textContent = 'پخش فرکانس'; genPlayBtn.classList.remove('playing');
        speakerIsPlaying = false; clearInterval(speakerTimer); speakerPlayBtn.textContent = 'شروع پاک‌سازی خودکار'; speakerPlayBtn.classList.remove('playing');
        hearingIsPlaying = false; hearingPlayBtn.textContent = 'شروع تست'; hearingPlayBtn.classList.remove('playing');
        
        oscAnim.isActive = false; radarAnim.isActive = false; emitterAnim.isActive = false; ejectAnim.isActive = false; beeAnim.isActive = false; animalAnim.isActive = false;
        
        document.querySelectorAll('.preset-btn').forEach(b => { b.classList.remove('active'); b.style.removeProperty('--active-color'); });
        const s1 = document.getElementById('insect-status'); if(s1) { s1.textContent = 'رادار آماده پخش'; s1.style.color = '#888'; }
        const s2 = document.getElementById('dog-status'); if(s2) { s2.textContent = 'رادار آماده پخش'; s2.style.color = '#888'; }
        const s3 = document.getElementById('bee-status'); if(s3) { s3.textContent = 'کندو در حالت استراحت'; s3.style.color = '#888'; }
        const s4 = document.getElementById('animal-status'); if(s4) { s4.textContent = 'سیستم هشدار آماده است'; s4.style.color = '#888'; }
        if(speakerPhaseText) speakerPhaseText.textContent = "آماده برای پاک‌سازی";
        if(speakerStatusText) speakerStatusText.textContent = "ولوم را روی حداکثر قرار دهید و گوشی را برگردانید";
    }
});
