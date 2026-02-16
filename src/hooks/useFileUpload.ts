import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { encryptData } from '@/lib/crypto';
import { wrapPayload } from '@/lib/payloadHelper';
import { useToast } from '@/hooks/use-toast';
import * as CryptoJS from 'crypto-js';

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface UseFileUploadProps {
  roomCode: string;
  secretKey: string | null;
  onUploadComplete?: () => void;
}

export function useFileUpload({ roomCode, secretKey, onUploadComplete }: UseFileUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const readFileAsWordArray = (file: File): Promise<CryptoJS.lib.WordArray> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        resolve(wordArray);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const res = e.target?.result as string;
        const rawBase64 = res.split(',')[1];
        resolve(rawBase64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast({
        variant: 'destructive',
        description: `File too chonky. Max ${MAX_FILE_SIZE_MB}MB. 📉`,
      });
      return;
    }

    setIsUploading(true);
    setProgress(10);

    try {
      let encryptedContent: string | Blob;

      if (secretKey) {
        const fileWordArray = await readFileAsWordArray(file);
        const encrypted = CryptoJS.AES.encrypt(fileWordArray, secretKey).toString();
        encryptedContent = new Blob([encrypted], { type: 'application/octet-stream' });
      } else {
        const base64 = await readFileAsBase64(file);
        encryptedContent = new Blob([base64], { type: 'text/plain' });
      }

      const timestamp = Date.now();
      const boringName = `sys_log_dump_${timestamp}.dat`;

      const uniqueId =
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : 'uuid-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);

      const filePath = `${roomCode}/${uniqueId}/${boringName}`;

      const { error: uploadError } = await supabase.storage
        .from('quick-share')
        .upload(filePath, encryptedContent, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'application/octet-stream',
        });

      if (uploadError) throw uploadError;

      setProgress(80);

      const { data } = supabase.storage.from('quick-share').getPublicUrl(filePath);

      const meta = {
        n: file.name,
        s: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        t: file.type,
        u: data.publicUrl,
      };

      const metaString = JSON.stringify(meta);
      const encryptedMeta = encryptData(metaString, secretKey);
      const payload = wrapPayload(encryptedMeta);

      // 🚨 THE FIX: Add .select().single() to get the DB row right away
      const { data: dbData, error: dbError } = await supabase
        .from('room_files')
        .insert({
          room_code: roomCode,
          file_data: payload,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      setProgress(100);
      toast({
        description: secretKey ? 'Encrypted & Synced! 🔒' : 'Obfuscated & Synced! 🌐',
      });
      onUploadComplete?.();

      // 🚨 Return the constructed object so the UI doesn't have to wait for the websocket
      return {
        id: dbData.id,
        name: meta.n,
        size: meta.s,
        type: meta.t,
        url: meta.u,
        uploaded_at: dbData.uploaded_at,
      };
    } catch (error: unknown) {
      console.error(error);
      const err = error as { message: string };
      toast({ variant: 'destructive', description: err.message || 'Upload failed' });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return { uploadFile, isUploading, progress };
}
