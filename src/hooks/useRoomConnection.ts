import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { decryptData, encryptData } from '@/lib/crypto';
import { wrapPayload, unwrapPayload } from '@/lib/payloadHelper';
import { useToast } from '@/hooks/use-toast';
import { useRoomStore } from '@/store/roomStore';

const TYPING_TIMEOUT = 2000;
const MAX_SYNC_CHARS = 800000;

export function useRoomConnection(roomCode: string | undefined, secretKey: string | null) {
  const { toast } = useToast();
  // Get all setters to perform a full reset
  const { isNuked, setNuked, setLocked, setConnected, setActiveUsers } = useRoomStore();

  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [remoteTyping, setRemoteTyping] = useState(false);

  // Ref tracking
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isTypingRef = useRef(false);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 0. THE CLEANUP CREW (Fixes the Ghost Bug)
  // Whenever roomCode changes (navigation), reset EVERYTHING.
  useEffect(() => {
    setNuked(false);
    setLocked(false);
    setConnected(false);
    setActiveUsers(0);
    setNotFound(false);
    setSyncError(null);
    setContent('');
    setIsLoading(true); // Ensure we show loader, not old state
  }, [roomCode, setNuked, setLocked, setConnected, setActiveUsers]);

  // 1. Fetch Initial Content
  const fetchLatestContent = useCallback(async () => {
    // Don't fetch if we don't have a code, or if we are actively typing (prevents cursor jumps)
    // Removed isNuked check here because we might be recovering from a reset state
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
        // Pass the secretKey (null or string) to decryptData
        const decrypted = decryptData(rawCipher, secretKey);
        setContent(decrypted);
      } else {
        setNuked(true);
      }
    } catch (err) {
      console.error('Error refreshing:', err);
    }
  }, [roomCode, secretKey, setNuked]);

  // 2. Initialize Subscription
  useEffect(() => {
    if (!roomCode) return;

    const initializeRoom = async () => {
      try {
        const { data: room, error } = await supabase
          .from('rooms')
          .select('content')
          .eq('room_code', roomCode)
          .maybeSingle();

        if (error) throw error;
        if (!room) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }

        // Initial set
        const rawCipher = unwrapPayload(room.content || '');
        const decrypted = decryptData(rawCipher, secretKey);
        setContent(decrypted);

        // Subscribe
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
                if (isTypingRef.current) return;

                const newRaw = (payload.new as { content: string }).content;
                const incomingCipher = unwrapPayload(newRaw);
                const incomingText = decryptData(incomingCipher, secretKey);
                setContent(incomingText);
              }
            }
          )
          .on('broadcast', { event: 'file-share' }, () => {
            toast({
              title: 'Incoming File! 📂',
              description: 'Check the Files tab to download.',
              duration: 5000,
            });
          })
          .on('broadcast', { event: 'typing' }, () => {
            setRemoteTyping(true);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
              setRemoteTyping(false);
            }, TYPING_TIMEOUT);
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
      if (document.visibilityState === 'visible') {
        fetchLatestContent();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (broadcastTimeoutRef.current) clearTimeout(broadcastTimeoutRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [roomCode, setNuked, fetchLatestContent, toast, secretKey]);

  // 3. Broadcast Helper
  const broadcastTyping = () => {
    if (!channelRef.current || broadcastTimeoutRef.current) return;
    channelRef.current.send({ type: 'broadcast', event: 'typing', payload: {} });
    broadcastTimeoutRef.current = setTimeout(() => {
      broadcastTimeoutRef.current = null;
    }, 500);
  };

  // 4. Update Content Handler
  const updateContent = (newContent: string) => {
    if (isNuked) return;

    setContent(newContent);
    isTypingRef.current = true;

    if (newContent.length > MAX_SYNC_CHARS) {
      setSyncError('DATA TOO LARGE');
      setIsSaving(false);
      return;
    } else {
      setSyncError(null);
    }

    setIsSaving(true);
    broadcastTyping();

    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);

    updateTimeoutRef.current = setTimeout(async () => {
      if (!roomCode) return;
      try {
        // Encrypt with Key (AES) or Null (Base64)
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
    }, 500);
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
