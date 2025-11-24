// ... existing imports ...
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { generateRoomId } from '@/lib/utils';
import { generateKey } from '@/lib/crypto';
import {
  Loader2,
  Info,
  Clock,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  Globe,
  Sparkles,
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ApinsityLogo } from '@/components/ApinsityLogo';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface HistoryItem {
  code: string;
  key: string | null;
  timestamp: number;
}

export default function HomePage() {
  const navigate = useNavigate();
  // ... existing state ...
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [recentRooms, setRecentRooms] = useState<HistoryItem[]>([]);

  const [isSecureMode, setIsSecureMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('quicksync_secure_pref') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const saved = localStorage.getItem('quicksync_history_hybrid');
    if (saved) {
      try {
        setRecentRooms(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }
  }, []);

  const toggleSecureMode = (checked: boolean) => {
    setIsSecureMode(checked);
    localStorage.setItem('quicksync_secure_pref', String(checked));
  };

  const addToHistory = (code: string, key: string | null) => {
    const newItem: HistoryItem = { code, key, timestamp: Date.now() };
    const current = recentRooms.filter((r) => r.code !== code);
    const updated = [newItem, ...current].slice(0, 3);
    setRecentRooms(updated);
    localStorage.setItem('quicksync_history_hybrid', JSON.stringify(updated));
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const roomCode = generateRoomId();
      const { error } = await supabase.from('rooms').insert([{ room_code: roomCode, content: '' }]);
      if (error) throw error;

      if (isSecureMode) {
        const secretKey = generateKey();
        addToHistory(roomCode, secretKey);
        navigate(`/room/${roomCode}#${secretKey}`);
      } else {
        addToHistory(roomCode, null);
        navigate(`/room/${roomCode}`);
      }
    } catch (err) {
      console.error('Error creating room:', err);
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (
    e?: React.FormEvent,
    codeOverride?: string,
    keyOverride?: string | null
  ) => {
    if (e) e.preventDefault();
    const codeToUse = codeOverride || joinCode;

    setJoinError('');
    setIsJoining(true);

    try {
      const code = codeToUse.trim().toUpperCase();
      if (!code) {
        setJoinError('Please enter a room code');
        setIsJoining(false);
        return;
      }

      const { data, error } = await supabase
        .from('rooms')
        .select('room_code')
        .eq('room_code', code)
        .maybeSingle();
      if (error) throw error;

      if (!data) {
        if (recentRooms.some((r) => r.code === code)) {
          setJoinError('Room has been Nuked or Expired 💥');
          const updatedHistory = recentRooms.filter((r) => r.code !== code);
          setRecentRooms(updatedHistory);
          localStorage.setItem('quicksync_history_hybrid', JSON.stringify(updatedHistory));
        } else {
          setJoinError('Room not found');
        }
        setIsJoining(false);
        return;
      }

      if (keyOverride) {
        addToHistory(code, keyOverride);
        navigate(`/room/${code}#${keyOverride}`);
      } else {
        addToHistory(code, null);
        navigate(`/room/${code}`);
      }
    } catch (err) {
      console.error('Error joining room:', err);
      setJoinError('An error occurred');
    } finally {
      setIsJoining(false);
    }
  };

  const isLoading = isCreating || isJoining;

  return (
    // FIX: Back to h-[100dvh] and overflow-hidden to kill the window scrollbar.
    // We handle scrolling internally now.
    <div className="relative h-[100dvh] w-full overflow-hidden select-none">
      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .glass-panel {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.15);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.1);
        }
        .dark .glass-panel {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3);
        }
      `}</style>

      {/* FALLBACK BLOBS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 hidden [.boring-mode_&]:block">
        <div className="absolute top-[-10%] left-[-20%] w-96 h-96 sm:w-[40vw] sm:h-[40vw] rounded-full bg-purple-500/30 dark:bg-purple-900/30 blur-[80px] sm:blur-[100px] mix-blend-overlay dark:mix-blend-screen" />
        <div className="absolute top-[20%] right-[-20%] w-80 h-80 sm:w-[35vw] sm:h-[35vw] rounded-full bg-cyan-500/30 dark:bg-cyan-900/30 blur-[80px] sm:blur-[100px] mix-blend-overlay dark:mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[10%] w-96 h-96 sm:w-[45vw] sm:h-[45vw] rounded-full bg-blue-500/30 dark:bg-blue-900/30 blur-[80px] sm:blur-[100px] mix-blend-overlay dark:mix-blend-screen" />
      </div>

      {/* Fixed controls stay above the scrollable area */}
      <div className="fixed top-8 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="fixed top-8 left-6 z-50">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-background/20 backdrop-blur-md border-white/10 hover:bg-background/40 shadow-sm"
            >
              <ApinsityLogo withText={false} className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            className="w-auto p-3 bg-background/80 backdrop-blur-xl border-white/10 select-none"
          >
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Part of
              </span>
              <span className="font-bold text-sm flex items-center gap-2 mt-1">
                <ApinsityLogo withText={false} className="h-4 w-4" /> Project Apinsity
              </span>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* FIX: SCROLLABLE WRAPPER 
        - absolute inset-0: Fills the screen
        - overflow-y-auto: Allows scrolling if content is too tall
        - [&::-webkit-scrollbar]:hidden: Hides scrollbar (Chrome/Safari/Edge)
        - [scrollbar-width:none]: Hides scrollbar (Firefox)
      */}
      <div className="absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <main className="relative z-10 flex flex-1 w-full max-w-md flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-1000 pt-20 pb-10 sm:pt-6 sm:pb-2 min-h-[min-content]">
          <h1 className="font-lavish text-[clamp(3rem,15vw,9rem)] leading-[0.9] tracking-wide text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/50 dark:from-white dark:to-white/50 drop-shadow-lg select-none pb-1">
            QuickSync
          </h1>

          <p className="mt-1 font-lavish text-xl sm:text-3xl text-muted-foreground/80 select-none flex items-center gap-2">
            Real-Time Shared Clipboard
          </p>

          <div className="mt-4 sm:mt-8 w-full glass-panel rounded-3xl p-5 sm:p-8 transition-all duration-500 hover:shadow-2xl hover:border-white/30 group">
            <button
              onClick={handleCreateRoom}
              disabled={isLoading}
              className={`w-full font-semibold py-4 px-4 rounded-2xl transition-all duration-300 mb-4 sm:mb-5 flex items-center justify-center shadow-lg transform hover:-translate-y-1 active:translate-y-0 active:scale-[0.98]
                ${
                  isSecureMode
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-green-500/30 text-white ring-2 ring-green-500/20'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-500/30 text-white ring-2 ring-blue-500/20'
                }
              `}
            >
              {isCreating ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : isSecureMode ? (
                <>
                  <ShieldCheck className="mr-2 h-5 w-5" /> Create Secure Room
                </>
              ) : (
                <>
                  <Globe className="mr-2 h-5 w-5" /> Create Public Room
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-3 mb-5 sm:mb-6 bg-black/5 dark:bg-white/5 p-2 rounded-full w-fit mx-auto border border-white/10 backdrop-blur-sm">
              <Switch
                id="secure-mode"
                checked={isSecureMode}
                onCheckedChange={toggleSecureMode}
                className="data-[state=checked]:bg-green-500"
              />
              <Label
                htmlFor="secure-mode"
                className="text-sm font-medium cursor-pointer flex items-center gap-2 pr-2 select-none"
              >
                {isSecureMode ? (
                  <span className="text-green-600 dark:text-green-400 flex items-center gap-1.5 animate-in fade-in duration-300">
                    <ShieldCheck className="w-3.5 h-3.5" /> E2E Encrypted
                  </span>
                ) : (
                  <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5 animate-in fade-in duration-300">
                    <Globe className="w-3.5 h-3.5" /> Public Mode
                  </span>
                )}
              </Label>
            </div>

            <div className="relative mb-5 sm:mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-foreground/10 dark:border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                <span className="px-4 bg-white/50 dark:bg-black/50 backdrop-blur-md text-muted-foreground/80 rounded-full py-1 border border-white/10">
                  or join existing
                </span>
              </div>
            </div>

            <form onSubmit={(e) => handleJoinRoom(e)} className="space-y-4">
              <div className="relative group/input">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value.toUpperCase());
                    setJoinError('');
                  }}
                  placeholder="ENTER 6-CHAR CODE"
                  maxLength={6}
                  className="w-full bg-white/5 dark:bg-black/20 border-2 border-white/10 focus:border-primary/50 rounded-2xl px-4 py-4 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-0 text-center font-mono text-lg font-bold tracking-[0.3em] transition-all shadow-inner hover:bg-white/10 dark:hover:bg-black/30"
                />
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-foreground/5 rounded-tl-lg group-hover/input:border-primary/40 transition-colors duration-500" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-foreground/5 rounded-tr-lg group-hover/input:border-primary/40 transition-colors duration-500" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-foreground/5 rounded-bl-lg group-hover/input:border-primary/40 transition-colors duration-500" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-foreground/5 rounded-br-lg group-hover/input:border-primary/40 transition-colors duration-500" />
              </div>

              {joinError && (
                <div className="flex items-center justify-center gap-2 text-red-500 dark:text-red-400 text-sm font-bold animate-in slide-in-from-top-2 duration-300">
                  <ShieldAlert className="w-4 h-4" /> {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !joinCode.trim()}
                className="w-full bg-secondary/80 hover:bg-secondary text-secondary-foreground font-semibold py-3 px-4 rounded-xl transition-all border border-white/10 hover:border-white/20 flex items-center justify-center gap-2 group/btn shadow-sm hover:shadow-md"
              >
                {isJoining ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Enter Room
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {recentRooms.length > 0 && (
              <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-foreground/5 dark:border-white/5">
                <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4 text-muted-foreground/60 text-[10px] font-bold uppercase tracking-[0.2em]">
                  <Clock className="w-3 h-3" />
                  <span>Recent Portals</span>
                </div>
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                  {recentRooms.map((item) => (
                    <Badge
                      key={item.code}
                      variant="outline"
                      className={`cursor-pointer px-3 py-1.5 transition-all duration-300 border font-mono text-xs sm:text-sm flex items-center gap-1.5 group/badge
                        ${
                          item.key
                            ? 'text-green-600 dark:text-green-400 border-green-500/30 hover:bg-green-500/10 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                            : 'text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                        }
                      `}
                      onClick={() => handleJoinRoom(undefined, item.code, item.key)}
                    >
                      {item.key ? (
                        <ShieldCheck className="w-3 h-3 group-hover/badge:scale-110 transition-transform" />
                      ) : (
                        <Globe className="w-3 h-3 group-hover/badge:scale-110 transition-transform" />
                      )}
                      {item.code}
                      <ArrowRight className="w-3 h-3 opacity-30 group-hover/badge:opacity-100 group-hover/badge:translate-x-0.5 transition-all" />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        <footer className="w-full max-w-6xl mx-auto flex shrink-0 items-center justify-between text-xs text-muted-foreground/60 pb-4 sm:pb-10 z-20 pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto hover:text-foreground transition-colors">
            <Sparkles className="w-3 h-3 text-yellow-500/70" />
            <span>Developed by Ashutosh Vijay</span>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full hover:bg-white/10 pointer-events-auto transition-colors"
              >
                <Info className="h-4 w-4" />
                <span className="sr-only">About</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-80 bg-background/80 backdrop-blur-xl border-white/10 shadow-2xl select-none"
              side="top"
              align="end"
            >
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none flex items-center gap-2">
                    <ApinsityLogo className="h-4 w-4" withText={false} />
                    Project Apinsity
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    QuickSync is a real-time, ephemeral data tunnel.
                  </p>
                </div>
                <div className="space-y-2 border-t border-white/10 pt-4">
                  <h4 className="font-medium leading-none text-xs uppercase tracking-wider text-muted-foreground">
                    Security Models
                  </h4>
                  <div className="flex flex-col gap-3 text-sm">
                    <div className="flex items-start gap-2 text-green-600 dark:text-green-400">
                      <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p>
                        <strong>E2E Encrypted:</strong> AES-256. Requires Hash Key.
                      </p>
                    </div>
                    <div className="flex items-start gap-2 text-blue-500 dark:text-blue-400">
                      <Globe className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p>
                        <strong>Public:</strong> Obfuscated. Open access.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </footer>
      </div>
    </div>
  );
}
