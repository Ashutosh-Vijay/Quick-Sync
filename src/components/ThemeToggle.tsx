'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Zap, ZapOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme } = useTheme();
  const [effectsOff, setEffectsOff] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('quicksync-boring-mode');
    const shouldDisable = saved === 'true';
    setEffectsOff(shouldDisable);
    if (shouldDisable) {
      document.body.classList.add('boring-mode');
    } else {
      document.body.classList.remove('boring-mode');
    }
  }, []);

  const toggleEffects = () => {
    const newValue = !effectsOff;
    setEffectsOff(newValue);
    localStorage.setItem('quicksync-boring-mode', String(newValue));

    if (newValue) {
      document.body.classList.add('boring-mode');
    } else {
      document.body.classList.remove('boring-mode');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative rounded-full bg-background/20 backdrop-blur-md border-white/10 hover:bg-background/40 shadow-sm transition-all duration-300 hover:scale-105"
        >
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />

          {effectsOff && (
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500/70" />
            </span>
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="mr-2 h-4 w-4" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="mr-2 h-4 w-4" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <span className="mr-2 text-xs">💻</span> System
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault();
            toggleEffects();
          }}
          className="cursor-pointer"
        >
          {effectsOff ? (
            <>
              <Zap className="mr-2 h-4 w-4 text-amber-500" />
              Enable Effects
            </>
          ) : (
            <>
              <ZapOff className="mr-2 h-4 w-4 text-muted-foreground" />
              Disable Effects
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
