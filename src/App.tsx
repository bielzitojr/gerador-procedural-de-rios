import React, { useState, useCallback } from 'react';
import { RiverCanvas } from './components/RiverCanvas';
import { ControlPanel } from './components/ControlPanel';
import { RiverConfig, ViewMode, CameraMode, TimeOfDay } from './types';
import {
  RotateCcw,
  Sparkles,
  Maximize2,
  HelpCircle,
  X,
  Compass,
  Box,
  Sun,
  Sunset,
  Moon,
  Hand,
  CloudRain,
  Clock,
} from 'lucide-react';

const INITIAL_CONFIG: RiverConfig = {
  seed: 1337,
  meander: 0.65,
  riverWidth: 8.5,
  depth: 2.2,
  flowSpeed: 1.0,
  rockDensity: 16,
  terrainRoughness: 1.1,
  length: 16,
  paletteId: 'godot_cyan', // Shader original importado da imagem
  foamWidth: 0.42,
  causticScale: 1.7,
  waveHeight: 0.15,
  duckCount: 2,
  currentStrength: 1.2,

  // Ciclo Dia / Noite & Clima
  timeOfDay: 'day',
  timeHour: 11.5,
  dayNightCycleEnabled: true,
  dayNightSpeed: 0.8,
  isRaining: false,
  rainIntensity: 1.0,

  // Propriedades Físicas da Água
  waterDensity: 1.0,
  buoyancy: 1.4,
  waterViscosity: 0.8,
  waveDamping: 0.975,
  rippleIntensity: 1.2,
};

export default function App() {
  const [config, setConfig] = useState<RiverConfig>(INITIAL_CONFIG);
  const [viewMode, setViewMode] = useState<ViewMode>('reference_pool');
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [showHelp, setShowHelp] = useState(false);

  const handleRandomizeSeed = useCallback(() => {
    setConfig((prev) => ({
      ...prev,
      seed: Math.floor(Math.random() * 999999) + 1,
    }));
  }, []);

  const handleResetConfig = useCallback(() => {
    setConfig({
      ...INITIAL_CONFIG,
      seed: Math.floor(Math.random() * 999999) + 1,
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
        viewMode={viewMode}
        cameraMode={cameraMode}
        onCameraModeChange={setCameraMode}
      />

      {/* Floating Control Panel */}
      <ControlPanel
        config={config}
        onChange={setConfig}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        cameraMode={cameraMode}
        onCameraModeChange={setCameraMode}
        onRandomizeSeed={handleRandomizeSeed}
      />

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

        {/* Quick Mode Toggle Pill */}
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-1 flex items-center shadow-lg">
          <button
            id="quick-toggle-river"
            onClick={() => setViewMode('river')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'river'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Rio
          </button>
          <button
            id="quick-toggle-pool"
            onClick={() => setViewMode('reference_pool')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'reference_pool'
                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            Piscina
          </button>
        </div>

        {/* Interactive Push Duck / Splash Button */}
        {viewMode === 'reference_pool' && (
          <button
            id="btn-push-duck-top"
            onClick={() => window.dispatchEvent(new CustomEvent('applet:push-duck'))}
            className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 border border-amber-400/40 shadow-lg transition-all flex items-center gap-1.5 text-xs font-medium"
            title="Empurrar o patinho para baixo para ver o efeito de flutuação e ondulações"
          >
            <Hand className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mergulhar Pato</span>
          </button>
        )}

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
          title="Sobre o Shader de Água"
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
            {viewMode === 'river'
              ? `Rio Procedural • Semente: ${config.seed} • ${config.duckCount} Patinhos`
              : 'Piscina de Referência 1:1 (Shader Toon Water)'}
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
                  Shader de Água Estilizada (Toon Water)
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
                Este projeto reproduz com precisão o shader de água estilizado da sua imagem de referência:
              </p>
              <ul className="space-y-2 list-disc list-inside text-slate-300 pl-1">
                <li>
                  <strong className="text-cyan-300">Espuma de Contato Dinâmica:</strong> Análise de buffer de profundidade e bordas calculando a faixa branca sólida ao redor das margens, patinhos e rochas.
                </li>
                <li>
                  <strong className="text-cyan-300">Cáusticas Voronoi Celulares:</strong> Padrão procedural de reflexos cristalinos em formato celular que deslizam com a correnteza.
                </li>
                <li>
                  <strong className="text-cyan-300">Gradiente de Profundidade:</strong> Transição suave entre turquesa raso translúcido e azul profundo no leito do rio.
                </li>
                <li>
                  <strong className="text-cyan-300">Patinho de Borracha:</strong> Flutua e navega seguindo a correnteza e a ondulação das ondas com física suave.
                </li>
                <li>
                  <strong className="text-cyan-300">Dois Modos de Visualização:</strong> O <em>Rio Procedural</em> (canyon com curvas, relevo e pedras) e a <em>Piscina de Referência</em> (a cena exata da sua imagem com o pato e as pílulas).
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
