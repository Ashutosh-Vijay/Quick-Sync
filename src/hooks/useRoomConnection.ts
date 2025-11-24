import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { decryptData, encryptData } from '@/lib/crypto';
import { wrapPayload, unwrapPayload } from '@/lib/payloadHelper';
import { useToast } from '@/hooks/use-toast';
import { useRoomStore } from '@/store/roomStore';

const TYPING_TIMEOUT = 2000;
const MAX_SYNC_CHARS = 800000;
const DB_SAVE_DEBOUNCE = 3000; // 🚀 Increased from 500ms to 3s to save bandwidth

// Simple diff types
type PatchOp = {
  i: number; // index
  d: number; // delete count
  t: string; // text to insert
};

export function useRoomConnection(roomCode: string | undefined, secretKey: string | null) {
  const { toast } = useToast();
  const { isNuked, setNuked, setLocked, setConnected, setActiveUsers } = useRoomStore();

  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [remoteTyping, setRemoteTyping] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const isTypingRef = useRef(false);
  const isApplyingPatchRef = useRef(false); // Prevents echo loops
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep track of previous content to calculate diffs
  const prevContentRef = useRef('');

  // 0. THE CLEANUP CREW
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
  }, [roomCode, setNuked, setLocked, setConnected, setActiveUsers]);

  // 1. Fetch Initial Content
  const fetchLatestContent = useCallback(async () => {
    if (!roomCode || isTypingRef.current) return;

    try {
      const { data: room, error } = await supabase
        .from('rooms')
        .select('content')
        .eq('room_code', roomCode)
        .maybeSingle();

      if (error) throw error;
      if (room) {
        const rawCipher = unwrapPayload(room.content || '');
        const decrypted = decryptData(rawCipher, secretKey);
        setContent(decrypted);
        prevContentRef.current = decrypted; // Sync ref
      } else {
        setNuked(true);
      }
    } catch (err) {
      console.error('Error refreshing:', err);
    }
  }, [roomCode, secretKey, setNuked]);

  // 2. Naive Diff Calculator (Savage Edition)
  const calculateDiff = (oldText: string, newText: string): PatchOp | null => {
    if (oldText === newText) return null;

    let start = 0;
    while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
      start++;
    }

    let oldEnd = oldText.length;
    let newEnd = newText.length;

    while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
      oldEnd--;
      newEnd--;
    }

    return {
      i: start,
      d: oldEnd - start,
      t: newText.slice(start, newEnd),
    };
  };

  // 3. Apply Patch
  const applyPatch = (currentText: string, op: PatchOp): string => {
    return currentText.slice(0, op.i) + op.t + currentText.slice(op.i + op.d);
  };

  // 4. Initialize Subscription
  useEffect(() => {
    if (!roomCode) return;

    const initializeRoom = async () => {
      try {
        // ... (Initial fetch logic logic same as before, skipped for brevity but included in flow)
        await fetchLatestContent();

        channelRef.current = supabase
          .channel(`room-content:${roomCode}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'rooms',
              filter: `room_code=eq.${roomCode}`,
            },
            (payload) => {
              if (payload.eventType === 'DELETE') {
                setNuked(true);
                return;
              }
              if (payload.eventType === 'UPDATE') {
                // DB Snapshot Update (The Backup Plan)
                if (isTypingRef.current) return;

                const newRaw = (payload.new as { content: string }).content;
                const incomingCipher = unwrapPayload(newRaw);
                const incomingText = decryptData(incomingCipher, secretKey);

                // Only update if we really drifted, otherwise trust the broadcasts
                if (incomingText !== prevContentRef.current) {
                  setContent(incomingText);
                  prevContentRef.current = incomingText;
                }
              }
            }
          )
          .on('broadcast', { event: 'file-share' }, () => {
            toast({
              title: 'Incoming File! 📂',
              description: 'Check the Files tab.',
              duration: 5000,
            });
          })
          // 🚀 LISTENING FOR PATCHES (The Fast Lane)
          .on('broadcast', { event: 'patch' }, (payload) => {
            // Payload has { op: EncryptedOpString }
            if (isTypingRef.current) return; // Don't patch if I'm active (simple conflict resolution)

            try {
              const encryptedOp = payload.payload.op;
              // Decrypt the Op
              const opString = decryptData(encryptedOp, secretKey);
              const op = JSON.parse(opString) as PatchOp;

              setRemoteTyping(true);
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => setRemoteTyping(false), TYPING_TIMEOUT);

              // Apply patch to state
              setContent((prev) => {
                const patched = applyPatch(prev, op);
                prevContentRef.current = patched; // Keep ref in sync
                return patched;
              });

              // Signal that we are patching so we don't echo back
              isApplyingPatchRef.current = true;
              setTimeout(() => (isApplyingPatchRef.current = false), 50);
            } catch (e) {
              console.error('Failed to apply patch', e);
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') fetchLatestContent();
          });
      } catch (_err) {
        setNotFound(true);
      } finally {
        setIsLoading(false);
      }
    };

    initializeRoom();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchLatestContent();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      // ... clear timeouts
    };
  }, [roomCode, setNuked, fetchLatestContent, toast, secretKey]);

  // 5. Update Content Handler (The Logic Brain)
  const updateContent = (newContent: string) => {
    if (isNuked || isApplyingPatchRef.current) return;

    setContent(newContent);
    isTypingRef.current = true;

    if (newContent.length > MAX_SYNC_CHARS) {
      setSyncError('DATA TOO LARGE');
      setIsSaving(false);
      return;
    } else {
      setSyncError(null);
    }

    // A. Calculate Diff & Broadcast (Fast Lane)
    if (channelRef.current) {
      const op = calculateDiff(prevContentRef.current, newContent);
      if (op) {
        // Encrypt the Op because we aren't heathens
        const opString = JSON.stringify(op);
        const encryptedOp = encryptData(opString, secretKey);

        channelRef.current.send({
          type: 'broadcast',
          event: 'patch',
          payload: { op: encryptedOp },
        });
      }
    }

    prevContentRef.current = newContent;
    setIsSaving(true);

    // B. Schedule DB Save (Slow Lane)
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);

    updateTimeoutRef.current = setTimeout(async () => {
      if (!roomCode) return;
      try {
        const cipherText = encryptData(newContent, secretKey);
        const payload = wrapPayload(cipherText);

        await supabase
          .from('rooms')
          .update({
            content: payload,
            updated_at: new Date().toISOString(),
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
    }, DB_SAVE_DEBOUNCE); // <--- This is the key change. 3 seconds delay.
  };

  return {
    content,
    updateContent,
    isLoading,
    isSaving,
    notFound,
    syncError,
    remoteTyping,
    setContent,
  };
}
