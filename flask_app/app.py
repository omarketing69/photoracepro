from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import json
import sqlite3
from datetime import datetime
import cv2
import pytesseract
from PIL import Image
import numpy as np
from pathlib import Path
import threading
import time

app = Flask(__name__)

# CORS allowlist (no open CORS en producción). Orígenes desde env CSV.
_allowed_origins = [o.strip() for o in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",") if o.strip()]
CORS(app, origins=_allowed_origins or False, supports_credentials=True)

# Límite de tamaño de upload (50 MB por request).
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024
# Secret key desde env (no hardcodeado).
app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", os.urandom(32))

# Configuration
UPLOAD_FOLDER = 'uploads'
CLOUD_STORAGE_FOLDER = 'cloud_storage'
DATABASE_PATH = 'race_photos.db'

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(CLOUD_STORAGE_FOLDER, exist_ok=True)
os.makedirs(f'{CLOUD_STORAGE_FOLDER}/events', exist_ok=True)

# Initialize database
def init_db():
    """Initialize SQLite database with required tables"""
    conn = sqlite3.connect(DATABASE_PATH)
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

# OCR Processing Functions
def preprocess_image_for_ocr(image_path):
    """Preprocess image for better OCR results"""
    try:
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            return None
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        
        # Apply Gaussian blur to reduce noise
        blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
        
        # Apply adaptive thresholding
        thresh = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
        )
        
        # Apply morphological operations to clean up
        kernel = np.ones((2,2), np.uint8)
        cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        
        return cleaned
    except Exception as e:
        print(f"Error preprocessing image {image_path}: {str(e)}")
        return None

def detect_dorsals(image_path):
    """Detect dorsal numbers using OCR"""
    try:
        # Preprocess image
        processed_img = preprocess_image_for_ocr(image_path)
        if processed_img is None:
            return []
        
        # Configure Tesseract for numeric detection
        custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789'
        
        # Perform OCR
        text = pytesseract.image_to_string(processed_img, config=custom_config)
        
        # Extract numbers from text
        import re
        numbers = re.findall(r'\b\d+\b', text)
        
        # Filter valid dorsal numbers (typically 1-99999)
        valid_dorsals = []
        for num in numbers:
            dorsal = int(num)
            if 1 <= dorsal <= 99999:
                valid_dorsals.append(dorsal)
        
        # Remove duplicates and return
        return list(set(valid_dorsals))
        
    except Exception as e:
        print(f"Error detecting dorsals in {image_path}: {str(e)}")
        return []

def detect_faces(image_path):
    """Detect faces using OpenCV Haar Cascade"""
    try:
        # Load image
        img = cv2.imread(image_path)
        if img is None:
            return []
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Load Haar Cascade classifier for face detection
        face_cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(face_cascade_path)
        
        # Detect faces
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        
        # Convert to list of dictionaries with coordinates and confidence
        face_list = []
        for (x, y, w, h) in faces:
            face_list.append({
                'x': int(x),
                'y': int(y),
                'width': int(w),
                'height': int(h),
                'confidence': 0.8  # Haar cascades don't provide confidence, using default
            })
        
        return face_list
        
    except Exception as e:
        print(f"Error detecting faces in {image_path}: {str(e)}")
        return []

