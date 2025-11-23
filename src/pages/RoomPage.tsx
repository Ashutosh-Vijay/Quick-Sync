import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getKeyFromHash } from '@/lib/crypto';
import { useRoomConnection } from '@/hooks/useRoomConnection';
import { useRoomStore } from '@/store/roomStore';
import PresenceFooter from '@/components/PresenceFooter';
import { FileShare } from '@/components/FileShare';
import { FileList } from '@/components/FileList';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Toaster } from '@/components/ui/toaster';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'react-qr-code';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-xml-doc';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-java';
import 'prismjs/themes/prism-tomorrow.css';
import {
  ArrowLeft,
  Loader2,
  Copy,
  Trash2,
  Check,
  QrCode,
  Code2,
  Skull,
  RotateCcw,
  Lock,
  Unlock,
  Globe,
  Activity,
  Eye,
  Menu,
  AlertTriangle,
  CloudOff,
  WifiOff,
  Key,
  Settings,
  Share2,
} from 'lucide-react';

const HISTORY_LIMIT = 10;
const MAX_HIGHLIGHT_LENGTH = 50000;

interface HistoryItem {
  code: string;
  key: string | null;
  timestamp: number;
}

export default function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isNuked, isLocked, setNuked, setLocked } = useRoomStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Local UI State
  const [copied, setCopied] = useState(false);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [isCodeMode, setIsCodeMode] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [lang, setLang] = useState<'xml' | 'json' | 'java'>('xml');
  const [history, setHistory] = useState<string[]>([]);

  // Key Extraction Logic
  useEffect(() => {
    const keyFromUrl = getKeyFromHash();
    if (keyFromUrl) {
      setSecretKey(keyFromUrl);
    }
    if (roomCode) {
      const saved = localStorage.getItem('quicksync_history_hybrid');
      let hist: HistoryItem[] = saved ? JSON.parse(saved) : [];
      hist = hist.filter((h) => h.code !== roomCode);
      hist.unshift({ code: roomCode, key: keyFromUrl, timestamp: Date.now() });
      hist = hist.slice(0, 3);
      localStorage.setItem('quicksync_history_hybrid', JSON.stringify(hist));
    }
  }, [roomCode]);

  // Use the hybrid connection hook
  const { content, updateContent, isLoading, isSaving, notFound, syncError, remoteTyping } =
    useRoomConnection(roomCode, secretKey);

  useEffect(() => {
    if (content) {
      setHistory((prev) => {
        if (prev.length > 0 && prev[0] === content) return prev;
        return [content, ...prev].slice(0, HISTORY_LIMIT);
      });
    }
  }, [content]);

  // Handlers
  const handleUndo = () => {
    if (history.length < 2) return;
    const previous = history[1];
    updateContent(previous);
    setHistory((prev) => prev.slice(1));
    toast({ description: 'Restored previous version' });
  };

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      toast({ description: 'Copied to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClear = () => {
    if (!window.confirm('Clear all text?')) return;
    updateContent('');
  };

  const toggleLang = () => {
    const next = lang === 'xml' ? 'json' : lang === 'json' ? 'java' : 'xml';
    setLang(next);
  };

  // --- Render Guards ---

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
          <p className="text-xl text-muted-foreground font-mono mb-8 max-w-md">
            The host has detonated this workspace.
          </p>
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
        <p className="text-xl text-muted-foreground mb-8">Room not found.</p>
        <Button size="lg" onClick={() => navigate('/')}>
          Go Home
        </Button>
      </div>
    );

  const isLargeContent = content.length > MAX_HIGHLIGHT_LENGTH;
  const currentUrl = window.location.href;

  // --- Shared Components ---

  const StatusBadge = () =>
    secretKey ? (
      <div className="flex items-center gap-1 px-2 py-1 bg-green-500/10 rounded border border-green-500/20 whitespace-nowrap">
        <Key className="w-3 h-3 text-green-500" />
        <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">
          E2E Secure
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
          <DialogDescription>
            {secretKey
              ? 'This QR code includes the encryption key. Treat it like a password.'
              : 'Anyone with this code can join and edit.'}
          </DialogDescription>
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
                toast({ description: 'Room Link Copied!' });
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copy Link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  // --- Desktop Controls ---

  const DesktopControls = () => (
    <>
      <FileShare roomCode={roomCode!} secretKey={secretKey} />
      <FileList roomCode={roomCode!} secretKey={secretKey} />
      <StatusBadge />

      <div className="h-6 w-px bg-border mx-1" />

      {/* Editor Settings Dropdown (De-clutters the bar) */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Settings className="w-4 h-4" />
            <span className="hidden lg:inline">Editor</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="end">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Preview Mode</span>
              <Switch checked={isPreviewMode} onCheckedChange={setIsPreviewMode} />
            </div>
            {!isLargeContent && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Code Mode</span>
                <Switch checked={isCodeMode} onCheckedChange={setIsCodeMode} />
              </div>
            )}
            {isCodeMode && !isLargeContent && (
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleLang}
                className="w-full text-xs mt-1"
              >
                Language: {lang.toUpperCase()}
              </Button>
            )}
            {isLargeContent && (
              <div className="text-xs text-yellow-500 flex items-center gap-1 bg-yellow-500/10 p-2 rounded">
                <AlertTriangle className="w-3 h-3" />
                Large content: Syntax highlighting disabled.
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

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

  // --- Mobile Controls (The Sheet) ---

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
          <SheetDescription className="sr-only">
            Manage room settings, files, and theme preferences.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 mt-6">
          {/* Status & Theme */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
            <StatusBadge />
            <ThemeToggle />
          </div>

          {/* Files & Sharing */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Files & Sharing
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

          {/* Editor View */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Editor View
            </Label>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <span className="text-sm">Markdown Preview</span>
              </div>
              <Switch checked={isPreviewMode} onCheckedChange={setIsPreviewMode} />
            </div>
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4" />
                <span className="text-sm">Code Mode</span>
              </div>
              <Switch checked={isCodeMode} onCheckedChange={setIsCodeMode} />
            </div>
          </div>

          {/* Danger Zone (Mobile Delete) */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              Actions
            </Label>
            <Button
              variant="destructive"
              className="w-full gap-2"
              onClick={handleClear}
              disabled={!content || isLocked}
            >
              <Trash2 className="w-4 h-4" /> Clear Content
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <div className="relative min-h-screen flex flex-col select-none">
      {/* HEADER */}
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

          {/* Desktop Toolbar */}
          <div className="hidden md:flex items-center gap-2">
            <DesktopControls />
          </div>

          {/* Mobile Toolbar */}
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

      {/* MAIN EDITOR AREA */}
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

          {isPreviewMode ? (
            <div className="w-full flex-1 min-h-[50vh] overflow-auto p-4 sm:p-8 prose prose-invert max-w-none dark:prose-invert prose-sm sm:prose-base select-text">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : isCodeMode && !isLargeContent ? (
            <div className="w-full flex-1 min-h-[50vh] overflow-auto p-4 custom-scrollbar select-text">
              <Editor
                value={content}
                onValueChange={updateContent}
                highlight={(code) => {
                  if (lang === 'xml') return highlight(code, languages.markup, 'markup');
                  if (lang === 'json') return highlight(code, languages.json, 'json');
                  return highlight(code, languages.java, 'java');
                }}
                padding={24}
                className="font-mono text-base leading-relaxed min-h-full"
                textareaClassName="focus:outline-none"
                readOnly={isLocked}
                style={{
                  fontFamily: '"Fira code", "Fira Mono", monospace',
                  fontSize: 14,
                  backgroundColor: 'transparent',
                  minHeight: '100%',
                }}
              />
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => updateContent(e.target.value)}
              readOnly={isLocked}
              placeholder={
                isLocked
                  ? 'Room is locked.'
                  : `Type here. Content is ${secretKey ? 'E2E Encrypted' : 'obfuscated from network filters'}.`
              }
              className="w-full flex-1 min-h-[50vh] bg-transparent text-foreground placeholder-muted-foreground/50 focus:outline-none border-none resize-none font-mono text-base leading-relaxed p-4 sm:p-8 select-text"
              autoFocus
              spellCheck={false}
            />
          )}

          {/* FOOTER TOOLBAR */}
          <div className="relative z-20 border-t border-border bg-muted/30 px-4 py-3 flex justify-between items-center gap-4 rounded-b-xl">
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground overflow-hidden flex-1 min-w-0">
              {remoteTyping ? (
                <span className="flex items-center gap-1 text-cyan-500 animate-pulse font-medium truncate">
                  <Activity className="w-3 h-3" />{' '}
                  <span className="hidden sm:inline">Remote Agent typing...</span>
                </span>
              ) : (
                <span className="truncate flex items-center gap-2">
                  {content.length.toLocaleString()} chars
                  {isLargeContent && (
                    <Badge variant="destructive" className="text-[10px] h-4 px-1 shrink-0">
                      HEAVY
                    </Badge>
                  )}
                  {syncError && (
                    <div className="flex items-center gap-2 px-2 text-red-500 animate-pulse shrink-0">
                      <WifiOff className="w-4 h-4" />{' '}
                      <span className="text-xs font-bold hidden sm:inline">SYNC DISABLED</span>
                    </div>
                  )}
                </span>
              )}
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
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button variant="ghost" size="icon" onClick={handleCopy}>
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
              {/* Desktop Delete Button (Mobile has it in menu) */}
              <div className="hidden sm:block">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  disabled={!content || isLocked}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <PresenceFooter roomCode={roomCode!} onNuke={() => setNuked(true)} />
      <Toaster />
    </div>
  );
}
