export type TimeOfDay = 'day' | 'sunset' | 'night';

export interface RiverConfig {
  seed: number;
  meander: number; // 0.1 to 1.5 - curvature
  riverWidth: number; // 3 to 15
  depth: number; // 1 to 5
  flowSpeed: number; // 0.2 to 3.0
  rockDensity: number; // 0 to 40
  terrainRoughness: number; // 0.5 to 2.5
  length: number; // segments
  paletteId: string;
  foamWidth: number; // foam threshold
  causticScale: number; // caustics frequency
  waveHeight: number; // wave amplitude
  duckCount: number;
  currentStrength: number; // 0.0 a 2.5 - Força da correnteza e esteira do fluxo

  // Ciclo Dia / Noite & Clima
  timeOfDay: TimeOfDay;
  timeHour: number; // 0.0 a 24.0 - Posição orbital contínua do Sol e da Lua
  dayNightCycleEnabled: boolean; // Rotação contínua e realista dos corpos celestes
  dayNightSpeed: number; // 0.1 a 5.0 - Velocidade da passagem do tempo
  isRaining: boolean; // Ativa chuva com gotas e ondulações
  rainIntensity: number; // 0.2 a 2.0 - Intensidade da precipitação

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