def process_photo(photo_id):
    """Process a single photo for OCR and face detection"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        # Get photo info
        cursor.execute('SELECT * FROM photos WHERE id = ?', (photo_id,))
        photo = cursor.fetchone()
        
        if not photo:
            return
        
        photo_dict = {
            'id': photo[0],
            'event_id': photo[1],
            'filename': photo[2],
            'original_path': photo[3]
        }
        
        # Update status to processing
        cursor.execute(
            'UPDATE photos SET processing_status = ? WHERE id = ?',
            ('processing', photo_id)
        )
        conn.commit()
        
        # Process image
        start_time = time.time()
        
        dorsals = detect_dorsals(photo_dict['original_path'])
        faces = detect_faces(photo_dict['original_path'])
        
        processing_time = time.time() - start_time
        
        # Update photo with results
        cursor.execute('''
            UPDATE photos 
            SET detected_dorsals = ?, faces = ?, processed = TRUE, 
                processing_status = 'completed', processed_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (json.dumps(dorsals), json.dumps(faces), photo_id))
        
        # Update processing stats
        cursor.execute('''
            SELECT id FROM processing_stats WHERE event_id = ?
        ''', (photo_dict['event_id'],))
        
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
            ''', (len(dorsals), len(faces), processing_time, photo_dict['event_id']))
        else:
            # Create new stats
            cursor.execute('''
                INSERT INTO processing_stats 
                (event_id, total_photos, processed_photos, dorsals_detected, faces_detected, avg_processing_time)
                SELECT ?, COUNT(*), 1, ?, ?, ?
                FROM photos WHERE event_id = ?
            ''', (photo_dict['event_id'], len(dorsals), len(faces), processing_time, photo_dict['event_id']))
        
        conn.commit()
        print(f"Successfully processed photo {photo_id}: {len(dorsals)} dorsals, {len(faces)} faces")
        
    except Exception as e:
        print(f"Error processing photo {photo_id}: {str(e)}")
        # Update status to failed
        cursor.execute(
            'UPDATE photos SET processing_status = ? WHERE id = ?',
            ('failed', photo_id)
        )
        conn.commit()
    
    finally:
        conn.close()

# API Routes
@app.route('/api/dashboard/stats', methods=['GET'])
def get_dashboard_stats():
    """Get dashboard statistics"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        # Count active events
        cursor.execute("SELECT COUNT(*) FROM events WHERE status = 'active'")
        active_events = cursor.fetchone()[0]
        
        # Count processed photos
        cursor.execute("SELECT COUNT(*) FROM photos WHERE processed = TRUE")
        processed_photos = cursor.fetchone()[0]
        
        # Count detected dorsals
        cursor.execute("SELECT detected_dorsals FROM photos WHERE detected_dorsals IS NOT NULL")
        dorsals_data = cursor.fetchall()
        total_dorsals = 0
        for row in dorsals_data:
            try:
                dorsals = json.loads(row[0])
                total_dorsals += len(dorsals)
            except:
                continue
        
        return jsonify({
            'activeEvents': 12,  # Mock data as requested
            'processedPhotos': 45672,
            'detectedDorsals': 8945,
            'monthlySales': '€2,847'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/events', methods=['GET'])
def get_events():
    """Get all events with stats"""
    conn = sqlite3.connect(DATABASE_PATH)
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
                'participantCount': 0  # Could be calculated from participants table
            }
            
            # Add processing stats if available
            if row[9] is not None:  # total_photos exists
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
        
        return jsonify(events)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/events', methods=['POST'])
def create_event():
    """Create new event"""
    data = request.get_json()
    
    if not all(key in data for key in ['name', 'date', 'location', 'expectedParticipants']):
        return jsonify({'error': 'Missing required fields'}), 400
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO events (name, date, location, expected_participants, status)
            VALUES (?, ?, ?, ?, ?)
        ''', (data['name'], data['date'], data['location'], 
              data['expectedParticipants'], data.get('status', 'active')))
        
        event_id = cursor.lastrowid
        conn.commit()
        
# Create cloud storage directory for event (sanitize name)
    safe_name = secure_filename(data['name']) or f"event_{event_id}"
    event_dir = f"{CLOUD_STORAGE_FOLDER}/events/evento_{event_id}_{safe_name}"
    os.makedirs(f"{event_dir}/originales", exist_ok=True)
    os.makedirs(f"{event_dir}/web", exist_ok=True)
    os.makedirs(f"{event_dir}/thumbnails", exist_ok=True)
    os.makedirs(f"{event_dir}/participantes", exist_ok=True)
        
        # Return created event
        cursor.execute('SELECT * FROM events WHERE id = ?', (event_id,))
        row = cursor.fetchone()
        
        event = {
            'id': row[0],
            'name': row[1],
            'date': row[2],
            'location': row[3],
            'expectedParticipants': row[4],
            'status': row[5],
            'createdAt': row[6],
            'updatedAt': row[7]
        }
        
        return jsonify(event), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/events/<int:event_id>/photos/upload', methods=['POST'])
def upload_photos(event_id):
    """Upload photos for an event"""
    if 'photos' not in request.files:
        return jsonify({'error': 'No photos provided'}), 400
    
    files = request.files.getlist('photos')
    if not files:
        return jsonify({'error': 'No photos provided'}), 400
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    uploaded_photos = []
    
    try:
        for file in files:
            if file and file.filename:
                # Save file (secure_filename previene path traversal: ../../etc/passwd)
                filename = secure_filename(file.filename)
                if not filename:
                    filename = f"upload_{int(time.time()*1000)}.jpg"
                file_path = os.path.join(UPLOAD_FOLDER, filename)
                file.save(file_path)
                
                # Insert into database
                cursor.execute('''
                    INSERT INTO photos (event_id, filename, original_path, processed, processing_status)
                    VALUES (?, ?, ?, FALSE, 'pending')
                ''', (event_id, filename, file_path))
                
                photo_id = cursor.lastrowid
                uploaded_photos.append({
                    'id': photo_id,
                    'filename': filename,
                    'original_path': file_path
                })
        
        conn.commit()
        
        # Start processing in background
        for photo in uploaded_photos:
            threading.Thread(target=process_photo, args=(photo['id'],)).start()
        
        return jsonify({
            'message': f'Successfully uploaded {len(uploaded_photos)} photos',
            'photos': uploaded_photos
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/photos/search', methods=['GET'])
def search_photos():
    """Search photos by dorsal number"""
    event_id = request.args.get('eventId')
    dorsal_number = request.args.get('dorsalNumber')
    
    if not event_id or not dorsal_number:
        return jsonify({'error': 'eventId and dorsalNumber are required'}), 400
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            SELECT * FROM photos 
            WHERE event_id = ? AND processed = TRUE
        ''', (event_id,))
        
        matching_photos = []
        dorsal_num = int(dorsal_number)
        
        for row in cursor.fetchall():
            if row[5]:  # detected_dorsals column
                try:
                    dorsals = json.loads(row[5])
                    if dorsal_num in dorsals:
                        photo = {
                            'id': row[0],
                            'eventId': row[1],
                            'filename': row[2],
                            'originalPath': row[3],
                            'webPath': row[4],
                            'thumbnailPath': row[5],
                            'detectedDorsals': dorsals,
                            'faces': json.loads(row[6]) if row[6] else [],
                            'processed': bool(row[7]),
                            'processingStatus': row[8],
                            'uploadedAt': row[9],
                            'processedAt': row[10]
                        }
                        matching_photos.append(photo)
                except:
                    continue
        
        return jsonify({
            'photos': matching_photos,
            'dorsalNumber': dorsal_num,
            'totalFound': len(matching_photos)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/events/<int:event_id>/process', methods=['POST'])
def process_event_photos(event_id):
    """Process all pending photos for an event"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    try:
        # Get pending photos
        cursor.execute('''
            SELECT id FROM photos 
            WHERE event_id = ? AND processed = FALSE
        ''', (event_id,))
        
        photo_ids = [row[0] for row in cursor.fetchall()]
        
        # Start processing in background
        for photo_id in photo_ids:
            threading.Thread(target=process_photo, args=(photo_id,)).start()
        
        return jsonify({
            'message': f'Started processing {len(photo_ids)} photos',
            'processedCount': len(photo_ids)
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    init_db()
    # Debug=True + 0.0.0.0 habilita el debugger de Werkzeug → RCE. Lo desactivamos.
    debug = os.environ.get("FLASK_DEBUG", "0") == "1"
    host = os.environ.get("FLASK_HOST", "127.0.0.1")
    port = int(os.environ.get("FLASK_PORT", "8000"))
    app.run(host=host, port=port, debug=debug)
