import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import {
  ArrowLeft,
  Trash2,
  Loader2,
  RefreshCw,
  Skull,
  FileX,
  FolderX,
  Ghost,
  Globe,
  Lock,
} from 'lucide-react';

interface RoomSummary {
  room_code: string;
  updated_at: string;
  content_length: number;
  file_count: number;
  mode: 'public' | 'private' | 'empty';
}

function detectMode(content: string | null): 'public' | 'private' | 'empty' {
  if (!content || content.length < 5) return 'empty';
  try {
    decodeURIComponent(atob(content));
    return 'public';
  } catch {
    return 'private';
  }
}

async function deleteRoomStorage(roomCode: string) {
  const { data: folders, error: listErr } = await supabase.storage
    .from('quick-share')
    .list(roomCode);
  if (listErr) throw new Error(`Storage list failed for ${roomCode}: ${listErr.message}`);
  if (!folders || folders.length === 0) return;
  const paths: string[] = [];
  for (const folder of folders) {
    const { data: files, error: fileErr } = await supabase.storage
      .from('quick-share')
      .list(`${roomCode}/${folder.name}`);
    if (fileErr)
      throw new Error(`Storage list failed for ${roomCode}/${folder.name}: ${fileErr.message}`);
    (files ?? []).forEach((f) => paths.push(`${roomCode}/${folder.name}/${f.name}`));
  }
  if (paths.length > 0) {
    const { error: removeErr } = await supabase.storage.from('quick-share').remove(paths);
    if (removeErr) throw new Error(`Storage remove failed: ${removeErr.message}`);
  }
}

async function deleteRoomFull(roomCode: string) {
  await deleteRoomStorage(roomCode);
  await supabase.from('room_files').delete().eq('room_code', roomCode);
  // room_presence logic removed by user request
  // await supabase.from('room_presence').delete().eq('room_code', roomCode);
  await supabase.from('rooms').delete().eq('room_code', roomCode);
}

async function deleteRoomFilesOnly(roomCode: string) {
  await deleteRoomStorage(roomCode);
  await supabase.from('room_files').delete().eq('room_code', roomCode);
}

