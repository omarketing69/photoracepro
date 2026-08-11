import cv2
import pytesseract
import numpy as np
from PIL import Image
import re
from typing import List, Tuple
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OCRProcessor:
    """
    Advanced OCR processor for detecting dorsal numbers in race photos
    Implements the preprocessing techniques described in the documentation
    """
    
    def __init__(self):
        # OCR configuration optimized for numeric detection
        self.ocr_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=0123456789'
        
        # Valid dorsal range (1-99999 as specified)
        self.min_dorsal = 1
        self.max_dorsal = 99999
    
    def preprocess_image(self, image_path: str) -> np.ndarray:
        """
        Preprocess image for optimal OCR results using advanced techniques
        
        Implements the preprocessing pipeline:
        1. Convert to grayscale
        2. Apply CLAHE for contrast enhancement
        3. Gaussian blur for noise reduction
        4. Adaptive thresholding
        5. Morphological operations for cleanup
        """
        try:
            # Load image
            img = cv2.imread(image_path)
            if img is None:
                logger.error(f"Could not load image: {image_path}")
                return None
            
            # Convert to grayscale
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            
            # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(gray)
            
            # Apply Gaussian blur to reduce noise
            blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)
            
            # Apply adaptive thresholding for binarization
            thresh = cv2.adaptiveThreshold(
                blurred, 
                255, 
                cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 
                11, 
                2
            )
            
            # Apply morphological operations for cleanup
            kernel = np.ones((2, 2), np.uint8)
            cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
            
            # Additional noise removal
            cleaned = cv2.medianBlur(cleaned, 3)
            
            return cleaned
            
        except Exception as e:
            logger.error(f"Error preprocessing image {image_path}: {str(e)}")
            return None
    
    def extract_text_regions(self, processed_img: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Extract potential text regions using contour detection
        """
        try:
            # Find contours
            contours, _ = cv2.findContours(processed_img, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            text_regions = []
            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                
                # Filter regions by size (potential dorsal numbers)
                if 20 <= w <= 200 and 15 <= h <= 100:
                    aspect_ratio = w / h
                    if 0.2 <= aspect_ratio <= 5.0:  # Reasonable aspect ratio for text
                        text_regions.append((x, y, w, h))
            
            return text_regions
            
        except Exception as e:
            logger.error(f"Error extracting text regions: {str(e)}")
            return []
    
    def perform_ocr(self, image: np.ndarray, region: Tuple[int, int, int, int] = None) -> str:
        """
        Perform OCR on image or specific region
        """
        try:
            if region:
                x, y, w, h = region
                roi = image[y:y+h, x:x+w]
            else:
                roi = image
            
            # Resize small regions for better OCR
            if roi.shape[0] < 30 or roi.shape[1] < 30:
                scale_factor = max(30 / roi.shape[0], 30 / roi.shape[1])
                new_width = int(roi.shape[1] * scale_factor)
                new_height = int(roi.shape[0] * scale_factor)
                roi = cv2.resize(roi, (new_width, new_height), interpolation=cv2.INTER_CUBIC)
            
            # Perform OCR
            text = pytesseract.image_to_string(roi, config=self.ocr_config)
            return text.strip()
            
        except Exception as e:
            logger.error(f"Error performing OCR: {str(e)}")
            return ""
    
    def extract_dorsal_numbers(self, text: str) -> List[int]:
        """
        Extract valid dorsal numbers from OCR text
        """
        try:
            # Find all numeric sequences
            numbers = re.findall(r'\b\d+\b', text)
            
            valid_dorsals = []
            for num_str in numbers:
                try:
                    num = int(num_str)
                    if self.min_dorsal <= num <= self.max_dorsal:
                        valid_dorsals.append(num)
                except ValueError:
                    continue
            
            # Remove duplicates while preserving order
            seen = set()
            unique_dorsals = []
            for dorsal in valid_dorsals:
                if dorsal not in seen:
                    seen.add(dorsal)
                    unique_dorsals.append(dorsal)
            
            return unique_dorsals
            
        except Exception as e:
            logger.error(f"Error extracting dorsal numbers: {str(e)}")
            return []
    
    def detect_dorsals(self, image_path: str) -> List[int]:
        """
        Main method to detect dorsal numbers in an image
        
        Returns:
            List of detected dorsal numbers
        """
        try:
            logger.info(f"Processing image for dorsal detection: {image_path}")
            
            # Preprocess image
            processed_img = self.preprocess_image(image_path)
            if processed_img is None:
                return []
            
            # Method 1: OCR on entire image
            full_text = self.perform_ocr(processed_img)
            dorsals_full = self.extract_dorsal_numbers(full_text)
            
            # Method 2: OCR on text regions
            text_regions = self.extract_text_regions(processed_img)
            dorsals_regions = []
            
            for region in text_regions:
                region_text = self.perform_ocr(processed_img, region)
                region_dorsals = self.extract_dorsal_numbers(region_text)
                dorsals_regions.extend(region_dorsals)
            
            # Combine results and remove duplicates
            all_dorsals = dorsals_full + dorsals_regions
            unique_dorsals = []
            seen = set()
            
            for dorsal in all_dorsals:
                if dorsal not in seen:
                    seen.add(dorsal)
                    unique_dorsals.append(dorsal)
            
            logger.info(f"Detected dorsals: {unique_dorsals}")
            return unique_dorsals
            
        except Exception as e:
            logger.error(f"Error detecting dorsals in {image_path}: {str(e)}")
            return []
    
    def get_confidence_score(self, image_path: str, detected_dorsals: List[int]) -> float:
        """
        Calculate confidence score for detected dorsals (0.0 to 1.0)
        """
        try:
            if not detected_dorsals:
                return 0.0
            
            # Load and preprocess image
            processed_img = self.preprocess_image(image_path)
            if processed_img is None:
                return 0.0
            
            # Get OCR data with confidence
            ocr_data = pytesseract.image_to_data(processed_img, config=self.ocr_config, output_type=pytesseract.Output.DICT)
            
            # Calculate average confidence for detected text
            confidences = [int(conf) for conf in ocr_data['conf'] if int(conf) > 0]
            
            if confidences:
                avg_confidence = sum(confidences) / len(confidences)
                return min(avg_confidence / 100.0, 1.0)  # Normalize to 0-1
            
            return 0.5  # Default confidence if no confidence data available
            
        except Exception as e:
            logger.error(f"Error calculating confidence: {str(e)}")
            return 0.5

# Convenience function for direct use
def detect_dorsals_in_image(image_path: str) -> List[int]:
    """
    Convenience function to detect dorsals in an image
    """
    processor = OCRProcessor()
    return processor.detect_dorsals(image_path)

def get_processing_stats(image_path: str) -> dict:
    """
    Get comprehensive processing statistics for an image
    """
    processor = OCRProcessor()
    dorsals = processor.detect_dorsals(image_path)
    confidence = processor.get_confidence_score(image_path, dorsals)
    
    return {
        'detected_dorsals': dorsals,
        'dorsal_count': len(dorsals),
        'confidence_score': confidence,
        'processing_status': 'completed' if dorsals else 'no_dorsals_found'
    }
