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
  const [isBoring, setIsBoring] = useState(false);

  // Load preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('quicksync-boring-mode');
    const shouldBeBoring = saved === 'true';
    setIsBoring(shouldBeBoring);
    if (shouldBeBoring) {
      document.body.classList.add('boring-mode');
    } else {
      document.body.classList.remove('boring-mode');
    }
  }, []);

  const toggleBoringMode = () => {
    const newValue = !isBoring;
    setIsBoring(newValue);
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
        <Button variant="outline" size="icon" className="relative">
          {/* Sun/Moon Icons */}
          <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />

          {/* Indicator for Boring Mode */}
          {isBoring && (
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
            </span>
          )}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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

        {/* The "Make it Boring" Toggle */}
        <DropdownMenuItem
          onClick={(e) => {
            e.preventDefault(); // Prevent closing so they can see it toggle
            toggleBoringMode();
          }}
          className="cursor-pointer"
        >
          {isBoring ? (
            <>
              <Zap className="mr-2 h-4 w-4 text-yellow-500" />
              Enable Fun UI
            </>
          ) : (
            <>
              <ZapOff className="mr-2 h-4 w-4 text-muted-foreground" />
              Disable Animations
            </>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
