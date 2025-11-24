import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { encryptData } from '@/lib/crypto';
import { wrapPayload } from '@/lib/payloadHelper';
import { useToast } from '@/hooks/use-toast';
import * as CryptoJS from 'crypto-js';

interface UseFileUploadProps {
  roomCode: string;
  secretKey: string | null;
  onUploadComplete?: () => void;
}

export function useFileUpload({ roomCode, secretKey, onUploadComplete }: UseFileUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Reads file as WordArray (for AES)
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

  // Reads file as Base64 String (for Public Obfuscation)
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const res = e.target?.result as string;
        // Remove the "data:*/*;base64," prefix to get raw payload
        const rawBase64 = res.split(',')[1];
        resolve(rawBase64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: 'destructive', description: 'File too large. Max 10MB.' });
      return;
    }

    setIsUploading(true);
    setProgress(10);

    try {
      let encryptedContent: string | Blob;

      if (secretKey) {
        // SECURE MODE: AES Encryption
        const fileWordArray = await readFileAsWordArray(file);
        const encrypted = CryptoJS.AES.encrypt(fileWordArray, secretKey).toString();
        encryptedContent = new Blob([encrypted], { type: 'application/octet-stream' });
      } else {
        // PUBLIC MODE: Base64 Obfuscation
        const base64 = await readFileAsBase64(file);
        encryptedContent = new Blob([base64], { type: 'text/plain' });
      }

      // 1. Upload the actual blob (Storage)
      // We still use obscure filenames to prevent path guessing
      const timestamp = Date.now();
      const boringName = `sys_log_dump_${timestamp}.dat`;
      const uniqueId = crypto.randomUUID();
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

      // 2. Prepare the Stealth Metadata
      // We rename keys to garbage to look like generic state sync
      const meta = {
        n: file.name, // n = name
        s: (file.size / 1024 / 1024).toFixed(2) + ' MB', // s = size
        t: file.type, // t = type
        u: data.publicUrl, // u = url
      };

      // 3. Encrypt the Metadata Object
      // This hides the structure. The network just sees a random string.
      const metaString = JSON.stringify(meta);
      const encryptedMeta = encryptData(metaString, secretKey);

      // 4. Wrap in Fake Telemetry
      // "Look busy, Jesus is coming"
      const payload = wrapPayload(encryptedMeta);

      const { error: dbError } = await supabase.from('room_files').insert({
        room_code: roomCode,
        file_data: payload, // <--- ONE KEY TO RULE THEM ALL
      });

      if (dbError) throw dbError;

      setProgress(100);
      toast({
        description: secretKey ? 'Encrypted & Synced!' : 'Obfuscated & Synced!',
      });
      onUploadComplete?.();
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
