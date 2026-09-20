export interface ThemeVars {
  primary: string;
  secondary: string;
  surface: string;
  text: string;
  bg: string;
  cardBg: string;
  cardBgDark: string;
  cardBgSubtle: string;
  cardBgDeep: string;
  border: string;
  textMuted: string;
  textFaint: string;
  textDim: string;
  accentBright: string;
  accentDim: string;
  accentMid: string;
}

export const THEMES: Record<string, ThemeVars> = {
  "Zöld": {
    primary: "#2d6a4f", secondary: "#4a8f6e", surface: "#1d3528", text: "#86d0a8",
    bg: "#181F1C", cardBg: "#274029", cardBgDark: "#1e3321", cardBgSubtle: "#1a2620", cardBgDeep: "#182219",
    border: "#315C2B", textMuted: "#6A7D65", textFaint: "#4A5E46", textDim: "#8FA087",
    accentBright: "#c4cf72", accentDim: "#60712F", accentMid: "#4a6044",
  },
  "Piros": {
    primary: "#9b2226", secondary: "#c44040", surface: "#2e1315", text: "#e08080",
    bg: "#1a1212", cardBg: "#2c1a1a", cardBgDark: "#221212", cardBgSubtle: "#180e0e", cardBgDeep: "#140c0c",
    border: "#4a2020", textMuted: "#7a4848", textFaint: "#5a3636", textDim: "#8a6060",
    accentBright: "#e07878", accentDim: "#5a2020", accentMid: "#5a3030",
  },
  "Narancs": {
    primary: "#ae2012", secondary: "#d44030", surface: "#321208", text: "#e89070",
    bg: "#1c1410", cardBg: "#2c1c10", cardBgDark: "#221408", cardBgSubtle: "#180e06", cardBgDeep: "#141008",
    border: "#4a2010", textMuted: "#7a5040", textFaint: "#5a3c30", textDim: "#8a7060",
    accentBright: "#e89068", accentDim: "#5a2c10", accentMid: "#5a3820",
  },
  "Citrom": {
    primary: "#8a7d00", secondary: "#b5a710", surface: "#282500", text: "#d4c840",
    bg: "#1a1a10", cardBg: "#28280c", cardBgDark: "#1e1e08", cardBgSubtle: "#141406", cardBgDeep: "#141410",
    border: "#404018", textMuted: "#787040", textFaint: "#585030", textDim: "#8a8060",
    accentBright: "#d4c840", accentDim: "#505010", accentMid: "#505020",
  },
  "Kék": {
    primary: "#1d3557", secondary: "#2e5080", surface: "#111e32", text: "#80a8d4",
    bg: "#111420", cardBg: "#182038", cardBgDark: "#131828", cardBgSubtle: "#0e121e", cardBgDeep: "#0c0e18",
    border: "#223060", textMuted: "#4a6080", textFaint: "#384a68", textDim: "#608090",
    accentBright: "#78b0e0", accentDim: "#1a2c50", accentMid: "#203a60",
  },
  "Lila": {
    primary: "#4a1c6e", secondary: "#6e3a98", surface: "#1e1030", text: "#c090e0",
    bg: "#140e1c", cardBg: "#221438", cardBgDark: "#1a1028", cardBgSubtle: "#100a1a", cardBgDeep: "#0c0a14",
    border: "#3c1c60", textMuted: "#604080", textFaint: "#483060", textDim: "#706090",
    accentBright: "#c09ae0", accentDim: "#381050", accentMid: "#3a1a5c",
  },
  "Szürke": {
    primary: "#3d3d3d", secondary: "#666666", surface: "#252525", text: "#aaaaaa",
    bg: "#141414", cardBg: "#222222", cardBgDark: "#1c1c1c", cardBgSubtle: "#181818", cardBgDeep: "#111111",
    border: "#383838", textMuted: "#606060", textFaint: "#484848", textDim: "#787878",
    accentBright: "#c0c0c0", accentDim: "#303030", accentMid: "#404040",
  },
};

export const THEME_NAMES = Object.keys(THEMES) as string[];

function hexToHsl(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    case b: h = ((r - g) / d + 4) / 6; break;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const hex2 = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

export function deriveTheme(primaryHex: string): ThemeVars {
  const [h, s] = hexToHsl(primaryHex);
  const cl = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const hs = (ss: number, ll: number) => hslToHex(h, cl(ss, 0, 100), cl(ll, 2, 97));

  return {
    primary:      primaryHex,
    secondary:    hs(s * 0.75, 42),
    surface:      hs(s * 0.75, 16),
    text:         hs(s * 0.5,  67),
    bg:           hs(s * 0.25,  9),
    cardBg:       hs(s * 0.45, 14),
    cardBgDark:   hs(s * 0.45, 11),
    cardBgSubtle: hs(s * 0.35, 10),
    cardBgDeep:   hs(s * 0.3,   9),
    border:       hs(s * 0.7,  22),
    textMuted:    hs(s * 0.15, 45),
    textFaint:    hs(s * 0.2,  32),
    textDim:      hs(s * 0.15, 57),
    accentBright: hs(s * 0.75, 65),
    accentDim:    hs(s * 0.65, 22),
    accentMid:    hs(s * 0.25, 30),
  };
}

function hexToRgb(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

export function applyTheme(themeName: string, customColor?: string): void {
  const theme = themeName === "Egyedi" && customColor
    ? deriveTheme(customColor)
    : (THEMES[themeName] ?? THEMES["Zöld"]);
  const root = document.documentElement;
  root.style.setProperty("--accent-primary",   theme.primary);
  root.style.setProperty("--accent-secondary",  theme.secondary);
  root.style.setProperty("--accent-surface",    theme.surface);
  root.style.setProperty("--accent-text",       theme.text);
  root.style.setProperty("--accent-rgb",        hexToRgb(theme.primary));
  root.style.setProperty("--accent",            theme.primary);
  root.style.setProperty("--bg",               theme.bg);
  root.style.setProperty("--card-bg",          theme.cardBg);
  root.style.setProperty("--card-bg-dark",     theme.cardBgDark);
  root.style.setProperty("--card-bg-subtle",   theme.cardBgSubtle);
  root.style.setProperty("--card-bg-deep",     theme.cardBgDeep);
  root.style.setProperty("--border",           theme.border);
  root.style.setProperty("--text-muted",       theme.textMuted);
  root.style.setProperty("--text-faint",       theme.textFaint);
  root.style.setProperty("--text-dim",         theme.textDim);
  root.style.setProperty("--accent-bright",    theme.accentBright);
  root.style.setProperty("--accent-dim",       theme.accentDim);
  root.style.setProperty("--accent-mid",       theme.accentMid);
}
