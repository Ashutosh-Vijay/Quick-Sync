import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { decryptData, decryptFile } from '@/lib/crypto';
import { unwrapPayload } from '@/lib/payloadHelper';
import { deleteFileByUrl, deleteAllRoomFiles } from '@/lib/fileStorage';
import {
  Download,
  Trash2,
  FolderOpen,
  Clock,
  Loader2,
  ShieldCheck,
  Globe,
  UploadCloud,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Progress } from '@/components/ui/progress';

type FileRow = Database['public']['Tables']['room_files']['Row'];

// UI Model (Decrypted)
interface FileRecord {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
  uploaded_at: string;
}

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isUploading, progress, uploadFiles } = useFileUpload({
    roomCode,
    secretKey,
    onUploadComplete: () => {
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    const newFiles = await uploadFiles(files);
    if (newFiles && newFiles.length > 0) {
      setFiles((prev) => {
        const toAdd = newFiles.filter((nf) => !prev.some((f) => f.id === nf.id));
        return [...toAdd, ...prev];
      });
    }
  };

  useEffect(() => {
    if (!roomCode) return;

    const parseFileRecord = async (row: FileRow): Promise<FileRecord | null> => {
      try {
        const encryptedMeta = unwrapPayload(row.file_data);
        const metaString = await decryptData(encryptedMeta, secretKey);
        const meta = JSON.parse(metaString);
        return {
          id: row.id,
          name: meta.n || 'Unknown',
          size: meta.s || '?',
          type: meta.t || 'application/octet-stream',
          url: meta.u || '',
          uploaded_at: row.uploaded_at,
        };
      } catch (e) {
        console.error('Failed to parse file record', e);
        return null;
      }
    };

    const fetchFiles = async () => {
      const { data } = await supabase
        .from('room_files')
        .select('*')
        .eq('room_code', roomCode)
        .order('uploaded_at', { ascending: false });

      if (data) {
        const parsed = (await Promise.all(data.map(parseFileRecord))).filter(
          (f): f is FileRecord => f !== null
        );
        setFiles(parsed);
      }
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
        async (payload) => {
          const newFile = await parseFileRecord(payload.new as FileRow);
          if (newFile) {
            setFiles((prev) => {
              if (prev.some((f) => f.id === newFile.id)) return prev;
              return [newFile, ...prev];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'room_files' },
        (payload) => {
          setFiles((prev) => prev.filter((f) => f.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomCode, secretKey]);

  const handleDelete = async (id: string) => {
    const file = files.find((f) => f.id === id);
    const previousFiles = [...files];
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (expandedId === id) setExpandedId(null);

    try {
      if (file) await deleteFileByUrl(file.url);
      const { error } = await supabase.from('room_files').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Delete failed:', error);
      setFiles(previousFiles);
      toast({ variant: 'destructive', description: 'Failed to delete file.' });
    }
  };

  const handleDeleteAll = async () => {
    setIsClearingAll(true);
    try {
      await deleteAllRoomFiles(roomCode);
      await supabase.from('room_files').delete().eq('room_code', roomCode);
      setFiles([]);
      setExpandedId(null);
      toast({ description: 'All files cleared.' });
    } catch (error) {
      console.error('Clear all failed:', error);
      toast({ variant: 'destructive', description: 'Failed to clear files.' });
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleDownload = async (file: FileRecord) => {
    setDownloadingId(file.id);
    try {
      const response = await fetch(file.url);
      let byteArray: Uint8Array;

      if (secretKey) {
        const buffer = await response.arrayBuffer();
        byteArray = await decryptFile(buffer, secretKey);
      } else {
        const content = await response.text();
        const binaryString = window.atob(content);
        byteArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          byteArray[i] = binaryString.charCodeAt(i);
        }
      }

      const blob = new Blob([new Uint8Array(byteArray)], { type: file.type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
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
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5" /> Shared Files
            </SheetTitle>
            {files.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-8"
                onClick={handleDeleteAll}
                disabled={isClearingAll}
              >
                {isClearingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Clear All
              </Button>
            )}
          </div>
          <SheetDescription className="sr-only">
            View, upload, and download shared files in this room.
          </SheetDescription>
        </SheetHeader>

        <input
          type="file"
          multiple
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileSelect}
        />

        <ScrollArea className="h-[calc(100vh-8rem)] mt-4 pr-4 overflow-x-hidden">
          {files.length === 0 ? (
            <div
              className={`flex flex-col items-center justify-center h-40 text-muted-foreground text-sm border-2 border-dashed rounded-lg transition-colors
                  ${
                    isUploading
                      ? 'bg-primary/5 border-primary/30'
                      : 'hover:bg-muted/50 hover:border-primary/50 cursor-pointer'
                  }
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
              <AnimatePresence>
                {isUploading && (
                  <motion.div
                    key="uploading"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-primary mb-1">Uploading file...</p>
                        <Progress value={progress} className="h-1" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                {files.map((file, i) => {
                  const isExpanded = expandedId === file.id;
                  return (
                    <motion.div
                      key={file.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
                      transition={{ delay: Math.min(i * 0.04, 0.25), duration: 0.22 }}
                      className="flex flex-col bg-card border rounded-lg overflow-hidden hover:border-primary/50 transition-colors w-full"
                    >
                      {/* Clickable info row — toggles expand */}
                      <div
                        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : file.id)}
                      >
                        <div
                          className={`p-2 rounded-md shrink-0 ${
                            secretKey ? 'bg-green-500/10' : 'bg-blue-500/10'
                          }`}
                        >
                          {secretKey ? (
                            <ShieldCheck className="w-4 h-4 text-green-500" />
                          ) : (
                            <Globe className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-medium text-sm truncate" title={file.name}>
                            {file.name}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{file.size}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {timeAgo(file.uploaded_at)}
                            </span>
                          </div>
                        </div>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        </motion.div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 px-3 pb-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="flex-1 h-9 gap-2 active:scale-95 transition-transform"
                          onClick={() => handleDownload(file)}
                          disabled={downloadingId === file.id}
                        >
                          {downloadingId === file.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                          {downloadingId === file.id ? 'Decrypting...' : 'Download'}
                        </Button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: 'auto' }}
                              exit={{ opacity: 0, width: 0 }}
                              transition={{ duration: 0.18 }}
                              className="overflow-hidden shrink-0"
                            >
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-9 gap-2 active:scale-95 transition-transform"
                                onClick={() => handleDelete(file.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </Button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
