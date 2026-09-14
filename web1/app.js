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
        this.stop(); 

        this.oscillator = this.ctx.createOscillator();
        this.gainNode = this.ctx.createGain();

        this.oscillator.type = type;
        this.oscillator.frequency.setValueAtTime(freq, this.ctx.currentTime);

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
            this.oscillator.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
        }
    }

    setWaveform(type) {
        if (this.oscillator && this.isPlaying) {
            this.oscillator.type = type;
        }
    }

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
        audio.stop(); 
        resetAllPlayButtons();
        
        // توقف میکروفون اگر روشن بود
        if (isDetecting) stopDetection();
        
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

    function updateGenFreqFromSlider(val) {
        const minLog = Math.log10(1);
        const maxLog = Math.log10(22000);
        const scale = (maxLog - minLog) / 1000;
        genFreq = Math.round(Math.pow(10, minLog + (val * scale)));
        genFreqDisplay.textContent = `${genFreq} Hz`;
        
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

                if (isPlaying) {
                    audio.stopSweep();
                    if (isSweep) audio.startSweep(15000, 20000, 50, 20, 'sine');
                    else audio.play(currentFreq, 'sine');
                    statusText.textContent = `در حال پخش: ${isSweep ? 'موج متغیر' : currentFreq + ' Hz'}`;
                }
            });
        });

        playBtn.addEventListener('click', () => {
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
            audio.play(165, 'square'); 
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

    // ==========================================
    // منطق ابزار 5: تست شنوایی
    // ==========================================
    const hearingSlider = document.getElementById('hearing-slider');
    const hearingFreqDisplay = document.getElementById('hearing-freq-display');
    const hearingAgeDisplay = document.getElementById('hearing-age');
    const hearingPlayBtn = document.getElementById('hearing-play-btn');

    let hearingFreq = 8000;
    let hearingIsPlaying = false;

    function calculateHearingAge(freq) {
        if (freq < 10000) return "طبیعی (همه سنین)";
        if (freq < 12000) return "حدود ۶۰ سال";
        if (freq < 14000) return "حدود ۵۰ سال";
        if (freq < 15000) return "حدود ۴۰ سال";
        if (freq < 16000) return "حدود ۳۰ سال";
        if (freq < 17000) return "حدود ۲۴ سال";
        if (freq < 18000) return "حدود ۲۰ سال";
        if (freq < 19000) return "حدود ۱۸ سال";
        if (freq < 20000) return "حدود ۱۶ سال";
        if (freq < 21000) return "زیر ۱۴ سال";
        return "خارج از محدوده انسان";
    }

    hearingSlider.addEventListener('input', (e) => {
        const minFreq = 8000;
        const maxFreq = 22000;
        const val = e.target.value / 1000;
        hearingFreq = Math.round(minFreq + (val * (maxFreq - minFreq)));
        
        hearingFreqDisplay.textContent = `${hearingFreq} Hz`;
        hearingAgeDisplay.textContent = `سن شنوایی: ${calculateHearingAge(hearingFreq)}`;
        
        if (hearingIsPlaying) audio.setFrequency(hearingFreq);
    });

    hearingPlayBtn.addEventListener('click', () => {
        hearingIsPlaying = !hearingIsPlaying;
        if (hearingIsPlaying) {
            audio.play(hearingFreq, 'sine');
            hearingPlayBtn.textContent = 'توقف تست';
            hearingPlayBtn.classList.add('playing');
        } else {
            audio.stop();
            hearingPlayBtn.textContent = 'شروع تست';
            hearingPlayBtn.classList.remove('playing');
        }
    });

    // ==========================================
    // منطق ابزار 6: تشخیص فرکانس (میکروفون)
    // ==========================================
    let audioCtxMic = null;
    let analyser = null;
    let microphone = null;
    let detectorReq = null;
    let isDetecting = false;

    const detectorFreqDisplay = document.getElementById('detector-freq-display');
    const detectorNoteDisplay = document.getElementById('detector-note');
    const detectorStatus = document.getElementById('detector-status');
    const detectorStartBtn = document.getElementById('detector-start-btn');

    function getMusicalNote(frequency) {
        if (frequency < 20 || frequency > 8000) return "--";
        const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const pitchIndex = Math.round(12 * (Math.log(frequency / 440.0) / Math.log(2))) + 69;
        if (pitchIndex < 0) return "--";
        const octave = Math.floor(pitchIndex / 12) - 1;
        return notes[pitchIndex % 12] + octave;
    }

    // الگوریتم Auto-correlation برای پیدا کردن دقیق فرکانس صدا
    function autoCorrelate(buf, sampleRate) {
        let SIZE = buf.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) {
            let val = buf[i];
            rms += val * val;
        }
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return -1; // صدای محیط خیلی کم است

        let r1 = 0, r2 = SIZE - 1, thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++)
            if (Math.abs(buf[i]) < thres) { r1 = i; break; }
        for (let i = 1; i < SIZE / 2; i++)
            if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }

        buf = buf.slice(r1, r2);
        SIZE = buf.length;

        let c = new Array(SIZE).fill(0);
        for (let i = 0; i < SIZE; i++)
            for (let j = 0; j < SIZE - i; j++)
                c[i] = c[i] + buf[j] * buf[j + i];

        let d = 0; while (c[d] > c[d + 1]) d++;
        let maxval = -1, maxpos = -1;
        for (let i = d; i < SIZE; i++) {
            if (c[i] > maxval) {
                maxval = c[i];
                maxpos = i;
            }
        }
        let T0 = maxpos;
        let x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
        let a = (x1 + x3 - 2 * x2) / 2;
        let b = (x3 - x1) / 2;
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
            detectorStatus.textContent = "سیگنال دریافت شد";
            detectorStatus.style.color = "#00FF66";
            
            // تغییر رنگ هوشمند بر اساس فرکانس (قرمز برای بم، بنفش برای زیر)
            const minLog = Math.log10(20);
            const maxLog = Math.log10(8000);
            const currentLog = Math.log10(Math.max(20, Math.min(freq, 8000)));
            const percent = (currentLog - minLog) / (maxLog - minLog);
            const hue = percent * 300;
            const color = `hsl(${hue}, 100%, 60%)`;
            
            detectorFreqDisplay.style.setProperty('--active-color', color);
            detectorNoteDisplay.style.color = color;
            detectorNoteDisplay.style.textShadow = `0 0 15px ${color}`;
        } else {
            detectorFreqDisplay.textContent = "0.0 Hz";
            detectorNoteDisplay.textContent = "--";
            detectorStatus.textContent = "در انتظار صدا...";
            detectorStatus.style.color = "#888";
            detectorFreqDisplay.style.setProperty('--active-color', 'transparent');
            detectorNoteDisplay.style.color = "#FFF";
            detectorNoteDisplay.style.textShadow = "0 0 15px rgba(255,255,255,0.5)";
        }
        detectorReq = requestAnimationFrame(updatePitch);
    }

    function stopDetection() {
        isDetecting = false;
        cancelAnimationFrame(detectorReq);
        if (microphone) {
            microphone.disconnect();
            microphone.mediaStream.getTracks().forEach(track => track.stop());
        }
        detectorStartBtn.textContent = 'شروع تشخیص';
        detectorStartBtn.classList.remove('playing');
        detectorStatus.textContent = "متوقف شد";
    }

    detectorStartBtn.addEventListener('click', async () => {
        if (isDetecting) {
            stopDetection();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!audioCtxMic) audioCtxMic = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtxMic.state === 'suspended') audioCtxMic.resume();
            
            analyser = audioCtxMic.createAnalyser();
            analyser.fftSize = 2048;
            microphone = audioCtxMic.createMediaStreamSource(stream);
            microphone.connect(analyser);
            
            isDetecting = true;
            detectorStartBtn.textContent = 'توقف تشخیص';
            detectorStartBtn.classList.add('playing');
            detectorStatus.textContent = "در حال شنیدن...";
            updatePitch();
        } catch (err) {
            alert('دسترسی به میکروفون داده نشد یا خطایی رخ داد.');
            console.error(err);
        }
    });

    // ==========================================
    // تابع کمکی ریست دکمه‌ها
    // ==========================================
    function resetAllPlayButtons() {
        document.querySelectorAll('.play-btn').forEach(btn => {
            btn.classList.remove('playing');
            if (btn.id === 'gen-play-btn') btn.textContent = 'پخش فرکانس';
            else if (btn.id === 'speaker-play-btn') btn.textContent = 'شروع پاک‌سازی';
            else if (btn.id === 'hearing-play-btn') btn.textContent = 'شروع تست';
            else if (btn.id === 'detector-start-btn') btn.textContent = 'شروع تشخیص';
            else btn.textContent = 'پخش';
        });
        genIsPlaying = false;
        hearingIsPlaying = false;
        
        const s1 = document.getElementById('insect-status'); if(s1) { s1.textContent = 'آماده پخش'; s1.style.color = '#888'; }
        const s2 = document.getElementById('dog-status'); if(s2) { s2.textContent = 'آماده پخش'; s2.style.color = '#888'; }
        const s3 = document.getElementById('speaker-status'); if(s3) { s3.textContent = 'ولوم را روی حداکثر قرار دهید'; s3.style.color = '#00FFFF'; }
    }
});
