import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from './ui';

type Theme = 'light' | 'dark';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('vortex-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('vortex-theme', theme);
  }, [theme]);

  const label = theme === 'dark' ? 'Activar tema claro' : 'Activar tema oscuro';
  return (
    <Button type="button" variant="ghost" aria-label={label} title={label}
      onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}>
      {theme === 'dark' ? <Sun size={19} aria-hidden /> : <Moon size={19} aria-hidden />}
    </Button>
  );
}
