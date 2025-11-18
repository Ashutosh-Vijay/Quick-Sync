import { useEffect, useState, useRef } from 'react';
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
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";

function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // Visual indicator
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  // ✅ THE FIX: Use a Ref for the typing lock. 
  // Refs update instantly and don't cause re-renders or dependency issues.
  const isTypingRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          setError('Room not found. Redirecting to home...');
          setTimeout(() => navigate('/'), 2000);
          return;
        }

        // Initial load
        setContent(room.content || '');

        // Subscribe to Realtime changes
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
              // ✅ THE MAGIC LOGIC
              // If I am currently typing (or waiting for my save to finish),
              // IGNORE the incoming update. My local version is newer.
              if (isTypingRef.current) {
                return;
              }
              
              const newContent = (payload.new as { content: string }).content;
              setContent(newContent);
            }
          )
          .subscribe();
        
      } catch (err: any) {
        console.error('Error initializing room:', err);
        setError('Failed to initialize room. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeRoom();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, [roomCode, navigate]); 

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    
    // 1. Update UI immediately
    setContent(newContent);
    
    // 2. ACTIVATE LOCK: Tell the app "I am busy typing, don't listen to the server"
    isTypingRef.current = true;
    setIsSaving(true);

    // 3. Clear previous timer
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // 4. Debounce the save
    updateTimeoutRef.current = setTimeout(async () => {
      try {
        await supabase
          .from('rooms')
          .update({ 
            content: newContent, 
            updated_at: new Date().toISOString() 
          })
          .eq('room_code', roomCode);
      } catch (err) {
        console.error('Error updating content:', err);
      } finally {
        // ✅ RELEASE LOCK: Only after the save is fully complete (and sent)
        // do we allow the server to update us again.
        // We add a small buffer to ensure the "echo" event has likely passed.
        setTimeout(() => {
            isTypingRef.current = false;
            setIsSaving(false);
        }, 200); 
      }
    }, 500); // 500ms wait time
  };

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      toast({ description: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Clear all text?")) return;
    
    setContent('');
    isTypingRef.current = true; // Lock during clear

    try {
        await supabase
            .from('rooms')
            .update({ content: '', updated_at: new Date().toISOString() })
            .eq('room_code', roomCode);
    } catch (err) {
        console.error('Error clearing:', err);
    } finally {
        setTimeout(() => {
            isTypingRef.current = false;
        }, 200);
    }
  };

  const characterCount = content.length;
  const lineCount = content ? content.split('\n').length : 0;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  if (isLoading) { 
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
                <Button variant="ghost" onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Home
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to Home</TooltipContent>
            </Tooltip>
          </TooltipProvider>

           <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 shadow-sm">
               <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase">Room</span>
               <p className="font-mono text-sm font-bold text-primary tracking-widest">{roomCode}</p>
             </div>
             {/* Saving Indicator */}
             <div className="w-20 flex justify-end">
                {isSaving ? (
                    <span className="text-xs text-muted-foreground animate-pulse flex items-center">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving
                    </span>
                ) : (
                    <span className="text-xs text-green-500 flex items-center">
                        <Check className="w-3 h-3 mr-1" /> Synced
                    </span>
                )}
             </div>
             <ThemeToggle />
           </div>
         </div>
       </header>

       <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
         <div className="bg-background/80 backdrop-blur-md rounded-xl shadow-2xl border border-border min-h-[70vh] flex flex-col overflow-hidden">
           <textarea
             ref={textareaRef}
             value={content}
             onChange={handleTextChange} 
             placeholder="Start typing... content syncs automatically."
             className="w-full flex-1 min-h-[65vh] bg-transparent text-foreground placeholder-muted-foreground/50 focus:outline-none border-none resize-none font-mono text-base leading-relaxed p-6 sm:p-8"
             autoFocus
             spellCheck={false}
           />
           
           <div className="border-t border-border bg-muted/30 px-4 py-3 flex justify-between items-center gap-4 rounded-b-xl">
              <div className="flex items-center gap-6 text-xs font-mono text-muted-foreground">
                <span>{characterCount.toLocaleString()} chars</span>
                <span>{wordCount.toLocaleString()} words</span>
                <span>{lineCount.toLocaleString()} lines</span>
              </div>
              
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
                <Button variant="ghost" size="icon" onClick={handleClear} disabled={!content}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
         </div>
       </main>

       <PresenceFooter roomCode={roomCode} />
       <Toaster />
     </div>
  );
}

export default RoomPage;