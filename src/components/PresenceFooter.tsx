import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Info, AlertTriangle } from 'lucide-react'; // 1. Add new icons
import { RealtimeChannel } from '@supabase/supabase-js';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // 2. Import Popover
import { Button } from "@/components/ui/button"; // 3. Import Button

interface PresenceFooterProps {
  roomCode: string;
  content: string; // 4. Accept content as a prop
}

function PresenceFooter({ roomCode, content }: PresenceFooterProps) {
  const [activeConnections, setActiveConnections] = useState(0);

  // 5. Calculate stats from the content prop
  const characterCount = content.length;
  const lineCount = content.split('\n').length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  useEffect(() => {
    if (!roomCode) return;

    const clientId = `client-${Math.random().toString(36).substr(2, 9)}`;
    let presenceChannel: RealtimeChannel;

    const setupPresence = async () => {
      presenceChannel = supabase.channel(`room-presence:${roomCode}`, {
        config: {
          presence: {
            key: clientId,
          },
        },
      });

      presenceChannel.on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const count = Object.keys(state).length;
        setActiveConnections(count);
      });

      await presenceChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });
    };

    setupPresence();

    return () => {
      if (presenceChannel) {
        presenceChannel.untrack();
        supabase.removeChannel(presenceChannel);
      }
    };
  }, [roomCode]);

  return (
    // 6. Added justify-between to space out content
    <div className="fixed bottom-0 left-0 right-0 bg-background/70 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60 border-t border-border px-4 sm:px-6 py-3 z-20">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-muted-foreground text-sm">
        
        {/* LEFT SIDE: Connections + Stats */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-500" />
            <span className="font-medium">Active: <span className="text-cyan-500 dark:text-cyan-400 font-bold">{activeConnections}</span></span>
          </div>
          {/* 7. Added stats from friend's code */}
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <span>{characterCount.toLocaleString()} chars</span>
            <span>{wordCount.toLocaleString()} words</span>
            <span>{lineCount.toLocaleString()} lines</span>
          </div>
        </div>

        {/* RIGHT SIDE: Disclaimer */}
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground hidden md:block">
            Made by Ashutosh Vijay
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
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

      </div>
    </div>
  );
}

export default PresenceFooter;