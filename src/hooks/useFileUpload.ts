import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { encryptData, encryptFile } from '@/lib/crypto';
import { wrapPayload } from '@/lib/payloadHelper';
import { useToast } from '@/hooks/use-toast';

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

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const res = e.target?.result as string;
        resolve(res.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const uploadFiles = async (files: File[]) => {
    const validFiles = files.filter((f) => {
      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast({
          variant: 'destructive',
          description: `${f.name} is too chonky. Max ${MAX_FILE_SIZE_MB}MB.`,
        });
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    setIsUploading(true);
    setProgress(0);

    try {
      const results = [];
      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        let encryptedContent: Blob;

        if (secretKey) {
          const fileBuffer = await file.arrayBuffer();
          encryptedContent = await encryptFile(fileBuffer, secretKey);
        } else {
          const base64 = await readFileAsBase64(file);
          encryptedContent = new Blob([base64], { type: 'text/plain' });
        }

        const timestamp = Date.now();
        const boringName = `sys_log_dump_${timestamp}_${i}.dat`;
        const uniqueId =
          typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : 'uuid-' + Math.random().toString(36).slice(2, 11);
        const filePath = `${roomCode}/${uniqueId}/${boringName}`;

        const { error: uploadError } = await supabase.storage
          .from('quick-share')
          .upload(filePath, encryptedContent, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'application/octet-stream',
          });

        if (uploadError) throw uploadError;

        setProgress(((i + 0.8) / validFiles.length) * 100);

        const { data } = supabase.storage.from('quick-share').getPublicUrl(filePath);

        const meta = {
          n: file.name,
          s: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          t: file.type,
          u: data.publicUrl,
        };
        const encryptedMeta = await encryptData(JSON.stringify(meta), secretKey);
        const payload = wrapPayload(encryptedMeta);

        const { data: dbData, error: dbError } = await supabase
          .from('room_files')
          .insert({ room_code: roomCode, file_data: payload })
          .select()
          .single();

        if (dbError) throw dbError;

        results.push({
          id: dbData.id,
          name: meta.n,
          size: meta.s,
          type: meta.t,
          url: meta.u,
          uploaded_at: dbData.uploaded_at,
        });
        setProgress(((i + 1) / validFiles.length) * 100);
      }

      toast({
        description: secretKey
          ? `Encrypted & Synced ${validFiles.length} files! 🔒`
          : `Obfuscated & Synced ${validFiles.length} files! 🌐`,
      });
      onUploadComplete?.();
      return results;
    } catch (error: unknown) {
      console.error(error);
      const err = error as { message: string };
      toast({ variant: 'destructive', description: err.message || 'Upload failed' });
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  };

  return { uploadFiles, isUploading, progress };
}
