import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Info, Flame, Zap, Code2 } from 'lucide-react';
import { ApinsityLogo } from './ApinsityLogo';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface PresenceFooterProps {
  roomCode: string;
  onNuke: () => void;
}

function PresenceFooter({ roomCode, onNuke }: PresenceFooterProps) {
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

  const handleNuke = async () => {
    onNuke();
    try {
      await supabase.from('rooms').delete().eq('room_code', roomCode);
    } catch (e) {
      console.error('Failed to nuke room', e);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/70 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60 border-t border-border px-4 sm:px-6 py-3 z-20 select-none">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-muted-foreground text-sm">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-500" />
          <span className="font-medium">
            Active:{' '}
            <span className="text-cyan-500 dark:text-cyan-400 font-bold">{activeConnections}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500/70 hover:text-red-500 hover:bg-red-500/10 h-8 px-2 gap-1 transition-colors"
              >
                <Flame className="w-3 h-3" />
                <span className="text-xs hidden sm:inline font-bold uppercase tracking-wider">
                  Nuke Room
                </span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-red-500 flex items-center gap-2">
                  <Flame className="w-5 h-5" />
                  Delete Room Forever?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will immediately delete all content, files, and
                  disconnect all active users.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleNuke}
                  className="bg-red-500 hover:bg-red-600 text-white border-none"
                >
                  Yes, Nuke It
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="hidden md:flex flex-col items-end border-l border-border pl-3 ml-1 leading-tight">
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80">
              Project Apinsity
            </span>
            <span className="text-[10px]">Made by Ashutosh Vijay</span>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <Info className="h-4 w-4" />
                <span className="sr-only">Info</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 overflow-hidden" side="top" align="end">
              <div className="bg-muted/50 p-4 border-b">
                <h4 className="font-medium flex items-center gap-2">
                  <ApinsityLogo className="h-4 w-4" withText={false} />
                  QuickSync
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  A sub-project under Project Apinsity.
                </p>
              </div>
              <div className="p-4 space-y-4 text-sm">
                <div className="flex gap-3">
                  <Code2 className="w-5 h-5 text-blue-500 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Developer-Centric</p>
                    <p className="text-xs text-muted-foreground">
                      Part of a suite of high-utility tools built for developer efficiency and data
                      flexibility.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Zap className="w-5 h-5 text-yellow-500 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Ephemeral by Nature</p>
                    <p className="text-xs text-muted-foreground">
                      Nothing is stored permanently. Use the{' '}
                      <strong className="text-red-500">Nuke</strong> button to instantly wipe the
                      database clean.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-muted/30 p-3 text-center border-t text-[10px] text-muted-foreground">
                A Hobby Project part of Project Apinsity by Ashutosh Vijay
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

export default PresenceFooter;
