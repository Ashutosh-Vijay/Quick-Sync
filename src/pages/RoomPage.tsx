import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PresenceFooter from '../components/PresenceFooter';
import { ArrowLeft, Loader2, Copy, Trash2, Check, QrCode, Code2, FileText, Layers, Skull, ShieldCheck } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { RealtimeChannel } from '@supabase/supabase-js';
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import * as CryptoJS from 'crypto-js'; 

import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike'; 
import 'prismjs/components/prism-markup'; 
import 'prismjs/components/prism-xml-doc';
import 'prismjs/components/prism-json';  
import 'prismjs/components/prism-java';   
import 'prismjs/themes/prism-tomorrow.css';

const FIXED_KEY = "QuickSync-Mule-Secret-v1"; 

const VaporizedView = ({ message, subMessage }: { message: string, subMessage: string }) => {
    const navigate = useNavigate();
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center p-6 overflow-hidden relative">
            <div className="relative z-10 flex flex-col items-center animate-in zoom-in-95 duration-500">
                <Skull className="w-24 h-24 text-destructive mb-6 animate-bounce" />
                <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-foreground mb-2">{message}</h1>
                <p className="text-xl text-muted-foreground font-mono mb-8 max-w-md">{subMessage}</p>
                <Button size="lg" onClick={() => navigate('/')}><ArrowLeft className="mr-2 h-4 w-4" /> Return</Button>
            </div>
        </div>
    );
};

function RoomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [copied, setCopied] = useState(false);
  const [isNuked, setIsNuked] = useState(false); 
  const [notFound, setNotFound] = useState(false); 

  const [isCodeMode, setIsCodeMode] = useState(false);
  const [lang, setLang] = useState<'xml' | 'json' | 'java'>('xml');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isTypingRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const encrypt = (text: string) => {
    return CryptoJS.AES.encrypt(text, FIXED_KEY).toString();
  };

  // ✅ UPDATED DECRYPTOR: Handles the "Fake JSON" wrapper
  const decrypt = (rawContent: string) => {
    try {
        // 1. Try to parse it as JSON (The Camouflage)
        const json = JSON.parse(rawContent);
        
        // 2. Extract the actual secret data from the "trace_blob" field
        if (json.trace_blob) {
            const bytes = CryptoJS.AES.decrypt(json.trace_blob, FIXED_KEY);
            return bytes.toString(CryptoJS.enc.Utf8);
        }
        
        // Fallback: It wasn't camouflaged, try decrypting raw string
        const bytes = CryptoJS.AES.decrypt(rawContent, FIXED_KEY);
        return bytes.toString(CryptoJS.enc.Utf8) || rawContent;

    } catch (e) {
        // It's just plain text or old data
        return rawContent;
    }
  };

  const fetchLatestContent = async () => {
    if (!roomCode || isNuked || isTypingRef.current) return;

    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('content')
        .eq('room_code', roomCode)
        .maybeSingle();

      if (error) throw error;
      if (room) {
        setContent(decrypt(room.content || ''));
      } else {
        setIsNuked(true);
      }
    } catch (err) {
      console.error('Error refreshing:', err);
    }
  };

  useEffect(() => {
    if (!roomCode) return;

    const initializeRoom = async () => {
      try {
        const { data: room, error: fetchError } = await supabase
          .from('rooms')
          .select('content')
          .eq('room_code', roomCode)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!room) {
          setNotFound(true);
          return;
        }

        setContent(decrypt(room.content || ''));

        channelRef.current = supabase
          .channel(`room-content:${roomCode}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'rooms', filter: `room_code=eq.${roomCode}` },
            (payload) => {
              if (payload.eventType === 'DELETE') {
                 setIsNuked(true); 
                 return;
              }
              if (payload.eventType === 'UPDATE') {
                 if (isTypingRef.current) return;
                 const rawContent = (payload.new as { content: string }).content;
                 setContent(decrypt(rawContent));
              }
            }
          )
          .subscribe((status) => {
             if (status === 'SUBSCRIBED') fetchLatestContent();
          });
        
      } catch (err: any) {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    initializeRoom();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isNuked) {
        fetchLatestContent();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [roomCode, navigate, isNuked]); 

  const handleContentChange = (newContent: string) => {
    if (isNuked) return;
    
    setContent(newContent);
    isTypingRef.current = true;
    setIsSaving(true);

    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(async () => {
      try {
        const cipherText = encrypt(newContent);

        // ✅ CAMOUFLAGE: Wrap the secret in "Boring" Telemetry JSON
        // This looks like standard Datadog/Splunk/OpenTelemetry logs
        const fakeTelemetry = JSON.stringify({
            v: 2,
            level: "INFO",
            service: "mule-diagnostic-agent",
            trace_id: crypto.randomUUID(), // Generates a fake UUID
            span_id: Math.floor(Math.random() * 1000000).toString(),
            timestamp: new Date().toISOString(),
            // This is your secret data, labeled as a binary blob
            trace_blob: cipherText 
        });
        
        await supabase
          .from('rooms')
          .update({ 
            content: fakeTelemetry, // Sending the JSON, not the string
            updated_at: new Date().toISOString() 
          })
          .eq('room_code', roomCode);
      } catch (err) {
        console.error('Error updating:', err);
      } finally {
        setTimeout(() => {
            isTypingRef.current = false;
            setIsSaving(false);
        }, 200); 
      }
    }, 500);
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
    isTypingRef.current = true;
    try {
        const empty = encrypt('');
        // Wrap empty state in camouflage too
        const fakeTelemetry = JSON.stringify({
            v: 2, level: "INFO", service: "mule-diagnostic-agent",
            timestamp: new Date().toISOString(), trace_blob: empty 
        });
        await supabase.from('rooms').update({ content: fakeTelemetry, updated_at: new Date().toISOString() }).eq('room_code', roomCode);
    } catch (err) { console.error(err); } 
    finally { setTimeout(() => { isTypingRef.current = false; }, 200); }
  };

  const toggleLang = () => {
    if (lang === 'xml') setLang('json');
    else if (lang === 'json') setLang('java');
    else setLang('xml');
  };

  if (isLoading) return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="mr-2 h-5 w-5 animate-spin" /></div>;
  if (isNuked) return <VaporizedView message="ROOM VAPORIZED" subMessage="The host has detonated this workspace." />;
  if (notFound) return <VaporizedView message="404: VOID" subMessage="Room not found." />;

  const currentUrl = window.location.href;
  const characterCount = content.length;
  const lineCount = content ? content.split('\n').length : 0;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  if (!roomCode) return null;

  return (
    <div className="relative min-h-screen flex flex-col">
       <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-lg supports-[backdrop-filter]:bg-background/60 border-border">
         <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
           <div className="flex items-center">
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
           </div>

           <div className="flex items-center gap-2 sm:gap-4">
             
             <div className="hidden md:flex items-center gap-1 px-2 py-1 bg-green-500/10 rounded border border-green-500/20">
                <ShieldCheck className="w-3 h-3 text-green-500" />
                <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">Secure Tunnel</span>
             </div>

             <div className="hidden md:flex items-center space-x-3 border-x border-border px-4 mx-2">
                <div className="flex items-center space-x-2">
                    <Switch id="code-mode" checked={isCodeMode} onCheckedChange={setIsCodeMode} />
                    <Label htmlFor="code-mode" className="text-xs font-medium cursor-pointer flex items-center gap-1 text-muted-foreground">
                        {isCodeMode ? <Code2 className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                        {isCodeMode ? 'Editor' : 'Text'}
                    </Label>
                </div>
                {isCodeMode && (
                    <Badge variant="secondary" className="cursor-pointer hover:bg-muted-foreground/20 font-mono text-[10px] h-5" onClick={toggleLang}>
                        {lang.toUpperCase()}
                    </Badge>
                )}
             </div>

             <div className="hidden sm:flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 shadow-sm">
               <span className="font-mono text-xs text-muted-foreground tracking-widest uppercase">Room</span>
               <p className="font-mono text-sm font-bold text-primary tracking-widest">{roomCode}</p>
             </div>

             <Dialog>
               <DialogTrigger asChild>
                 <Button variant="outline" size="sm" className="gap-2 flex">
                   <QrCode className="w-4 h-4" />
                   <span className="hidden sm:inline">Share</span>
                 </Button>
               </DialogTrigger>
               <DialogContent className="sm:max-w-md">
                 <DialogHeader><DialogTitle>Share Room</DialogTitle><DialogDescription>Scan this QR code with your mobile camera to join instantly.</DialogDescription></DialogHeader>
                 <div className="flex flex-col items-center justify-center p-6 space-y-4">
                   <div className="p-4 bg-white rounded-xl shadow-lg">
                     <QRCode value={currentUrl} size={200} style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox={`0 0 256 256`} />
                   </div>
                   <p className="font-mono text-sm text-muted-foreground bg-muted px-3 py-1 rounded-md">{roomCode}</p>
                 </div>
               </DialogContent>
             </Dialog>

             <div className="w-20 flex justify-end">
                {isSaving ? (
                    <span className="text-xs text-muted-foreground animate-pulse flex items-center"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Saving</span>
                ) : (
                    <span className="text-xs text-green-500 flex items-center"><Check className="w-3 h-3 mr-1" /> Synced</span>
                )}
             </div>
             <ThemeToggle />
           </div>
         </div>
       </header>

       <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 z-10">
         <div className="bg-background/80 backdrop-blur-md rounded-xl shadow-2xl border border-border min-h-[70vh] flex flex-col overflow-hidden">
           {isCodeMode ? (
               <div className="w-full flex-1 min-h-[65vh] overflow-auto p-4 custom-scrollbar">
                   <Editor
                        value={content}
                        onValueChange={handleContentChange}
                        highlight={code => {
                            if (lang === 'xml') return highlight(code, languages.markup, 'markup');
                            if (lang === 'json') return highlight(code, languages.json, 'json');
                            return highlight(code, languages.java, 'java');
                        }}
                        padding={24}
                        className="font-mono text-base leading-relaxed min-h-full"
                        textareaClassName="focus:outline-none"
                        style={{ fontFamily: '"Fira code", "Fira Mono", monospace', fontSize: 14, backgroundColor: 'transparent', minHeight: '100%' }}
                    />
                    <div className="absolute top-4 right-6 text-[10px] text-muted-foreground/40 uppercase tracking-widest pointer-events-none flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {lang === 'xml' ? 'XML' : lang.toUpperCase()} Syntax
                    </div>
               </div>
           ) : (
            <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => handleContentChange(e.target.value)} 
                placeholder="Type here. Content is automatically encrypted."
                className="w-full flex-1 min-h-[65vh] bg-transparent text-foreground placeholder-muted-foreground/50 focus:outline-none border-none resize-none font-mono text-base leading-relaxed p-6 sm:p-8"
                autoFocus
                spellCheck={false}
            />
           )}
           <div className="border-t border-border bg-muted/30 px-4 py-3 flex justify-between items-center gap-4 rounded-b-xl">
              <div className="flex items-center gap-6 text-xs font-mono text-muted-foreground">
                <span>{characterCount.toLocaleString()} chars</span>
                <span>{wordCount.toLocaleString()} words</span>
                <span>{lineCount.toLocaleString()} lines</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handleCopy}>{copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</Button>
                <Button variant="ghost" size="icon" onClick={handleClear} disabled={!content}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
         </div>
       </main>
        
       <PresenceFooter roomCode={roomCode} onNuke={() => setIsNuked(true)} />
       <Toaster />
     </div>
  );
}

export default RoomPage;