import React, { useState, useCallback } from 'react';
import { RiverCanvas } from './components/RiverCanvas';
import { ControlPanel } from './components/ControlPanel';
import { RiverConfig, CameraMode } from './types';
import {
  RotateCcw,
  Sparkles,
  Maximize2,
  HelpCircle,
  X,
  Sun,
  Sunset,
  Moon,
  CloudRain,
  Clock,
} from 'lucide-react';

const INITIAL_CONFIG: RiverConfig = {
  waterMode: 'river',
  environment: { scale: 22, height: 16, depth: 12, density: 24, intensity: 1, rainbow: true },

  // 1. Rio Procedural
  seed: 1337,
  meander: 0.65,
  riverWidth: 8.5,
  depth: 2.2,
  flowSpeed: 1.0,
  rockDensity: 16,
  terrainRoughness: 1.1,
  length: 16,
  duckCount: 2,
  currentStrength: 1.2,

  // 2. Água Toon & Shader Godot
  paletteId: 'godot_cyan', // Shader original importado da imagem
  foamWidth: 0.42,
  causticScale: 1.7,
  waveHeight: 0.15,
  translucency: 0.85,
  refractionAmount: 0.5,
  highlightIntensity: 0.90,
  isCalmWater: false,
  calmWaterIntensity: 1.0,
  waveVariant: 'leve',

  // Ciclo Dia / Noite & Clima
  timeOfDay: 'day',
  timeHour: 11.5,
  dayNightCycleEnabled: true,
  dayNightSpeed: 0.8,

  // 3. Chuva
  isRaining: false,
  rainIntensity: 1.0,
  rain: {
    isRaining: false,
    rainIntensity: 1.0,
    dropletCount: 2800,
    windAngle: 8.0,
    splashIntensity: 1.0,
    rippleFrequency: 1.0,
  },

  // 4. Poças d'água no Terreno
  puddles: {
    puddleCount: 14,
    puddleRadius: 3.2,
    puddleDepth: 0.65,
    mudRimWidth: 1.1,
    puddleSeed: 5555,
    puddleWetness: 1.2,
    isCalmWater: true,
  },

  // 5. Lagos
  lake: {
    lakeRadius: 30,
    lakeDepth: 3.5,
    lakeIrregularity: 0.75,
    lakeIslandCount: 1,
    lakeCalmness: 1.0,
    lakeRockDensity: 18,
    lakeSeed: 4242,
    isCalmWater: true,
  },

  // 6. Oceanos e Praias (Ondas)
  ocean: {
    waveVariant: 'leve',
    oceanSwellHeight: 1.6,
    oceanWaveLength: 22,
    oceanChoppiness: 1.0,
    oceanSpeed: 1.2,
    oceanFoamCrests: 0.8,
    shoreWash: 1.5,
    oceanSeed: 8888,
  },

  // Propriedades Físicas da Água
  waterDensity: 1.0,
  buoyancy: 1.4,
  waterViscosity: 0.8,
  waveDamping: 0.975,
  rippleIntensity: 1.2,
};

