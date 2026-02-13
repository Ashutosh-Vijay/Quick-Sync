import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom'; // Added useLocation
import { getKeyFromHash } from '@/lib/crypto';
import { useRoomConnection } from '@/hooks/useRoomConnection';
import { useRoomStore } from '@/store/roomStore';
import { FileShare } from '@/components/FileShare';
import { FileList } from '@/components/FileList';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'react-qr-code';
import {
  ArrowLeft,
  Loader2,
  Copy,
  Trash2,
  Check,
  QrCode,
  Skull,
  RotateCcw,
  RotateCw, // New Icon for Redo
  Lock,
  Unlock,
  Globe,
  Menu,
  CloudOff,
  WifiOff,
  Key,
  Share2,
} from 'lucide-react';

const HISTORY_LIMIT = 10;

interface HistoryItem {
  code: string;
  key: string | null;
  timestamp: number;
}

export default function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const location = useLocation(); // Hook to listen to URL changes
  const { toast } = useToast();
  const { isNuked, isLocked, setLocked } = useRoomStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // FIX: Make secretKey reactive to location changes
  const [secretKey, setSecretKey] = useState<string | null>(getKeyFromHash());

  // Listen for hash changes specifically
  useEffect(() => {
    setSecretKey(getKeyFromHash());
  }, [location.hash]);

  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]); // Redo Stack
  const isUndoingRedoing = useRef(false); // Flag to prevent history loops

  // History management
  useEffect(() => {
    if (roomCode) {
      const saved = localStorage.getItem('quicksync_history_hybrid');
      let hist: HistoryItem[] = saved ? JSON.parse(saved) : [];
      // Remove duplicates
      hist = hist.filter((h) => h.code !== roomCode);
      // Add current
      hist.unshift({ code: roomCode, key: secretKey, timestamp: Date.now() });
      hist = hist.slice(0, 3);
      localStorage.setItem('quicksync_history_hybrid', JSON.stringify(hist));
    }
  }, [roomCode, secretKey]);

  // Pass the reactive secretKey to the hook
  const { content, updateContent, isLoading, isSaving, notFound, syncError } = useRoomConnection(
    roomCode,
    secretKey
  );

  useEffect(() => {
    if (content) {
      // If we are currently undoing/redoing, skip the automatic history logging
      if (isUndoingRedoing.current) {
        isUndoingRedoing.current = false;
        return;
      }

      setHistory((prev) => {
        if (prev.length > 0 && prev[0] === content) return prev;
        return [content, ...prev].slice(0, HISTORY_LIMIT);
      });
      // Clear future on new manual typing
      setFuture([]);
    }
  }, [content]);

  const handleUndo = () => {
    if (history.length < 2) return;

    isUndoingRedoing.current = true;
    const current = history[0];
    const previous = history[1];

    // Move current state to Future
    setFuture((prev) => [current, ...prev].slice(0, HISTORY_LIMIT));
    // Step back in History
    setHistory((prev) => prev.slice(1));

    updateContent(previous);
    toast({ description: 'Undo ↩️', duration: 1500 });
  };

  const handleRedo = () => {
    if (future.length === 0) return;

    isUndoingRedoing.current = true;
    const next = future[0];

    // Move next state back to History
    setHistory((prev) => [next, ...prev].slice(0, HISTORY_LIMIT));
    // Remove from Future
    setFuture((prev) => prev.slice(1));

    updateContent(next);
    toast({ description: 'Redo ↪️', duration: 1500 });
  };

  const handleCopy = async () => {
    if (!content) return;

    try {
      // Try modern API first (requires HTTPS)
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(content);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch (_err) {
      // FIX: Renamed unused var to _err
      // Fallback for HTTP/LAN debugging using execCommand
      if (textareaRef.current) {
        textareaRef.current.select();
        document.execCommand('copy');
        textareaRef.current.setSelectionRange(0, 0); // Deselect
      }
    }

    setCopied(true);
    toast({ description: 'Copied to Clipboard! 📋', duration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    updateContent('');
    toast({ variant: 'destructive', description: 'Cleared!' });
  };

  if (isLoading)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      </div>
    );

  if (isNuked)
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-6 overflow-hidden relative select-none">
        <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 duration-500">
          <Skull className="w-24 h-24 text-destructive mb-6 animate-bounce" />
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground mb-2">
            ROOM VAPORIZED
          </h1>
          <Button size="lg" onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Return
          </Button>
        </div>
      </div>
    );

  if (notFound)
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-6">
        <h1 className="text-4xl font-black text-foreground mb-2">404: VOID</h1>
        <Button size="lg" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    );

  const currentUrl = window.location.href;

  const StatusBadge = () =>
    secretKey ? (
      <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 rounded border border-green-500/20 whitespace-nowrap">
        <Key className="w-3 h-3 text-green-500" />
        <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">
          Secure
        </span>
      </div>
    ) : (
      <div className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 rounded border border-blue-500/20 whitespace-nowrap">
        <Globe className="w-3 h-3 text-blue-500" />
        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
          Public
        </span>
      </div>
    );

  const ShareDialog = ({ children }: { children: React.ReactNode }) => (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md select-none">
        <DialogHeader>
          <DialogTitle>Share Room</DialogTitle>
          <DialogDescription>Scan to join on mobile.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-6 space-y-4">
          <div className="p-4 bg-white rounded-xl shadow-lg">
            <QRCode
              value={currentUrl}
              size={200}
              style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
              viewBox={`0 0 256 256`}
            />
          </div>
          <div className="w-full flex gap-2">
            <Button
              className="w-full"
              onClick={() => {
                navigator.clipboard.writeText(currentUrl);
                toast({ description: 'Link Copied!' });
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const DesktopControls = () => (
    <>
      <FileShare roomCode={roomCode!} secretKey={secretKey} />
      <FileList roomCode={roomCode!} secretKey={secretKey} />
      <StatusBadge />
      <div className="h-6 w-px bg-border mx-1" />
      <ShareDialog>
        <Button variant="ghost" size="sm" className="gap-2">
          <Share2 className="w-4 h-4" />
          <span className="hidden lg:inline">Share</span>
        </Button>
      </ShareDialog>
      <div className="hidden justify-end sm:flex ml-2 items-center">
        {syncError ? (
          <span className="text-xs text-red-500 font-bold flex items-center animate-pulse whitespace-nowrap">
            <CloudOff className="w-3 h-3 mr-1" /> {syncError}
          </span>
        ) : isSaving ? (
          <span className="text-xs text-muted-foreground animate-pulse flex items-center">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving
          </span>
        ) : (
          <span className="text-xs text-green-500 flex items-center">
            <Check className="w-3 h-3 mr-1" /> Synced
          </span>
        )}
      </div>
      <div className="hidden sm:block ml-1">
        <ThemeToggle />
      </div>
    </>
  );

  const MobileControls = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-left">Room Controls</SheetTitle>
          <SheetDescription className="sr-only">Settings</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 mt-6">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
            <StatusBadge />
            <ThemeToggle />
          </div>
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Data Mule
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <FileShare roomCode={roomCode!} secretKey={secretKey} />
              <FileList roomCode={roomCode!} secretKey={secretKey} />
            </div>
            <ShareDialog>
              <Button variant="outline" className="w-full gap-2">
                <QrCode className="w-4 h-4" /> Share Room
              </Button>
            </ShareDialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="relative min-h-screen flex flex-col select-none">
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60 border-border">
        <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card/50 px-3 py-1 shadow-sm">
              <p className="font-mono text-sm font-bold text-primary tracking-widest">{roomCode}</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <DesktopControls />
          </div>
          <div className="flex md:hidden items-center gap-2">
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <Check className="w-4 h-4 text-green-500" />
            )}
            <MobileControls />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 py-4 sm:px-6 sm:py-6 z-10 pb-24">
        <div className="bg-background/80 backdrop-blur-md rounded-xl shadow-sm sm:shadow-2xl border border-border min-h-[calc(100dvh-10rem)] sm:min-h-[70vh] flex flex-col overflow-hidden relative">
          {isLocked && (
            <div className="absolute inset-0 bg-background/10 z-10 flex justify-center pt-24 pointer-events-none">
              <div className="bg-background/80 backdrop-blur-sm border border-border px-4 py-2 rounded-full flex items-center gap-2 text-muted-foreground shadow-lg">
                <Lock className="w-4 h-4" />{' '}
                <span className="text-xs font-medium uppercase tracking-wider">Read Only</span>
              </div>
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => updateContent(e.target.value)}
            readOnly={isLocked}
            placeholder={
              isLocked
                ? 'Room is locked.'
                : `Paste logs/code here. Traffic is ${secretKey ? 'encrypted' : 'obfuscated'}.`
            }
            className="w-full flex-1 bg-transparent text-foreground placeholder-muted-foreground/50 focus:outline-none border-none resize-none font-mono text-sm sm:text-base leading-relaxed p-4 sm:p-6 select-text"
            autoFocus
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />

          <div className="relative z-20 border-t border-border bg-muted/30 px-4 py-3 flex justify-between items-center gap-4 rounded-b-xl">
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground overflow-hidden flex-1 min-w-0">
              <span className="truncate flex items-center gap-2">
                {content.length.toLocaleString()} chars
                {syncError && (
                  <div className="flex items-center gap-2 px-2 text-red-500 animate-pulse shrink-0">
                    <WifiOff className="w-4 h-4" />{' '}
                    <span className="text-xs font-bold hidden sm:inline uppercase">
                      {syncError}
                    </span>
                  </div>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setLocked(!isLocked)}>
                {isLocked ? (
                  <Lock className="w-4 h-4 text-orange-500" />
                ) : (
                  <Unlock className="w-4 h-4 text-muted-foreground" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleUndo}
                disabled={history.length < 2 || isLocked}
                title="Undo"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRedo}
                disabled={future.length === 0 || isLocked}
                title="Redo"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button
                variant={copied ? 'default' : 'secondary'}
                size="icon"
                className="transition-all active:scale-95"
                onClick={handleCopy}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button
                variant="destructive"
                size="icon"
                onClick={handleClear}
                disabled={!content || isLocked}
                className="transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
