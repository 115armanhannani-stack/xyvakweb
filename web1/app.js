// ==========================================
// موتور صوتی (Web Audio API)
// ==========================================
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.oscillator = null;
        this.gainNode = null;
        this.isPlaying = false;
        this.sweepInterval = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    play(freq, type = 'sine') {
        this.init();
        this.stop(); // توقف صدای قبلی اگر وجود داشت

        this.oscillator = this.ctx.createOscillator();
        this.gainNode = this.ctx.createGain();

        this.oscillator.type = type;
        this.oscillator.frequency.setValueAtTime(freq, this.ctx.currentTime);

        // Fade-in نرم برای جلوگیری از صدای تق (Click/Pop)
        this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
        this.gainNode.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 0.05);

        this.oscillator.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);

        this.oscillator.start();
        this.isPlaying = true;
    }

    stop() {
        this.stopSweep();
        if (this.oscillator && this.isPlaying) {
            // Fade-out نرم
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, this.ctx.currentTime);
            this.gainNode.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.05);
            
            const osc = this.oscillator;
            setTimeout(() => {
                try { osc.stop(); osc.disconnect(); } catch (e) {}
            }, 50);
            
            this.isPlaying = false;
        }
    }

    setFrequency(freq) {
        if (this.oscillator && this.isPlaying) {
            // تغییر نرم فرکانس
            this.oscillator.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
        }
    }

    setWaveform(type) {
        if (this.oscillator && this.isPlaying) {
            this.oscillator.type = type;
        }
    }

    // شبیه‌سازی موج متغیر (Sweep) برای دافع حشرات و اسپیکر
    startSweep(minFreq, maxFreq, step, speedMs, type = 'sine') {
        this.play(minFreq, type);
        let currentFreq = minFreq;
        let goingUp = true;

        this.sweepInterval = setInterval(() => {
            if (goingUp) {
                currentFreq += step;
                if (currentFreq >= maxFreq) goingUp = false;
            } else {
                currentFreq -= step;
                if (currentFreq <= minFreq) goingUp = true;
            }
            this.setFrequency(currentFreq);
        }, speedMs);
    }

    stopSweep() {
        if (this.sweepInterval) {
            clearInterval(this.sweepInterval);
            this.sweepInterval = null;
        }
    }
}

const audio = new AudioEngine();