export default function App() {
  const [config, setConfig] = useState<RiverConfig>(INITIAL_CONFIG);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [showHelp, setShowHelp] = useState(false);

  const handleRandomizeSeed = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 999999) + 1;
    setConfig((prev) => {
      if (prev.waterMode === 'lake') {
        return {
          ...prev,
          lake: { ...prev.lake, lakeSeed: newSeed },
        };
      }
      if (prev.waterMode === 'ocean') {
        return {
          ...prev,
          ocean: { ...prev.ocean, oceanSeed: newSeed },
        };
      }
      if (prev.waterMode === 'puddles') {
        return {
          ...prev,
          puddles: { ...prev.puddles, puddleSeed: newSeed },
        };
      }
      return {
        ...prev,
        seed: newSeed,
      };
    });
  }, []);

  const handleResetConfig = useCallback(() => {
    setConfig({
      ...INITIAL_CONFIG,
      seed: Math.floor(Math.random() * 999999) + 1,
      lake: { ...INITIAL_CONFIG.lake, lakeSeed: Math.floor(Math.random() * 999999) + 1 },
      ocean: { ...INITIAL_CONFIG.ocean, oceanSeed: Math.floor(Math.random() * 999999) + 1 },
      puddles: { ...INITIAL_CONFIG.puddles, puddleSeed: Math.floor(Math.random() * 999999) + 1 },
    });
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  return (
    <div id="river-app-root" className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* 3D WebGL Canvas */}
      <RiverCanvas
        config={config}
        cameraMode={cameraMode}
        onCameraModeChange={setCameraMode}
      />

      {/* Floating Control Panel */}
      <ControlPanel
        config={config}
        onChange={setConfig}
        cameraMode={cameraMode}
        onCameraModeChange={setCameraMode}
        onRandomizeSeed={handleRandomizeSeed}
      />

      <div className="absolute bottom-14 right-4 z-30 flex flex-col items-end gap-2">
        <button id="first-person-toggle" onClick={() => setCameraMode(cameraMode === 'first_person' ? 'orbit' : 'first_person')} className="rounded-lg bg-slate-900/90 border border-cyan-500/50 text-cyan-200 px-4 py-2 text-sm">{cameraMode === 'first_person' ? 'Sair da primeira pessoa' : 'Explorar em primeira pessoa'}</button>
        {cameraMode === 'first_person' && <div className="rounded-lg bg-slate-950/90 p-3 text-xs text-slate-200 max-w-72"><p>WASD / setas: mover · Shift: acelerar<br />Arraste a cena para olhar ao redor.</p><div className="flex gap-2 mt-2">{[['KeyA','←'],['KeyW','↑'],['KeyS','↓'],['KeyD','→']].map(([key,label]) => <button key={key} aria-label={'Mover ' + label} className="bg-slate-700 rounded p-3 touch-none" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId); window.dispatchEvent(new CustomEvent('explorer-move',{detail:{key,down:true}}));}} onPointerUp={()=>window.dispatchEvent(new CustomEvent('explorer-move',{detail:{key,down:false}}))} onPointerCancel={()=>window.dispatchEvent(new CustomEvent('explorer-move',{detail:{key,down:false}}))}>{label}</button>)}</div></div>}
      </div>
      {/* Top Right Quick Actions Bar */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        {/* Quick Day / Sunset / Night Toggle Pill */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-1 flex items-center shadow-lg">
          <button
            id="quick-time-cycle"
            onClick={() =>
              setConfig((p) => ({
                ...p,
                dayNightCycleEnabled: !(p.dayNightCycleEnabled ?? true),
              }))
            }
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              config.dayNightCycleEnabled ?? true
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Alternar rotação contínua astronômica Dia / Noite"
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {config.dayNightCycleEnabled ? 'Rotação Ativa' : 'Pausado'}
            </span>
          </button>
          <button
            id="quick-time-day"
            onClick={() =>
              setConfig((p) => ({
                ...p,
                timeOfDay: 'day',
                timeHour: 12.0,
                dayNightCycleEnabled: false,
              }))
            }
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              config.timeOfDay === 'day' && !config.dayNightCycleEnabled
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Modo Dia (Iluminação Solar Clara - 12h)"
          >
            <Sun className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dia</span>
          </button>
          <button
            id="quick-time-sunset"
            onClick={() =>
              setConfig((p) => ({
                ...p,
                timeOfDay: 'sunset',
                timeHour: 17.8,
                dayNightCycleEnabled: false,
              }))
            }
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              config.timeOfDay === 'sunset' && !config.dayNightCycleEnabled
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Modo Entardecer (Pôr do Sol Dourado - 17h48)"
          >
            <Sunset className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Entardecer</span>
          </button>
          <button
            id="quick-time-night"
            onClick={() =>
              setConfig((p) => ({
                ...p,
                timeOfDay: 'night',
                timeHour: 0.0,
                dayNightCycleEnabled: false,
              }))
            }
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              config.timeOfDay === 'night' && !config.dayNightCycleEnabled
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Modo Noite (Luar Prateado & Céu Estrelado - 00h)"
          >
            <Moon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Noite</span>
          </button>
        </div>

        {/* Quick Rain Toggle */}
        <button
          id="quick-toggle-rain"
          onClick={() => setConfig((p) => ({ ...p, isRaining: !p.isRaining }))}
          className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg backdrop-blur-md border ${
            config.isRaining
              ? 'bg-cyan-600/90 text-white border-cyan-400/50 shadow-cyan-900/30'
              : 'bg-slate-900/80 text-slate-300 hover:text-white border-slate-700/60'
          }`}
          title={config.isRaining ? 'Chuva Ativada (Clique para desligar)' : 'Chuva Desativada (Clique para ligar)'}
        >
          <CloudRain className={`w-4 h-4 ${config.isRaining ? 'text-cyan-200 animate-pulse' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">{config.isRaining ? 'Chuva Ligada' : 'Chuva'}</span>
        </button>

        {/* Reset */}
        <button
          id="btn-reset"
          onClick={handleResetConfig}
          className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 shadow-lg transition-all"
          title="Redefinir Parâmetros"
          aria-label="Redefinir parâmetros padrão"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Info / Help */}
        <button
          id="btn-info"
          onClick={() => setShowHelp(true)}
          className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 shadow-lg transition-all"
          title="Sobre o Gerador de Rios"
          aria-label="Sobre o shader e controles"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Fullscreen */}
        <button
          id="btn-fullscreen"
          onClick={toggleFullscreen}
          className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 shadow-lg transition-all"
          title="Tela Cheia"
          aria-label="Alternar tela cheia"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Center Status Pill */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 px-4 py-1.5 rounded-full shadow-xl flex items-center gap-2.5 text-xs text-slate-200">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-medium">
            Ambiente Aquático • Semente: {config.seed} • {config.duckCount} Patinhos
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-cyan-300 text-[11px]">
            Arraste com o mouse para orbitar a cena 3D
          </span>
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full shadow-2xl text-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h2 className="text-base font-semibold text-white">
                  Gerador Procedural de Rios (Shader Toon Water)
                </h2>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <p>
                Gerador procedural de rios em 3D com shader de água estilizada toon:
              </p>
              <ul className="space-y-2 list-disc list-inside text-slate-300 pl-1">
                <li>
                  <strong className="text-cyan-300">Espuma de Contato Dinâmica:</strong> Margens do rio e rochas submersas geram espuma suave e viva.
                </li>
                <li>
                  <strong className="text-cyan-300">Cáusticas Voronoi Celulares:</strong> Padrão procedural de reflexos cristalinos deslizando com a correnteza.
                </li>
                <li>
                  <strong className="text-cyan-300">Gradiente de Profundidade:</strong> Transição suave entre turquesa raso e azul profundo no leito do rio.
                </li>
                <li>
                  <strong className="text-cyan-300">Física de Objetos e Patinhos:</strong> Flutuação, inércia, ondas de choque ao clicar e natação ao longo da correnteza.
                </li>
                <li>
                  <strong className="text-cyan-300">Ciclo Dia/Noite & Clima:</strong> Luz dinâmica, sol, lua, chuva, poças de água e tocha com física de fogo realista.
                </li>
              </ul>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
