// Types de theme.palette.js (utilisé par tailwind.config.js et les tests)
export type Scale = Record<string, string>;
export type Theme = Record<string, Scale | string>;

export const palettes: { light: Theme; dark: Theme };
export function cssVariables(theme: Theme): Record<string, string>;
export function tailwindColors(): Record<string, Scale | string>;
