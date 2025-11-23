import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { decryptData } from '@/lib/crypto';
import {
  Download,
  Trash2,
  FolderOpen,
  Clock,
  Loader2,
  ShieldCheck,
  Globe,
  UploadCloud,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription, // 1. IMPORT THIS
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Progress } from '@/components/ui/progress';
import * as CryptoJS from 'crypto-js';

type FileRecord = Database['public']['Tables']['room_files']['Row'];

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
}

interface FileListProps {
  roomCode: string;
  secretKey: string | null;
}

export function FileList({ roomCode, secretKey }: FileListProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading, progress } = useFileUpload({
    roomCode,
    secretKey,
    onUploadComplete: () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    await uploadFile(file);
  };

  useEffect(() => {
    if (!roomCode) return;

    const fetchFiles = async () => {
      const { data } = await supabase
        .from('room_files')
        .select('*')
        .eq('room_code', roomCode)
        .order('uploaded_at', { ascending: false });

      if (data) setFiles(data);
    };
    fetchFiles();

    const channel = supabase
      .channel(`room-files:${roomCode}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_files',
          filter: `room_code=eq.${roomCode}`,
        },
        (payload) => {
          setFiles((prev) => {
            if (prev.some((f) => f.id === payload.new.id)) return prev;
            return [payload.new as FileRecord, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_files' },
        (payload) => {
          setFiles((prev) => {
            const exists = prev.some((f) => f.id === payload.old.id);
            if (!exists) return prev;
            return prev.filter((f) => f.id !== payload.old.id);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode]);

  const handleDelete = async (id: string, _url: string) => {
    const previousFiles = [...files];
    setFiles((prev) => prev.filter((f) => f.id !== id));

    try {
      const { error } = await supabase.from('room_files').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Delete failed:', error);
      setFiles(previousFiles);
      toast({ variant: 'destructive', description: 'Failed to delete file.' });
    }
  };

  const handleDownload = async (file: FileRecord) => {
    setDownloadingId(file.id);
    try {
      const response = await fetch(file.file_url);
      const content = await response.text();

      let byteArray: Uint8Array;

      if (secretKey) {
        const decryptedBytes = CryptoJS.AES.decrypt(content, secretKey);
        const len = decryptedBytes.sigBytes;
        const words = decryptedBytes.words;
        byteArray = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          byteArray[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        }
      } else {
        const binaryString = window.atob(content);
        const len = binaryString.length;
        byteArray = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          byteArray[i] = binaryString.charCodeAt(i);
        }
      }

      const fileType = file.file_type
        ? decryptData(file.file_type, secretKey)
        : 'application/octet-stream';

      const fileName = decryptData(file.file_name, secretKey) || 'downloaded-file';

      const blob = new Blob([byteArray as unknown as BlobPart], { type: fileType });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({ description: 'File ready!' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', description: 'Failed to process file.' });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 relative select-none">
          <FolderOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Files</span>
          {files.length > 0 && (
            <Badge
              variant="secondary"
              className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] absolute -top-1 -right-1"
            >
              {files.length}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="select-none w-[90%] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" /> Shared Files
          </SheetTitle>
          {/* 2. ADD THIS TO SHUT UP THE CONSOLE */}
          <SheetDescription className="sr-only">
            View, upload, and download shared files in this room.
          </SheetDescription>
        </SheetHeader>

        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />

        <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4">
          {files.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center h-40 text-muted-foreground text-sm border-2 border-dashed rounded-lg transition-colors
                  ${isUploading ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/50 hover:border-primary/50 cursor-pointer'}
                `}
              onClick={() => !isUploading && fileInputRef.current?.click()}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-8 h-8 mb-2 animate-spin text-primary" />
                  <p className="font-medium text-primary">Uploading...</p>
                  <Progress value={progress} className="w-1/2 h-1.5 mt-2" />
                </>
              ) : (
                <>
                  <UploadCloud className="w-8 h-8 mb-2 opacity-50" />
                  <p>No files yet.</p>
                  <p className="text-xs opacity-70 mt-1">Click to upload</p>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {isUploading && (
                <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-primary mb-1">Uploading file...</p>
                    <Progress value={progress} className="h-1" />
                  </div>
                </div>
              )}

              {files.map((file) => {
                const displayName = decryptData(file.file_name, secretKey);
                return (
                  <div
                    key={file.id}
                    className="group flex flex-col bg-card border rounded-lg p-3 gap-2 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div
                          className={`p-2 rounded-md ${secretKey ? 'bg-green-500/10' : 'bg-blue-500/10'}`}
                        >
                          {secretKey ? (
                            <ShieldCheck className="w-4 h-4 text-green-500" />
                          ) : (
                            <Globe className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm truncate" title={displayName}>
                            {displayName}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{file.file_size}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {timeAgo(file.uploaded_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {/* Responsive Download Button: Full width on mobile, auto on desktop */}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1 h-9 gap-2"
                        onClick={() => handleDownload(file)}
                        disabled={downloadingId === file.id}
                      >
                        {downloadingId === file.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                        <span className={downloadingId === file.id ? 'inline' : 'inline'}>
                          {downloadingId === file.id ? 'Decrypting...' : 'Download'}
                        </span>
                      </Button>

                      {/* Delete Button: Always square */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                        onClick={() => handleDelete(file.id, file.file_url)}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
