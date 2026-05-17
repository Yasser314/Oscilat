import React, { useState, useEffect, useRef } from 'react';
import { Mic, Activity, Settings2, Sliders, Layers, Video, Square, Camera, Monitor } from 'lucide-react';
import { TektronixVectorScope } from './components/TektronixVectorScope';

const Section = ({ title, children, icon: Icon }: any) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-2 border border-gray-800 rounded bg-gray-900/40 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-2 bg-gray-800/80 hover:bg-gray-700 text-xs font-bold text-gray-200 uppercase tracking-wider">
        <div className="flex items-center gap-2"><Icon size={14} className="text-green-400" /> {title}</div>
        <span className="text-gray-500">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="p-2 space-y-2">{children}</div>}
    </div>
  );
};

const Slider = ({ label, min, max, step, val, onChange }: any) => (
  <div className="flex flex-col gap-1">
    <div className="flex justify-between text-[10px] text-gray-400 uppercase tracking-wide">
      <label>{label}</label>
      <span className="text-green-400">{val.toFixed(step < 1 ? 2 : 0)}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={val} onChange={e => onChange(parseFloat(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500" />
  </div>
);

const Toggle = ({ label, val, onChange }: any) => (
  <label className="flex items-center justify-between cursor-pointer">
    <span className="text-xs text-gray-300">{label}</span>
    <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${val ? 'bg-green-500' : 'bg-gray-700'}`}>
      <div className={`w-3 h-3 rounded-full bg-white transition-transform ${val ? 'translate-x-4' : 'translate-x-0'}`} />
    </div>
    <input type="checkbox" className="hidden" checked={val} onChange={e => onChange(e.target.checked)} />
  </label>
);

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>(0);
  const audioCtx = useRef<AudioContext | null>(null);
  const analyserL = useRef<AnalyserNode | null>(null);
  const analyserR = useRef<AnalyserNode | null>(null);
  const gainL = useRef<GainNode | null>(null);
  const gainR = useRef<GainNode | null>(null);
  const dataL = useRef<Float32Array>(new Float32Array(2048));
  const dataR = useRef<Float32Array>(new Float32Array(2048));
  const delayNodeRef = useRef<DelayNode | null>(null);
  const analyserFFT = useRef<AnalyserNode | null>(null);
  const fftData = useRef<Uint8Array>(new Uint8Array(512));
  const fftBands = useRef({ bass: 0, mid: 0, treble: 0 });
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  const [, setUiState] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [showTektronix, setShowTektronix] = useState(false);

  const cfg = useRef({
    mode: 'math_lissajous',
    showTektronix: false,
    gainL: 1, gainR: 1, audioDelay: 0.02,
    phosphor: 0.15, glow: 10, color: '#00ff41', bg: '#000000', grid: true,
    mathA: 3, mathB: 2, mathC: 4, delta: 0, phi: 0, spiroR: 100, spiror: 20, spiroD: 50, roseK: 4,
    rgbShift: 0, scanlines: 0.3, feedback: 0, wave: 0,
    kal: 0, mirror: 'none',
    velocityIntensity: true, intensityExp: 1.0,
    fftReactive: true,
    colorMode: 'static', hueSpeed: 20, hueSat: 100, hueLight: 55,
    lorenzSigma: 10, lorenzRho: 28, lorenzBeta: 2.667,
    cliffordA: -1.4, cliffordB: 1.6, cliffordC: 1.0, cliffordD: 0.7
  });

  const updateCfg = (key: string, val: any) => {
    (cfg.current as any)[key] = val;
    setUiState(prev => prev + 1);
  };

  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      audioStreamRef.current = stream;

      // Force stereo upmix so mono mics appear on both channels
      source.channelCount = 2;
      source.channelCountMode = 'explicit';

      const splitter = ctx.createChannelSplitter(2);
      source.connect(splitter);

      const aL = ctx.createAnalyser();
      const aR = ctx.createAnalyser();
      aL.fftSize = 2048; aR.fftSize = 2048;

      const gL = ctx.createGain();
      const gR = ctx.createGain();

      const delayR = ctx.createDelay(1.0);
      delayR.delayTime.value = cfg.current.audioDelay || 0;
      delayNodeRef.current = delayR;

      splitter.connect(gL, 0);
      splitter.connect(gR, 1);

      gL.connect(aL);
      gR.connect(delayR);
      delayR.connect(aR);

      // FFT analyser for spectral bands
      const aFFT = ctx.createAnalyser();
      aFFT.fftSize = 1024;
      aFFT.smoothingTimeConstant = 0.8;
      source.connect(aFFT);
      analyserFFT.current = aFFT;

      audioCtx.current = ctx; analyserL.current = aL; analyserR.current = aR;
      gainL.current = gL; gainR.current = gR;
      setHasAudio(true); updateCfg('mode', 'audio_xy');
    } catch (e: any) { alert("Error audio: " + e.message); }
  };

  const takeScreenshot = () => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.href = canvasRef.current.toDataURL('image/png');
    a.download = `osc-${Date.now()}.png`;
    a.click();
  };

  const toggleRecording = () => {
    if (isRecording && mediaRecorder.current) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    } else if (canvasRef.current) {
      const stream = canvasRef.current.captureStream(60);
      if (audioStreamRef.current) {
        audioStreamRef.current.getAudioTracks().forEach(track => {
          stream.addTrack(track);
        });
      }
      
      let mimeType = 'video/webm';
      const types = [
        'video/mp4;codecs=h264,aac',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
      ];
      for (const t of types) {
        if (MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, { 
        mimeType: mimeType || undefined,
        videoBitsPerSecond: 16000000, // 16 Mbps
        audioBitsPerSecond: 320000    // 320 Kbps
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob(chunks, { type: mimeType }));
        a.download = `osc-${Date.now()}.${ext}`;
        a.click();
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setIsRecording(true);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.max(window.devicePixelRatio || 1, 2);
      canvas.width = (canvas.parentElement?.clientWidth || window.innerWidth) * dpr;
      canvas.height = (canvas.parentElement?.clientHeight || window.innerHeight) * dpr;
    };
    window.addEventListener('resize', resize);
    resize();

    const render = (time: number) => {
      const c = cfg.current;

      if ((c.mode.startsWith('audio') || c.showTektronix) && gainL.current && gainR.current) {
        gainL.current.gain.value = c.gainL;
        gainR.current.gain.value = c.gainR;
        if (delayNodeRef.current) {
          delayNodeRef.current.delayTime.value = c.audioDelay || 0;
        }
      }

      if (c.showTektronix) {
        reqRef.current = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext('2d', { alpha: false })!;
      const w = canvas.width, h = canvas.height, cx = w / 2, cy = h / 2;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = c.bg;
      ctx.globalAlpha = 1 - c.phosphor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;

      if (c.feedback > 0) {
        ctx.translate(cx, cy);
        const s = 1 + c.feedback * 0.05;
        ctx.scale(s, s);
        ctx.rotate(c.feedback * 0.02);
        ctx.translate(-cx, -cy);
        ctx.globalAlpha = 0.9;
        ctx.drawImage(canvas, 0, 0);
        ctx.globalAlpha = 1;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }

      if (c.grid) {
        ctx.strokeStyle = '#003300'; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = cx % 50; i < w; i += 50) { ctx.moveTo(i, 0); ctx.lineTo(i, h); }
        for (let i = cy % 50; i < h; i += 50) { ctx.moveTo(0, i); ctx.lineTo(w, i); }
        ctx.stroke();
        ctx.strokeStyle = '#005500'; ctx.beginPath();
        ctx.moveTo(cx, 0); ctx.lineTo(cx, h);
        ctx.moveTo(0, cy); ctx.lineTo(w, cy);
        ctx.stroke();
      }

      let pts: { x: number, y: number }[] = [];
      const t = time * 0.001;

      // Compute FFT bands (bass / mid / treble)
      let bass = 0, mid = 0, treble = 0;
      if (c.fftReactive && analyserFFT.current) {
        analyserFFT.current.getByteFrequencyData(fftData.current);
        const bins = fftData.current;
        let bSum = 0, mSum = 0, tSum = 0;
        for (let i = 0; i < 16; i++) bSum += bins[i];
        for (let i = 16; i < 80; i++) mSum += bins[i];
        for (let i = 80; i < 256; i++) tSum += bins[i];
        bass = bSum / (16 * 255);
        mid = mSum / (64 * 255);
        treble = tSum / (176 * 255);
        fftBands.current = { bass, mid, treble };
      }

      if (c.mode.startsWith('audio') && analyserL.current && analyserR.current) {
        analyserL.current.getFloatTimeDomainData(dataL.current);
        analyserR.current.getFloatTimeDomainData(dataR.current);
        const len = dataL.current.length;
        if (c.mode === 'audio_xy') {
          for (let i = 0; i < len; i++) pts.push({ x: dataL.current[i] * cx * 0.9, y: -dataR.current[i] * cy * 0.9 });
        } else {
          for (let i = 0; i < len; i++) pts.push({ x: (i / len) * w - cx, y: -dataL.current[i] * cy * 0.9 });
        }
      } else {
        const steps = 1000, scale = Math.min(cx, cy) * 0.8;
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * Math.PI * 2 * 20;
          let x = 0, y = 0;
          if (c.mode === 'math_lissajous') {
            x = Math.sin(c.mathA * theta + c.delta + t) * cx * 0.8;
            y = Math.sin(c.mathB * theta) * cy * 0.8;
            const proj = 1 + Math.sin(c.mathC * theta + c.phi + t * 0.5) * 0.2;
            x *= proj; y *= proj;
          } else if (c.mode === 'math_spiro') {
            const R = c.spiroR, r = c.spiror, d = c.spiroD;
            x = (R - r) * Math.cos(theta + t * 0.1) + d * Math.cos((R - r) / r * theta);
            y = (R - r) * Math.sin(theta + t * 0.1) - d * Math.sin((R - r) / r * theta);
            const s = scale / (R + d + 1); x *= s; y *= s;
          } else if (c.mode === 'math_rose') {
            const r = Math.cos(c.roseK * theta + t) * scale;
            x = r * Math.cos(theta); y = r * Math.sin(theta);
          } else if (c.mode === 'math_lorenz') {
            // Skip theta-based generation; handled below
          } else if (c.mode === 'math_clifford') {
            // Skip theta-based generation; handled below
          }
          // FFT-driven perturbations for math modes
          if (c.fftReactive && (bass > 0 || mid > 0 || treble > 0) && c.mode !== 'math_lorenz' && c.mode !== 'math_clifford') {
            const fftScale = 1 + bass * 0.3;
            x *= fftScale;
            y *= fftScale;
            x += Math.sin(theta * 20 + t * 5) * treble * scale * 0.08;
            y += Math.cos(theta * 20 + t * 5) * treble * scale * 0.08;
          }
          if (c.mode !== 'math_lorenz' && c.mode !== 'math_clifford') {
            pts.push({ x, y });
          }
        }

        // Lorenz attractor (iterative ODE, separate from theta loop)
        if (c.mode === 'math_lorenz') {
          const dt = 0.005;
          const sigma = c.lorenzSigma;
          const rho = c.lorenzRho + bass * 8;
          const beta = c.lorenzBeta;
          let lx = 0.1, ly = 0, lz = 0;
          const scaleL = scale * 0.02;
          for (let i = 0; i < 8000; i++) {
            const dxL = sigma * (ly - lx) * dt;
            const dyL = (lx * (rho - lz) - ly) * dt;
            const dzL = (lx * ly - beta * lz) * dt;
            lx += dxL; ly += dyL; lz += dzL;
            // 3D perspective projection
            const pZ = (lz * 0.02) + 2.5;
            const sx = (lx * scaleL / pZ) * 2;
            const sy = (ly * scaleL / pZ) * 2;
            pts.push({ x: sx, y: sy });
          }
        }

        // Clifford attractor (iterated map)
        if (c.mode === 'math_clifford') {
          const a = c.cliffordA + bass * 0.3;
          const b = c.cliffordB;
          const ca = c.cliffordC;
          const d = c.cliffordD;
          let cx2 = 0.1, cy2 = 0.1;
          const scaleC = scale * 0.25;
          for (let i = 0; i < 10000; i++) {
            const nx = Math.sin(a * cy2) + ca * Math.cos(a * cx2);
            const ny = Math.sin(b * cx2) + d * Math.cos(b * cy2);
            cx2 = nx; cy2 = ny;
            pts.push({ x: cx2 * scaleC, y: cy2 * scaleC });
          }
        }
      }

      if (c.wave > 0) {
        pts = pts.map(p => ({
          x: p.x + Math.sin(p.y * 0.02 + t * 2) * c.wave * 50,
          y: p.y + Math.cos(p.x * 0.02 + t * 2) * c.wave * 50
        }));
      }

      const drawPath = (color: string, offsetX = 0, offsetY = 0) => {
        if (!c.velocityIntensity) {
          // Original fast path
          ctx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            if (i === 0) ctx.moveTo(pts[i].x + offsetX, pts[i].y + offsetY);
            else ctx.lineTo(pts[i].x + offsetX, pts[i].y + offsetY);
          }
          ctx.strokeStyle = color; ctx.lineWidth = 2;
          ctx.shadowBlur = c.glow; ctx.shadowColor = color;
          ctx.stroke();
          return;
        }
        // Velocity-based intensity: bright where slow, dim where fast
        const maxDist = Math.max(w, h) * 0.15;
        const exp = c.intensityExp;
        for (let i = 1; i < pts.length; i++) {
          const dx = pts[i].x - pts[i - 1].x;
          const dy = pts[i].y - pts[i - 1].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const norm = Math.min(dist / maxDist, 1);
          const intensity = Math.pow(1 - norm, exp);
          ctx.beginPath();
          ctx.moveTo(pts[i - 1].x + offsetX, pts[i - 1].y + offsetY);
          ctx.lineTo(pts[i].x + offsetX, pts[i].y + offsetY);
          ctx.globalAlpha = 0.15 + intensity * 0.85;
          ctx.lineWidth = 1 + intensity * 3;
          ctx.shadowBlur = intensity * c.glow * 1.5;
          ctx.shadowColor = color;
          ctx.strokeStyle = color;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      };

      ctx.save();
      ctx.translate(cx, cy);
      ctx.globalCompositeOperation = 'screen';

      const drawAll = () => {
        // Resolve dynamic color
        let activeColor = c.color;
        if (c.colorMode === 'cycle') {
          const hue = (t * c.hueSpeed) % 360;
          activeColor = `hsl(${hue}, ${c.hueSat}%, ${c.hueLight}%)`;
        } else if (c.colorMode === 'audio') {
          const { bass: b, treble: tr } = fftBands.current;
          const hue = (b * 360 + t * 10) % 360;
          const sat = 50 + tr * 50;
          activeColor = `hsl(${hue}, ${sat}%, ${c.hueLight}%)`;
        }
        if (c.rgbShift > 0) {
          drawPath('#ff0000', -c.rgbShift * 20, 0);
          drawPath('#00ff00', 0, 0);
          drawPath('#0000ff', c.rgbShift * 20, 0);
        } else drawPath(activeColor);
      };

      const mirrors = c.mirror === 'quad' ? [[1, 1], [-1, 1], [1, -1], [-1, -1]] :
        c.mirror === 'h' ? [[1, 1], [-1, 1]] :
          c.mirror === 'v' ? [[1, 1], [1, -1]] : [[1, 1]];
      const kal = parseInt(c.kal as any), angles = kal > 0 ? kal : 1;

      for (let m of mirrors) {
        ctx.save(); ctx.scale(m[0], m[1]);
        for (let i = 0; i < angles; i++) {
          ctx.save();
          if (kal > 0) ctx.rotate((i * Math.PI * 2) / angles);
          drawAll();
          ctx.restore();
        }
        ctx.restore();
      }
      ctx.restore();

      if (c.scanlines > 0) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = `rgba(0,0,0,${c.scanlines})`;
        for (let i = 0; i < h; i += 4) ctx.fillRect(0, i, w, 2);
      }

      reqRef.current = requestAnimationFrame(render);
    };

    reqRef.current = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(reqRef.current); window.removeEventListener('resize', resize); };
  }, []);

  const c = cfg.current;

  return (
    <div className="flex h-screen w-screen bg-black text-white overflow-hidden font-sans selection:bg-green-500/30">
      <div className="w-80 bg-gray-950 border-r border-gray-800 flex flex-col z-10 shadow-2xl shadow-black">
        <div className="p-4 border-b border-gray-800 flex items-center gap-3 bg-gray-900/50">
          <Activity className="text-green-400" />
          <h1 className="font-bold tracking-tight text-gray-100">OSC-GEN <span className="text-green-400 text-xs ml-1 font-mono">v2.0</span></h1>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <Section title="Mode & Source" icon={Settings2}>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {['audio_xy', 'audio_wave', 'math_lissajous', 'math_spiro', 'math_rose', 'math_lorenz', 'math_clifford'].map(m => (
                <button key={m} onClick={() => { updateCfg('mode', m); updateCfg('showTektronix', false); setShowTektronix(false); }} className={`p-1.5 text-[10px] rounded border uppercase ${c.mode === m && !showTektronix ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                  {m.replace('_', ' ')}
                </button>
              ))}
              <button onClick={() => {
                updateCfg('showTektronix', true);
                setShowTektronix(true);
                if (isRecording && mediaRecorder.current) {
                  mediaRecorder.current.stop();
                  setIsRecording(false);
                }
              }} className={`p-1.5 text-[10px] rounded border uppercase ${showTektronix ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                Tektronix 760A
              </button>
            </div>
            {(c.mode.startsWith('audio') || showTektronix) && !hasAudio && (
              <button onClick={startAudio} className="w-full py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-bold flex items-center justify-center gap-2">
                <Mic size={16} /> Enable Mic
              </button>
            )}
            {(c.mode.startsWith('audio') || showTektronix) && hasAudio && (
              <div className="space-y-2">
                <Slider label="Gain L" min={0} max={5} step={0.1} val={c.gainL} onChange={(v: any) => updateCfg('gainL', v)} />
                <Slider label="Gain R" min={0} max={5} step={0.1} val={c.gainR} onChange={(v: any) => updateCfg('gainR', v)} />
                <Slider label="Phase L/R" min={0} max={0.1} step={0.001} val={c.audioDelay || 0} onChange={(v: any) => updateCfg('audioDelay', v)} />
                <Toggle label="FFT Reactive" val={c.fftReactive} onChange={(v: any) => updateCfg('fftReactive', v)} />
              </div>
            )}
          </Section>

          {c.mode.startsWith('math') && (
            <Section title="Math Params" icon={Activity}>
              {c.mode === 'math_lissajous' && (
                <>
                  <div className="flex flex-col gap-1 mb-2">
                    <label className="text-[10px] text-gray-400 uppercase tracking-wide">Ratio (A:B)</label>
                    <select className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded p-1 outline-none" onChange={e => {
                      const [a, b] = e.target.value.split(':').map(Number);
                      updateCfg('mathA', a); updateCfg('mathB', b);
                    }} value={`${c.mathA}:${c.mathB}`}>
                      <option value="1:1">1:1</option><option value="2:3">2:3</option>
                      <option value="3:4">3:4</option><option value="5:6">5:6</option>
                      <option value="3:2">3:2 (Custom)</option>
                    </select>
                  </div>
                  <Slider label="Freq A (X)" min={1} max={10} step={1} val={c.mathA} onChange={(v: any) => updateCfg('mathA', v)} />
                  <Slider label="Freq B (Y)" min={1} max={10} step={1} val={c.mathB} onChange={(v: any) => updateCfg('mathB', v)} />
                  <Slider label="Freq C (Z)" min={0} max={10} step={1} val={c.mathC} onChange={(v: any) => updateCfg('mathC', v)} />
                  <Slider label="Phase Delta" min={0} max={Math.PI * 2} step={0.1} val={c.delta} onChange={(v: any) => updateCfg('delta', v)} />
                </>
              )}
              {c.mode === 'math_spiro' && (
                <>
                  <Slider label="Outer R" min={10} max={200} step={1} val={c.spiroR} onChange={(v: any) => updateCfg('spiroR', v)} />
                  <Slider label="Inner r" min={1} max={100} step={1} val={c.spiror} onChange={(v: any) => updateCfg('spiror', v)} />
                  <Slider label="Pen Offset d" min={1} max={200} step={1} val={c.spiroD} onChange={(v: any) => updateCfg('spiroD', v)} />
                </>
              )}
              {c.mode === 'math_rose' && (
                <Slider label="Petals (k)" min={1} max={20} step={1} val={c.roseK} onChange={(v: any) => updateCfg('roseK', v)} />
              )}
              {c.mode === 'math_lorenz' && (
                <>
                  <Slider label="Sigma (σ)" min={1} max={30} step={0.5} val={c.lorenzSigma} onChange={(v: any) => updateCfg('lorenzSigma', v)} />
                  <Slider label="Rho (ρ)" min={10} max={50} step={0.5} val={c.lorenzRho} onChange={(v: any) => updateCfg('lorenzRho', v)} />
                  <Slider label="Beta (β)" min={0.5} max={8} step={0.1} val={c.lorenzBeta} onChange={(v: any) => updateCfg('lorenzBeta', v)} />
                </>
              )}
              {c.mode === 'math_clifford' && (
                <>
                  <Slider label="A" min={-3} max={3} step={0.1} val={c.cliffordA} onChange={(v: any) => updateCfg('cliffordA', v)} />
                  <Slider label="B" min={-3} max={3} step={0.1} val={c.cliffordB} onChange={(v: any) => updateCfg('cliffordB', v)} />
                  <Slider label="C" min={-3} max={3} step={0.1} val={c.cliffordC} onChange={(v: any) => updateCfg('cliffordC', v)} />
                  <Slider label="D" min={-3} max={3} step={0.1} val={c.cliffordD} onChange={(v: any) => updateCfg('cliffordD', v)} />
                </>
              )}
            </Section>
          )}

          <Section title="Visuals" icon={Camera}>
            <div className="flex flex-col gap-1 mb-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-wide">Color Mode</label>
              <select className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded p-1 outline-none" value={c.colorMode} onChange={e => updateCfg('colorMode', e.target.value)}>
                <option value="static">Static</option>
                <option value="cycle">Rainbow Cycle</option>
                <option value="audio">Audio Reactive</option>
              </select>
            </div>
            {c.colorMode === 'static' && (
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-300">Trace Color</span>
                <input type="color" value={c.color} onChange={e => updateCfg('color', e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
              </div>
            )}
            {c.colorMode === 'cycle' && (
              <Slider label="Hue Speed" min={1} max={100} step={1} val={c.hueSpeed} onChange={(v: any) => updateCfg('hueSpeed', v)} />
            )}
            {(c.colorMode === 'cycle' || c.colorMode === 'audio') && (
              <div className="space-y-2">
                <Slider label="Saturation" min={0} max={100} step={1} val={c.hueSat} onChange={(v: any) => updateCfg('hueSat', v)} />
                <Slider label="Lightness" min={20} max={80} step={1} val={c.hueLight} onChange={(v: any) => updateCfg('hueLight', v)} />
              </div>
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-300">Background</span>
              <input type="color" value={c.bg} onChange={e => updateCfg('bg', e.target.value)} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0" />
            </div>
            <Toggle label="CRT Graticule" val={c.grid} onChange={(v: any) => updateCfg('grid', v)} />
            <div className="mt-2 space-y-2">
              <Slider label="Phosphor" min={0} max={0.99} step={0.01} val={c.phosphor} onChange={(v: any) => updateCfg('phosphor', v)} />
              <Slider label="Glow Bloom" min={0} max={50} step={1} val={c.glow} onChange={(v: any) => updateCfg('glow', v)} />
              <Toggle label="Velocity Intensity" val={c.velocityIntensity} onChange={(v: any) => updateCfg('velocityIntensity', v)} />
              {c.velocityIntensity && (
                <Slider label="Intensity Curve" min={0.3} max={3} step={0.1} val={c.intensityExp} onChange={(v: any) => updateCfg('intensityExp', v)} />
              )}
            </div>
          </Section>

          <Section title="Glitch FX" icon={Sliders}>
            <Slider label="RGB Shift" min={0} max={1} step={0.01} val={c.rgbShift} onChange={(v: any) => updateCfg('rgbShift', v)} />
            <Slider label="Scanlines" min={0} max={1} step={0.01} val={c.scanlines} onChange={(v: any) => updateCfg('scanlines', v)} />
            <Slider label="Feedback" min={0} max={1} step={0.01} val={c.feedback} onChange={(v: any) => updateCfg('feedback', v)} />
            <Slider label="Wave Distort" min={0} max={1} step={0.01} val={c.wave} onChange={(v: any) => updateCfg('wave', v)} />
          </Section>

          <Section title="Symmetry" icon={Layers}>
            <div className="flex flex-col gap-1 mb-2">
              <label className="text-[10px] text-gray-400 uppercase tracking-wide">Kaleidoscope</label>
              <select className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded p-1 outline-none" value={c.kal} onChange={e => updateCfg('kal', parseInt(e.target.value))}>
                <option value="0">Off</option><option value="2">2-Fold</option>
                <option value="4">4-Fold</option><option value="6">6-Fold</option>
                <option value="8">8-Fold</option><option value="12">12-Fold</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-gray-400 uppercase tracking-wide">Mirror</label>
              <select className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded p-1 outline-none" value={c.mirror} onChange={e => updateCfg('mirror', e.target.value)}>
                <option value="none">None</option><option value="h">Horizontal</option>
                <option value="v">Vertical</option><option value="quad">Quad</option>
              </select>
            </div>
          </Section>
        </div>

        <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex gap-2">
          <button onClick={takeScreenshot} disabled={showTektronix} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 border ${showTektronix ? 'bg-gray-800/50 text-gray-600 border-gray-800 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'}`}>
            <Camera size={14} /> PNG
          </button>
          <button onClick={toggleRecording} disabled={showTektronix} className={`flex-1 py-2 rounded text-xs font-bold flex items-center justify-center gap-2 border ${showTektronix ? 'bg-gray-800/50 text-gray-600 border-gray-800 cursor-not-allowed' : isRecording ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'}`}>
            {isRecording ? <Square size={14} /> : <Video size={14} />}
            {isRecording ? 'STOP' : 'MP4/WEBM'}
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-black cursor-crosshair overflow-hidden">
        {showTektronix && (
          <TektronixVectorScope
            analyserL={analyserL.current}
            analyserR={analyserR.current}
            isActive={showTektronix}
            hasAudio={hasAudio}
          />
        )}
        <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full ${showTektronix ? 'hidden' : ''}`} />
        {isRecording && !showTektronix && (
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/20 border border-red-500/50 text-red-400 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse">
            <div className="w-2 h-2 bg-red-500 rounded-full" /> REC
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #374151; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #4B5563; }
      `}} />
    </div>
  );
}
