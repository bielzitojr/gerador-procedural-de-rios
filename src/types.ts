export type TimeOfDay = 'day' | 'sunset' | 'night';

export type WaterBodyType = 'water' | 'river' | 'lake' | 'ocean' | 'puddles' | 'rain' | 'waterfall' | 'aquatic_cave' | 'rainbow' | 'grotto' | 'trench' | 'underground_river' | 'drips';

// Variantes de Ondas para Praias e Mares
export type WaveVariant = 'leve' | 'agitado' | 'tempestade';

// Configuração Procedural de Poças d'água no Terreno
export interface PuddleConfig {
  puddleCount: number; // 3 a 35 poções de água
  puddleRadius: number; // 1.0 a 6.0m
  puddleDepth: number; // 0.1 a 1.5m
  mudRimWidth: number; // 0.2 a 2.5m
  puddleSeed: number;
  puddleWetness: number; // 0.2 a 2.0
  isCalmWater?: boolean; // Águas calmas na poça (água parada, sem perturbação)
}

// Configuração Procedural de Chuva e Clima
export interface RainConfig {
  isRaining: boolean;
  rainIntensity: number; // 0.2 a 2.5
  dropletCount: number; // 1000 a 5000
  windAngle: number; // -45 a 45 graus
  splashIntensity: number; // 0.2 a 2.0
  rippleFrequency: number; // 0.2 a 2.0
}

// Configuração Procedural de Bacia Lacustre (Lagos)
export interface LakeConfig {
  lakeRadius: number; // 15 a 48m
  lakeDepth: number; // 1.0 a 7.0m
  lakeIrregularity: number; // 0.1 a 1.5
  lakeIslandCount: number; // 0 a 4
  lakeCalmness: number; // 0.2 a 2.0
  lakeRockDensity: number; // 0 a 35
  lakeSeed: number;
  isCalmWater?: boolean; // Lago de águas calmas (superfície espelhada e parada)
}

// Configuração Procedural de Oceano Aberto e Praias (Ondas, Swell e Arrebentação)
export interface OceanConfig {
  waveVariant: WaveVariant; // 'leve' | 'agitado' | 'tempestade'
  oceanSwellHeight: number; // 0.4 a 4.0m
  oceanWaveLength: number; // 8 a 40m
  oceanChoppiness: number; // 0.2 a 2.0
  oceanSpeed: number; // 0.3 a 3.0
  oceanFoamCrests: number; // 0.1 a 1.5
  shoreWash?: number; // 0.5 a 3.0m - avanço da onda na areia da praia
  oceanSeed: number;
}

export interface RiverConfig {
  environment: { scale: number; height: number; depth: number; density: number; intensity: number; rainbow: boolean };
  // Aba ativa e ambiente aquático selecionado
  waterMode: WaterBodyType;

  // 1. Geração Procedural do Rio (separado da Água)
  seed: number;
  meander: number; // 0.1 to 1.5 - curvature
  riverWidth: number; // 3 to 16
  depth: number; // 1 to 5
  flowSpeed: number; // 0.2 to 3.0
  rockDensity: number; // 0 to 40
  terrainRoughness: number; // 0.5 to 2.5
  length: number; // segments
  duckCount: number;
  currentStrength: number; // 0.0 a 2.5 - Força da correnteza e esteira do fluxo

  // 2. Parâmetros e Shader de Água Toon (Matéria & Aparência da Água)
  paletteId: string;
  foamWidth: number; // foam threshold
  causticScale: number; // caustics frequency
  waveHeight: number; // wave amplitude
  translucency?: number;
  refractionAmount?: number;
  highlightIntensity?: number;
  isCalmWater?: boolean; // Águas Calmas: água parada, sem correnteza, límpida e espelhada
  calmWaterIntensity?: number; // 0.0 a 1.0 - Intensidade da calmaria
  waveVariant?: WaveVariant; // Ondas: 'leve' | 'agitado' | 'tempestade'

  // Ciclo Dia / Noite & Clima
  timeOfDay: TimeOfDay;
  timeHour: number; // 0.0 a 24.0 - Posição orbital contínua do Sol e da Lua
  dayNightCycleEnabled: boolean; // Rotação contínua e realista dos corpos celestes
  dayNightSpeed: number; // 0.1 a 5.0 - Velocidade da passagem do tempo

  // 3. Chuva (compatibilidade direta + objeto rain)
  isRaining: boolean;
  rainIntensity: number;
  rain: RainConfig;

  // 4. Poças (variável dedicada)
  puddles: PuddleConfig;

  // 5. Lagos (variável dedicada)
  lake: LakeConfig;

  // 6. Oceanos (variável dedicada)
  ocean: OceanConfig;

  // Propriedades Físicas da Água
  waterDensity: number; // 0.6 a 1.6 - Densidade do líquido
  buoyancy: number; // 0.5 a 3.0 - Força de empuxo / flutuação
  waterViscosity: number; // 0.2 a 2.5 - Viscosidade / arrasto hidrodinâmico
  waveDamping: number; // 0.90 a 0.995 - Amortecimento e propagação de ondas
  rippleIntensity: number; // 0.2 a 3.0 - Ondulações geradas por movimento de objetos
  showPhysicsDebug?: boolean; // Logs visuais de bounding boxes, áreas de contato e vetores de força
}

export interface WaterPalette {
  id: string;
  name: string;
  shallowColor: string;
  deepColor: string;
  foamColor: string;
  causticColor: string;
  sunGlintColor: string;
}

export type ViewMode = 'river';
export type CameraMode = 'orbit' | 'follow_duck' | 'top_down';
