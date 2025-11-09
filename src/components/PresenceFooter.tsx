import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Info, AlertTriangle } from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface PresenceFooterProps {
  roomCode: string;
}

function PresenceFooter({ roomCode }: PresenceFooterProps) {
  const [activeConnections, setActiveConnections] = useState(0);

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
    <div className="fixed bottom-0 left-0 right-0 bg-background/70 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60 border-t border-border px-4 sm:px-6 py-3 z-20">
      
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 text-muted-foreground text-sm">
        
        {/* LEFT SIDE: Active Connections */}
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-500" />
          <span className="font-medium">Active Connections: <span className="text-cyan-500 dark:text-cyan-400 font-bold">{activeConnections}</span></span>
        </div>

        {/* RIGHT SIDE: Author + Disclaimer */}
        <div className="flex items-center gap-2">
          
          {/* --- 1. UPDATED THIS DIV --- */}
          <div className="text-xs text-muted-foreground hidden sm:block text-right">
            <p>Made by Ashutosh Vijay</p>
            <p className="text-muted-foreground/70">A sub project under Project Apinsity.</p>
          </div>
          {/* ------------------------ */}
          
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