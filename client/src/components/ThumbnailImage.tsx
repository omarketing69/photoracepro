import React from 'react';
import { useThumbnail } from '@/hooks/use-thumbnail';

interface ThumbnailImageProps {
  filename: string;
  photoId?: number;
  alt: string;
  className?: string;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({
  filename,
  photoId,
  alt,
  className = '',
  onError
}) => {
  const { src, loading, error } = useThumbnail(filename, photoId);

  // Debug logging for external domains
  React.useEffect(() => {
    const isExternalDomain = window.location.hostname.includes('replit.app') || 
                            window.location.hostname.includes('replit.dev') ||
                            window.location.hostname.includes('replit.co');
    
    if (isExternalDomain && src) {
      console.log(`[External Domain] Loaded thumbnail for ${filename}: ${src.substring(0, 50)}...`);
    }
  }, [src, filename]);

  if (loading) {
    return (
      <div className={`${className} bg-gray-200 animate-pulse flex items-center justify-center`}>
        <div className="text-gray-500 text-sm">Cargando...</div>
      </div>
    );
  }

  if (error || !src) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`}>
        <div className="text-gray-500 text-sm">Error al cargar</div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={onError}
    />
  );
};