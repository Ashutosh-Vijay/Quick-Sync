import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate, useLocation } from 'react-router-dom'; // Added useLocation
import { getKeyFromHash } from '@/lib/crypto';
import { supabase } from '@/lib/supabase';
import { useRoomConnection } from '@/hooks/useRoomConnection';
import { useFileUpload } from '@/hooks/useFileUpload';
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
  RotateCw,
  Globe,
  Menu,
  CloudOff,
  WifiOff,
  Key,
  Share2,
  Flame,
  UploadCloud,
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
  const { isNuked, setNuked } = useRoomStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Bug 8: Reset isNuked immediately on mount/room change to prevent flash
  useEffect(() => {
    setNuked(false);
  }, [roomCode, setNuked]);

  // FIX: Make secretKey reactive to location changes
  const [secretKey, setSecretKey] = useState<string | null>(getKeyFromHash());

  // Listen for hash changes specifically
  useEffect(() => {
    setSecretKey(getKeyFromHash());
  }, [location.hash]);

  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [future, setFuture] = useState<string[]>([]); // Redo Stack
  const [destructOpen, setDestructOpen] = useState(false);
  const [isDestructing, setIsDestructing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const isUndoingRedoing = useRef(false);

  const { uploadFiles, isUploading } = useFileUpload({ roomCode: roomCode!, secretKey });

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current++;
      setIsDragging(true);
    }
  };
  const handleDragLeave = () => {
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) await uploadFiles(files);
  }; // Flag to prevent history loops

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

  // Simple history management for undo/redo
  // Removed automatic effect-based tracking to avoid conflicts with remote changes.

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
      await navigator.clipboard.writeText(content);
    } catch (_err) {
      toast({ variant: 'destructive', description: 'Failed to copy to clipboard' });
      return;
    }

    setCopied(true);
    toast({ description: 'Copied to Clipboard! 📋', duration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    updateContent('');
    toast({ variant: 'destructive', description: 'Cleared!' });
  };

  const handleDestructRoom = async () => {
    if (!roomCode) return;
    setIsDestructing(true);
    try {
      const { data: folders } = await supabase.storage.from('quick-share').list(roomCode);
      if (folders && folders.length > 0) {
        const paths: string[] = [];
        for (const folder of folders) {
          const { data: files } = await supabase.storage
            .from('quick-share')
            .list(`${roomCode}/${folder.name}`);
          (files ?? []).forEach((f) => paths.push(`${roomCode}/${folder.name}/${f.name}`));
        }
        if (paths.length > 0) {
          await supabase.storage.from('quick-share').remove(paths);
        }
      }
      await supabase.from('room_files').delete().eq('room_code', roomCode);
      await supabase.from('rooms').delete().eq('room_code', roomCode);
      setDestructOpen(false);
      setNuked(true);
    } catch (err) {
      console.error('Destruct failed:', err);
      toast({ variant: 'destructive', description: 'Destruct failed. Try again.' });
    } finally {
      setIsDestructing(false);
    }
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
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-transform"
        onClick={() => setDestructOpen(true)}
      >
        <Flame className="w-4 h-4" />
        <span className="hidden lg:inline">Destruct</span>
      </Button>
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
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Danger Zone
            </Label>
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={() => setDestructOpen(true)}
            >
              <Flame className="w-4 h-4" /> Destruct Room
            </Button>
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
              className="text-muted-foreground hover:text-foreground active:scale-95 transition-transform"
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

      <main
        className="flex-1 max-w-6xl w-full mx-auto px-3 py-4 sm:px-6 sm:py-6 z-10 pb-24"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-background/80 backdrop-blur-md rounded-xl shadow-sm sm:shadow-2xl border border-border min-h-[calc(100dvh-10rem)] sm:min-h-[70vh] flex flex-col overflow-hidden relative"
        >
          <AnimatePresence>
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl pointer-events-none"
              >
                <motion.div
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                >
                  <UploadCloud className="w-12 h-12 text-primary" />
                </motion.div>
                <p className="font-mono font-bold text-primary tracking-wide">Drop to upload</p>
              </motion.div>
            )}
          </AnimatePresence>
          {isUploading && !isDragging && (
            <div className="absolute top-3 right-3 z-30 flex items-center gap-2 bg-background/90 border border-border rounded-full px-3 py-1.5 text-xs text-primary font-mono shadow-lg">
              <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              const val = e.target.value;
              setHistory((prev) => {
                if (prev.length > 0 && prev[0] === val) return prev;
                return [val, ...prev].slice(0, HISTORY_LIMIT);
              });
              setFuture([]);
              updateContent(val);
            }}
            placeholder={`Paste logs/code here. Traffic is ${secretKey ? 'encrypted' : 'obfuscated'}.`}
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
              <Button
                variant="ghost"
                size="icon"
                className="active:scale-95 transition-transform"
                onClick={handleUndo}
                disabled={history.length < 2}
                title="Undo"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="active:scale-95 transition-transform"
                onClick={handleRedo}
                disabled={future.length === 0}
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
                disabled={!content}
                className="transition-all active:scale-95"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </main>
      <Dialog open={destructOpen} onOpenChange={setDestructOpen}>
        <DialogContent className="sm:max-w-sm select-none">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Flame className="w-5 h-5" /> Destruct Room
            </DialogTitle>
            <DialogDescription>
              Permanently deletes this room, all content, and all uploaded files from storage. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setDestructOpen(false)}
              disabled={isDestructing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              disabled={isDestructing}
              onClick={handleDestructRoom}
            >
              {isDestructing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Flame className="w-4 h-4" />
              )}
              {isDestructing ? 'Destructing...' : 'Confirm'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Toaster />
    </div>
  );
}
