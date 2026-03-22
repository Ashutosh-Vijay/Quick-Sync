import { useState, useRef } from 'react';
import { Upload, File, Loader2, ShieldCheck, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useFileUpload } from '@/hooks/useFileUpload';

interface FileShareProps {
  roomCode: string;
  secretKey: string | null;
}

export function FileShare({ roomCode, secretKey }: FileShareProps) {
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFiles, isUploading, progress } = useFileUpload({
    roomCode,
    secretKey,
    onUploadComplete: () => {
      setIsOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files);
    await uploadFiles(files);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Send Secure File</span>
          <span className="sm:hidden">Upload</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md select-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {secretKey ? (
              <ShieldCheck className="w-5 h-5 text-green-500" />
            ) : (
              <Globe className="w-5 h-5 text-blue-500" />
            )}
            {secretKey ? 'Secure File Transfer' : 'Public File Transfer'}
          </DialogTitle>
          <DialogDescription>
            {secretKey
              ? 'Files are encrypted with AES-256 client-side. Impossible to read without the key.'
              : 'Files are Base64 obfuscated to bypass network filters. Readable by anyone with the link.'}
          </DialogDescription>
        </DialogHeader>

        <div
          className={`
            border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 text-center transition-colors
            ${isUploading ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 cursor-pointer'}
          `}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="w-full space-y-4">
              <div className="flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {secretKey ? 'Encrypting...' : 'Obfuscating...'}
                </p>
                <Progress value={progress} className="h-2" />
              </div>
            </div>
          ) : (
            <>
              <div className="bg-muted rounded-full p-4">
                <File className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Click to select or drag file here</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Max 50MB • {secretKey ? 'End-to-End Encrypted' : 'Traffic Obfuscated'}
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
