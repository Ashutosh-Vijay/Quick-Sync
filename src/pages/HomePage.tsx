import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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

// Framer Motion orchestration
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.7,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.8,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const buttonItemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export default function HomePage() {
  const navigate = useNavigate();
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

      if (code === 'XX13XX') {
        navigate('/room/XX13XX');
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
    <div className="relative h-[100dvh] w-full overflow-hidden select-none">
      {/* Fixed controls */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="fixed top-6 left-6 z-50">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="rounded-full bg-background/20 backdrop-blur-md border-white/10 hover:bg-background/40 shadow-sm transition-all duration-300 hover:scale-105"
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

      {/* Scrollable wrapper */}
      <div className="absolute inset-0 w-full h-full overflow-y-auto overflow-x-hidden flex flex-col items-center p-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <motion.main
          className="relative z-10 flex flex-1 w-full max-w-md flex-col items-center justify-center text-center pt-20 pb-10 sm:pt-6 sm:pb-2 min-h-[min-content]"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ── Hero Title ─────────────────────────────────────────── */}
          <motion.h1
            variants={itemVariants}
            className="font-lavish text-[clamp(3.5rem,15vw,9rem)] leading-[0.9] tracking-wide gradient-text drop-shadow-lg pb-1"
          >
            QuickSync
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mt-2 font-medium text-base sm:text-lg text-muted-foreground/70 tracking-wide"
          >
            Real-Time Shared Clipboard
          </motion.p>

          {/* ── Animated tagline chips ─────────────────────────────── */}
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-2 mt-4">
            {['Instant', 'Encrypted', 'Ephemeral'].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 text-[11px] font-semibold uppercase tracking-widest rounded-full border border-white/10 dark:border-white/5 bg-white/30 dark:bg-white/[0.03] text-muted-foreground/70 backdrop-blur-sm"
              >
                {tag}
              </span>
            ))}
          </motion.div>

          {/* ── Main Card ──────────────────────────────────────────── */}
          <motion.div
            variants={cardVariants}
            className="mt-6 sm:mt-10 w-full glow-card rounded-2xl p-5 sm:p-8 transition-all duration-500"
          >
            {/* Create Room Button */}
            <motion.button
              variants={buttonItemVariants}
              onClick={handleCreateRoom}
              disabled={isLoading}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full btn-shine glow-pulse font-semibold py-4 px-4 rounded-xl transition-all duration-300 mb-4 sm:mb-5 flex items-center justify-center shadow-lg
                ${
                  isSecureMode
                    ? 'bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white'
                    : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white'
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
            </motion.button>

            {/* Security Toggle */}
            <motion.div
              variants={buttonItemVariants}
              className="flex items-center justify-center gap-3 mb-5 sm:mb-6 bg-black/[0.03] dark:bg-white/[0.03] p-2.5 rounded-full w-fit mx-auto border border-black/5 dark:border-white/5 backdrop-blur-sm"
            >
              <Switch
                id="secure-mode"
                checked={isSecureMode}
                onCheckedChange={toggleSecureMode}
                className="data-[state=checked]:bg-emerald-500"
              />
              <Label
                htmlFor="secure-mode"
                className="text-sm font-medium cursor-pointer flex items-center gap-2 pr-2 select-none"
              >
                {isSecureMode ? (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" /> E2E Encrypted
                  </span>
                ) : (
                  <span className="text-violet-600 dark:text-violet-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" /> Public Mode
                  </span>
                )}
              </Label>
            </motion.div>

            {/* Divider */}
            <motion.div variants={buttonItemVariants} className="relative mb-5 sm:mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-black/5 dark:border-white/5" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold">
                <span className="px-4 bg-white/60 dark:bg-white/[0.03] backdrop-blur-md text-muted-foreground/60 rounded-full py-1 border border-black/5 dark:border-white/5">
                  or join existing
                </span>
              </div>
            </motion.div>

            {/* Join Form */}
            <motion.form
              variants={buttonItemVariants}
              onSubmit={(e) => handleJoinRoom(e)}
              className="space-y-4"
            >
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
                  className="w-full bg-black/[0.02] dark:bg-white/[0.03] border-2 border-black/5 dark:border-white/5 focus:border-violet-500/50 dark:focus:border-violet-400/50 rounded-xl px-4 py-4 text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-0 text-center font-mono text-lg font-bold tracking-[0.3em] transition-all duration-300 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]"
                />
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-transparent rounded-tl-lg group-hover/input:border-violet-500/30 transition-colors duration-500" />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-transparent rounded-tr-lg group-hover/input:border-violet-500/30 transition-colors duration-500" />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-transparent rounded-bl-lg group-hover/input:border-violet-500/30 transition-colors duration-500" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-transparent rounded-br-lg group-hover/input:border-violet-500/30 transition-colors duration-500" />
              </div>

              {joinError && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-center gap-2 text-red-500 dark:text-red-400 text-sm font-bold"
                >
                  <ShieldAlert className="w-4 h-4" /> {joinError}
                </motion.div>
              )}

              <button
                type="submit"
                disabled={isLoading || !joinCode.trim()}
                className="w-full bg-black/[0.03] dark:bg-white/[0.06] hover:bg-black/[0.06] dark:hover:bg-white/[0.1] text-foreground font-semibold py-3 px-4 rounded-xl transition-all duration-300 border border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/10 flex items-center justify-center gap-2 group/btn"
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
            </motion.form>

            {/* Recent Rooms */}
            {recentRooms.length > 0 && (
              <motion.div
                variants={buttonItemVariants}
                className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-black/5 dark:border-white/5"
              >
                <div className="flex items-center justify-center gap-2 mb-3 sm:mb-4 text-muted-foreground/50 text-[10px] font-bold uppercase tracking-[0.2em]">
                  <Clock className="w-3 h-3" />
                  <span>Recent Portals</span>
                </div>
                <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
                  {recentRooms.map((item, i) => (
                    <motion.div
                      key={item.code}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.1, duration: 0.4 }}
                    >
                      <Badge
                        variant="outline"
                        className={`cursor-pointer px-3 py-1.5 transition-all duration-300 border font-mono text-xs sm:text-sm flex items-center gap-1.5 group/badge hover:scale-105
                          ${
                            item.key
                              ? 'text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                              : 'text-violet-600 dark:text-violet-400 border-violet-500/20 hover:bg-violet-500/10 hover:border-violet-500/40 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]'
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
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.main>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="w-full max-w-6xl mx-auto flex shrink-0 items-center justify-between text-xs text-muted-foreground/40 pb-4 sm:pb-10 z-20 pointer-events-none"
        >
          <div className="flex items-center gap-2 pointer-events-auto hover:text-foreground/60 transition-colors">
            <Sparkles className="w-3 h-3 text-violet-500/50" />
            <span>Developed by Asura</span>
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
                    <div className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p>
                        <strong>E2E Encrypted:</strong> AES-256. Requires Hash Key.
                      </p>
                    </div>
                    <div className="flex items-start gap-2 text-violet-500 dark:text-violet-400">
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
        </motion.footer>
      </div>
    </div>
  );
}
