import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, Info, AlertTriangle } from 'lucide-react';
import { useVanta } from '../hooks/use-vanta';
import { ThemeToggle } from '../components/ThemeToggle';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

function HomePage() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const vantaRef = useVanta();

  const generateRoomCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const roomCode = generateRoomCode();
      const { error } = await supabase.from('rooms').insert([
        { room_code: roomCode, content: '' },
      ]);
      if (error) throw error;
      navigate(`/room/${roomCode}`);
    } catch (err) {
      console.error('Error creating room:', err);
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setIsJoining(true);

    try {
      const code = joinCode.trim().toUpperCase();
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
        setJoinError('Room not found');
        setIsJoining(false);
        return;
      }

      navigate(`/room/${code}`);
    } catch (err) {
      console.error('Error joining room:', err);
      setJoinError('An error occurred');
    } finally {
      setIsJoining(false);
    }
  };

  const isLoading = isCreating || isJoining;

  return (
    <div
      ref={vantaRef}
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden p-4 bg-slate-900" // Fallback bg
    >
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* This overlay adds to the glass effect */}
      <div className="absolute inset-0 bg-black/30" /> 

      <main className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        
        <h1 className="font-lavish text-7xl tracking-wide text-white sm:text-8xl md:text-9xl">
          QuickSync
        </h1>
        
        <p className="mt-2 font-lavish text-3xl text-gray-200 md:text-4xl">
          Your Real-Time Shared Clipboard
        </p>

        <div className="mt-8 w-full">
          {/* --- APPLE GLASS UI FIX --- */}
          <div className="w-full bg-white/10 dark:bg-black/20 backdrop-blur-lg border border-white/20 rounded-xl shadow-2xl p-6 sm:p-8">
            <button
              onClick={handleCreateRoom}
              disabled={isLoading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500 disabled:opacity-60 text-white font-semibold py-3 px-4 rounded-lg transition-colors mb-6 flex items-center justify-center"
            >
              {isCreating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Create New Room"}
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/30"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-transparent text-gray-200" style={{ transform: "translateY(-0.6rem)" }}>or</span>
              </div>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-4">
              <div>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value.toUpperCase());
                    setJoinError('');
                  }}
                  placeholder="ENTER ROOM CODE"
                  maxLength={6}
                  className="w-full bg-white/10 dark:bg-black/20 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-300 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 uppercase text-center font-bold tracking-[0.2em]"
                />
              </div>
              {joinError && (
                <p className="text-red-300 text-sm font-medium">{joinError}</p>
              )}
              <button
                type="submit"
                disabled={isLoading || !joinCode.trim()}
                className="w-full bg-white/20 hover:bg-white/30 disabled:bg-white/10 disabled:opacity-40 text-white font-semibold py-3 px-4 rounded-lg transition-colors border border-white/20 flex items-center justify-center"
              >
                {isJoining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Join Room"}
              </button>
            </form>
          </div>
        </div>
      </main>

      <footer className="fixed bottom-4 right-4 z-20">
        <div className="flex items-center gap-2">
          
          <div className="text-xs text-gray-200 hidden sm:block text-right">
            <p>Made by Ashutosh Vijay</p>
            <p className="text-gray-400">A sub project under Project Apinsity.</p>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-full text-gray-200 hover:text-white hover:bg-white/10"
              >
                <Info className="h-4 w-4" />
                <span className="sr-only">Disclaimer</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" side="top" align="end">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none">Educational Purpose</h4>
                  <p className="text-sm text-muted-foreground">
                    <strong>Learning Project:</strong> This tool is for learning and demonstration only.
                  </p>
                </div>
                <div className="flex items-start gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">
                    Do not use for confidential or production data.
                  </p>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </footer>

    </div>
  );
}

export default HomePage;