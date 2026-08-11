import cv2
import numpy as np
from typing import List, Dict, Tuple
import logging
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FaceDetector:
    """
    Face detection system using OpenCV Haar Cascades
    Implements the face detection techniques described in the documentation
    """
    
    def __init__(self):
        # Load Haar Cascade classifiers
        self.face_cascade = self._load_cascade('haarcascade_frontalface_default.xml')
        self.profile_cascade = self._load_cascade('haarcascade_profileface.xml')
        
        # Detection parameters
        self.scale_factor = 1.1
        self.min_neighbors = 5
        self.min_size = (30, 30)
        self.max_size = (300, 300)
    
    def _load_cascade(self, cascade_name: str):
        """Load Haar Cascade classifier"""
        try:
            cascade_path = cv2.data.haarcascades + cascade_name
            cascade = cv2.CascadeClassifier(cascade_path)
            
            if cascade.empty():
                logger.error(f"Failed to load cascade: {cascade_name}")
                return None
            
            return cascade
        except Exception as e:
            logger.error(f"Error loading cascade {cascade_name}: {str(e)}")
            return None
    
    def preprocess_image(self, image_path: str) -> Tuple[np.ndarray, np.ndarray]:
        """
        Preprocess image for face detection
        
        Returns:
            Tuple of (original_image, grayscale_image)
        """
        try:
            # Load image
            img = cv2.imread(image_path)
            if img is None:
                logger.error(f"Could not load image: {image_path}")
                return None, None
            
            # Convert to grayscale for detection
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Apply histogram equalization for better contrast
            gray = cv2.equalizeHist(gray)
            
            return img, gray
            
        except Exception as e:
            logger.error(f"Error preprocessing image {image_path}: {str(e)}")
            return None, None
    
    def detect_frontal_faces(self, gray_image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detect frontal faces using Haar Cascade
        """
        try:
            if self.face_cascade is None:
                return []
            
            faces = self.face_cascade.detectMultiScale(
                gray_image,
                scaleFactor=self.scale_factor,
                minNeighbors=self.min_neighbors,
                minSize=self.min_size,
                maxSize=self.max_size,
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            return faces.tolist() if len(faces) > 0 else []
            
        except Exception as e:
            logger.error(f"Error detecting frontal faces: {str(e)}")
            return []
    
    def detect_profile_faces(self, gray_image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detect profile faces using Haar Cascade
        """
        try:
            if self.profile_cascade is None:
                return []
            
            # Detect profile faces (left side)
            profiles = self.profile_cascade.detectMultiScale(
                gray_image,
                scaleFactor=self.scale_factor,
                minNeighbors=self.min_neighbors,
                minSize=self.min_size,
                maxSize=self.max_size,
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            # Flip image and detect profile faces (right side)
            flipped = cv2.flip(gray_image, 1)
            profiles_flipped = self.profile_cascade.detectMultiScale(
                flipped,
                scaleFactor=self.scale_factor,
                minNeighbors=self.min_neighbors,
                minSize=self.min_size,
                maxSize=self.max_size,
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            # Convert flipped coordinates back to original orientation
            width = gray_image.shape[1]
            profiles_right = []
            for (x, y, w, h) in profiles_flipped:
                # Flip x coordinate back
                x_orig = width - x - w
                profiles_right.append((x_orig, y, w, h))
            
            # Combine left and right profile detections
            all_profiles = profiles.tolist() if len(profiles) > 0 else []
            all_profiles.extend(profiles_right)
            
            return all_profiles
            
        except Exception as e:
            logger.error(f"Error detecting profile faces: {str(e)}")
            return []
    
    def calculate_face_confidence(self, face_region: np.ndarray) -> float:
        """
        Calculate confidence score for detected face based on image quality
        """
        try:
            if face_region is None or face_region.size == 0:
                return 0.0
            
            # Calculate various quality metrics
            
            # 1. Contrast (standard deviation of pixel intensities)
            contrast = np.std(face_region)
            contrast_score = min(contrast / 50.0, 1.0)  # Normalize
            
            # 2. Sharpness (Laplacian variance)
            laplacian_var = cv2.Laplacian(face_region, cv2.CV_64F).var()
            sharpness_score = min(laplacian_var / 100.0, 1.0)  # Normalize
            
            # 3. Size score (larger faces generally more reliable)
            size_score = min(face_region.shape[0] * face_region.shape[1] / (100 * 100), 1.0)
            
            # Weighted combination
            confidence = (0.4 * contrast_score + 0.4 * sharpness_score + 0.2 * size_score)
            
            return min(max(confidence, 0.0), 1.0)  # Clamp to [0, 1]
            
        except Exception as e:
            logger.error(f"Error calculating face confidence: {str(e)}")
            return 0.5  # Default confidence
    
    def filter_overlapping_faces(self, faces: List[Tuple[int, int, int, int]], overlap_threshold: float = 0.3) -> List[Tuple[int, int, int, int]]:
        """
        Remove overlapping face detections, keeping the larger ones
        """
        try:
            if len(faces) <= 1:
                return faces
            
            # Convert to list of rectangles with areas
            rects = []
            for i, (x, y, w, h) in enumerate(faces):
                rects.append({
                    'index': i,
                    'x': x, 'y': y, 'w': w, 'h': h,
                    'area': w * h
                })
            
            # Sort by area (largest first)
            rects.sort(key=lambda r: r['area'], reverse=True)
            
            filtered_faces = []
            used_indices = set()
            
            for rect in rects:
                if rect['index'] in used_indices:
                    continue
                
                # Check for overlap with already selected faces
                overlaps = False
                for selected_face in filtered_faces:
                    if self._rectangles_overlap(rect, selected_face, overlap_threshold):
                        overlaps = True
                        break
                
                if not overlaps:
                    filtered_faces.append((rect['x'], rect['y'], rect['w'], rect['h']))
                    used_indices.add(rect['index'])
            
            return filtered_faces
            
        except Exception as e:
            logger.error(f"Error filtering overlapping faces: {str(e)}")
            return faces  # Return original if filtering fails
    
    def _rectangles_overlap(self, rect1: Dict, rect2: Tuple[int, int, int, int], threshold: float) -> bool:
        """
        Check if two rectangles overlap more than threshold
        """
        try:
            x1, y1, w1, h1 = rect1['x'], rect1['y'], rect1['w'], rect1['h']
            x2, y2, w2, h2 = rect2
            
            # Calculate intersection
            x_left = max(x1, x2)
            y_top = max(y1, y2)
            x_right = min(x1 + w1, x2 + w2)
            y_bottom = min(y1 + h1, y2 + h2)
            
            if x_right <= x_left or y_bottom <= y_top:
                return False  # No intersection
            
            intersection_area = (x_right - x_left) * (y_bottom - y_top)
            
            # Calculate union
            area1 = w1 * h1
            area2 = w2 * h2
            union_area = area1 + area2 - intersection_area
            
            # Calculate overlap ratio
            overlap_ratio = intersection_area / union_area if union_area > 0 else 0
            
            return overlap_ratio > threshold
            
        except Exception as e:
            logger.error(f"Error checking rectangle overlap: {str(e)}")
            return False
    
    def detect_faces(self, image_path: str) -> List[Dict]:
        """
        Main method to detect faces in an image
        
        Returns:
            List of face dictionaries with coordinates and confidence
        """
        try:
            logger.info(f"Processing image for face detection: {image_path}")
            
            # Preprocess image
            img, gray = self.preprocess_image(image_path)
            if img is None or gray is None:
                return []
            
            # Detect frontal faces
            frontal_faces = self.detect_frontal_faces(gray)
            
            # Detect profile faces
            profile_faces = self.detect_profile_faces(gray)
            
            # Combine all detections
            all_faces = frontal_faces + profile_faces
            
            # Filter overlapping faces
            filtered_faces = self.filter_overlapping_faces(all_faces)
            
            # Convert to required format with confidence scores
            face_list = []
            for (x, y, w, h) in filtered_faces:
                # Extract face region for confidence calculation
                face_region = gray[y:y+h, x:x+w]
                confidence = self.calculate_face_confidence(face_region)
                
                face_dict = {
                    'x': int(x),
                    'y': int(y),
                    'width': int(w),
                    'height': int(h),
                    'confidence': float(confidence)
                }
                face_list.append(face_dict)
            
            logger.info(f"Detected {len(face_list)} faces")
            return face_list
            
        except Exception as e:
            logger.error(f"Error detecting faces in {image_path}: {str(e)}")
            return []
    
    def get_face_statistics(self, image_path: str) -> Dict:
        """
        Get comprehensive face detection statistics
        """
        try:
            faces = self.detect_faces(image_path)
            
            if not faces:
                return {
                    'face_count': 0,
                    'avg_confidence': 0.0,
                    'max_confidence': 0.0,
                    'min_confidence': 0.0,
                    'faces': []
                }
            
            confidences = [face['confidence'] for face in faces]
            
            return {
                'face_count': len(faces),
                'avg_confidence': sum(confidences) / len(confidences),
                'max_confidence': max(confidences),
                'min_confidence': min(confidences),
                'faces': faces
            }
            
        except Exception as e:
            logger.error(f"Error getting face statistics: {str(e)}")
            return {
                'face_count': 0,
                'avg_confidence': 0.0,
                'max_confidence': 0.0,
                'min_confidence': 0.0,
                'faces': []
            }

# Convenience functions
def detect_faces_in_image(image_path: str) -> List[Dict]:
    """
    Convenience function to detect faces in an image
    """
    detector = FaceDetector()
    return detector.detect_faces(image_path)

def get_face_detection_stats(image_path: str) -> Dict:
    """
    Get comprehensive face detection statistics for an image
    """
    detector = FaceDetector()
    return detector.get_face_statistics(image_path)
