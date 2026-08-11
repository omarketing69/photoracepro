import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional

class Database:
    def __init__(self, db_path: str = 'race_photos.db'):
        self.db_path = db_path
        self.init_db()
    
    def get_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)
    
    def init_db(self):
        """Initialize database with tables"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Events table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                date TEXT NOT NULL,
                location TEXT NOT NULL,
                expected_participants INTEGER NOT NULL,
                status TEXT DEFAULT 'active',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Photos table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                original_path TEXT NOT NULL,
                web_path TEXT,
                thumbnail_path TEXT,
                detected_dorsals TEXT,
                faces TEXT,
                processed BOOLEAN DEFAULT FALSE,
                processing_status TEXT DEFAULT 'pending',
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                processed_at TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events (id)
            )
        ''')
        
        # Participants table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                dorsal_number INTEGER NOT NULL,
                name TEXT,
                email TEXT,
                photo_count INTEGER DEFAULT 0,
                FOREIGN KEY (event_id) REFERENCES events (id)
            )
        ''')
        
        # Sales table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                dorsal_number INTEGER,
                photo_ids TEXT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events (id)
            )
        ''')
        
        # Processing stats table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS processing_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id INTEGER NOT NULL,
                total_photos INTEGER DEFAULT 0,
                processed_photos INTEGER DEFAULT 0,
                dorsals_detected INTEGER DEFAULT 0,
                faces_detected INTEGER DEFAULT 0,
                ocr_accuracy REAL DEFAULT 0.0,
                avg_processing_time REAL DEFAULT 0.0,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (event_id) REFERENCES events (id)
            )
        ''')
        
        conn.commit()
        conn.close()


class EventModel:
    def __init__(self, db: Database):
        self.db = db
    
    def create_event(self, name: str, date: str, location: str, expected_participants: int, status: str = 'active') -> Dict:
        """Create new event"""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO events (name, date, location, expected_participants, status)
                VALUES (?, ?, ?, ?, ?)
            ''', (name, date, location, expected_participants, status))
            
            event_id = cursor.lastrowid
            conn.commit()
            
            # Get created event
            cursor.execute('SELECT * FROM events WHERE id = ?', (event_id,))
            row = cursor.fetchone()
            
            return {
                'id': row[0],
                'name': row[1],
                'date': row[2],
                'location': row[3],
                'expectedParticipants': row[4],
                'status': row[5],
                'createdAt': row[6],
                'updatedAt': row[7]
            }
        finally:
            conn.close()
    
    def get_events(self) -> List[Dict]:
        """Get all events with statistics"""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT e.*, 
                       COUNT(p.id) as photo_count,
                       ps.total_photos, ps.processed_photos, ps.dorsals_detected, 
                       ps.faces_detected, ps.ocr_accuracy, ps.avg_processing_time
                FROM events e
                LEFT JOIN photos p ON e.id = p.event_id
                LEFT JOIN processing_stats ps ON e.id = ps.event_id
                GROUP BY e.id
                ORDER BY e.created_at DESC
            ''')
            
            events = []
            for row in cursor.fetchall():
                event = {
                    'id': row[0],
                    'name': row[1],
                    'date': row[2],
                    'location': row[3],
                    'expectedParticipants': row[4],
                    'status': row[5],
                    'createdAt': row[6],
                    'updatedAt': row[7],
                    'photoCount': row[8] or 0,
                    'participantCount': 0
                }
                
                # Add processing stats if available
                if row[9] is not None:
                    event['processingStats'] = {
                        'eventId': row[0],
                        'totalPhotos': row[9],
                        'processedPhotos': row[10],
                        'dorsalsDetected': row[11],
                        'facesDetected': row[12],
                        'ocrAccuracy': f"{row[13]:.2f}" if row[13] else "0.00",
                        'avgProcessingTime': f"{row[14]:.3f}" if row[14] else "0.000"
                    }
                
                events.append(event)
            
            return events
        finally:
            conn.close()
    
    def get_event(self, event_id: int) -> Optional[Dict]:
        """Get single event by ID"""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT * FROM events WHERE id = ?', (event_id,))
            row = cursor.fetchone()
            
            if row:
                return {
                    'id': row[0],
                    'name': row[1],
                    'date': row[2],
                    'location': row[3],
                    'expectedParticipants': row[4],
                    'status': row[5],
                    'createdAt': row[6],
                    'updatedAt': row[7]
                }
            return None
        finally:
            conn.close()


class PhotoModel:
    def __init__(self, db: Database):
        self.db = db
    
    def create_photo(self, event_id: int, filename: str, original_path: str) -> Dict:
        """Create new photo record"""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                INSERT INTO photos (event_id, filename, original_path, processed, processing_status)
                VALUES (?, ?, ?, FALSE, 'pending')
            ''', (event_id, filename, original_path))
            
            photo_id = cursor.lastrowid
            conn.commit()
            
            return {
                'id': photo_id,
                'eventId': event_id,
                'filename': filename,
                'originalPath': original_path,
                'processed': False,
                'processingStatus': 'pending'
            }
        finally:
            conn.close()
    
    def update_photo_processing(self, photo_id: int, dorsals: List[int], faces: List[Dict]):
        """Update photo with processing results"""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                UPDATE photos 
                SET detected_dorsals = ?, faces = ?, processed = TRUE, 
                    processing_status = 'completed', processed_at = CURRENT_TIMESTAMP
                WHERE id = ?
            ''', (json.dumps(dorsals), json.dumps(faces), photo_id))
            
            conn.commit()
        finally:
            conn.close()
    
    def search_by_dorsal(self, event_id: int, dorsal_number: int) -> List[Dict]:
        """Search photos by dorsal number"""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT * FROM photos 
                WHERE event_id = ? AND processed = TRUE
            ''', (event_id,))
            
            matching_photos = []
            
            for row in cursor.fetchall():
                if row[6]:  # detected_dorsals column
                    try:
                        dorsals = json.loads(row[6])
                        if dorsal_number in dorsals:
                            photo = {
                                'id': row[0],
                                'eventId': row[1],
                                'filename': row[2],
                                'originalPath': row[3],
                                'webPath': row[4],
                                'thumbnailPath': row[5],
                                'detectedDorsals': dorsals,
                                'faces': json.loads(row[7]) if row[7] else [],
                                'processed': bool(row[8]),
                                'processingStatus': row[9],
                                'uploadedAt': row[10],
                                'processedAt': row[11]
                            }
                            matching_photos.append(photo)
                    except:
                        continue
            
            return matching_photos
        finally:
            conn.close()
    
    def get_pending_photos(self, event_id: int) -> List[int]:
        """Get IDs of photos pending processing"""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT id FROM photos 
                WHERE event_id = ? AND processed = FALSE
            ''', (event_id,))
            
            return [row[0] for row in cursor.fetchall()]
        finally:
            conn.close()


class ProcessingStatsModel:
    def __init__(self, db: Database):
        self.db = db
    
    def update_stats(self, event_id: int, dorsals_count: int, faces_count: int, processing_time: float):
        """Update processing statistics"""
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        try:
            # Check if stats exist
            cursor.execute('SELECT id FROM processing_stats WHERE event_id = ?', (event_id,))
            stats_row = cursor.fetchone()
            
            if stats_row:
                # Update existing stats
                cursor.execute('''
                    UPDATE processing_stats 
                    SET processed_photos = processed_photos + 1,
                        dorsals_detected = dorsals_detected + ?,
                        faces_detected = faces_detected + ?,
                        avg_processing_time = (avg_processing_time + ?) / 2,
                        last_updated = CURRENT_TIMESTAMP
                    WHERE event_id = ?
                ''', (dorsals_count, faces_count, processing_time, event_id))
            else:
                # Create new stats
                cursor.execute('''
                    INSERT INTO processing_stats 
                    (event_id, total_photos, processed_photos, dorsals_detected, faces_detected, avg_processing_time)
                    SELECT ?, COUNT(*), 1, ?, ?, ?
                    FROM photos WHERE event_id = ?
                ''', (event_id, dorsals_count, faces_count, processing_time, event_id))
            
            conn.commit()
        finally:
            conn.close()
