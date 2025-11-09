import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PresenceFooter from '../components/PresenceFooter'; 
import { Loader2 } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useVanta } from '../hooks/use-vanta';
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  const vantaRef = useVanta();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">Invalid room code</p>
      </div>
    );
  }

  useEffect(() => {
    const initializeRoom = async () => {
      try {
        const { data: room, error: fetchError } = await supabase
          .from('rooms')
          .select('content')
          .eq('room_code', roomCode)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (!room) {
          setError('Room not found');
          setTimeout(() => navigate('/'), 2000);
          return;
        }

        setContent(room.content || '');

        channelRef.current = supabase
          .channel(`room-content:${roomCode}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'rooms',
              filter: `room_code=eq.${roomCode}`,
            },
            (payload) => {
              const newContent = (payload.new as { content: string }).content;
              setContent(newContent);
            }
          )
          .subscribe();

        setIsLoading(false);

      } catch (err: any) {
        console.error('Error initializing room:', err);
        setError('Failed to initialize room');
        setIsLoading(false);
      }
    };

    initializeRoom();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomCode, navigate]);

  const handleTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    try {
      await supabase
        .from('rooms')
        .update({ content: newContent, updated_at: new Date().toISOString() })
        .eq('room_code', roomCode);
    } catch (err) {
      console.error('Error updating content:', err);
    }
  };

  if (isLoading && !content) { 
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading room...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col">
       
       <div 
         ref={vantaRef} 
         className="fixed inset-0 z-0"
       />

       <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60 border-border">
         <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
           
           <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 -960 960 960" 
                    fill="currentColor"
                    className="w-5 h-5" // Set size using Tailwind
                  >
                    <path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/>
                  </svg>
                  <span className="sr-only">Back to Home</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Back to Home</p>
              </TooltipContent>
            </Tooltip>
           </TooltipProvider>

           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 rounded-md border border-border bg-card/80 px-3 py-1.5">
               <span className="font-mono text-sm text-muted-foreground tracking-widest hidden sm:inline">Room:</span>
               <p className="font-mono text-sm text-foreground tracking-widest">{roomCode}</p>
             </div>
             <ThemeToggle />
           </div>
         </div>
       </header>

       <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
         <div className="bg-background rounded-lg shadow-xl border border-border min-h-[70vh]">
           <textarea
             ref={textareaRef}
             value={content}
             onChange={handleTextChange}
             placeholder="Start typing... Your text will sync in real-time"
             className="w-full h-full min-h-[7Dvh] bg-transparent text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0 border-none resize-none font-mono text-base leading-relaxed p-4 sm:p-8"
             autoFocus
           />
         </div>
       </main>

       <PresenceFooter roomCode={roomCode} />
     </div>
  );
}

export default RoomPage;