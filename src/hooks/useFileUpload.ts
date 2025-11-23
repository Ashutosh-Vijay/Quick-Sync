import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { encryptData } from '@/lib/crypto';
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

      const encryptedName = encryptData(file.name, secretKey);
      const encryptedType = encryptData(file.type, secretKey);

      const { error: dbError } = await supabase.from('room_files').insert({
        room_code: roomCode,
        file_url: data.publicUrl,
        file_name: encryptedName,
        file_size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        file_type: encryptedType,
      });

      if (dbError) throw dbError;

      setProgress(100);
      toast({
        description: secretKey ? 'File Encrypted & Uploaded!' : 'File Obfuscated & Uploaded!',
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
