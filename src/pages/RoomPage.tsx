import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PresenceFooter from '../components/PresenceFooter';
import { ArrowLeft, Loader2, Copy, Trash2, Check } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ✅ NEW: A throttle function for a smoother real-time feel
function throttle<F extends (...args: any[]) => any>(func: F, limit: number) {
  let inThrottle: boolean;
  return function(this: any, ...args: Parameters<F>) {
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isTypingRef = useRef(false);

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">Invalid room code</p>
      </div>
    );
  }

  const sendUpdate = useCallback(async (newContent: string) => {
    try {
      await supabase
        .from('rooms')
        .update({ content: newContent, updated_at: new Date().toISOString() })
        .eq('room_code', roomCode);
    } catch (err) {
      console.error('Error updating content:', err);
    }
  }, [roomCode]);

  // ✅ NEW: Switched from debounce to throttle for a 200ms update interval
  const throttledSendUpdate = useCallback(throttle(sendUpdate, 200), [sendUpdate]);

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
              if (isTypingRef.current) return;
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

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    isTypingRef.current = true;
    const newContent = e.target.value;
    setContent(newContent); 
    throttledSendUpdate(newContent);
    // Use a timeout to reset the typing flag
    setTimeout(() => {
        isTypingRef.current = false;
    }, 300); // Reset after 300ms of inactivity
  };

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    setContent(''); 
    throttledSendUpdate(''); 
  };

  const characterCount = content.length;
  const lineCount = content.split('\n').length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

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
       <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60 border-border">
         <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
           <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
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
         <div className="bg-background/80 backdrop-blur-lg rounded-lg shadow-xl border border-border min-h-[70vh] flex flex-col">
           <textarea
             ref={textareaRef}
             value={content}
             onChange={handleTextChange} 
             placeholder="Start typing... Your text will sync in real-time"
             className="w-full flex-1 min-h-[65vh] bg-transparent text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0 border-none resize-none font-mono text-base leading-relaxed p-4 sm:p-8"
             autoFocus
           />
           
           <div className="border-t border-border bg-muted/50 px-4 py-2 flex justify-between items-center gap-2 rounded-b-lg">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{characterCount.toLocaleString()} chars</span>
                <span>{wordCount.toLocaleString()} words</span>
                <span>{lineCount.toLocaleString()} lines</span>
              </div>
              
              <div className="flex items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={handleCopy}>
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{copied ? "Copied!" : "Copy to clipboard"}</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={handleClear} disabled={!content}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear text</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
         </div>
       </main>

       <PresenceFooter roomCode={roomCode} />
     </div>
  );
}

export default RoomPage;