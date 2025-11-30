import React, { useState, useCallback } from 'react';
import VoidCanvas from './components/VoidCanvas';
import { interpretVoid } from './services/geminiService';
import { VoidState, HandGestures } from './types';
import { Settings, Info, Minimize2, Eye } from 'lucide-react';

const App: React.FC = () => {
  const [appState, setAppState] = useState<VoidState>(VoidState.IDLE);
  const [gestures, setGestures] = useState<HandGestures>({ isDetected: false, pinchDistance: 0, rotationAngle: 0, isFist: false });
  const [oracleMessage, setOracleMessage] = useState<string>("");
  const [isOracleLoading, setIsOracleLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  
  // Settings State
  const [ringHeight, setRingHeight] = useState<number>(0);
  const [rotationSpeed, setRotationSpeed] = useState<number>(30); 
  const [invertRotation, setInvertRotation] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

  const handleStateChange = useCallback((newState: VoidState) => {
    setAppState(newState);
  }, []);

  const handleGestureUpdate = useCallback((newGestures: HandGestures) => {
    setGestures(newGestures);
  }, []);

  const consultOracle = async () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    setIsOracleLoading(true);
    setOracleMessage("Analyzing...");
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.5);
    const interpretation = await interpretVoid(imageBase64);
    setOracleMessage(interpretation);
    setIsOracleLoading(false);
  };

  const mappedSpeed = rotationSpeed * 0.0005;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-white text-slate-900 font-mono select-none">
      
      {/* 3D Canvas Layer */}
      <VoidCanvas 
        onStateChange={handleStateChange}
        onGestureUpdate={handleGestureUpdate}
        isAnalyzerActive={isOracleLoading}
        verticalOffset={ringHeight}
        baseRotationSpeed={mappedSpeed}
        invertRotation={invertRotation}
        isAnimating={isAnimating}
      />

      {/* Ghost Button: Show UI */}
      {!uiVisible && (
        <button 
            onClick={() => setUiVisible(true)}
            className="absolute top-6 right-6 z-20 bg-white/10 backdrop-blur-md p-3 rounded-full text-slate-600 shadow-lg"
        >
            <Eye size={20} />
        </button>
      )}

      {/* Main UI Overlay */}
      <div className={`absolute inset-0 pointer-events-none z-10 flex flex-col justify-between transition-opacity duration-500 ${uiVisible ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Top Bar */}
        <div className="flex justify-between items-center p-6 bg-gradient-to-b from-white/90 to-transparent">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tighter" style={{ fontFamily: '"Press Start 2P", system-ui' }}>
                    魔法石<span className="text-cyan-500 text-sm align-top">2.0</span>
                </h1>
                <div className="flex items-center gap-2 mt-2">
                    <div className={`w-2 h-2 rounded-full ${gestures.isDetected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                    <span className="text-[10px] md:text-xs font-bold tracking-widest text-slate-400">
                        {appState === VoidState.LOADING_VISION ? 'INIT...' : 
                         gestures.isDetected ? 'LINKED' : 'SCANNING'}
                    </span>
                </div>
            </div>
            
            <div className="flex gap-2 pointer-events-auto">
                <button 
                    onClick={() => setUiVisible(false)}
                    className="p-3 bg-white/50 backdrop-blur-sm rounded-full hover:bg-white shadow-sm transition-all"
                >
                    <Minimize2 size={18} className="text-slate-600" />
                </button>
                <button 
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-3 backdrop-blur-sm rounded-full shadow-sm transition-all ${showSettings ? 'bg-cyan-500 text-white' : 'bg-white/50 text-slate-600 hover:bg-white'}`}
                >
                    <Settings size={18} />
                </button>
            </div>
        </div>

        {/* Middle Area: Interpretation Bubble */}
        <div className="flex-1 flex items-center justify-center p-6 pointer-events-none">
            {oracleMessage && (
                <div className="bg-white/80 backdrop-blur-xl border border-white shadow-2xl rounded-2xl p-6 max-w-sm text-center animate-in fade-in zoom-in duration-300">
                    <span className="text-cyan-600 text-xs font-bold tracking-widest block mb-2">SYSTEM OUTPUT</span>
                    <p className="text-sm font-medium leading-relaxed text-slate-800">
                        "{oracleMessage}"
                    </p>
                    <button 
                        onClick={() => setOracleMessage("")} 
                        className="mt-4 text-xs text-slate-400 hover:text-slate-900 pointer-events-auto underline decoration-dotted"
                    >
                        Dismiss
                    </button>
                </div>
            )}
        </div>

        {/* Bottom Drawer Controls */}
        <div className="bg-white/80 backdrop-blur-xl border-t border-slate-200 pointer-events-auto transition-transform duration-300 ease-in-out">
            
            {/* Settings Panel (Collapsible) */}
            {showSettings && (
                <div className="p-6 border-b border-slate-100 grid grid-cols-2 gap-x-8 gap-y-6 animate-in slide-in-from-bottom-4">
                    <div className="col-span-2 md:col-span-1 space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Elevation</label>
                        <input 
                            type="range" min="-200" max="200" 
                            value={ringHeight} onChange={(e) => setRingHeight(Number(e.target.value))}
                            className="w-full h-1 bg-slate-200 rounded-lg appearance-none accent-cyan-600"
                        />
                    </div>
                    <div className="col-span-2 md:col-span-1 space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sensitivity</label>
                        <input 
                            type="range" min="0" max="100" 
                            value={rotationSpeed} onChange={(e) => setRotationSpeed(Number(e.target.value))}
                            className="w-full h-1 bg-slate-200 rounded-lg appearance-none accent-cyan-600"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600">Reverse Rotation</span>
                        <button 
                            onClick={() => setInvertRotation(!invertRotation)}
                            className={`w-10 h-6 rounded-full relative transition-colors ${invertRotation ? 'bg-cyan-500' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${invertRotation ? 'left-5' : 'left-1'}`} />
                        </button>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-600">Skeleton Animation</span>
                        <button 
                            onClick={() => setIsAnimating(!isAnimating)}
                            className={`w-10 h-6 rounded-full relative transition-colors ${isAnimating ? 'bg-rose-500' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isAnimating ? 'left-5' : 'left-1'}`} />
                        </button>
                    </div>
                </div>
            )}

            {/* Main Action Bar */}
            <div className="p-4 flex items-center gap-4 safe-area-bottom">
                
                {/* Status Indicator (Compact) */}
                <div className="hidden md:block flex-1 text-[10px] text-slate-400 font-bold space-y-1">
                     <p>R: {gestures.isFist ? 'G-LOCK' : `${Math.round(gestures.pinchDistance * 100)}%`} | A: {Math.round(gestures.rotationAngle * 57.2)}°</p>
                </div>

                {/* Main Action Button */}
                <button
                    onClick={consultOracle}
                    disabled={isOracleLoading || appState !== VoidState.ACTIVE}
                    className="flex-1 bg-slate-900 text-white rounded-xl py-4 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50 shadow-lg shadow-slate-300/50"
                >
                    {isOracleLoading ? (
                        <span className="text-xs font-bold animate-pulse">PROCESSING...</span>
                    ) : (
                        <>
                            <span className="text-cyan-400 text-lg">✦</span>
                            <span className="text-xs font-bold tracking-widest">INTERPRET</span>
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default App;