export default function AdminPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [clearingFilesCode, setClearingFilesCode] = useState<string | null>(null);
  const [isPurgingAll, setIsPurgingAll] = useState(false);

  // Orphaned storage state
  const [orphanedCodes, setOrphanedCodes] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isPurgingOrphaned, setIsPurgingOrphaned] = useState(false);
  const [scanned, setScanned] = useState(false);

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    setScanned(false);
    setOrphanedCodes([]);
    try {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('room_code, updated_at, content')
        .order('updated_at', { ascending: false });

      if (!roomData) {
        setRooms([]);
        return;
      }

      const codes = roomData.map((r) => r.room_code);
      const { data: fileCounts } = await supabase
        .from('room_files')
        .select('room_code')
        .in('room_code', codes);

      const countMap: Record<string, number> = {};
      (fileCounts ?? []).forEach((f) => {
        countMap[f.room_code] = (countMap[f.room_code] ?? 0) + 1;
      });

      setRooms(
        roomData.map((r) => ({
          room_code: r.room_code,
          updated_at: r.updated_at,
          content_length: r.content ? Math.round(r.content.length * 0.75) : 0,
          file_count: countMap[r.room_code] ?? 0,
          mode: detectMode(r.content),
        }))
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleDelete = async (code: string) => {
    setDeletingCode(code);
    try {
      await deleteRoomFull(code);
      setRooms((prev) => prev.filter((r) => r.room_code !== code));
      toast({ description: `Room ${code} destroyed.` });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Delete failed.';
      toast({ variant: 'destructive', description: msg });
    } finally {
      setDeletingCode(null);
    }
  };

  const handleClearFilesOnly = async (code: string) => {
    setClearingFilesCode(code);
    try {
      await deleteRoomFilesOnly(code);
      setRooms((prev) => prev.map((r) => (r.room_code === code ? { ...r, file_count: 0 } : r)));
      toast({ description: `Files cleared from ${code}.` });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Clear files failed.';
      toast({ variant: 'destructive', description: msg });
    } finally {
      setClearingFilesCode(null);
    }
  };

  const handlePurgeAll = async () => {
    if (!confirm('Purge ALL rooms and files? This cannot be undone.')) return;
    setIsPurgingAll(true);
    try {
      for (const room of rooms) {
        await deleteRoomFull(room.room_code);
      }
      setRooms([]);
      toast({ description: 'All rooms purged.' });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Purge failed.';
      toast({ variant: 'destructive', description: msg });
    } finally {
      setIsPurgingAll(false);
    }
  };

  const handleScanOrphaned = async () => {
    setIsScanning(true);
    setOrphanedCodes([]);
    try {
      const { data: storageFolders } = await supabase.storage.from('quick-share').list('');
      const storageCodes = (storageFolders ?? []).map((f) => f.name);

      const { data: dbRooms } = await supabase.from('rooms').select('room_code');
      const dbSet = new Set((dbRooms ?? []).map((r) => r.room_code));

      const orphaned = storageCodes.filter((code) => !dbSet.has(code));
      setOrphanedCodes(orphaned);
      setScanned(true);

      if (orphaned.length === 0) {
        toast({ description: 'No orphaned files found.' });
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', description: 'Scan failed.' });
    } finally {
      setIsScanning(false);
    }
  };

  const handlePurgeOrphaned = async () => {
    if (!confirm(`Delete storage files for ${orphanedCodes.length} orphaned room(s)?`)) return;
    setIsPurgingOrphaned(true);
    try {
      for (const code of orphanedCodes) {
        await deleteRoomStorage(code);
      }
      setOrphanedCodes([]);
      toast({ description: 'Orphaned files purged.' });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : 'Purge failed.';
      toast({ variant: 'destructive', description: msg });
    } finally {
      setIsPurgingOrphaned(false);
    }
  };

  const totalFiles = rooms.reduce((sum, r) => sum + r.file_count, 0);
  const isBusy = isPurgingAll || isPurgingOrphaned;

  return (
    <div className="min-h-screen bg-background flex flex-col select-none">
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur-lg border-border">
        <div className="max-w-4xl mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/5 px-3 py-1">
              <Skull className="w-3.5 h-3.5 text-destructive" />
              <span className="font-mono font-bold tracking-widest text-sm text-destructive">
                ADMIN
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={fetchRooms} disabled={isLoading || isBusy}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isPurgingAll || isLoading || rooms.length === 0}
              onClick={handlePurgeAll}
              className="gap-2"
            >
              {isPurgingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileX className="w-4 h-4" />
              )}
              Purge All
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-6">
        {/* Stats + orphaned scanner */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground font-mono">
            {rooms.length} room{rooms.length !== 1 ? 's' : ''} · {totalFiles} file
            {totalFiles !== 1 ? 's' : ''}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-xs"
            onClick={handleScanOrphaned}
            disabled={isScanning || isBusy}
          >
            {isScanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Ghost className="w-3.5 h-3.5" />
            )}
            Scan Orphaned
          </Button>
        </div>

        {/* Orphaned files result */}
        {scanned && (
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card gap-4">
            {orphanedCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground font-mono">
                No orphaned storage folders found.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  <FolderX className="w-4 h-4 text-orange-500 shrink-0" />
                  <p className="text-sm font-mono">
                    <span className="font-bold text-orange-500">{orphanedCodes.length}</span>{' '}
                    orphaned folder{orphanedCodes.length !== 1 ? 's' : ''} in storage with no
                    matching room
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2 shrink-0"
                  onClick={handlePurgeOrphaned}
                  disabled={isPurgingOrphaned}
                >
                  {isPurgingOrphaned ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  Purge
                </Button>
              </>
            )}
          </div>
        )}

        {/* Room list */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Skull className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-mono text-sm">No rooms. All clear.</p>
          </div>
        ) : (
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="flex flex-col gap-2">
              <AnimatePresence mode="popLayout">
                {rooms.map((room, i) => {
                  const isDeleting = deletingCode === room.room_code;
                  const isClearingFiles = clearingFilesCode === room.room_code;
                  return (
                    <motion.div
                      key={room.room_code}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
                      transition={{ delay: Math.min(i * 0.035, 0.25), duration: 0.2 }}
                      className="flex items-center justify-between gap-4 p-3 bg-card border rounded-lg hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="font-mono font-bold text-primary tracking-widest text-sm cursor-pointer hover:underline shrink-0"
                          onClick={() => navigate(`/room/${room.room_code}`)}
                          title="Open room"
                        >
                          {room.room_code}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {room.content_length > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                              ~
                              {room.content_length >= 1000
                                ? `${(room.content_length / 1000).toFixed(1)}k`
                                : room.content_length}
                              c
                            </Badge>
                          )}
                          {room.file_count > 0 && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                              {room.file_count} FILE{room.file_count !== 1 ? 'S' : ''}
                            </Badge>
                          )}
                          {room.mode === 'public' && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1.5 gap-1 text-sky-500 border-sky-500/30"
                            >
                              <Globe className="w-2.5 h-2.5" />
                              PUB
                            </Badge>
                          )}
                          {room.mode === 'private' && (
                            <Badge
                              variant="outline"
                              className="text-[10px] h-4 px-1.5 gap-1 text-violet-500 border-violet-500/30"
                            >
                              <Lock className="w-2.5 h-2.5" />
                              E2E
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="text-xs text-muted-foreground font-mono hidden sm:block"
                          title="Last modified"
                        >
                          ✎ {new Date(room.updated_at).toLocaleDateString()}
                        </span>

                        {/* Clear files only */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-orange-500 hover:text-orange-500 hover:bg-orange-500/10"
                          disabled={
                            isClearingFiles || isDeleting || isBusy || room.file_count === 0
                          }
                          onClick={() => handleClearFilesOnly(room.room_code)}
                          title="Clear files only (keep room)"
                        >
                          {isClearingFiles ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FolderX className="w-4 h-4" />
                          )}
                        </Button>

                        {/* Delete room fully */}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={isDeleting || isClearingFiles || isBusy}
                          onClick={() => handleDelete(room.room_code)}
                          title="Delete room + all files"
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </ScrollArea>
        )}
      </main>
      <Toaster />
    </div>
  );
}
