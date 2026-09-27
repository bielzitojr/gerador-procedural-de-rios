import { SPECIAL_ENVIRONMENTS, isSpecialEnvironment, SpecialMode } from '../procedural/specialEnvironments';
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
  Wind,
  Mountain,
} from 'lucide-react';
import { RiverConfig, CameraMode, WaterBodyType } from '../types';
import { WATER_PALETTES } from '../shaders/waterShader';
import { PhysicalObjectType } from './RiverObjects';

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
  const activeTab = config.waterMode ?? 'river';

  const setWaterMode = (mode: WaterBodyType) => {
    onChange({
      ...config,
      waterMode: mode,
    });
  };

  const update = <K extends keyof RiverConfig>(key: K, val: RiverConfig[K]) => {
    onChange({
      ...config,
      [key]: val,
    });
  };

  const updatePuddles = <K extends keyof RiverConfig['puddles']>(
    key: K,
    val: RiverConfig['puddles'][K]
  ) => {
    onChange({
      ...config,
      puddles: {
        ...config.puddles,
        [key]: val,
      },
    });
  };

  const updateRain = <K extends keyof RiverConfig['rain']>(
    key: K,
    val: RiverConfig['rain'][K]
  ) => {
    const updatedRain = {
      ...config.rain,
      [key]: val,
    };
    onChange({
      ...config,
      rain: updatedRain,
      isRaining: key === 'isRaining' ? (val as boolean) : config.isRaining,
      rainIntensity: key === 'rainIntensity' ? (val as number) : config.rainIntensity,
    });
  };

  const updateLake = <K extends keyof RiverConfig['lake']>(
    key: K,
    val: RiverConfig['lake'][K]
  ) => {
    onChange({
      ...config,
      lake: {
        ...config.lake,
        [key]: val,
      },
    });
  };

  const updateOcean = <K extends keyof RiverConfig['ocean']>(
    key: K,
    val: RiverConfig['ocean'][K]
  ) => {
    onChange({
      ...config,
      ocean: {
        ...config.ocean,
        [key]: val,
      },
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

  // Metadados do cabeçalho dinâmico para cada corpo d'água / elemento aquático
  const headerMeta: Record<
    WaterBodyType,
    { title: string; subtitle: string; icon: React.ReactNode; color: string }
  > = {
    ...Object.fromEntries(Object.entries(SPECIAL_ENVIRONMENTS).map(([key, value]) => [key, { title: value.label, subtitle: value.description, icon: <Mountain className="w-5 h-5 text-cyan-300" />, color: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300' }])) as Record<SpecialMode, { title: string; subtitle: string; icon: React.ReactNode; color: string }>,
    water: {
      title: 'Água Toon',
      subtitle: 'Shader Godot & Refração Translúcida',
      icon: <Sparkles className="w-5 h-5 text-cyan-300" />,
      color: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300',
    },
    river: {
      title: 'Rio Procedural',
      subtitle: 'Leito, Meandros & Correnteza Fluida',
      icon: <Waves className="w-5 h-5 text-teal-300" />,
      color: 'bg-teal-500/20 border-teal-400/40 text-teal-300',
    },
    lake: {
      title: 'Lago Procedural',
      subtitle: 'Bacia Lacustre & Águas Calmas',
      icon: <Compass className="w-5 h-5 text-sky-300" />,
      color: 'bg-sky-500/20 border-sky-400/40 text-sky-300',
    },
    ocean: {
      title: 'Oceano Procedural',
      subtitle: 'Swell Marítimo & Horizonte Aberto',
      icon: <Anchor className="w-5 h-5 text-blue-300" />,
      color: 'bg-blue-500/20 border-blue-400/40 text-blue-300',
    },
    puddles: {
      title: 'Poças Procedurais',
      subtitle: 'Terreno Úmido & Acúmulo de Chuva',
      icon: <Droplets className="w-5 h-5 text-indigo-300" />,
      color: 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300',
    },
    rain: {
      title: 'Sistema de Chuva',
      subtitle: 'Precipitação, Vento & Micro-Splashes',
      icon: <CloudRain className="w-5 h-5 text-cyan-300" />,
      color: 'bg-cyan-500/20 border-cyan-400/40 text-cyan-300',
    },
  };

  const currentHeader = headerMeta[activeTab];

  return (
    <aside
      id="river-control-panel"
      className="absolute top-4 left-4 z-20 w-84 max-w-[calc(100vw-2rem)] flex flex-col bg-slate-900/85 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-2xl text-slate-100 transition-all duration-200"
    >
      {/* Header com identificação dinâmica do corpo d'água separado */}
      <div className="p-3.5 border-b border-slate-700/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${currentHeader.color}`}>
            {currentHeader.icon}
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-white leading-tight">
              {currentHeader.title}
            </h1>
            <p className="text-[11px] text-cyan-400 font-medium">{currentHeader.subtitle}</p>
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
        <div className="p-3.5 space-y-3 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
          {/* Seletor de Abas Principais: Água, Rio, Poças, Chuva, Lagos e Oceanos */}
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block px-0.5">
              Ambientes & Elementos Aquáticos
            </span>
            <div className="grid grid-cols-3 gap-1 bg-slate-950/60 p-1 rounded-lg border border-slate-800">
              {Object.entries(SPECIAL_ENVIRONMENTS).map(([key, item]) => <button key={key} id={'tab-' + key} title={item.description} aria-pressed={activeTab === key} onClick={() => setWaterMode(key as SpecialMode)} className={`py-2 px-1 rounded-md text-[10px] flex flex-col items-center gap-1 transition-colors ${activeTab === key ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-300 hover:bg-slate-800'}`}><Mountain className="w-4 h-4" /><span>{item.label}</span></button>)}
              {/* 1. Água (Shader) */}
              <button
                id="tab-water"
                onClick={() => setWaterMode('water')}
                className={`py-1.5 px-1.5 rounded-md text-[10px] font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                  activeTab === 'water'
                    ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Ajuste do Shader de Água Toon, cores, caustics e refração"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Água (Shader)</span>
              </button>

              {/* 2. Rio */}
              <button
                id="tab-river"
                onClick={() => setWaterMode('river')}
                className={`py-1.5 px-1.5 rounded-md text-[10px] font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                  activeTab === 'river'
                    ? 'bg-teal-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Geração procedural de rio, meandros, largura e leito"
              >
                <Waves className="w-3.5 h-3.5" />
                <span>Rio</span>
              </button>

              {/* 3. Lagos */}
              <button
                id="tab-lake"
                onClick={() => setWaterMode('lake')}
                className={`py-1.5 px-1.5 rounded-md text-[10px] font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                  activeTab === 'lake'
                    ? 'bg-sky-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Geração procedural de lago fechado, bacia e ilhotas"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Lagos</span>
              </button>

              {/* 4. Oceanos */}
              <button
                id="tab-ocean"
                onClick={() => setWaterMode('ocean')}
                className={`py-1.5 px-1.5 rounded-md text-[10px] font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                  activeTab === 'ocean'
                    ? 'bg-blue-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Geração procedural de oceano aberto, swell e ondas"
              >
                <Anchor className="w-3.5 h-3.5" />
                <span>Oceanos</span>
              </button>

              {/* 5. Poças */}
              <button
                id="tab-puddles"
                onClick={() => setWaterMode('puddles')}
                className={`py-1.5 px-1.5 rounded-md text-[10px] font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                  activeTab === 'puddles'
                    ? 'bg-indigo-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Geração procedural de poças d'água no terreno"
              >
                <Droplets className="w-3.5 h-3.5" />
                <span>Poças</span>
              </button>

              {/* 6. Chuva */}
              <button
                id="tab-rain"
                onClick={() => setWaterMode('rain')}
                className={`py-1.5 px-1.5 rounded-md text-[10px] font-medium flex flex-col items-center justify-center gap-1 transition-all ${
                  activeTab === 'rain'
                    ? 'bg-cyan-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
                title="Sistema climático de chuva, vento e micro-splashes"
              >
                <CloudRain className="w-3.5 h-3.5" />
                <span>Chuva</span>
              </button>
            </div>
          </div>


          {isSpecialEnvironment(activeTab) && <section className="space-y-4 border border-cyan-800/50 rounded-lg p-3 bg-slate-950/40">
            <button onClick={onRandomizeSeed} className="w-full rounded-md bg-cyan-500 text-slate-950 text-xs font-semibold py-2">Gerar novo ambiente</button>
            <p className="text-xs text-slate-400">{SPECIAL_ENVIRONMENTS[activeTab].description}. Semente: {config.seed}. Cavernas e fossas exibidas em corte para explorar o interior.</p>
            {([
              ['scale', 'Extensão do ambiente', 12, 32, 1, 'm'],
              ['height', 'Altura da queda / galeria', 6, 28, 1, 'm'],
              ['depth', 'Profundidade da bacia', 3, 26, 1, 'm'],
              ['density', 'Formações e partículas', 8, 48, 1, ''],
              ['intensity', 'Intensidade da água', 0.2, 2.5, 0.1, '×'],
            ] as const).map(([key, label, min, max, step, suffix]) => <label key={key} className="block text-xs text-slate-300"><span className="flex justify-between mb-2"><span>{label}</span><span className="text-cyan-300">{config.environment[key]}{suffix}</span></span><input className="w-full accent-cyan-400" type="range" min={min} max={max} step={step} value={config.environment[key]} onChange={e => update('environment', {...config.environment, [key]: Number(e.target.value)})} /></label>)}
            {activeTab === 'waterfall' && <label className="flex gap-2 text-xs"><input type="checkbox" checked={config.environment.rainbow} onChange={e => update('environment', {...config.environment, rainbow: e.target.checked})} />Arco-íris na cachoeira</label>}
          </section>}
          {/* ========================================================================= */}
          {/* ABA 1: ÁGUA (Shader Toon, Cores, Translucidez, Caustics e Espuma) */}
          {/* ========================================================================= */}
          {activeTab === 'water' && (
            <div className="space-y-3 text-xs pt-1">
              <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/25 space-y-1">
                <span className="font-semibold text-cyan-300 text-[11px] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Laboratório de Shader & Material Toon
                </span>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Controle da matéria e óptica do fluido (Godot Shader): paleta cromática, refração suave, caustics nebulosas e espumas orgânicas de margem.
                </p>
              </div>

              {/* Paleta de Cores Toon */}
              <div className="space-y-1.5">
                <label className="text-slate-300 block font-medium">Paleta Cromática Toon:</label>
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

              {/* Translucidez e Refração */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Translucidez do Fluido</span>
                  <span className="text-cyan-400 font-mono">{(config.translucency ?? 0.85).toFixed(2)}</span>
                </div>
                <input
                  id="slider-translucency"
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={config.translucency ?? 0.85}
                  onChange={(e) => update('translucency', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Refração */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Distorção de Refração Óptica</span>
                  <span className="text-cyan-400 font-mono">{(config.refractionAmount ?? 0.5).toFixed(2)}</span>
                </div>
                <input
                  id="slider-refraction"
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={config.refractionAmount ?? 0.5}
                  onChange={(e) => update('refractionAmount', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Cáusticas Voronoi */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Escala das Cáusticas (Luz no Fundo)</span>
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

              {/* Espuma de Borda / Contato */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Espuma de Borda / Contato Toon</span>
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
              </div>

              {/* Ondas Básicas da Superfície */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Ondulação Base da Superfície</span>
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

              {/* Águas Calmas (Água Parada) */}
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-slate-200 font-medium">Águas Calmas (Água Parada)</span>
                  </div>
                  <button
                    id="toggle-calm-water"
                    onClick={() => update('isCalmWater', !config.isCalmWater)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                      config.isCalmWater
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    {config.isCalmWater ? 'Ativado (Parada)' : 'Desativado'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Quando ativado, a água fica completamente parada (sem fluxo de correnteza), como um espelho d'água límpido e cristalino, ideal para lagos e poças d'água.
                </p>
                {config.isCalmWater && (
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-slate-300">
                      <span>Suavidade do Espelho d'Água</span>
                      <span className="text-cyan-300 font-mono">
                        {Math.round((config.calmWaterIntensity ?? 1.0) * 100)}%
                      </span>
                    </div>
                    <input
                      id="slider-calm-intensity"
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={config.calmWaterIntensity ?? 1.0}
                      onChange={(e) => update('calmWaterIntensity', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 2: RIO (Geração Procedural do Rio, Meandros, Leito & Correnteza) */}
          {/* ========================================================================= */}
          {activeTab === 'river' && (
            <div className="space-y-3 text-xs pt-1">
              <button
                id="randomize-river-btn"
                onClick={onRandomizeSeed}
                className="w-full py-2 px-3 bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              >
                <Shuffle className="w-4 h-4" />
                Gerar Novo Rio Procedural
              </button>

              {/* Meandros / Curvatura */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Meandros (Curvatura das Margens)</span>
                  <span className="text-teal-300 font-mono">{config.meander.toFixed(2)}x</span>
                </div>
                <input
                  id="slider-meander"
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={config.meander}
                  onChange={(e) => update('meander', parseFloat(e.target.value))}
                  className="w-full accent-teal-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Largura do Rio */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Largura do Canal do Rio</span>
                  <span className="text-teal-300 font-mono">{config.riverWidth}m</span>
                </div>
                <input
                  id="slider-width"
                  type="range"
                  min="4"
                  max="16"
                  step="0.5"
                  value={config.riverWidth}
                  onChange={(e) => update('riverWidth', parseFloat(e.target.value))}
                  className="w-full accent-teal-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Profundidade do Leito */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Profundidade do Leito</span>
                  <span className="text-teal-300 font-mono">{config.depth.toFixed(1)}m</span>
                </div>
                <input
                  id="slider-depth"
                  type="range"
                  min="0.8"
                  max="4.0"
                  step="0.2"
                  value={config.depth}
                  onChange={(e) => update('depth', parseFloat(e.target.value))}
                  className="w-full accent-teal-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Correnteza / Velocidade do Fluxo */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Velocidade da Correnteza</span>
                  <span className="text-teal-300 font-mono">{config.flowSpeed.toFixed(1)}x</span>
                </div>
                <input
                  id="slider-flow"
                  type="range"
                  min="0.2"
                  max="3.0"
                  step="0.1"
                  value={config.flowSpeed}
                  onChange={(e) => update('flowSpeed', parseFloat(e.target.value))}
                  className="w-full accent-teal-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Rochas & Obstáculos no Rio */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Rochas no Leito</span>
                  <span className="text-teal-300 font-mono">{config.rockDensity}</span>
                </div>
                <input
                  id="slider-rocks"
                  type="range"
                  min="0"
                  max="35"
                  step="1"
                  value={config.rockDensity}
                  onChange={(e) => update('rockDensity', parseInt(e.target.value))}
                  className="w-full accent-teal-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Patinhos no Rio */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Patinhos Navegando</span>
                  <span className="text-teal-300 font-mono">{config.duckCount}</span>
                </div>
                <input
                  id="slider-ducks"
                  type="range"
                  min="0"
                  max="8"
                  step="1"
                  value={config.duckCount}
                  onChange={(e) => update('duckCount', parseInt(e.target.value))}
                  className="w-full accent-teal-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  Patinhos com rastro hidrodinâmico em V suave e física de flutuação.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 3: LAGOS (Bacia Lacustre, Águas Calmas & Ilhotas) */}
          {/* ========================================================================= */}
          {activeTab === 'lake' && (
            <div className="space-y-3 text-xs pt-1">
              <button
                id="randomize-lake-btn"
                onClick={onRandomizeSeed}
                className="w-full py-2 px-3 bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              >
                <Shuffle className="w-4 h-4" />
                Gerar Novo Lago Procedural
              </button>

              {/* Raio da Bacia do Lago */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Raio / Extensão da Bacia</span>
                  <span className="text-sky-300 font-mono">{(config.lake?.lakeRadius ?? 30)}m</span>
                </div>
                <input
                  id="slider-lake-radius"
                  type="range"
                  min="16"
                  max="46"
                  step="1"
                  value={config.lake?.lakeRadius ?? 30}
                  onChange={(e) => updateLake('lakeRadius', parseFloat(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Profundidade do Lago */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Profundidade Central</span>
                  <span className="text-sky-300 font-mono">{(config.lake?.lakeDepth ?? 3.5).toFixed(1)}m</span>
                </div>
                <input
                  id="slider-lake-depth"
                  type="range"
                  min="1.0"
                  max="6.5"
                  step="0.5"
                  value={config.lake?.lakeDepth ?? 3.5}
                  onChange={(e) => updateLake('lakeDepth', parseFloat(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Irregularidade da Borda */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Recortes Orgânicos da Margem</span>
                  <span className="text-sky-300 font-mono">{(config.lake?.lakeIrregularity ?? 0.75).toFixed(2)}x</span>
                </div>
                <input
                  id="slider-lake-irregularity"
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.05"
                  value={config.lake?.lakeIrregularity ?? 0.75}
                  onChange={(e) => updateLake('lakeIrregularity', parseFloat(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Ilhotas Centrais */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Ilhotas & Penedos Centrais</span>
                  <span className="text-sky-300 font-mono">{config.lake?.lakeIslandCount ?? 1}</span>
                </div>
                <input
                  id="slider-lake-islands"
                  type="range"
                  min="0"
                  max="4"
                  step="1"
                  value={config.lake?.lakeIslandCount ?? 1}
                  onChange={(e) => updateLake('lakeIslandCount', parseInt(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Calma da Água */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Calma das Águas (Espelho Reflexivo)</span>
                  <span className="text-sky-300 font-mono">{(config.lake?.lakeCalmness ?? 1.0).toFixed(1)}x</span>
                </div>
                <input
                  id="slider-lake-calmness"
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={config.lake?.lakeCalmness ?? 1.0}
                  onChange={(e) => updateLake('lakeCalmness', parseFloat(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Pedras nas Margens */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Pedras Costeiras do Lago</span>
                  <span className="text-sky-300 font-mono">{config.lake?.lakeRockDensity ?? 18}</span>
                </div>
                <input
                  id="slider-lake-rocks"
                  type="range"
                  min="0"
                  max="35"
                  step="1"
                  value={config.lake?.lakeRockDensity ?? 18}
                  onChange={(e) => updateLake('lakeRockDensity', parseInt(e.target.value))}
                  className="w-full accent-sky-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Águas Calmas do Lago */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-700/60">
                <div>
                  <span className="text-slate-200 font-medium block">Águas Calmas do Lago</span>
                  <span className="text-[10px] text-slate-400">Água parada espelhada (sem correnteza)</span>
                </div>
                <button
                  id="toggle-lake-calm"
                  onClick={() => updateLake('isCalmWater', !(config.lake?.isCalmWater ?? true))}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                    (config.lake?.isCalmWater ?? true)
                      ? 'bg-sky-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  {(config.lake?.isCalmWater ?? true) ? 'Água Parada' : 'Correnteza Ativa'}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 4: OCEANOS (Oceano Aberto, Swell Marítimo & Horizonte) */}
          {/* ========================================================================= */}
          {activeTab === 'ocean' && (
            <div className="space-y-3 text-xs pt-1">
              <button
                id="randomize-ocean-btn"
                onClick={onRandomizeSeed}
                className="w-full py-2 px-3 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              >
                <Shuffle className="w-4 h-4" />
                Gerar Novo Oceano Procedural
              </button>

              {/* Seletor de Variantes de Ondas: Leve, Agitado, Tempestade */}
              <div className="space-y-1.5 p-2 rounded-lg bg-slate-900/60 border border-slate-700/60">
                <label className="text-slate-300 block font-medium">Variantes de Ondas (Praias e Mares):</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    id="wave-variant-leve"
                    onClick={() => {
                      updateOcean('waveVariant', 'leve');
                      updateOcean('oceanSwellHeight', 0.8);
                      updateOcean('oceanChoppiness', 0.5);
                      updateOcean('oceanSpeed', 0.85);
                      updateOcean('oceanFoamCrests', 0.5);
                    }}
                    className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                      (config.ocean?.waveVariant ?? 'leve') === 'leve'
                        ? 'border-blue-400 bg-blue-950/60 text-white font-semibold shadow-sm'
                        : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-sm">🌊</span>
                    <span className="text-[11px]">Leve</span>
                    <span className="text-[9px] text-slate-400">Mar sereno</span>
                  </button>

                  <button
                    id="wave-variant-agitado"
                    onClick={() => {
                      updateOcean('waveVariant', 'agitado');
                      updateOcean('oceanSwellHeight', 1.8);
                      updateOcean('oceanChoppiness', 1.15);
                      updateOcean('oceanSpeed', 1.4);
                      updateOcean('oceanFoamCrests', 1.1);
                    }}
                    className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                      config.ocean?.waveVariant === 'agitado'
                        ? 'border-blue-400 bg-blue-950/60 text-white font-semibold shadow-sm'
                        : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-sm">🌊🌊</span>
                    <span className="text-[11px]">Agitado</span>
                    <span className="text-[9px] text-slate-400">Carneirinhos</span>
                  </button>

                  <button
                    id="wave-variant-tempestade"
                    onClick={() => {
                      updateOcean('waveVariant', 'tempestade');
                      updateOcean('oceanSwellHeight', 3.2);
                      updateOcean('oceanChoppiness', 1.65);
                      updateOcean('oceanSpeed', 2.2);
                      updateOcean('oceanFoamCrests', 1.8);
                    }}
                    className={`p-2 rounded-lg border text-center transition-all flex flex-col items-center gap-1 ${
                      config.ocean?.waveVariant === 'tempestade'
                        ? 'border-red-400 bg-red-950/60 text-white font-semibold shadow-sm'
                        : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <span className="text-sm">⛈️🌊</span>
                    <span className="text-[11px]">Tempestade</span>
                    <span className="text-[9px] text-slate-400">Mar revolto</span>
                  </button>
                </div>
              </div>

              {/* Altura do Swell Oceânico */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Altura do Swell (Grandes Ondas)</span>
                  <span className="text-blue-300 font-mono">{(config.ocean?.oceanSwellHeight ?? 1.6).toFixed(1)}m</span>
                </div>
                <input
                  id="slider-ocean-swell"
                  type="range"
                  min="0.4"
                  max="3.5"
                  step="0.1"
                  value={config.ocean?.oceanSwellHeight ?? 1.6}
                  onChange={(e) => updateOcean('oceanSwellHeight', parseFloat(e.target.value))}
                  className="w-full accent-blue-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Comprimento de Onda */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Comprimento das Ondas do Mar</span>
                  <span className="text-blue-300 font-mono">{config.ocean?.oceanWaveLength ?? 22}m</span>
                </div>
                <input
                  id="slider-ocean-length"
                  type="range"
                  min="10"
                  max="40"
                  step="2"
                  value={config.ocean?.oceanWaveLength ?? 22}
                  onChange={(e) => updateOcean('oceanWaveLength', parseFloat(e.target.value))}
                  className="w-full accent-blue-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Velocidade Marítima */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Velocidade das Correntes Marinhas</span>
                  <span className="text-blue-300 font-mono">{(config.ocean?.oceanSpeed ?? 1.2).toFixed(1)}x</span>
                </div>
                <input
                  id="slider-ocean-speed"
                  type="range"
                  min="0.3"
                  max="2.5"
                  step="0.1"
                  value={config.ocean?.oceanSpeed ?? 1.2}
                  onChange={(e) => updateOcean('oceanSpeed', parseFloat(e.target.value))}
                  className="w-full accent-blue-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Espuma nas Cristas */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Espuma nas Cristas das Ondas</span>
                  <span className="text-blue-300 font-mono">{(config.ocean?.oceanFoamCrests ?? 0.8).toFixed(1)}x</span>
                </div>
                <input
                  id="slider-ocean-foam"
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.1"
                  value={config.ocean?.oceanFoamCrests ?? 0.8}
                  onChange={(e) => updateOcean('oceanFoamCrests', parseFloat(e.target.value))}
                  className="w-full accent-blue-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 5: POÇAS (Geração Procedural de Poças d'Água Paradas no Terreno) */}
          {/* ========================================================================= */}
          {activeTab === 'puddles' && (
            <div className="space-y-3 text-xs pt-1">
              <button
                id="randomize-puddles-btn"
                onClick={onRandomizeSeed}
                className="w-full py-2 px-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-slate-950 font-semibold rounded-lg text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98]"
              >
                <Shuffle className="w-4 h-4" />
                Gerar Novo Terreno com Poças d'Água
              </button>

              <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/25 space-y-1">
                <span className="font-medium text-indigo-300 text-[11px] flex items-center gap-1">
                  <Droplets className="w-3.5 h-3.5" />
                  Poções de Água Paradas no Terreno
                </span>
                <p className="text-[10px] text-slate-300 leading-relaxed">
                  Depressões naturais e bacias no relevo onde a água repousa serena e parada ("águas calmas"), com anéis de lama úmida, pedras marginais e reflexos espelhados.
                </p>
              </div>

              {/* Quantidade de Poções de Água */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Quantidade de Poções de Água</span>
                  <span className="text-indigo-300 font-mono">{config.puddles?.puddleCount ?? 14}</span>
                </div>
                <input
                  id="slider-puddle-count"
                  type="range"
                  min="3"
                  max="35"
                  step="1"
                  value={config.puddles?.puddleCount ?? 14}
                  onChange={(e) => updatePuddles('puddleCount', parseInt(e.target.value))}
                  className="w-full accent-indigo-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Raio Médio das Poças */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Tamanho Médio das Poças</span>
                  <span className="text-indigo-300 font-mono">{(config.puddles?.puddleRadius ?? 3.2).toFixed(1)}m</span>
                </div>
                <input
                  id="slider-puddle-radius"
                  type="range"
                  min="1.0"
                  max="5.5"
                  step="0.2"
                  value={config.puddles?.puddleRadius ?? 3.2}
                  onChange={(e) => updatePuddles('puddleRadius', parseFloat(e.target.value))}
                  className="w-full accent-indigo-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Profundidade das Depressões */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Profundidade das Depressões</span>
                  <span className="text-indigo-300 font-mono">{(config.puddles?.puddleDepth ?? 0.65).toFixed(2)}m</span>
                </div>
                <input
                  id="slider-puddle-depth"
                  type="range"
                  min="0.2"
                  max="1.5"
                  step="0.05"
                  value={config.puddles?.puddleDepth ?? 0.65}
                  onChange={(e) => updatePuddles('puddleDepth', parseFloat(e.target.value))}
                  className="w-full accent-indigo-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Borda de Lama / Argila Úmida */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Borda de Terra & Lama Molhada</span>
                  <span className="text-indigo-300 font-mono">{(config.puddles?.mudRimWidth ?? 1.1).toFixed(2)}m</span>
                </div>
                <input
                  id="slider-mud-rim"
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.05"
                  value={config.puddles?.mudRimWidth ?? 1.1}
                  onChange={(e) => updatePuddles('mudRimWidth', parseFloat(e.target.value))}
                  className="w-full accent-indigo-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Águas Calmas na Poça (Água Parada) */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-700/60">
                <div>
                  <span className="text-slate-200 font-medium block">Águas Calmas na Poça</span>
                  <span className="text-[10px] text-slate-400">Água parada em repouso absoluto, sem correnteza</span>
                </div>
                <button
                  id="toggle-puddle-calm"
                  onClick={() => updatePuddles('isCalmWater', !(config.puddles?.isCalmWater ?? true))}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                    (config.puddles?.isCalmWater ?? true)
                      ? 'bg-indigo-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  {(config.puddles?.isCalmWater ?? true) ? 'Água Parada' : 'Agitada'}
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 6: CHUVA (Sistema Climático, Gotas, Micro-Splashes & Ondulações) */}
          {/* ========================================================================= */}
          {activeTab === 'rain' && (
            <div className="space-y-3 text-xs pt-1">
              {/* Botão Liga/Desliga Chuva */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/60 border border-slate-700/60">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <CloudRain className="w-4 h-4 text-cyan-400" />
                  Precipitação Climática
                </span>
                <button
                  id="toggle-rain-master"
                  onClick={() => updateRain('isRaining', !config.isRaining)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    config.isRaining
                      ? 'bg-cyan-500 text-slate-950 shadow-md'
                      : 'bg-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {config.isRaining ? 'Chovendo' : 'Céu Limpo'}
                </button>
              </div>

              {/* Presets Rápidos de Clima */}
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={() => updateRain('rainIntensity', 0.5)}
                  className={`py-1.5 px-1 rounded-md text-[10px] font-medium border transition-all ${
                    config.isRaining && Math.abs(config.rainIntensity - 0.5) < 0.2
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Garoa Fina
                </button>
                <button
                  onClick={() => updateRain('rainIntensity', 1.0)}
                  className={`py-1.5 px-1 rounded-md text-[10px] font-medium border transition-all ${
                    config.isRaining && Math.abs(config.rainIntensity - 1.0) < 0.2
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Chuva Média
                </button>
                <button
                  onClick={() => updateRain('rainIntensity', 1.8)}
                  className={`py-1.5 px-1 rounded-md text-[10px] font-medium border transition-all ${
                    config.isRaining && Math.abs(config.rainIntensity - 1.8) < 0.2
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  Tempestade
                </button>
              </div>

              {/* Intensidade da Chuva */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Intensidade da Precipitação</span>
                  <span className="text-cyan-400 font-mono">{config.rainIntensity.toFixed(1)}x</span>
                </div>
                <input
                  id="slider-rain-intensity"
                  type="range"
                  min="0.2"
                  max="2.5"
                  step="0.1"
                  value={config.rainIntensity}
                  onChange={(e) => updateRain('rainIntensity', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
              </div>

              {/* Micro-Splashes */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Micro-Splashes na Água</span>
                  <span className="text-cyan-400 font-mono">{(config.rain?.splashIntensity ?? 1.0).toFixed(1)}x</span>
                </div>
                <input
                  id="slider-splash-intensity"
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={config.rain?.splashIntensity ?? 1.0}
                  onChange={(e) => updateRain('splashIntensity', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  Gotículas translúcidas salpicando discretamente ao tocar a água.
                </p>
              </div>

              {/* Frequência dos Círculos de Impacto */}
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>Círculos Concêntricos de Impacto</span>
                  <span className="text-cyan-400 font-mono">{(config.rain?.rippleFrequency ?? 1.0).toFixed(1)}x</span>
                </div>
                <input
                  id="slider-ripple-freq"
                  type="range"
                  min="0.2"
                  max="2.0"
                  step="0.1"
                  value={config.rain?.rippleFrequency ?? 1.0}
                  onChange={(e) => updateRain('rippleFrequency', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-slate-400">
                  Anéis concêntricos que surgem e se propagam suavemente na água.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* Seção Complementar: Ciclo Astronômico & Câmera */}
          {/* ========================================================================= */}
          <div className="pt-2 border-t border-slate-700/60 space-y-2">
            {/* Ciclo Dia / Noite Astronômico */}
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
                >
                  <RotateCw className={`w-3 h-3 ${config.dayNightCycleEnabled ? 'animate-spin' : ''}`} />
                  {config.dayNightCycleEnabled ? 'Orbitando' : 'Pausado'}
                </button>
              </div>

              {/* Presets Rápidos de Horário */}
              <div className="bg-slate-900/60 p-1 rounded-md flex border border-slate-700/50 gap-1">
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
                  Dia
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

              {/* Slider de Hora */}
              <div className="space-y-1 pt-0.5">
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
            </div>

            {/* Modos de Câmera */}
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={() => onCameraModeChange('orbit')}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-center text-[10px] font-medium transition-all ${
                  cameraMode === 'orbit'
                    ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200 font-semibold'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                Câmera Livre
              </button>
              <button
                onClick={() => onCameraModeChange('follow_duck')}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-center text-[10px] font-medium transition-all ${
                  cameraMode === 'follow_duck'
                    ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200 font-semibold'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                Seguir Pato
              </button>
              <button
                onClick={() => onCameraModeChange('top_down')}
                className={`flex-1 py-1.5 px-2 rounded-lg border text-center text-[10px] font-medium transition-all ${
                  cameraMode === 'top_down'
                    ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200 font-semibold'
                    : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                Visão Aérea
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
