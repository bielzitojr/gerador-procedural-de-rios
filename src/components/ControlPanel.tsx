import React, { useState } from 'react';
import {
  Sparkles,
  Waves,
  Shuffle,
  Eye,
  Camera,
  Layers,
  ChevronDown,
  ChevronUp,
  Sliders,
  Compass,
  Sun,
  Sunset,
  Moon,
  Activity,
  Droplets,
  Hand,
  CloudRain,
  Clock,
  Flame,
  RotateCw,
  Anchor,
  Ship,
  Trash2,
} from 'lucide-react';
import { RiverConfig, CameraMode } from '../types';
import { WATER_PALETTES } from '../shaders/waterShader';
import { PhysicalObjectType, PHYSICAL_OBJECT_DEFS } from './RiverObjects';

interface ControlPanelProps {
  config: RiverConfig;
  onChange: (newConfig: RiverConfig) => void;
  cameraMode: CameraMode;
  onCameraModeChange: (mode: CameraMode) => void;
  onRandomizeSeed: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  config,
  onChange,
  cameraMode,
  onCameraModeChange,
  onRandomizeSeed,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'river' | 'water' | 'physics' | 'camera'>('water');

  const update = <K extends keyof RiverConfig>(key: K, val: RiverConfig[K]) => {
    onChange({
      ...config,
      [key]: val,
    });
  };

  const handlePushDuck = () => {
    window.dispatchEvent(new CustomEvent('applet:push-duck'));
  };

  const handleSpawnObject = (type: PhysicalObjectType) => {
    window.dispatchEvent(
      new CustomEvent('applet:spawn-river-object', {
        detail: { type, dropFromHeight: true },
      })
    );
  };

  const handleClearObjects = () => {
    window.dispatchEvent(new CustomEvent('applet:clear-river-objects'));
  };

