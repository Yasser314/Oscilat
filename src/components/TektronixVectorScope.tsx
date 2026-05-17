import React, { useEffect, useRef, useState } from 'react';

interface Props {
  analyserL: AnalyserNode | null;
  analyserR: AnalyserNode | null;
  isActive: boolean;
  hasAudio: boolean;
}

export const TektronixVectorScope = ({ analyserL, analyserR, isActive, hasAudio }: Props) => {
  const canvasMain = useRef<HTMLCanvasElement>(null);
  const canvasPersist = useRef<HTMLCanvasElement | null>(null);
  const reqRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  const [mode, setMode] = useState(1);
  const [persistence, setPersistence] = useState(0.04);
  const [rotationSpeed, setRotationSpeed] = useState(0.01);
  const [brightness, setBrightness] = useState(0.9);
  
  const [sphereRadius, setSphereRadius] = useState(0.6);
  const [sphereDist, setSphereDist] = useState(2.0);
  const [sphereScale, setSphereScale] = useState(2.5);

  const [spiralTurns, setSpiralTurns] = useState(5);

  const [lissajousA, setLissajousA] = useState(3);
  const [lissajousB, setLissajousB] = useState(4);
  const [lissajousC, setLissajousC] = useState(5);
  const [lissajousDelta, setLissajousDelta] = useState(0);
  const [lissajousPhi, setLissajousPhi] = useState(0);
  
  const [xyDelay, setXyDelay] = useState(0);
  const [xyScale, setXyScale] = useState(1.0);
  
  const [torusR1, setTorusR1] = useState(0.6);
  const [torusR2, setTorusR2] = useState(0.3);
  const [roseK, setRoseK] = useState(4);
  const [roseD, setRoseD] = useState(1);
  
  const [rgbShift, setRgbShift] = useState(0);
  const [showGraticule, setShowGraticule] = useState(true);
  const [infiniteLoop, setInfiniteLoop] = useState(false);
  
  const [rmsL, setRmsL] = useState(0);
  const [rmsR, setRmsR] = useState(0);
  const peakL = useRef({ val: 0, time: 0 });
  const peakR = useRef({ val: 0, time: 0 });
  const dataL = useRef<Float32Array>(new Float32Array(2048));
  const dataR = useRef<Float32Array>(new Float32Array(2048));

  useEffect(() => {
    if (!isActive) return;

    if (!canvasPersist.current) {
      canvasPersist.current = document.createElement('canvas');
    }

    const canvas = canvasMain.current;
    if (!canvas) return;
    const persist = canvasPersist.current;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const size = Math.min(parent.clientWidth, parent.clientHeight);
        canvas.width = size;
        canvas.height = size;
        persist.width = size;
        persist.height = size;
      }
    };
    window.addEventListener('resize', resize);
    resize();

    const render = (timestamp: number) => {
      timeRef.current += 1;
      const time = timeRef.current;
      
      const ctxMain = canvas.getContext('2d')!;
      const ctxPersist = persist.getContext('2d')!;
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;

      // Calculate RMS
      let currentRmsL = 0;
      let currentRmsR = 0;
      if (hasAudio && analyserL && analyserR) {
        analyserL.getFloatTimeDomainData(dataL.current);
        analyserR.getFloatTimeDomainData(dataR.current);
        let sumL = 0, sumR = 0;
        for (let i = 0; i < dataL.current.length; i++) {
          sumL += dataL.current[i] * dataL.current[i];
          sumR += dataR.current[i] * dataR.current[i];
        }
        currentRmsL = Math.sqrt(sumL / dataL.current.length);
        currentRmsR = Math.sqrt(sumR / dataR.current.length);
      } else {
        // Fake RMS for animation
        currentRmsL = 0.2 + Math.sin(time * 0.05) * 0.1;
        currentRmsR = 0.2 + Math.cos(time * 0.04) * 0.1;
      }

      setRmsL(currentRmsL);
      setRmsR(currentRmsR);

      // 0. Infinite feedback loop
      if (infiniteLoop) {
        ctxPersist.save();
        ctxPersist.translate(cx, cy);
        ctxPersist.scale(0.98, 0.98);
        ctxPersist.rotate(0.01);
        ctxPersist.translate(-cx, -cy);
        ctxPersist.globalAlpha = 0.9;
        ctxPersist.drawImage(persist, 0, 0);
        ctxPersist.restore();
      }

      // 1. Fade persist canvas
      const fadeAmount = mode === 1 ? Math.max(0.005, persistence * 0.25) : persistence;
      ctxPersist.fillStyle = `rgba(0, 5, 0, ${fadeAmount})`;
      ctxPersist.fillRect(0, 0, w, h);

      // 2. Draw new trace
      ctxPersist.save();
      ctxPersist.translate(cx, cy);
      ctxPersist.strokeStyle = `rgba(0, 255, 200, ${brightness})`;
      ctxPersist.lineWidth = mode === 1 ? 2.0 : 1.5;
      
      if (mode === 1) {
        ctxPersist.shadowBlur = 8;
        ctxPersist.shadowColor = `rgba(0, 255, 200, ${brightness})`;
      }
      
      ctxPersist.beginPath();

      const t = time * rotationSpeed;

      if (mode === 1) {
        // 3D Wireframe Sphere
        const radius = Math.min(cx, cy) * sphereRadius;
        const dist = sphereDist;
        const scale = sphereScale;
        
        // Continuous rotation angles based on time and speed
        const rotX = t * 0.8;
        const rotY = t * 1.2;
        const rotZ = t * 0.5;

        // 3D Rotation helper
        const rotate3D = (x: number, y: number, z: number) => {
          // Rotate X
          const y1 = y * Math.cos(rotX) - z * Math.sin(rotX);
          const z1 = y * Math.sin(rotX) + z * Math.cos(rotX);
          // Rotate Y
          const x2 = x * Math.cos(rotY) + z1 * Math.sin(rotY);
          const z2 = -x * Math.sin(rotY) + z1 * Math.cos(rotY);
          // Rotate Z
          const x3 = x2 * Math.cos(rotZ) - y1 * Math.sin(rotZ);
          const y3 = x2 * Math.sin(rotZ) + y1 * Math.cos(rotZ);
          return { x: x3, y: y3, z: z2 };
        };

        // Deform radially based on RMS
        const deformL = hasAudio ? currentRmsL * radius * 1.5 : 0;
        const deformR = hasAudio ? currentRmsR * radius * 1.5 : 0;
        
        // Draw Latitudes
        for (let lat = -Math.PI/2 + Math.PI/8; lat < Math.PI/2; lat += Math.PI/8) {
          let first = true;
          for (let lon = 0; lon <= Math.PI * 2 + 0.1; lon += 0.1) {
            // Radial deformation
            let rMod = radius + deformL * Math.sin(lon * 6 + t * 5) * Math.cos(lat * 4);
            
            // Base 3D coordinates
            let ox = rMod * Math.cos(lat) * Math.cos(lon);
            let oy = rMod * Math.sin(lat);
            let oz = rMod * Math.cos(lat) * Math.sin(lon);
            
            // Apply 3D rotation
            const { x, y, z } = rotate3D(ox, oy, oz);
            
            // Perspective projection
            const pZ = (z / radius) + dist;
            const sX = (x / pZ) * scale;
            const sY = (y / pZ) * scale;
            
            if (first) { ctxPersist.moveTo(sX, sY); first = false; }
            else ctxPersist.lineTo(sX, sY);
          }
        }
        
        // Draw Longitudes
        for (let lon = 0; lon < Math.PI * 2; lon += Math.PI/8) {
          let first = true;
          for (let lat = -Math.PI/2; lat <= Math.PI/2 + 0.1; lat += 0.1) {
            // Radial deformation
            let rMod = radius + deformR * Math.cos(lat * 6 + t * 5) * Math.sin(lon * 4);
            
            // Base 3D coordinates
            let ox = rMod * Math.cos(lat) * Math.cos(lon);
            let oy = rMod * Math.sin(lat);
            let oz = rMod * Math.cos(lat) * Math.sin(lon);
            
            // Apply 3D rotation
            const { x, y, z } = rotate3D(ox, oy, oz);
            
            // Perspective projection
            const pZ = (z / radius) + dist;
            const sX = (x / pZ) * scale;
            const sY = (y / pZ) * scale;
            
            if (first) { ctxPersist.moveTo(sX, sY); first = false; }
            else ctxPersist.lineTo(sX, sY);
          }
        }
      } else if (mode === 2) {
        // Archimedean Spiral
        const maxRadius = Math.min(cx, cy) * 0.9;
        const turns = spiralTurns;
        const b = maxRadius / (Math.PI * 2 * turns);
        
        for (let i = 0; i < Math.PI * 2 * turns; i += 0.05) {
          const angle = i + t * 2; // rotation
          let r = b * i;
          
          if (hasAudio) {
            // Add audio ripples
            r += (currentRmsL + currentRmsR) * 30 * Math.sin(i * 10 - t * 5);
          }
          
          let x = r * Math.cos(angle);
          let y = r * Math.sin(angle);
          
          if (i === 0) ctxPersist.moveTo(x, y);
          else ctxPersist.lineTo(x, y);
        }
      } else if (mode === 3) {
        // Classic XY Vectorscope (L vs R)
        const scaleMult = xyScale * 0.8;
        
        if (hasAudio && analyserL && analyserR) {
          const len = dataL.current.length;
          const phaseShift = Math.floor(xyDelay);
          for (let i = 0; i < len - phaseShift; i++) {
            const x = dataL.current[i] * cx * scaleMult;
            const y = -dataR.current[i + phaseShift] * cy * scaleMult;
            
            if (i === 0) ctxPersist.moveTo(x, y);
            else ctxPersist.lineTo(x, y);
          }
        } else {
          // Fake test signal (circle)
          for (let i = 0; i < Math.PI * 2; i += 0.05) {
            const x = Math.sin(i + t) * cx * 0.5 * xyScale;
            const y = Math.cos(i + t) * cy * 0.5 * xyScale;
            if (i === 0) ctxPersist.moveTo(x, y);
            else ctxPersist.lineTo(x, y);
          }
        }
      } else if (mode === 5) {
        // Time Domain (Oscilloscope)
        if (hasAudio && analyserL) {
          const scaleMult = xyScale * 0.8;
          const sliceWidth = (w * 1.0) / dataL.current.length;
          let x = -cx;
          for (let i = 0; i < dataL.current.length; i++) {
            const v = dataL.current[i] * scaleMult;
            const y = -(v * cy);
            if (i === 0) ctxPersist.moveTo(x, y);
            else ctxPersist.lineTo(x, y);
            x += sliceWidth;
          }
        } else {
          // Fake test signal
          let x = -cx;
          for (let i = 0; i < w; i += 2) {
            const y = Math.sin(i * 0.05 + t) * cy * 0.5 * xyScale;
            if (i === 0) ctxPersist.moveTo(x, y);
            else ctxPersist.lineTo(x, y);
            x += 2;
          }
        }
      } else if (mode === 4) {
        // Dense 3D Lissajous
        const currentRmsL = hasAudio ? rmsL : 0;
        const currentRmsR = hasAudio ? rmsR : 0;
        const audioScale = hasAudio ? 1 + (currentRmsL + currentRmsR) * 0.5 : 1;
        
        const scale = Math.min(cx, cy) * 0.8 * audioScale;
        const a = lissajousA, b = lissajousB, c = lissajousC;
        for (let i = 0; i < Math.PI * 2 * 10; i += 0.02) {
          const x = Math.sin(a * i + t + lissajousDelta) * scale;
          const y = Math.sin(b * i) * scale;
          const z = Math.sin(c * i + t * 0.5 + lissajousPhi);
          
          const pZ = z + 2;
          const sX = (x / pZ) * 1.5;
          const sY = (y / pZ) * 1.5;
          
          if (i === 0) ctxPersist.moveTo(sX, sY);
          else ctxPersist.lineTo(sX, sY);
        }
      } else if (mode === 6) {
        // 3D Torus
        const R = Math.min(cx, cy) * torusR1;
        const r = Math.min(cx, cy) * torusR2;
        const rotX = t * 0.7;
        const rotY = t * 1.1;
        const rotZ = t * 0.3;

        const rotate3D = (x: number, y: number, z: number) => {
          const y1 = y * Math.cos(rotX) - z * Math.sin(rotX);
          const z1 = y * Math.sin(rotX) + z * Math.cos(rotX);
          const x2 = x * Math.cos(rotY) + z1 * Math.sin(rotY);
          const z2 = -x * Math.sin(rotY) + z1 * Math.cos(rotY);
          const x3 = x2 * Math.cos(rotZ) - y1 * Math.sin(rotZ);
          const y3 = x2 * Math.sin(rotZ) + y1 * Math.cos(rotZ);
          return { x: x3, y: y3, z: z2 };
        };

        for (let theta = 0; theta < Math.PI * 2; theta += Math.PI / 12) {
          let first = true;
          for (let phi = 0; phi <= Math.PI * 2 + 0.1; phi += 0.1) {
            const deform = hasAudio ? (currentRmsL + currentRmsR) * 0.5 * Math.sin(phi * 4 + t * 5) : 0;
            const rMod = r + deform * r;

            const ox = (R + rMod * Math.cos(theta)) * Math.cos(phi);
            const oy = (R + rMod * Math.cos(theta)) * Math.sin(phi);
            const oz = rMod * Math.sin(theta);

            const { x, y, z } = rotate3D(ox, oy, oz);
            const pZ = (z / R) + sphereDist;
            const sX = (x / pZ) * sphereScale;
            const sY = (y / pZ) * sphereScale;

            if (first) { ctxPersist.moveTo(sX, sY); first = false; }
            else ctxPersist.lineTo(sX, sY);
          }
        }
      } else if (mode === 7) {
        // Rose Curve
        const scaleMult = xyScale * 0.8;
        const maxR = Math.min(cx, cy) * scaleMult;
        const k = roseK / roseD;
        
        for (let i = 0; i <= Math.PI * 2 * roseD; i += 0.02) {
          let r = maxR * Math.cos(k * i + t);
          if (hasAudio) {
             r += (currentRmsL + currentRmsR) * 50 * Math.sin(i * 10);
          }
          const x = r * Math.cos(i);
          const y = r * Math.sin(i);
          if (i === 0) ctxPersist.moveTo(x, y);
          else ctxPersist.lineTo(x, y);
        }
      } else if (mode === 8) {
        // Circular Waveform
        const baseR = Math.min(cx, cy) * 0.5 * xyScale;
        if (hasAudio && analyserL) {
          const len = dataL.current.length;
          for (let i = 0; i <= len; i++) {
            const idx = i % len;
            const angle = (i / len) * Math.PI * 2 + t;
            const val = dataL.current[idx] * baseR * 2;
            const r = baseR + val;
            const x = r * Math.cos(angle);
            const y = r * Math.sin(angle);
            if (i === 0) ctxPersist.moveTo(x, y);
            else ctxPersist.lineTo(x, y);
          }
        } else {
           for (let i = 0; i <= Math.PI * 2; i += 0.05) {
             const r = baseR + Math.sin(i * 10 + t * 5) * 20;
             const x = r * Math.cos(i);
             const y = r * Math.sin(i);
             if (i === 0) ctxPersist.moveTo(x, y);
             else ctxPersist.lineTo(x, y);
           }
        }
      }

      ctxPersist.stroke();
      ctxPersist.restore();

      // 3. Draw to main canvas with bloom
      ctxMain.fillStyle = '#000a00';
      ctxMain.fillRect(0, 0, w, h);
      
      // Draw graticule
      if (showGraticule) {
        ctxMain.strokeStyle = 'rgba(0, 50, 0, 0.3)';
        ctxMain.lineWidth = 1;
        ctxMain.beginPath();
        for(let i=cx%40; i<w; i+=40) { ctxMain.moveTo(i,0); ctxMain.lineTo(i,h); }
        for(let i=cy%40; i<h; i+=40) { ctxMain.moveTo(0,i); ctxMain.lineTo(w,i); }
        ctxMain.stroke();
        ctxMain.beginPath();
        ctxMain.moveTo(cx, 0); ctxMain.lineTo(cx, h);
        ctxMain.moveTo(0, cy); ctxMain.lineTo(w, cy);
        ctxMain.stroke();
      }

      // Draw persist with optional RGB shift
      if (rgbShift > 0) {
        // Create an offscreen canvas to tint the persist layer
        const tintCanvas = document.createElement('canvas');
        tintCanvas.width = w;
        tintCanvas.height = h;
        const tCtx = tintCanvas.getContext('2d')!;
        
        ctxMain.globalCompositeOperation = 'screen';
        
        // Red channel
        tCtx.clearRect(0, 0, w, h);
        tCtx.drawImage(persist, 0, 0);
        tCtx.globalCompositeOperation = 'source-in';
        tCtx.fillStyle = '#ff0000';
        tCtx.fillRect(0, 0, w, h);
        ctxMain.drawImage(tintCanvas, -rgbShift * 15, 0);
        
        // Green channel
        tCtx.globalCompositeOperation = 'source-over';
        tCtx.clearRect(0, 0, w, h);
        tCtx.drawImage(persist, 0, 0);
        tCtx.globalCompositeOperation = 'source-in';
        tCtx.fillStyle = '#00ff00';
        tCtx.fillRect(0, 0, w, h);
        ctxMain.drawImage(tintCanvas, 0, 0);
        
        // Blue channel
        tCtx.globalCompositeOperation = 'source-over';
        tCtx.clearRect(0, 0, w, h);
        tCtx.drawImage(persist, 0, 0);
        tCtx.globalCompositeOperation = 'source-in';
        tCtx.fillStyle = '#0000ff';
        tCtx.fillRect(0, 0, w, h);
        ctxMain.drawImage(tintCanvas, rgbShift * 15, 0);
        
        ctxMain.globalCompositeOperation = 'source-over';
      } else {
        ctxMain.drawImage(persist, 0, 0);
      }
      
      // Bloom
      ctxMain.filter = 'blur(4px)';
      ctxMain.globalAlpha = 0.6;
      ctxMain.drawImage(persist, 0, 0);
      ctxMain.filter = 'none';
      ctxMain.globalAlpha = 1.0;

      reqRef.current = requestAnimationFrame(render);
    };

    reqRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(reqRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [isActive, mode, persistence, rotationSpeed, brightness, sphereRadius, sphereDist, sphereScale, spiralTurns, lissajousA, lissajousB, lissajousC, lissajousDelta, lissajousPhi, xyDelay, xyScale, torusR1, torusR2, roseK, roseD, rgbShift, showGraticule, infiniteLoop, hasAudio, analyserL, analyserR]);

  if (!isActive) return null;

  return (
    <div className="flex w-full h-full bg-[#111] p-4 md:p-8 items-center justify-center font-mono overflow-hidden">
      <div className="flex flex-col md:flex-row gap-8 bg-gradient-to-br from-[#2a2a2a] to-[#1a1a1a] p-6 md:p-8 rounded-xl border border-[#333] shadow-2xl max-w-full max-h-full">
        
        {/* Screen Bezel */}
        <div className="relative p-4 bg-[#1a1a1a] rounded-lg border-2 border-[#111] shadow-inner flex-1 flex flex-col items-center justify-center min-w-[300px] min-h-[300px]">
          <div className="absolute top-2 left-4 text-[#555] text-xs font-bold tracking-widest z-10">TEKTRONIX 760A</div>
          <div className="relative mt-4 rounded-lg overflow-hidden w-full aspect-square max-w-[1000px] max-h-[1000px]">
            <canvas 
              ref={canvasMain} 
              className="absolute inset-0 w-full h-full bg-[#000a00]"
              style={{
                boxShadow: 'inset 0 0 60px rgba(0,0,0,0.9), 0 0 20px rgba(0, 255, 180, 0.15)'
              }}
            />
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)'
            }} />
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex flex-col gap-6 w-full md:w-48 shrink-0">
          {/* VU Meters */}
          <div className="flex justify-around bg-[#0a0a0a] p-4 rounded border border-[#222] h-48 md:h-64">
            <VUMeter value={rmsL} label="L" peakRef={peakL} />
            <VUMeter value={rmsR} label="R" peakRef={peakR} />
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-4 bg-[#1a1a1a] p-4 rounded border border-[#333] flex-1 overflow-y-auto max-h-[80vh]">
            <div className="text-[#888] text-xs font-bold mb-2 border-b border-[#333] pb-1">DISPLAY MODE</div>
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(m => (
                <button 
                  key={m}
                  onClick={() => setMode(m)}
                  className={`py-1 text-xs rounded border transition-colors ${mode === m ? 'bg-[#00ffcc] text-black border-[#00ffcc]' : 'bg-[#222] text-[#888] border-[#444] hover:bg-[#333]'}`}
                >
                  M{m}
                </button>
              ))}
            </div>
            
            <div className="mt-2 flex gap-2">
              <button 
                onClick={() => setShowGraticule(!showGraticule)}
                className={`flex-1 py-1 text-xs rounded border transition-colors ${showGraticule ? 'bg-[#00ffcc] text-black border-[#00ffcc]' : 'bg-[#222] text-[#888] border-[#444] hover:bg-[#333]'}`}
              >
                GRID {showGraticule ? 'ON' : 'OFF'}
              </button>
              <button 
                onClick={() => setInfiniteLoop(!infiniteLoop)}
                className={`flex-1 py-1 text-xs rounded border transition-colors ${infiniteLoop ? 'bg-[#00ffcc] text-black border-[#00ffcc]' : 'bg-[#222] text-[#888] border-[#444] hover:bg-[#333]'}`}
              >
                INF LOOP {infiniteLoop ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="mt-4 flex flex-row md:flex-col gap-4 justify-around">
              <Knob label="PERSIST" value={persistence} min={0.01} max={0.4} step={0.01} onChange={setPersistence} />
              <Knob label="SPEED" value={rotationSpeed} min={0} max={0.1} step={0.001} onChange={setRotationSpeed} />
              <Knob label="INTENS" value={brightness} min={0.1} max={3} step={0.1} onChange={setBrightness} />
              <Knob label="RGB SFT" value={rgbShift} min={0} max={1} step={0.05} onChange={setRgbShift} />
            </div>

            {mode === 1 && (
              <div className="mt-4 flex flex-row md:flex-col gap-4 justify-around border-t border-[#333] pt-4">
                <Knob label="RADIUS" value={sphereRadius} min={0.1} max={1.5} step={0.05} onChange={setSphereRadius} />
                <Knob label="DIST" value={sphereDist} min={1.1} max={5.0} step={0.1} onChange={setSphereDist} />
                <Knob label="SCALE" value={sphereScale} min={0.5} max={8.0} step={0.1} onChange={setSphereScale} />
              </div>
            )}

            {mode === 2 && (
              <div className="mt-4 flex flex-row md:flex-col gap-4 justify-around border-t border-[#333] pt-4">
                <Knob label="TURNS" value={spiralTurns} min={1} max={20} step={1} onChange={setSpiralTurns} />
              </div>
            )}

            {mode === 3 && (
              <div className="mt-4 flex flex-row md:flex-col gap-4 justify-around border-t border-[#333] pt-4">
                <Knob label="PHASE" value={xyDelay} min={0} max={500} step={1} onChange={setXyDelay} />
                <Knob label="SCALE" value={xyScale} min={0.5} max={8.0} step={0.1} onChange={setXyScale} />
              </div>
            )}

            {mode === 5 && (
              <div className="mt-4 flex flex-row md:flex-col gap-4 justify-around border-t border-[#333] pt-4">
                <Knob label="SCALE" value={xyScale} min={0.5} max={8.0} step={0.1} onChange={setXyScale} />
              </div>
            )}

            {mode === 6 && (
              <div className="mt-4 flex flex-row md:flex-col gap-4 justify-around border-t border-[#333] pt-4">
                <Knob label="MAJOR R" value={torusR1} min={0.1} max={1.5} step={0.05} onChange={setTorusR1} />
                <Knob label="MINOR R" value={torusR2} min={0.1} max={1.0} step={0.05} onChange={setTorusR2} />
                <Knob label="SCALE" value={sphereScale} min={0.5} max={8.0} step={0.1} onChange={setSphereScale} />
              </div>
            )}

            {mode === 7 && (
              <div className="mt-4 flex flex-row md:flex-col gap-4 justify-around border-t border-[#333] pt-4">
                <Knob label="PETALS" value={roseK} min={1} max={12} step={1} onChange={setRoseK} />
                <Knob label="DENOM" value={roseD} min={1} max={10} step={1} onChange={setRoseD} />
                <Knob label="SCALE" value={xyScale} min={0.5} max={8.0} step={0.1} onChange={setXyScale} />
              </div>
            )}

            {mode === 8 && (
              <div className="mt-4 flex flex-row md:flex-col gap-4 justify-around border-t border-[#333] pt-4">
                <Knob label="SCALE" value={xyScale} min={0.5} max={8.0} step={0.1} onChange={setXyScale} />
              </div>
            )}

            {mode === 4 && (
              <div className="mt-4 flex flex-col gap-4 border-t border-[#333] pt-4">
                <div className="flex flex-row gap-4 justify-around">
                  <Knob label="FREQ A" value={lissajousA} min={1} max={10} step={1} onChange={setLissajousA} />
                  <Knob label="FREQ B" value={lissajousB} min={1} max={10} step={1} onChange={setLissajousB} />
                  <Knob label="FREQ C" value={lissajousC} min={1} max={10} step={1} onChange={setLissajousC} />
                </div>
                <div className="flex flex-row gap-4 justify-around">
                  <Knob label="DELTA" value={lissajousDelta} min={0} max={Math.PI * 2} step={0.1} onChange={setLissajousDelta} />
                  <Knob label="PHI" value={lissajousPhi} min={0} max={Math.PI * 2} step={0.1} onChange={setLissajousPhi} />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

const VUMeter = ({ value, label, peakRef }: any) => {
  const db = value > 0 ? 20 * Math.log10(value) : -60;
  const normalized = Math.max(0, Math.min(1, (db + 45) / 53)); // -45 to +8
  
  const now = Date.now();
  if (normalized > peakRef.current.val || now - peakRef.current.time > 2000) {
    peakRef.current = { val: normalized, time: now };
  }

  const segments = 30;
  
  return (
    <div className="flex flex-col items-center gap-2 h-full">
      <div className="text-[#00ffcc] text-[10px] font-bold">{label}</div>
      <div className="relative w-4 flex-1 bg-[#050505] border border-[#222] rounded-sm overflow-hidden flex flex-col-reverse gap-[1px] p-[1px]">
        {Array.from({ length: segments }).map((_, i) => {
          const threshold = i / segments;
          const isActive = normalized > threshold;
          const isPeak = Math.abs(peakRef.current.val - threshold) < (1/segments);
          
          let color = '#003300'; // off
          if (isActive || isPeak) {
            if (threshold > 0.9) color = '#ff0000';
            else if (threshold > 0.7) color = '#ffff00';
            else color = '#00ffcc';
          }
          
          return (
            <div 
              key={i} 
              className="w-full flex-1 rounded-sm transition-opacity duration-75"
              style={{ backgroundColor: color, opacity: isActive ? 1 : isPeak ? 0.8 : 0.3 }}
            />
          );
        })}
      </div>
      <div className="text-[#555] text-[8px]">{db.toFixed(0)}</div>
    </div>
  );
};

const Knob = ({ label, value, min, max, step, onChange }: any) => {
  const pct = (value - min) / (max - min);
  const angle = -135 + pct * 270;
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-[#444] to-[#222] border-2 border-[#111] shadow-lg flex items-center justify-center cursor-pointer">
        <div 
          className="absolute w-1 h-3 bg-white rounded-full top-1"
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: '50% 14px' }}
        />
        <input 
          type="range" 
          min={min} max={max} step={step} 
          value={value} 
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>
      <div className="text-[#888] text-[9px] font-bold tracking-wider">{label}</div>
    </div>
  );
};
