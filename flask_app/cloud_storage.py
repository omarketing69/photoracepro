import os
import shutil
import json
from pathlib import Path
from typing import Dict, List, Optional
import logging
from datetime import datetime
import hashlib

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class CloudStorageManager:
    """
    Simulated cloud storage manager that organizes files in a local directory structure
    Mimics Google Drive/AWS S3 organization patterns
    """
    
    def __init__(self, base_path: str = 'cloud_storage'):
        self.base_path = Path(base_path)
        self.events_path = self.base_path / 'events'
        self.temp_path = self.base_path / 'temp'
        
        # Create base directories
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Ensure all base directories exist"""
        try:
            self.base_path.mkdir(exist_ok=True)
            self.events_path.mkdir(exist_ok=True)
            self.temp_path.mkdir(exist_ok=True)
            logger.info(f"Cloud storage initialized at: {self.base_path}")
        except Exception as e:
            logger.error(f"Error creating base directories: {str(e)}")
            raise
    
    def create_event_structure(self, event_id: int, event_name: str) -> str:
        """
        Create directory structure for a new event
        
        Structure:
        /cloud_storage/events/evento_{id}_{name}/
        ├── originales/          # High resolution originals
        ├── web/                 # Web-optimized versions
        ├── thumbnails/          # Thumbnail versions
        ├── participantes/       # Organized by dorsal
        │   ├── dorsal_123/
        │   ├── dorsal_456/
        │   └── ...
        └── metadata.json        # Event metadata
        """
        try:
            # Create safe directory name
            safe_name = self._sanitize_filename(event_name)
            event_dir_name = f"evento_{event_id}_{safe_name}"
            event_path = self.events_path / event_dir_name
            
            # Create directory structure
            directories = [
                event_path,
                event_path / 'originales',
                event_path / 'web',
                event_path / 'thumbnails',
                event_path / 'participantes',
            ]
            
            for directory in directories:
                directory.mkdir(parents=True, exist_ok=True)
            
            # Create metadata file
            metadata = {
                'event_id': event_id,
                'event_name': event_name,
                'created_at': datetime.now().isoformat(),
                'structure_version': '1.0',
                'total_photos': 0,
                'processed_photos': 0,
                'participants': {}
            }
            
            metadata_file = event_path / 'metadata.json'
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            logger.info(f"Created event structure: {event_path}")
            return str(event_path)
            
        except Exception as e:
            logger.error(f"Error creating event structure: {str(e)}")
            raise
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename for safe filesystem use"""
        # Remove or replace problematic characters
        invalid_chars = '<>:"/\\|?*'
        for char in invalid_chars:
            filename = filename.replace(char, '_')
        
        # Remove extra spaces and limit length
        filename = '_'.join(filename.split())
        return filename[:50]  # Limit length
    
    def store_original_photo(self, event_id: int, photo_path: str, filename: str) -> str:
        """
        Store original photo in event's originales directory
        """
        try:
            event_dir = self._find_event_directory(event_id)
            if not event_dir:
                raise ValueError(f"Event directory not found for event {event_id}")
            
            originales_dir = event_dir / 'originales'
            safe_filename = self._sanitize_filename(filename)
            destination = originales_dir / safe_filename
            
            # Copy file to cloud storage
            shutil.copy2(photo_path, destination)
            
            logger.info(f"Stored original photo: {destination}")
            return str(destination)
            
        except Exception as e:
            logger.error(f"Error storing original photo: {str(e)}")
            raise
    
    def generate_web_version(self, original_path: str, max_width: int = 1200, max_height: int = 800, quality: int = 85) -> str:
        """
        Generate web-optimized version of photo
        """
        try:
            from PIL import Image
            
            # Parse paths
            original_path = Path(original_path)
            event_dir = original_path.parent.parent
            web_dir = event_dir / 'web'
            web_path = web_dir / original_path.name
            
            # Open and resize image
            with Image.open(original_path) as img:
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                
                # Calculate new dimensions maintaining aspect ratio
                img_width, img_height = img.size
                ratio = min(max_width / img_width, max_height / img_height)
                
                if ratio < 1:  # Only resize if image is larger
                    new_width = int(img_width * ratio)
                    new_height = int(img_height * ratio)
                    img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                
                # Save web version
                img.save(web_path, 'JPEG', quality=quality, optimize=True)
            
            logger.info(f"Generated web version: {web_path}")
            return str(web_path)
            
        except Exception as e:
            logger.error(f"Error generating web version: {str(e)}")
            return original_path  # Return original if web generation fails
    
    def generate_thumbnail(self, original_path: str, size: tuple = (150, 150)) -> str:
        """
        Generate thumbnail version of photo
        """
        try:
            from PIL import Image
            
            # Parse paths
            original_path = Path(original_path)
            event_dir = original_path.parent.parent
            thumb_dir = event_dir / 'thumbnails'
            thumb_path = thumb_dir / original_path.name
            
            # Open and create thumbnail
            with Image.open(original_path) as img:
                # Convert to RGB if necessary
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                
                # Create thumbnail maintaining aspect ratio
                img.thumbnail(size, Image.Resampling.LANCZOS)
                
                # Save thumbnail
                img.save(thumb_path, 'JPEG', quality=80, optimize=True)
            
            logger.info(f"Generated thumbnail: {thumb_path}")
            return str(thumb_path)
            
        except Exception as e:
            logger.error(f"Error generating thumbnail: {str(e)}")
            return original_path  # Return original if thumbnail generation fails
    
    def organize_by_participant(self, event_id: int, photo_filename: str, dorsal_numbers: List[int]) -> List[str]:
        """
        Organize photo copies by participant dorsal numbers
        """
        try:
            event_dir = self._find_event_directory(event_id)
            if not event_dir:
                raise ValueError(f"Event directory not found for event {event_id}")
            
            participantes_dir = event_dir / 'participantes'
            original_photo = event_dir / 'originales' / photo_filename
            
            if not original_photo.exists():
                raise FileNotFoundError(f"Original photo not found: {original_photo}")
            
            organized_paths = []
            
            for dorsal in dorsal_numbers:
                # Create participant directory
                dorsal_dir = participantes_dir / f"dorsal_{dorsal}"
                dorsal_dir.mkdir(exist_ok=True)
                
                # Copy photo to participant directory
                destination = dorsal_dir / photo_filename
                shutil.copy2(original_photo, destination)
                organized_paths.append(str(destination))
                
                logger.info(f"Organized photo for dorsal {dorsal}: {destination}")
            
            # Update metadata
            self._update_event_metadata(event_id, dorsal_numbers)
            
            return organized_paths
            
        except Exception as e:
            logger.error(f"Error organizing photo by participant: {str(e)}")
            return []
    
    def _find_event_directory(self, event_id: int) -> Optional[Path]:
        """Find event directory by event ID"""
        try:
            for event_dir in self.events_path.iterdir():
                if event_dir.is_dir() and event_dir.name.startswith(f"evento_{event_id}_"):
                    return event_dir
            return None
        except Exception as e:
            logger.error(f"Error finding event directory: {str(e)}")
            return None
    
    def _update_event_metadata(self, event_id: int, dorsal_numbers: List[int]):
        """Update event metadata with new participant information"""
        try:
            event_dir = self._find_event_directory(event_id)
            if not event_dir:
                return
            
            metadata_file = event_dir / 'metadata.json'
            if not metadata_file.exists():
                return
            
            # Load existing metadata
            with open(metadata_file, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
            
            # Update participant counts
            for dorsal in dorsal_numbers:
                dorsal_str = str(dorsal)
                if dorsal_str in metadata['participants']:
                    metadata['participants'][dorsal_str] += 1
                else:
                    metadata['participants'][dorsal_str] = 1
            
            # Update total counts
            metadata['total_photos'] = metadata.get('total_photos', 0) + 1
            metadata['last_updated'] = datetime.now().isoformat()
            
            # Save updated metadata
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
        except Exception as e:
            logger.error(f"Error updating event metadata: {str(e)}")
    
    def get_participant_photos(self, event_id: int, dorsal_number: int) -> List[str]:
        """
        Get all photos for a specific participant
        """
        try:
            event_dir = self._find_event_directory(event_id)
            if not event_dir:
                return []
            
            dorsal_dir = event_dir / 'participantes' / f"dorsal_{dorsal_number}"
            if not dorsal_dir.exists():
                return []
            
            photos = []
            for photo_file in dorsal_dir.iterdir():
                if photo_file.is_file() and photo_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.tiff']:
                    photos.append(str(photo_file))
            
            return photos
            
        except Exception as e:
            logger.error(f"Error getting participant photos: {str(e)}")
            return []
    
    def create_download_package(self, event_id: int, dorsal_number: int) -> Optional[str]:
        """
        Create ZIP package of all photos for a participant
        """
        try:
            import zipfile
            
            photos = self.get_participant_photos(event_id, dorsal_number)
            if not photos:
                return None
            
            # Create temporary ZIP file
            zip_filename = f"dorsal_{dorsal_number}_photos.zip"
            zip_path = self.temp_path / zip_filename
            
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                for photo_path in photos:
                    photo_file = Path(photo_path)
                    zipf.write(photo_path, photo_file.name)
            
            logger.info(f"Created download package: {zip_path}")
            return str(zip_path)
            
        except Exception as e:
            logger.error(f"Error creating download package: {str(e)}")
            return None
    
    def get_event_statistics(self, event_id: int) -> Dict:
        """
        Get comprehensive statistics for an event
        """
        try:
            event_dir = self._find_event_directory(event_id)
            if not event_dir:
                return {}
            
            metadata_file = event_dir / 'metadata.json'
            if metadata_file.exists():
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
            else:
                metadata = {}
            
            # Count files in each directory
            stats = {
                'event_id': event_id,
                'total_originals': len(list((event_dir / 'originales').glob('*'))),
                'total_web_versions': len(list((event_dir / 'web').glob('*'))),
                'total_thumbnails': len(list((event_dir / 'thumbnails').glob('*'))),
                'unique_participants': len(list((event_dir / 'participantes').iterdir())),
                'metadata': metadata
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"Error getting event statistics: {str(e)}")
            return {}
    
    def cleanup_temp_files(self, max_age_hours: int = 24):
        """
        Clean up temporary files older than specified hours
        """
        try:
            import time
            
            current_time = time.time()
            max_age_seconds = max_age_hours * 3600
            
            for temp_file in self.temp_path.iterdir():
                if temp_file.is_file():
                    file_age = current_time - temp_file.stat().st_mtime
                    if file_age > max_age_seconds:
                        temp_file.unlink()
                        logger.info(f"Cleaned up temp file: {temp_file}")
            
        except Exception as e:
            logger.error(f"Error cleaning up temp files: {str(e)}")

# Convenience functions
def setup_event_storage(event_id: int, event_name: str) -> str:
    """
    Convenience function to set up storage for a new event
    """
    manager = CloudStorageManager()
    return manager.create_event_structure(event_id, event_name)

def process_and_store_photo(event_id: int, photo_path: str, filename: str, dorsal_numbers: List[int]) -> Dict[str, str]:
    """
    Complete photo processing and storage workflow
    """
    try:
        manager = CloudStorageManager()
        
        # Store original
        original_path = manager.store_original_photo(event_id, photo_path, filename)
        
        # Generate web version
        web_path = manager.generate_web_version(original_path)
        
        # Generate thumbnail
        thumbnail_path = manager.generate_thumbnail(original_path)
        
        # Organize by participants
        participant_paths = manager.organize_by_participant(event_id, filename, dorsal_numbers)
        
        return {
            'original_path': original_path,
            'web_path': web_path,
            'thumbnail_path': thumbnail_path,
            'participant_paths': participant_paths
        }
        
    except Exception as e:
        logger.error(f"Error in photo processing workflow: {str(e)}")
        return {}
