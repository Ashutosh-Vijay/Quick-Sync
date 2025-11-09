import { useEffect, useState, useRef, useCallback } from 'react'; // 1. Import useCallback
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PresenceFooter from '../components/PresenceFooter';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useVanta } from '../hooks/use-vanta';

// 2. A simple debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced as (...args: Parameters<F>) => void;
}

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

  // 3. Create a debounced function to update Supabase
  // We use useCallback so it doesn't get recreated on every render
  const debouncedUpdateSupabase = useCallback(
    debounce(async (newContent: string) => {
      try {
        await supabase
          .from('rooms')
          .update({ content: newContent, updated_at: new Date().toISOString() })
          .eq('room_code', roomCode);
      } catch (err) {
        console.error('Error updating content:', err);
      }
    }, 300), // Wait 300ms after user stops typing
    [roomCode] // Re-create this function if the roomCode changes
  );

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
              
              // 4. OPTIMIZATION: Only update state if the text is different
              // This stops the "echo" of your own debounced update.
              setContent(prevContent => {
                if (prevContent !== newContent) {
                  return newContent;
                }
                return prevContent;
              });
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

  // 5. Update the text change handler
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent); // Update local UI instantly (feels fast)
    debouncedUpdateSupabase(newContent); // Send to server after a delay (no lag)
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
           <button
             onClick={() => navigate('/')}
             className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2 text-sm"
           >
             <ArrowLeft className="w-4 h-4" />
             Back to Home
           </button>
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
             onChange={handleTextChange} // This now calls the debounced function
             placeholder="Start typing... Your text will sync in real-time"
             className="w-full h-full min-h-[70vh] bg-transparent text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0 border-none resize-none font-mono text-base leading-relaxed p-4 sm:p-8"
             autoFocus
           />
         </div>
       </main>

       <PresenceFooter roomCode={roomCode} />
     </div>
  );
}

export default RoomPage;