import { cn } from '@/lib/utils';

interface ApinsityLogoProps {
  className?: string;
  withText?: boolean;
}

export function ApinsityLogo({ className, withText = true }: ApinsityLogoProps) {
  return (
    <div className={cn('flex items-center gap-2 select-none', className)}>
      {/* The Image Logo */}
      {/* ⚠️ IMPORTANT: Rename your image file to 'logo.png' and place it in the 'public' folder */}
      <img src="/logo.png" alt="Apinsity Flame" className="w-8 h-8 object-contain drop-shadow-md" />

      {/* The Text */}
      {withText && (
        <div className="flex flex-col leading-none">
          {/* Removed 'text-foreground' to resolve CSS conflict with 'text-transparent' */}
          <span className="font-lavish text-xl tracking-widest font-bold uppercase bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-600 dark:from-orange-400 dark:to-yellow-200">
            Apinsity
          </span>
        </div>
      )}
    </div>
  );
}