  return (
    <aside
      id="river-control-panel"
      className="absolute top-4 left-4 z-20 w-84 max-w-[calc(100vw-2rem)] flex flex-col bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-2xl text-slate-100 transition-all duration-200"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white leading-tight">
              Água Toon & Rio
            </h1>
            <p className="text-[11px] text-cyan-400 font-medium">Shader Godot & Física Fluida</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="toggle-panel-btn"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title={isExpanded ? 'Recolher' : 'Expandir'}
            aria-label="Expandir ou recolher painel"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3.5 space-y-3.5 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
          {/* Ciclo Dia / Noite com Rotação Semelhante à Realidade */}
          <div className="space-y-1.5 p-2 bg-slate-800/60 rounded-lg border border-slate-700/60">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Ciclo Dia / Noite Astronômico
              </span>
              <button
                id="toggle-day-night-rotation"
                onClick={() =>
                  update('dayNightCycleEnabled', !(config.dayNightCycleEnabled ?? true))
                }
                className={`px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 transition-all ${
                  config.dayNightCycleEnabled ?? true
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-slate-700 text-slate-300 hover:text-white'
                }`}
                title="Ativar/Desativar rotação contínua do Sol e da Lua"
              >
                <RotateCw className={`w-3 h-3 ${config.dayNightCycleEnabled ? 'animate-spin' : ''}`} />
                {config.dayNightCycleEnabled ? 'Orbitando' : 'Pausado'}
              </button>
            </div>

            {/* Presets Rápidos */}
            <div className="bg-slate-900/60 p-1 rounded-md flex border border-slate-700/50 gap-1">
              <button
                id="control-time-dawn"
                onClick={() => {
                  onChange({ ...config, timeOfDay: 'day', timeHour: 6.5, dayNightCycleEnabled: false });
                }}
                className="flex-1 py-1 px-1 rounded text-[10px] font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-all text-center"
                title="6h30 - Alvorecer com tons rosados e sol nascente"
              >
                Alvorada
              </button>
              <button
                id="control-time-day"
                onClick={() => {
                  onChange({ ...config, timeOfDay: 'day', timeHour: 12.0, dayNightCycleEnabled: false });
                }}
                className={`flex-1 py-1 px-1 rounded text-[10px] font-medium flex items-center justify-center gap-0.5 transition-all ${
                  Math.abs((config.timeHour ?? 12) - 12) < 2
                    ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sun className="w-3 h-3" />
                Meio-Dia
              </button>
              <button
                id="control-time-sunset"
                onClick={() => {
                  onChange({ ...config, timeOfDay: 'sunset', timeHour: 17.8, dayNightCycleEnabled: false });
                }}
                className={`flex-1 py-1 px-1 rounded text-[10px] font-medium flex items-center justify-center gap-0.5 transition-all ${
                  Math.abs((config.timeHour ?? 12) - 17.8) < 1.5
                    ? 'bg-orange-500 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Sunset className="w-3 h-3" />
                Pôr do Sol
              </button>
              <button
                id="control-time-night"
                onClick={() => {
                  onChange({ ...config, timeOfDay: 'night', timeHour: 0.0, dayNightCycleEnabled: false });
                }}
                className={`flex-1 py-1 px-1 rounded text-[10px] font-medium flex items-center justify-center gap-0.5 transition-all ${
                  (config.timeHour ?? 12) >= 22 || (config.timeHour ?? 12) <= 3
                    ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Moon className="w-3 h-3" />
                Noite
              </button>
            </div>

            {/* Slider de Hora do Dia */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Posição Orbital do Sol & Lua</span>
                <span className="font-mono text-cyan-300">
                  {Math.floor(config.timeHour ?? 12).toString().padStart(2, '0')}:
                  {Math.floor(((config.timeHour ?? 12) % 1) * 60).toString().padStart(2, '0')}h
                </span>
              </div>
              <input
                id="slider-time-hour"
                type="range"
                min="0"
                max="24"
                step="0.25"
                value={config.timeHour ?? 12}
                onChange={(e) => {
                  const hour = parseFloat(e.target.value);
                  let timeOfDay: RiverConfig['timeOfDay'] = 'day';
                  if (hour >= 17.0 && hour <= 19.5) timeOfDay = 'sunset';
                  else if (hour > 19.5 || hour < 5.5) timeOfDay = 'night';
                  onChange({ ...config, timeHour: hour, timeOfDay, dayNightCycleEnabled: false });
                }}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Velocidade da Rotação */}
            {config.dayNightCycleEnabled && (
              <div className="space-y-1 pt-1 border-t border-slate-700/50">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Velocidade de Rotação Orbital</span>
                  <span className="font-mono text-amber-300">{(config.dayNightSpeed ?? 0.8).toFixed(1)}x</span>
                </div>
                <input
                  id="slider-day-night-speed"
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.2"
                  value={config.dayNightSpeed ?? 0.8}
                  onChange={(e) => update('dayNightSpeed', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            )}

            {/* Status do NPC com Tocha & Poças */}
            <div className="pt-1.5 mt-1 border-t border-slate-700/50 flex items-center justify-between text-[10px] text-slate-300">
              <span className="flex items-center gap-1 text-orange-300">
                <Flame className="w-3 h-3 text-orange-400 animate-pulse" />
                NPC com Tocha Dinâmica
              </span>
              <span className="text-slate-400">Poças com Reflexo</span>
            </div>
          </div>

          {/* Clima & Chuva */}
          <div className="space-y-1.5 p-2 bg-slate-800/60 rounded-lg border border-slate-700/60">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <CloudRain className={`w-3.5 h-3.5 ${config.isRaining ? 'text-cyan-400 animate-bounce' : 'text-slate-400'}`} />
                Clima & Chuva
              </span>
              <button
                id="panel-toggle-rain"
                onClick={() => update('isRaining', !config.isRaining)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  config.isRaining
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'bg-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {config.isRaining ? 'Ativa' : 'Desligada'}
              </button>
            </div>

            {config.isRaining && (
              <div className="space-y-1.5 pt-1 border-t border-slate-700/50">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Intensidade da Chuva</span>
                  <span className="font-mono text-cyan-300">{config.rainIntensity.toFixed(1)}x</span>
                </div>
                <input
                  id="rain-intensity-slider"
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={config.rainIntensity}
                  onChange={(e) => update('rainIntensity', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
                <div className="flex gap-1 pt-0.5">
                  <button
                    id="rain-preset-light"
                    onClick={() => update('rainIntensity', 0.5)}
                    className={`flex-1 py-0.5 rounded text-[9px] font-medium border transition-colors ${
                      Math.abs(config.rainIntensity - 0.5) < 0.15
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                        : 'bg-slate-800 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Garoa
                  </button>
                  <button
                    id="rain-preset-medium"
                    onClick={() => update('rainIntensity', 1.0)}
                    className={`flex-1 py-0.5 rounded text-[9px] font-medium border transition-colors ${
                      Math.abs(config.rainIntensity - 1.0) < 0.15
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                        : 'bg-slate-800 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Chuva
                  </button>
                  <button
                    id="rain-preset-heavy"
                    onClick={() => update('rainIntensity', 1.8)}
                    className={`flex-1 py-0.5 rounded text-[9px] font-medium border transition-colors ${
                      Math.abs(config.rainIntensity - 1.8) < 0.15
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                        : 'bg-slate-800 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tempestade
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Quick Action: New River */}
          <button
            id="randomize-river-btn"
            onClick={onRandomizeSeed}
            className="w-full py-2 px-3 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
          >
            <Shuffle className="w-4 h-4" />
            Gerar Novo Rio Aleatório
          </button>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-800 text-[11px] font-medium">
            <button
              id="tab-river"
              onClick={() => setActiveTab('river')}
              className={`flex-1 pb-2 flex items-center justify-center gap-1 border-b-2 transition-colors ${
                activeTab === 'river'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Rio
            </button>
            <button
              id="tab-water"
              onClick={() => setActiveTab('water')}
              className={`flex-1 pb-2 flex items-center justify-center gap-1 border-b-2 transition-colors ${
                activeTab === 'water'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Shader
            </button>
            <button
              id="tab-physics"
              onClick={() => setActiveTab('physics')}
              className={`flex-1 pb-2 flex items-center justify-center gap-1 border-b-2 transition-colors ${
                activeTab === 'physics'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Física & Ondas
            </button>
            <button
              id="tab-camera"
              onClick={() => setActiveTab('camera')}
              className={`flex-1 pb-2 flex items-center justify-center gap-1 border-b-2 transition-colors ${
                activeTab === 'camera'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Câmera
            </button>
          </div>

          {/* TAB 1: River & Terrain Parameters */}
          {activeTab === 'river' && (
            <div className="space-y-3 text-xs">
              {/* Meander / Curvature */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Meandros (Curvatura)</span>
                  <span className="text-cyan-400 font-mono">{config.meander.toFixed(2)}x</span>
                </div>
                <input
                  id="slider-meander"
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={config.meander}
                  onChange={(e) => update('meander', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* River Width */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Largura do Rio</span>
                  <span className="text-cyan-400 font-mono">{config.riverWidth}m</span>
                </div>
                <input
                  id="slider-width"
                  type="range"
                  min="4"
                  max="16"
                  step="0.5"
                  value={config.riverWidth}
                  onChange={(e) => update('riverWidth', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* River Bed Depth */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Profundidade do Leito</span>
                  <span className="text-cyan-400 font-mono">{config.depth.toFixed(1)}m</span>
                </div>
                <input
                  id="slider-depth"
                  type="range"
                  min="0.8"
                  max="4.0"
                  step="0.2"
                  value={config.depth}
                  onChange={(e) => update('depth', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Rock Density */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Rochas & Obstáculos (com Espuma)</span>
                  <span className="text-cyan-400 font-mono">{config.rockDensity}</span>
                </div>
                <input
                  id="slider-rocks"
                  type="range"
                  min="0"
                  max="35"
                  step="1"
                  value={config.rockDensity}
                  onChange={(e) => update('rockDensity', parseInt(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Terrain Roughness */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Rugosidade do Terreno</span>
                  <span className="text-cyan-400 font-mono">{config.terrainRoughness.toFixed(1)}</span>
                </div>
                <input
                  id="slider-roughness"
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.1"
                  value={config.terrainRoughness}
                  onChange={(e) => update('terrainRoughness', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Duck Count */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Patinhos no Rio</span>
                  <span className="text-cyan-400 font-mono">
                    {config.duckCount === 0 ? '0 (Nenhum)' : config.duckCount}
                  </span>
                </div>
                <input
                  id="slider-ducks"
                  type="range"
                  min="0"
                  max="8"
                  step="1"
                  value={config.duckCount}
                  onChange={(e) => update('duckCount', parseInt(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  {config.duckCount === 0
                    ? 'Nenhum patinho na cena. Ajuste para adicionar ou lance objetos físicos abaixo.'
                    : 'Patinhos físicos com gravidade, flutuação leve (densidade 0.24) e arrasto pela correnteza.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Water Shader Parameters */}
          {activeTab === 'water' && (
            <div className="space-y-3 text-xs">
              {/* Color Presets */}
              <div className="space-y-1.5">
                <label className="text-slate-300 block font-medium">Paleta de Cores:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {WATER_PALETTES.map((palette) => (
                    <button
                      key={palette.id}
                      id={`palette-${palette.id}`}
                      onClick={() => update('paletteId', palette.id)}
                      className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                        config.paletteId === palette.id
                          ? 'border-cyan-400 bg-cyan-950/40 text-white font-medium shadow-sm'
                          : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex -space-x-1 shrink-0">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-900"
                          style={{ backgroundColor: palette.shallowColor }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-900"
                          style={{ backgroundColor: palette.deepColor }}
                        />
                      </div>
                      <span className="text-[11px] truncate leading-none">{palette.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Edge Contact Foam Width */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Espuma de Borda / Contato</span>
                  <span className="text-cyan-400 font-mono">{config.foamWidth.toFixed(2)}</span>
                </div>
                <input
                  id="slider-foam"
                  type="range"
                  min="0.1"
                  max="1.2"
                  step="0.05"
                  value={config.foamWidth}
                  onChange={(e) => update('foamWidth', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  Anel de espuma branca em torno das paredes, patos e objetos.
                </p>
              </div>

              {/* Flow Speed */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Velocidade de Deslocamento</span>
                  <span className="text-cyan-400 font-mono">{config.flowSpeed.toFixed(1)}x</span>
                </div>
                <input
                  id="slider-flow"
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={config.flowSpeed}
                  onChange={(e) => update('flowSpeed', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Correnteza / Current Strength */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Correnteza (Força do Fluxo)</span>
                  <span className="text-cyan-400 font-mono">{(config.currentStrength ?? 1.2).toFixed(1)}x</span>
                </div>
                <input
                  id="slider-current-strength"
                  type="range"
                  min="0.0"
                  max="2.5"
                  step="0.1"
                  value={config.currentStrength ?? 1.2}
                  onChange={(e) => update('currentStrength', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  Intensifica o arrasto da correnteza, linhas de fluxo e a esteira dos corpos flutuantes.
                </p>
              </div>

              {/* Caustic Scale */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Cáusticas Voronoi</span>
                  <span className="text-cyan-400 font-mono">{config.causticScale.toFixed(1)}</span>
                </div>
                <input
                  id="slider-caustics"
                  type="range"
                  min="0.8"
                  max="3.0"
                  step="0.1"
                  value={config.causticScale}
                  onChange={(e) => update('causticScale', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Wave Height */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Ondas da Superfície</span>
                  <span className="text-cyan-400 font-mono">{config.waveHeight.toFixed(2)}m</span>
                </div>
                <input
                  id="slider-waves"
                  type="range"
                  min="0.05"
                  max="0.45"
                  step="0.02"
                  value={config.waveHeight}
                  onChange={(e) => update('waveHeight', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Physics & Ripples */}
          {activeTab === 'physics' && (
            <div className="space-y-3.5 text-xs">
              {/* Seção de Objetos Físicos & Gravidade Real */}
              <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-cyan-300 font-semibold">
                    <Droplets className="w-4 h-4" />
                    <span>Lançar Objetos Físicos no Rio</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-mono">
                    g = 9.8 m/s²
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Objetos caem do céu com gravidade real e espirram na água. Corpos menos densos que a água boiam e são levados pela correnteza; corpos pesados afundam até o leito rochoso!
                </p>

                <div className="grid grid-cols-1 gap-1.5 pt-1">
                  {/* Patinho */}
                  <button
                    id="spawn-btn-duck"
                    onClick={() => handleSpawnObject('duck')}
                    className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-750 border border-amber-500/40 rounded-lg text-left flex items-center justify-between transition-all active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🦆</span>
                      <div>
                        <div className="text-xs font-medium text-amber-300 group-hover:text-amber-200">
                          Patinho de Borracha
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Densidade: 0.24 g/cm³ • Boia muito e corre veloz
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                      Boia Alto
                    </span>
                  </button>

                  {/* Barquinho de Papel */}
                  <button
                    id="spawn-btn-boat"
                    onClick={() => handleSpawnObject('boat')}
                    className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-750 border border-sky-500/40 rounded-lg text-left flex items-center justify-between transition-all active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-2">
                      <Ship className="w-4 h-4 text-sky-400 shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-sky-300 group-hover:text-sky-200">
                          Barquinho de Papel
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Densidade: 0.12 g/cm³ • Leve, desliza no topo
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-medium">
                      Super Leve
                    </span>
                  </button>

                  {/* Tronco de Madeira */}
                  <button
                    id="spawn-btn-log"
                    onClick={() => handleSpawnObject('log')}
                    className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-750 border border-amber-700/40 rounded-lg text-left flex items-center justify-between transition-all active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🪵</span>
                      <div>
                        <div className="text-xs font-medium text-amber-400 group-hover:text-amber-300">
                          Tronco de Madeira
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Densidade: 0.65 g/cm³ • Flutua meio submerso
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-800/30 text-amber-300 font-medium">
                      Parcial
                    </span>
                  </button>

                  {/* Pedra de Rio */}
                  <button
                    id="spawn-btn-rock"
                    onClick={() => handleSpawnObject('rock')}
                    className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-750 border border-slate-600/50 rounded-lg text-left flex items-center justify-between transition-all active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">🪨</span>
                      <div>
                        <div className="text-xs font-medium text-slate-200 group-hover:text-white">
                          Pedra de Rio (Granito)
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Densidade: 2.65 g/cm³ • Afunda e trava no fundo
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300 font-medium">
                      Afunda no Leito
                    </span>
                  </button>

                  {/* Peso de Metal */}
                  <button
                    id="spawn-btn-metal"
                    onClick={() => handleSpawnObject('metal')}
                    className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-750 border border-indigo-500/40 rounded-lg text-left flex items-center justify-between transition-all active:scale-[0.98] group"
                  >
                    <div className="flex items-center gap-2">
                      <Anchor className="w-4 h-4 text-indigo-400 shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-indigo-300 group-hover:text-indigo-200">
                          Âncora / Peso de Metal
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Densidade: 7.85 g/cm³ • Afunda como âncora fixa
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                      Âncora Pesada
                    </span>
                  </button>
                </div>

                <div className="flex gap-1.5 pt-1">
                  <button
                    id="btn-push-duck-panel"
                    onClick={handlePushDuck}
                    className="flex-1 py-1.5 px-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.98]"
                  >
                    <Hand className="w-3.5 h-3.5" />
                    Empurrar Objeto
                  </button>
                  <button
                    id="btn-clear-spawned"
                    onClick={handleClearObjects}
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-red-950/50 text-slate-400 hover:text-red-300 border border-slate-700 hover:border-red-500/40 rounded-lg text-xs flex items-center justify-center gap-1 transition-all"
                    title="Remover objetos lançados pelo usuário"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Limpar
                  </button>
                </div>
              </div>

              {/* Ripple Intensity */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Intensidade das Ondulações</span>
                  <span className="text-cyan-400 font-mono">{config.rippleIntensity.toFixed(2)}x</span>
                </div>
                <input
                  id="slider-ripple-intensity"
                  type="range"
                  min="0.3"
                  max="3.0"
                  step="0.1"
                  value={config.rippleIntensity}
                  onChange={(e) => update('rippleIntensity', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  Força das ondas criadas ao mover o patinho ou tocar na água.
                </p>
              </div>

              {/* Wave Damping */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Propagação / Duração das Ondas</span>
                  <span className="text-cyan-400 font-mono">{config.waveDamping.toFixed(3)}</span>
                </div>
                <input
                  id="slider-wave-damping"
                  type="range"
                  min="0.930"
                  max="0.992"
                  step="0.002"
                  value={config.waveDamping}
                  onChange={(e) => update('waveDamping', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  Valores altos propagam as ondas pelo rio todo por mais tempo.
                </p>
              </div>

              <div className="pt-1 border-t border-slate-800">
                <div className="flex items-center gap-1.5 text-cyan-300 font-semibold mb-2">
                  <Droplets className="w-3.5 h-3.5" />
                  <span>Propriedades Físicas do Fluido</span>
                </div>

                {/* Buoyancy */}
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-300">
                    <span>Força de Empuxo (Flutuação)</span>
                    <span className="text-cyan-400 font-mono">{config.buoyancy.toFixed(2)}x</span>
                  </div>
                  <input
                    id="slider-buoyancy"
                    type="range"
                    min="0.6"
                    max="2.6"
                    step="0.1"
                    value={config.buoyancy}
                    onChange={(e) => update('buoyancy', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Water Density */}
                <div className="space-y-1 mt-2.5">
                  <div className="flex justify-between text-slate-300">
                    <span>Densidade da Água</span>
                    <span className="text-cyan-400 font-mono">{config.waterDensity.toFixed(2)}</span>
                  </div>
                  <input
                    id="slider-density"
                    type="range"
                    min="0.5"
                    max="1.8"
                    step="0.05"
                    value={config.waterDensity}
                    onChange={(e) => update('waterDensity', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Viscosity / Drag */}
                <div className="space-y-1 mt-2.5">
                  <div className="flex justify-between text-slate-300">
                    <span>Viscosidade & Arrasto Hidrodinâmico</span>
                    <span className="text-cyan-400 font-mono">{config.waterViscosity.toFixed(2)}</span>
                  </div>
                  <input
                    id="slider-viscosity"
                    type="range"
                    min="0.2"
                    max="2.5"
                    step="0.1"
                    value={config.waterViscosity}
                    onChange={(e) => update('waterViscosity', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400">
                    Determina o amortecimento e resistência ao movimento dos corpos na água.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Camera Modes */}
          {activeTab === 'camera' && (
            <div className="space-y-2 text-xs">
              <label className="text-slate-300 block font-medium">Modo de Câmera:</label>
              <div className="space-y-1.5">
                <button
                  id="cam-orbit"
                  onClick={() => onCameraModeChange('orbit')}
                  className={`w-full p-2 rounded-lg border text-left flex items-center gap-2.5 transition-all ${
                    cameraMode === 'orbit'
                      ? 'border-cyan-400 bg-cyan-950/40 text-white font-medium shadow-sm'
                      : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Eye className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-xs">Câmera Livre (Órbita 3D)</div>
                    <div className="text-[10px] text-slate-400">
                      Gire com botão esquerdo, aproxime com scroll e arraste com botão direito.
                    </div>
                  </div>
                </button>

                <button
                  id="cam-follow"
                  onClick={() => onCameraModeChange('follow_duck')}
                  className={`w-full p-2 rounded-lg border text-left flex items-center gap-2.5 transition-all ${
                    cameraMode === 'follow_duck'
                      ? 'border-cyan-400 bg-cyan-950/40 text-white font-medium shadow-sm'
                      : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-xs">Seguir Patinho de Borracha</div>
                    <div className="text-[10px] text-slate-400">
                      Câmera cinematográfica acompanhando o patinho no rio.
                    </div>
                  </div>
                </button>

                <button
                  id="cam-top"
                  onClick={() => onCameraModeChange('top_down')}
                  className={`w-full p-2 rounded-lg border text-left flex items-center gap-2.5 transition-all ${
                    cameraMode === 'top_down'
                      ? 'border-cyan-400 bg-cyan-950/40 text-white font-medium shadow-sm'
                      : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-xs">Visão Aérea (Top-Down)</div>
                    <div className="text-[10px] text-slate-400">
                      Visualização cartográfica das curvas do rio.
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Quick info banner */}
          <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[11px] text-cyan-200/90 leading-relaxed">
            <span className="font-semibold text-cyan-300">Simulação Física & Toon Water:</span> Ondulações interativas causadas por objetos flutuantes e toques na água, com ciclo dia/noite e iluminação dinâmica.
          </div>
        </div>
      )}
    </aside>
  );
};
