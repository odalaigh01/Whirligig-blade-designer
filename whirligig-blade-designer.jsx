import React, { useState, useMemo } from 'react';
import { 
  Download, Wind, Ruler, Globe, AlertCircle, 
  Circle, Leaf, ChevronUp, ChevronDown, 
  Layout, Crosshair, MoveDiagonal, Gauge, 
  Zap, ImageIcon
} from 'lucide-react';

/**
 * Whirligig Blade Designer
 * * A specialized tool for makers to design and balance wind-driven blades.
 * Features real-time physics simulation for Center of Gravity (CG) 
 * and Rotational Moment of Inertia (Flywheel Effect).
 * * Logic assumes a single-blade design intended for a multi-blade assembly.
 */
const App = () => {
  // --- Constants ---
  const IN_TO_MM = 25.4;
  const IN_TO_PX = 40; 
  const EXPORT_DPI = 150; 
  const DEFAULT_PITCH = 25; 
  const HUB_DIAMETER_FIXED = 3.5; 

  // --- Design Presets (Calibrated for the 35-42% Balance Range) ---
  const PRESETS = {
    leaf: {
      rootWidth: 1.75,     
      tipWidth: 2.5,      
      tipRadius: 0.65,    
      widthPosition: 0.6, 
      taperSharpness: 0.4,
      edgeCurvature: 0.5,
    },
    rounded: {
      rootWidth: 2.5,     
      tipWidth: 1.25,     
      tipRadius: 0.5,     
      widthPosition: 0.5,
      taperSharpness: 0.5,
      edgeCurvature: 0.38, 
    }
  };

  // --- UI State ---
  const [unit, setUnit] = useState('imperial'); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // --- Parameter State ---
  const [params, setParams] = useState({
    exposedLength: 10.5,
    tabLength: 1.0,
    tabWidth: 2.25,
    ...PRESETS.leaf,
    kerfOffset: 0.005, 
    tipStyle: 'leaf',
    quantity: 5, 
    hasPinHole: true,
    pinHoleSize: 0.125,
    pinHoleOffset: 0.5,
  });

  // Local state for input strings to maintain UI fluidity
  const [inputStates, setInputStates] = useState({
    exposedLength: "10.5", tabLength: "1.0", tabWidth: "2.25",
    rootWidth: "1.75", tipWidth: "2.5", pinHoleSize: "0.125",
    pinHoleOffset: "0.5"
  });

  // --- Helpers ---
  const toDisplayValue = (val) => unit === 'metric' ? (val * IN_TO_MM) : val;
  const fromDisplayValue = (val) => unit === 'metric' ? val / IN_TO_MM : val;
  const unitLabel = unit === 'imperial' ? 'in' : 'mm';

  const toggleUnits = () => {
    const newUnit = unit === 'imperial' ? 'metric' : 'imperial';
    setUnit(newUnit);
    const newStates = {};
    Object.keys(params).forEach(key => {
      if (typeof params[key] !== 'number') return;
      const val = params[key];
      const needsConversion = ['exposedLength', 'tabLength', 'tabWidth', 'rootWidth', 'tipWidth', 'pinHoleSize', 'pinHoleOffset'].includes(key);
      const displayVal = needsConversion ? (newUnit === 'metric' ? (val * IN_TO_MM) : val) : val;
      newStates[key] = needsConversion ? displayVal.toFixed(newUnit === 'metric' ? 1 : 3) : val.toString();
    });
    setInputStates(newStates);
  };

  const handleStyleChange = (style) => {
    const preset = PRESETS[style];
    const newParams = { ...params, ...preset, tipStyle: style };
    setParams(newParams);
    
    const newStates = { ...inputStates };
    Object.keys(preset).forEach(key => {
      const val = preset[key];
      const needsConversion = ['rootWidth', 'tipWidth'].includes(key);
      const displayVal = needsConversion ? (unit === 'metric' ? (val * IN_TO_MM) : val) : val;
      newStates[key] = needsConversion ? displayVal.toFixed(unit === 'metric' ? 1 : 3) : val.toString();
    });
    setInputStates(newStates);
  };

  // --- Geometry Engine ---
  const getWidthAt = (x, p) => {
    const hRoot = p.rootWidth / 2;
    const hMax = p.tipWidth / 2;
    const L = Math.max(0.1, p.exposedLength);
    if (x < 0) return p.tabWidth / 2;
    
    if (p.tipStyle === 'leaf') {
      const bX = L * p.widthPosition;
      const distToTip = L - bX;
      if (x <= bX) {
        const t = x / Math.max(0.001, bX);
        return hRoot + (hMax - hRoot) * Math.sin((t * Math.PI) / 2);
      } else {
        const t = (x - bX) / Math.max(0.001, distToTip);
        const bluntness = p.tipRadius;
        const sharpness = 1 + (p.taperSharpness * 3);
        const curve = Math.pow(Math.max(0, 1 - t), sharpness) * (1 - bluntness) + Math.sqrt(Math.max(0, 1 - t * t)) * bluntness;
        return hMax * curve;
      }
    } else {
      const t = x / L;
      const curvePower = p.edgeCurvature < 0.5 ? 1 + (0.5 - p.edgeCurvature) * 4 : 1 / (1 + (p.edgeCurvature - 0.5) * 4);
      let w = hRoot + (hMax - hRoot) * Math.pow(t, curvePower);
      if (x > L - p.tipRadius) {
        const tr = Math.max(0.01, p.tipRadius);
        const ratio = (x - (L - tr)) / tr;
        const circ = hMax * Math.sqrt(Math.max(0, 1 - ratio * ratio));
        w = Math.min(w, circ);
      }
      return w;
    }
  };

  // --- Physics Simulation ---
  const derived = useMemo(() => {
    const hubR = HUB_DIAMETER_FIXED / 2;
    let totalArea = params.tabLength * params.tabWidth;
    let weightedX = (-params.tabLength / 2) * (params.tabLength * params.tabWidth);
    let momentOfInertia = 0;
    const steps = 60;
    const dx = params.exposedLength / steps;
    
    for (let i = 0; i < steps; i++) {
      const x = (i + 0.5) * dx;
      const width = getWidthAt(x, params) * 2;
      const area = width * dx;
      totalArea += area;
      weightedX += x * area;
      const r = hubR + x;
      momentOfInertia += (r * r) * area;
    }
    
    const cgX = weightedX / Math.max(0.001, totalArea);
    const cgPercent = (cgX / Math.max(0.001, params.exposedLength)) * 100;
    const sweetStart = params.exposedLength * 0.35;
    const sweetEnd = params.exposedLength * 0.42;
    const pitchFactor = Math.sin(DEFAULT_PITCH * Math.PI / 180);
    const torqueDifficulty = (cgPercent / 40) * (pitchFactor / 0.42); 
    
    let sensitivity = "High";
    if (torqueDifficulty > 1.2) sensitivity = "Low (Heavy Tip)";
    else if (torqueDifficulty > 0.9) sensitivity = "Moderate";
    
    const flywheelScore = momentOfInertia / 100; 
    let flywheelRating = "Snappy";
    if (flywheelScore > 14) flywheelRating = "High Coast";
    else if (flywheelScore > 8) flywheelRating = "Steady";
    
    return { cgX, cgPercent, sweetStart, sweetEnd, sensitivity, flywheelRating };
  }, [params]);

  // --- Graphics Path ---
  const generateBladePath = (p, isClosed = true, scale = IN_TO_PX, applyKerf = false) => {
    const k = applyKerf ? p.kerfOffset * scale : 0;
    const totalX = p.exposedLength * scale + k;
    const tabStartX = -p.tabLength * scale - k;
    const hTab = (p.tabWidth / 2) * scale;
    const hRoot = (p.rootWidth / 2) * scale;
    const hTip = (p.tipWidth / 2) * scale;
    
    let path = `M ${tabStartX} ${-hTab - k} L ${tabStartX} ${hTab + k} L 0 ${hTab + k} L 0 ${hRoot + k} `;
    if (p.tipStyle === 'leaf') {
      const bulgeX = p.exposedLength * p.widthPosition * scale;
      const bulgeY = hTip + k;
      const distToTip = totalX - bulgeX;
      path += `C ${bulgeX * 0.5} ${hRoot + k} ${bulgeX * 0.85} ${bulgeY} ${bulgeX} ${bulgeY} `;
      path += `C ${bulgeX + (distToTip * (1 - p.taperSharpness))} ${bulgeY} ${totalX} ${bulgeY * (1 - p.tipRadius)} ${totalX} 0 `;
      path += `C ${totalX} ${-bulgeY * (1 - p.tipRadius)} ${bulgeX + (distToTip * (1 - p.taperSharpness))} ${-bulgeY} ${bulgeX} ${-bulgeY} `;
      path += `C ${bulgeX * 0.85} ${-bulgeY} ${bulgeX * 0.5} ${-hRoot - k} 0 ${-hRoot - k} `;
    } else {
      const cpX = totalX * 0.5;
      const cpY = (hRoot + (hTip - hRoot) * 0.5) + (p.edgeCurvature - 0.5) * 100;
      const r = Math.max(0.001, Math.min(p.tipRadius * scale, totalX * 0.3, hTip));
      path += `Q ${cpX} ${cpY} ${totalX - r} ${hTip + k} Q ${totalX} ${hTip + k} ${totalX} 0 Q ${totalX} ${-hTip - k} ${totalX - r} ${-hTip - k} Q ${cpX} ${-cpY} 0 ${-hRoot - k} `;
    }
    path += `L 0 ${-hRoot - k} L 0 ${-hTab - k} Z`;
    return path;
  };

  // --- Exports ---
  const downloadSVG = () => {
    const internalScale = 1.0; 
    const maxW = params.exposedLength + params.tabLength;
    const maxH = Math.max(params.rootWidth, params.tabWidth, params.tipWidth);
    const physicalWidth = maxW + 1.0;
    const physicalHeight = maxH + 1.0;
    const svgHeader = `<svg xmlns="http://www.w3.org/2000/svg" width="${physicalWidth}in" height="${physicalHeight}in" viewBox="0 0 ${physicalWidth} ${physicalHeight}">`;
    const yOff = (maxH / 2) + 0.5;
    const xOff = params.tabLength + 0.5;
    const pathData = generateBladePath(params, true, internalScale, true);
    let content = `<path d="${pathData}" transform="translate(${xOff}, ${yOff})" fill="none" stroke="black" stroke-width="0.01" />`;
    if (params.hasPinHole) {
      content += `<circle cx="${xOff - params.pinHoleOffset}" cy="${yOff}" r="${params.pinHoleSize / 2}" fill="none" stroke="red" stroke-width="0.01" />`;
    }
    const blob = new Blob([svgHeader + content + '</svg>'], { type: 'image/svg+xml' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `whirligig_blade_template.svg`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const downloadJPG = () => {
    const scale = EXPORT_DPI; 
    const maxW = params.exposedLength + params.tabLength;
    const maxH = Math.max(params.rootWidth, params.tabWidth, params.tipWidth);
    const canvas = document.createElement('canvas');
    canvas.width = (maxW + 2) * scale;
    canvas.height = (maxH + 2) * scale; 
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const yOff = (maxH / 2 + 1) * scale; const xOff = (params.tabLength + 1) * scale;
    ctx.save(); ctx.translate(xOff, yOff);
    const path2d = new Path2D(generateBladePath(params, true, scale, false));
    ctx.strokeStyle = 'black'; ctx.lineWidth = 3; ctx.stroke(path2d);
    if (params.hasPinHole) {
      ctx.beginPath(); ctx.arc(-params.pinHoleOffset * scale, 0, (params.pinHoleSize / 2) * scale, 0, Math.PI * 2);
      ctx.strokeStyle = 'red'; ctx.stroke();
    }
    ctx.restore();
    // Verification Scale Bar
    const barY = canvas.height - (0.5 * scale); const barX = 1 * scale;
    ctx.fillStyle = '#64748b'; ctx.font = `bold ${Math.round(0.12 * scale)}px sans-serif`;
    ctx.fillText(unit === 'imperial' ? "1 INCH SCALE BAR" : "50MM SCALE BAR", barX, barY - 10);
    ctx.beginPath(); ctx.moveTo(barX, barY);
    ctx.lineTo(barX + (unit === 'imperial' ? 1 : 50 / IN_TO_MM) * scale, barY);
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 3; ctx.stroke();
    const link = document.createElement('a'); link.href = canvas.toDataURL('image/jpeg', 0.98);
    link.download = `whirligig_blade_scale_template.jpg`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const handleTextChange = (key, val) => {
    setInputStates(prev => ({ ...prev, [key]: val }));
    const num = parseFloat(val);
    if (!isNaN(num)) setParams(p => ({ ...p, [key]: fromDisplayValue(Math.max(0, num)) }));
  };

  const handleSliderChange = (key, val) => {
    const num = parseFloat(val);
    setParams(p => ({ ...p, [key]: fromDisplayValue(num) }));
    setInputStates(p => ({ ...p, [key]: num.toString() }));
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <div className={`w-full md:w-80 bg-white border-r border-slate-200 flex flex-col shadow-sm transition-all duration-300 ${isSidebarOpen ? 'max-h-[75vh] md:max-h-screen' : 'max-h-[60px] md:w-20 overflow-hidden'}`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2 overflow-hidden">
            <Wind className="text-blue-600 flex-shrink-0" size={24} />
            <h1 className="text-lg font-bold tracking-tight truncate">Blade Designer</h1>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleUnits} className="p-1.5 bg-slate-100 rounded hover:bg-slate-200 transition-colors flex items-center gap-1 text-[10px] font-bold uppercase"><Globe size={14} /> <span>{unit}</span></button>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1.5 text-slate-400 hover:text-slate-600 md:hidden">{isSidebarOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section className="space-y-6">
            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 mb-2 block tracking-wider">Blade Selection</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
                <button className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-all ${params.tipStyle === 'rounded' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`} onClick={() => handleStyleChange('rounded')}><Circle size={14} /> Round</button>
                <button className={`flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-md transition-all ${params.tipStyle === 'leaf' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`} onClick={() => handleStyleChange('leaf')}><Leaf size={14} /> Leaf</button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase text-slate-400 mb-2 block tracking-wider">Profile Geometry ({unitLabel})</label>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Exposed Length</label>
                  <input type="text" value={inputStates.exposedLength} onChange={(e) => handleTextChange('exposedLength', e.target.value)} className="w-full p-2 border rounded text-sm font-mono outline-none" />
                </div>
                {params.tipStyle === 'leaf' ? (
                  <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Swell Pos</label><input type="range" min="0.1" max="0.9" step="0.05" value={params.widthPosition} onChange={(e) => setParams(p => ({...p, widthPosition: parseFloat(e.target.value)}))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none accent-blue-600" /></div>
                    <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Sharpness</label><input type="range" min="0" max="1" step="0.05" value={params.taperSharpness} onChange={(e) => setParams(p => ({...p, taperSharpness: parseFloat(e.target.value)}))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none accent-blue-600" /></div>
                    <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Bluntness</label><input type="range" min="0" max="1" step="0.05" value={params.tipRadius} onChange={(e) => setParams(p => ({...p, tipRadius: parseFloat(e.target.value)}))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none accent-blue-600" /></div>
                  </div>
                ) : (
                  <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Curvature</label><input type="range" min="0.2" max="0.8" step="0.01" value={params.edgeCurvature} onChange={(e) => setParams(p => ({...p, edgeCurvature: parseFloat(e.target.value)}))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none accent-blue-600" /></div>
                    <div><label className="text-[10px] font-bold text-slate-500 block mb-1">Rounding</label><input type="range" min="0" max={toDisplayValue(params.tipWidth / 2)} step={0.05} value={toDisplayValue(params.tipRadius)} onChange={(e) => handleSliderChange('tipRadius', e.target.value)} className="w-full h-2 bg-slate-200 rounded-lg appearance-none accent-blue-600" /></div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-slate-500 block mb-1">End Width</label><input type="text" value={inputStates.tipWidth} onChange={(e) => handleTextChange('tipWidth', e.target.value)} className="w-full p-2 border rounded text-xs" /></div>
                  <div><label className="text-xs text-slate-500 block mb-1">Root Width</label><input type="text" value={inputStates.rootWidth} onChange={(e) => handleTextChange('rootWidth', e.target.value)} className="w-full p-2 border rounded text-xs" /></div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <label className="text-[10px] font-semibold uppercase text-slate-400 mb-2 block tracking-wider">Tab & Assembly</label>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-slate-500 block mb-1">Tab Len</label><input type="text" value={inputStates.tabLength} onChange={(e) => handleTextChange('tabLength', e.target.value)} className="w-full p-2 border rounded text-xs" /></div>
                  <div><label className="text-xs text-slate-500 block mb-1">Tab Wid</label><input type="text" value={inputStates.tabWidth} onChange={(e) => handleTextChange('tabWidth', e.target.value)} className="w-full p-2 border rounded text-xs" /></div>
                </div>
                <div className="space-y-3 p-3 bg-blue-50/30 rounded-lg border border-blue-100/50">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={params.hasPinHole} onChange={(e) => setParams(p => ({...p, hasPinHole: e.target.checked}))} className="w-4 h-4 text-blue-600 rounded cursor-pointer" id="pinhole" />
                    <label htmlFor="pinhole" className="text-xs font-bold text-slate-700 cursor-pointer">Mechanical Pin Hole</label>
                  </div>
                  {params.hasPinHole && (
                    <div className="grid grid-cols-2 gap-2">
                      <div><label className="text-[9px] uppercase text-slate-400 font-bold block mb-1">Hole Dia</label><input type="text" value={inputStates.pinHoleSize} onChange={(e) => handleTextChange('pinHoleSize', e.target.value)} className="w-full p-1.5 border rounded text-xs font-mono" /></div>
                      <div><label className="text-[9px] uppercase text-slate-400 font-bold block mb-1">Dist from Hub</label><input type="text" value={inputStates.pinHoleOffset} onChange={(e) => handleTextChange('pinHoleOffset', e.target.value)} className="w-full p-1.5 border rounded text-xs font-mono" /></div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
               <button onClick={downloadSVG} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all"><Download size={18} /> Export SVG</button>
               <button onClick={downloadJPG} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"><ImageIcon size={18} /> Export JPG</button>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mt-4">
              <div className="flex items-center gap-2 mb-1"><Ruler size={14} className="text-amber-600" /><label className="text-xs font-bold text-amber-900">Pitch Guide</label></div>
              <p className="text-[10px] text-amber-800 leading-tight">Recommended hub angle for 3D printed parts is <b>25°</b> for light wind performance.</p>
            </div>
          </section>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col relative bg-white overflow-hidden">
        <div className="flex-1 flex items-center justify-center p-4 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
          <svg width="100%" height="100%" viewBox="-100 -200 800 400" className="drop-shadow-2xl transition-all">
            <g transform="translate(50, 0)">
              <line x1="-100" y1="0" x2="600" y2="0" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="4 4" />
              <rect x={derived.sweetStart * IN_TO_PX} y="-120" width={(derived.sweetEnd - derived.sweetStart) * IN_TO_PX} height="240" fill="#22c55e" fillOpacity="0.1" />
              <text x={(derived.sweetStart + derived.sweetEnd) / 2 * IN_TO_PX} y="-130" textAnchor="middle" className="fill-green-600 text-[8px] font-bold uppercase tracking-widest">Sweet Spot</text>
              
              <path d={generateBladePath(params, true)} fill="#fde68a" stroke="#92400e" strokeWidth="2" className="transition-all duration-300" />
              
              {params.hasPinHole && <circle cx={-params.pinHoleOffset * IN_TO_PX} cy="0" r={(params.pinHoleSize / 2) * IN_TO_PX} fill="white" stroke="#ef4444" strokeWidth="1.5" />}
              
              <g transform={`translate(${derived.cgX * IN_TO_PX}, 0)`} className="transition-all duration-300">
                <line x1="-15" y1="0" x2="15" y2="0" stroke="#ef4444" strokeWidth="1.5" /><line x1="0" y1="-15" x2="0" y2="15" stroke="#ef4444" strokeWidth="1.5" /><circle r="4" fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeWidth="0.5" />
                <g transform="translate(0, 25)"><rect x="-18" y="-8" width="36" height="12" rx="2" fill="white" stroke="#ef4444" strokeWidth="0.5" /><text textAnchor="middle" y="2" className="fill-red-600 text-[8px] font-mono font-bold">{derived.cgPercent.toFixed(1)}%</text></g>
              </g>

              <g className="fill-blue-500 text-[11px] font-mono pointer-events-none">
                <text x={params.exposedLength * IN_TO_PX / 2} y="-20" textAnchor="middle">{toDisplayValue(params.exposedLength).toFixed(unit === 'metric' ? 1 : 2)}{unitLabel}</text>
                <path d={`M 0 -10 L ${params.exposedLength * IN_TO_PX} -10`} stroke="#3b82f6" strokeWidth="1" strokeDasharray="2 2" />
                <line x1="0" y1="-100" x2="0" y2="100" stroke="#e2e8f0" strokeWidth="1" />
              </g>
            </g>
          </svg>
        </div>

        {/* Footer Metrics */}
        <div className="p-3 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-slate-400 font-medium z-10 shadow-lg">
          <div className="flex gap-4 sm:gap-6 uppercase tracking-tighter">
            <div className="flex items-center gap-1.5" title="Center of Gravity Location"><Crosshair size={12} className="text-red-500"/> <span className="text-white">BALANCE: {derived.cgPercent.toFixed(1)}%</span></div>
            <div className="flex items-center gap-1.5" title="Start-up torque in light wind"><Gauge size={12} className="text-blue-400"/> <span className="text-white">SENSITIVITY: {derived.sensitivity}</span></div>
            <div className="flex items-center gap-1.5" title="Ability to maintain momentum between gusts"><Zap size={12} className="text-amber-400"/> <span className="text-white">FLYER: {derived.flywheelRating}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-white ${derived.cgPercent >= 35 && derived.cgPercent <= 42 ? 'bg-green-600' : 'bg-amber-600'}`}>
              {derived.cgPercent >= 35 && derived.cgPercent <= 42 ? 'IDEAL RANGE' : 'OFFSET'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;