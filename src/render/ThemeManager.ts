import { THEMES, type ThemeDef, getTheme } from '../content/themes';

export class ThemeManager {
  current: ThemeDef = THEMES[0]!;

  setTheme(id: string): ThemeDef {
    this.current = getTheme(id);
    this.applyCssVars(this.current);
    return this.current;
  }

  private applyCssVars(theme: ThemeDef): void {
    const root = document.documentElement;
    root.style.setProperty('--theme-accent', theme.accent);
    root.style.setProperty('--theme-sky-top', theme.skyTop);
    root.style.setProperty('--theme-sky-mid', theme.skyMid);
    root.style.setProperty('--theme-sky-bottom', theme.skyBottom);
    root.style.setProperty('--theme-horizon', theme.horizon);
    root.style.setProperty('--theme-lava-a', theme.lava[0]);
    root.style.setProperty('--theme-lava-b', theme.lava[1]);
  }
}
