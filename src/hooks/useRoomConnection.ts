import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { decryptData, encryptData } from '@/lib/crypto';
import { wrapPayload, unwrapPayload } from '@/lib/payloadHelper';
import { useRoomStore } from '@/store/roomStore';

const MAX_SYNC_CHARS = 1000000;
const DB_SAVE_DEBOUNCE = 2000;
const TYPING_LOCK_DURATION = 3000;
const MAX_RETRIES = 3;
const PATCH_COOLDOWN = 4000;

type PatchOp = {
  i: number; // index
  d: number; // delete count
  t: string; // text to insert
};

export function useRoomConnection(roomCode: string | undefined, secretKey: string | null) {
  const { isNuked, setNuked, setLocked, setConnected, setActiveUsers } = useRoomStore();

  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const isTypingRef = useRef(false);
  const isSavingRef = useRef(false);
  const lastPatchTimeRef = useRef(0);

  // FIX: Use a Ref for the secret key to avoid stale closures in event listeners
  const secretKeyRef = useRef(secretKey);
  // Update ref whenever key changes
  useEffect(() => {
    secretKeyRef.current = secretKey;
  }, [secretKey]);

  const dbSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingUnlockTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevContentRef = useRef('');
  const retryCountRef = useRef(0);

  useEffect(() => {
    setNuked(false);
    setLocked(false);
    setConnected(false);
    setActiveUsers(0);
    setNotFound(false);
    setSyncError(null);
    setContent('');
    prevContentRef.current = '';
    setIsLoading(true);
    retryCountRef.current = 0;
    isSavingRef.current = false;
    lastPatchTimeRef.current = 0;
  }, [roomCode, setNuked, setLocked, setConnected, setActiveUsers]);

  const calculateDiff = (oldText: string, newText: string): PatchOp | null => {
    if (oldText === newText) return null;
    let start = 0;
    while (start < oldText.length && start < newText.length && oldText[start] === newText[start])
      start++;
    let oldEnd = oldText.length;
    let newEnd = newText.length;
    while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }
    return { i: start, d: oldEnd - start, t: newText.slice(start, newEnd) };
  };

  const applyPatch = (currentText: string, op: PatchOp): string => {
    return currentText.slice(0, op.i) + op.t + currentText.slice(op.i + op.d);
  };

  const fetchLatestContent = useCallback(async () => {
    if (!roomCode) return;

    if (isTypingRef.current || isSavingRef.current) return;

    if (Date.now() - lastPatchTimeRef.current < PATCH_COOLDOWN) {
      return;
    }

    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('content')
        .eq('room_code', roomCode)
        .maybeSingle();

      if (error) throw error;

      if (room) {
        retryCountRef.current = 0;
        const raw = unwrapPayload(room.content || '');
        // Use Ref here to guarantee latest key
        const dbText = decryptData(raw, secretKeyRef.current);

        // Guard against key mismatch
        if (raw.length > 10 && dbText.length === 0 && secretKeyRef.current) {
          console.error('Decryption failed. Key mismatch?');
          return;
        }

        if (dbText !== prevContentRef.current) {
          setContent(dbText);
          prevContentRef.current = dbText;
        }
      } else {
        if (retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current++;
          return;
        }
        setNuked(true);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current++;
      }
    }
  }, [roomCode, setNuked]); // Removed secretKey dependency, using Ref

  useEffect(() => {
    if (!roomCode) return;

    const init = async () => {
      try {
        await fetchLatestContent();

        if (channelRef.current) supabase.removeChannel(channelRef.current);

        channelRef.current = supabase
          .channel(`room:${roomCode}`)
          .on('broadcast', { event: 'patch' }, (payload) => {
            if (isTypingRef.current) return;

            try {
              lastPatchTimeRef.current = Date.now();

              // Use Ref here to guarantee latest key in the callback closure
              const opString = decryptData(payload.payload.op, secretKeyRef.current);
              const op = JSON.parse(opString) as PatchOp;

              setContent((prev) => {
                const patched = applyPatch(prev, op);
                prevContentRef.current = patched;
                return patched;
              });
            } catch (e) {
              console.error('Patch sync error', e);
              // Force fetch on error to self-heal
              fetchLatestContent();
            }
          })
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'rooms',
              filter: `room_code=eq.${roomCode}`,
            },
            () => fetchLatestContent()
          )
          .on(
            'postgres_changes',
            {
              event: 'DELETE',
              schema: 'public',
              table: 'rooms',
              filter: `room_code=eq.${roomCode}`,
            },
            () => setNuked(true)
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              setConnected(true);
              fetchLatestContent();
            } else if (status === 'CHANNEL_ERROR') {
              setSyncError('Connection Failed');
            }
          });
      } catch (_err) {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    const intervalId = setInterval(fetchLatestContent, 5000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        retryCountRef.current = 0;
        fetchLatestContent();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [roomCode, fetchLatestContent, setConnected, setNuked]);
  // Removed secretKey from effect dependencies to prevent unnecessary channel teardown
  // The Ref handles the key updates for the callbacks.

  const updateContent = (newContent: string) => {
    if (isNuked) return;

    setContent(newContent);
    isTypingRef.current = true;

    if (newContent.length > MAX_SYNC_CHARS) {
      setSyncError('DATA LIMIT EXCEEDED');
      return;
    } else {
      setSyncError(null);
    }

    if (channelRef.current) {
      const op = calculateDiff(prevContentRef.current, newContent);
      if (op) {
        const opString = JSON.stringify(op);
        // Use ref here too for consistency
        const encryptedOp = encryptData(opString, secretKeyRef.current);
        channelRef.current.send({
          type: 'broadcast',
          event: 'patch',
          payload: { op: encryptedOp },
        });
      }
    }

    prevContentRef.current = newContent;

    if (typingUnlockTimeoutRef.current) clearTimeout(typingUnlockTimeoutRef.current);
    typingUnlockTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
    }, TYPING_LOCK_DURATION);

    setIsSaving(true);
    isSavingRef.current = true;

    if (dbSaveTimeoutRef.current) clearTimeout(dbSaveTimeoutRef.current);

    dbSaveTimeoutRef.current = setTimeout(async () => {
      if (!roomCode) return;
      try {
        // Use ref here
        const cipherText = encryptData(newContent, secretKeyRef.current);
        const payload = wrapPayload(cipherText);

        const { error } = await supabase
          .from('rooms')
          .update({
            content: payload,
            updated_at: new Date().toISOString(),
          })
          .eq('room_code', roomCode);

        if (error) throw error;

        setSyncError(null);
      } catch (err) {
        // REMOVED : any
        console.error('Save error:', err);
        // FIX: Safe error handling
        const msg = err instanceof Error ? err.message : 'Unknown Error';
        setSyncError(`Save Failed: ${msg}`);
      } finally {
        setIsSaving(false);
        isSavingRef.current = false;
      }
    }, DB_SAVE_DEBOUNCE);
  };

  return { content, updateContent, isLoading, isSaving, notFound, syncError };
}
