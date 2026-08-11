import { useState, useEffect } from 'react';

export const useThumbnail = (filename: string, photoId?: number) => {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadThumbnail = async () => {
      if (!filename) return;

      setLoading(true);
      setError(false);

      // Simple approach: use the simplified thumbnail endpoint
      const thumbnailUrl = `/api/thumbnails/${filename}?t=${Date.now()}`;
      console.log(`[Thumbnail] Loading: ${thumbnailUrl}`);
      
      try {
        const response = await fetch(thumbnailUrl, {
          method: 'GET',
          headers: {
            'Accept': 'image/jpeg,image/png,image/*,*/*'
          }
        });
        
        console.log(`[Thumbnail] Response status: ${response.status}`);
        
        if (response.ok && mounted) {
          // Check if response is an image
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.startsWith('image/')) {
            setSrc(thumbnailUrl);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error('[Thumbnail] Load failed:', err);
      }

      // If thumbnail fails, try to get preview by filename instead of photo ID
      try {
        const previewUrl = `/api/photos/preview/${filename}`;
        console.log(`[Thumbnail] Trying preview fallback: ${previewUrl}`);
        
        const previewResponse = await fetch(previewUrl, { method: 'HEAD' });
        if (previewResponse.ok && mounted) {
          setSrc(previewUrl);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('[Thumbnail] Preview fallback failed:', err);
      }

      if (mounted) {
        setError(true);
        setLoading(false);
      }
    };

    loadThumbnail();

    return () => {
      mounted = false;
    };
  }, [filename, photoId]);

  return { src, loading, error };
};