// ==========================================
// مدیریت رابط کاربری و صفحات
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = document.getElementById('dashboard');
    const toolView = document.getElementById('tool-view');
    const backBtn = document.getElementById('back-btn');
    const toolTitle = document.getElementById('tool-title');
    const cards = document.querySelectorAll('.neon-card');
    const toolUIs = document.querySelectorAll('.tool-ui');

    let currentTool = null;

    // باز کردن ابزار
    cards.forEach(card => {
        card.addEventListener('click', () => {
            const title = card.getAttribute('data-title');
            const toolId = card.getAttribute('data-tool');
            
            toolTitle.textContent = title;
            currentTool = toolId;

            // مخفی کردن همه UI ها و نمایش UI مربوطه
            toolUIs.forEach(ui => ui.classList.add('hidden'));
            const activeUI = document.getElementById(`ui-${toolId}`);
            if (activeUI) {
                activeUI.classList.remove('hidden');
            } else {
                document.getElementById('ui-placeholder').classList.remove('hidden');
            }

            dashboard.classList.remove('active');
            setTimeout(() => toolView.classList.add('active'), 50);
        });
    });

    // دکمه برگشت
    backBtn.addEventListener('click', () => {
        audio.stop(); // قطع صدا هنگام خروج
        resetAllPlayButtons();
        
        toolView.classList.remove('active');
        setTimeout(() => dashboard.classList.add('active'), 50);
    });

    // ==========================================
    // منطق ابزار 1: ژنراتور آزاد
    // ==========================================
    const genSlider = document.getElementById('gen-slider');
    const genFreqDisplay = document.getElementById('gen-freq-display');
    const genWaveBtns = document.querySelectorAll('#ui-generator .wave-btn');
    const genPlayBtn = document.getElementById('gen-play-btn');
    
    let genFreq = 440;
    let genWave = 'sine';
    let genIsPlaying = false;

    // تبدیل لگاریتمی اسلایدر (مثل اندروید)
    function updateGenFreqFromSlider(val) {
        const minLog = Math.log10(1);
        const maxLog = Math.log10(22000);
        const scale = (maxLog - minLog) / 1000;
        genFreq = Math.round(Math.pow(10, minLog + (val * scale)));
        genFreqDisplay.textContent = `${genFreq} Hz`;
        
        // تغییر رنگ بر اساس فرکانس (شبیه‌سازی Synesthesia)
        const hue = (val / 1000) * 300;
        const color = `hsl(${hue}, 100%, 60%)`;
        genFreqDisplay.style.setProperty('--active-color', color);
        genPlayBtn.style.setProperty('--active-color', color);

        if (genIsPlaying) audio.setFrequency(genFreq);
    }

    genSlider.addEventListener('input', (e) => updateGenFreqFromSlider(e.target.value));

    genWaveBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            genWaveBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            genWave = btn.getAttribute('data-wave');
            if (genIsPlaying) audio.setWaveform(genWave);
        });
    });

    genPlayBtn.addEventListener('click', () => {
        genIsPlaying = !genIsPlaying;
        if (genIsPlaying) {
            audio.play(genFreq, genWave);
            genPlayBtn.textContent = 'توقف فرکانس';
            genPlayBtn.classList.add('playing');
        } else {
            audio.stop();
            genPlayBtn.textContent = 'پخش فرکانس';
            genPlayBtn.classList.remove('playing');
        }
    });

    // ==========================================
    // منطق ابزار 2 و 3: دافع حشرات و سوت سگ
    // ==========================================
    function setupPresetTool(toolPrefix, defaultColor) {
        const presetBtns = document.querySelectorAll(`#ui-${toolPrefix} .preset-btn`);
        const playBtn = document.getElementById(`${toolPrefix}-play-btn`);
        const statusText = document.getElementById(`${toolPrefix}-status`);
        
        let currentFreq = 0;
        let isSweep = false;
        let isPlaying = false;

        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                presetBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.removeProperty('--active-color');
                });
                btn.classList.add('active');
                btn.style.setProperty('--active-color', defaultColor);
                
                if (btn.hasAttribute('data-sweep')) {
                    isSweep = true;
                } else {
                    isSweep = false;
                    currentFreq = parseInt(btn.getAttribute('data-freq'));
                }

                // اگر در حال پخش است، آپدیت کن
                if (isPlaying) {
                    audio.stopSweep();
                    if (isSweep) audio.startSweep(15000, 20000, 50, 20, 'sine');
                    else audio.play(currentFreq, 'sine');
                    statusText.textContent = `در حال پخش: ${isSweep ? 'موج متغیر' : currentFreq + ' Hz'}`;
                }
            });
        });

        playBtn.addEventListener('click', () => {
            // پیدا کردن دکمه فعال
            const activeBtn = document.querySelector(`#ui-${toolPrefix} .preset-btn.active`);
            if (!activeBtn) {
                alert('لطفاً ابتدا یک گزینه را انتخاب کنید.');
                return;
            }

            isPlaying = !isPlaying;
            if (isPlaying) {
                if (isSweep) audio.startSweep(15000, 20000, 50, 20, 'sine');
                else audio.play(currentFreq, 'sine');
                
                playBtn.textContent = 'توقف';
                playBtn.classList.add('playing');
                statusText.textContent = `در حال پخش: ${isSweep ? 'موج متغیر' : currentFreq + ' Hz'}`;
                statusText.style.color = defaultColor;
            } else {
                audio.stop();
                playBtn.textContent = 'پخش';
                playBtn.classList.remove('playing');
                statusText.textContent = 'آماده پخش';
                statusText.style.color = '#888';
            }
        });
    }

    setupPresetTool('insect', '#FF3366');
    setupPresetTool('dog', '#FF9900');

    // ==========================================
    // منطق ابزار 4: پاک‌کننده اسپیکر
    // ==========================================
    const speakerBtns = document.querySelectorAll('#ui-speaker .preset-btn');
    const speakerPlayBtn = document.getElementById('speaker-play-btn');
    const speakerStatus = document.getElementById('speaker-status');
    let speakerMode = '';
    let speakerIsPlaying = false;

    speakerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            speakerBtns.forEach(b => {
                b.classList.remove('active');
                b.style.removeProperty('--active-color');
            });
            btn.classList.add('active');
            btn.style.setProperty('--active-color', '#00FFFF');
            speakerMode = btn.getAttribute('data-mode');

            if (speakerIsPlaying) playSpeakerMode();
        });
    });

    function playSpeakerMode() {
        audio.stopSweep();
        if (speakerMode === 'deep') {
            audio.play(165, 'sine');
        } else if (speakerMode === 'sweep') {
            audio.startSweep(100, 250, 2, 20, 'sine');
        } else if (speakerMode === 'shock') {
            audio.play(165, 'square'); // موج مربعی برای شوک فیزیکی اسپیکر
        }
        speakerStatus.textContent = "در حال پاک‌سازی... (صبر کنید)";
    }

    speakerPlayBtn.addEventListener('click', () => {
        if (!speakerMode) {
            alert('یک حالت پاک‌سازی انتخاب کنید.');
            return;
        }
        speakerIsPlaying = !speakerIsPlaying;
        if (speakerIsPlaying) {
            playSpeakerMode();
            speakerPlayBtn.textContent = 'توقف پاک‌سازی';
            speakerPlayBtn.classList.add('playing');
        } else {
            audio.stop();
            speakerPlayBtn.textContent = 'شروع پاک‌سازی';
            speakerPlayBtn.classList.remove('playing');
            speakerStatus.textContent = "ولوم را روی حداکثر قرار دهید";
        }
    });

    // تابع کمکی برای ریست کردن دکمه‌ها هنگام خروج از ابزار
    function resetAllPlayButtons() {
        document.querySelectorAll('.play-btn').forEach(btn => {
            btn.classList.remove('playing');
            if (btn.id === 'gen-play-btn') btn.textContent = 'پخش فرکانس';
            else if (btn.id === 'speaker-play-btn') btn.textContent = 'شروع پاک‌سازی';
            else btn.textContent = 'پخش';
        });
        genIsPlaying = false;
        
        // ریست استاتوس‌ها
        const s1 = document.getElementById('insect-status'); if(s1) { s1.textContent = 'آماده پخش'; s1.style.color = '#888'; }
        const s2 = document.getElementById('dog-status'); if(s2) { s2.textContent = 'آماده پخش'; s2.style.color = '#888'; }
        const s3 = document.getElementById('speaker-status'); if(s3) { s3.textContent = 'ولوم را روی حداکثر قرار دهید'; s3.style.color = '#00FFFF'; }
    }
});
