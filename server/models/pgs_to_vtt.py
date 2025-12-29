#!/usr/bin/env python3
"""
PGS to VTT Converter
Converts PGS (Presentation Graphic Stream) subtitle tracks from MKV files to WebVTT format.
Uses ffmpeg to extract PGS subtitles and OCR to convert images to text.
"""

import sys
import os
import subprocess
import tempfile
import shutil
from pathlib import Path
import argparse
from typing import List, Tuple, Optional

try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    print("Warning: pytesseract and/or PIL not available. OCR functionality disabled.")
    print("Install with: pip install pytesseract pillow")

# Configuration
VIDEOS_DIR = "/media/connorwoodford/F898C32498C2DFEC/Videos"
SUBTITLES_DIR = "/media/connorwoodford/F898C32498C2DFEC/subtitles"
FFMPEG_PATH = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE_PATH = shutil.which("ffprobe") or "ffprobe"


def find_mkv_file(movie_title: str) -> Optional[str]:
    """Find the MKV file matching the movie title."""
    videos_path = Path(VIDEOS_DIR)
    if not videos_path.exists():
        print(f"Error: Videos directory not found: {VIDEOS_DIR}")
        return None
    
    # Try exact match first
    mkv_file = videos_path / f"{movie_title}.mkv"
    if mkv_file.exists():
        return str(mkv_file)
    
    # Try case-insensitive search
    for file in videos_path.glob("*.mkv"):
        if file.stem.lower() == movie_title.lower():
            return str(file)
    
    # Try partial match
    for file in videos_path.glob("*.mkv"):
        if movie_title.lower() in file.stem.lower() or file.stem.lower() in movie_title.lower():
            return str(file)
    
    print(f"Error: Could not find MKV file for '{movie_title}'")
    return None


def get_subtitle_stream_index(mkv_file: str, language: str = "eng") -> Optional[int]:
    """Get the subtitle stream index for the specified language."""
    try:
        cmd = [
            FFPROBE_PATH,
            "-v", "error",
            "-select_streams", "s",
            "-show_entries", "stream=index:stream_tags=language",
            "-of", "json",
            mkv_file
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        import json
        data = json.loads(result.stdout)
        
        for stream in data.get("streams", []):
            tags = stream.get("tags", {})
            if tags.get("language", "").lower() == language.lower():
                return stream.get("index")
        
        # If no language match, return first subtitle stream
        if data.get("streams"):
            return data["streams"][0].get("index")
        
        return None
    except Exception as e:
        print(f"Error getting subtitle stream index: {e}")
        return None


def extract_pgs_simple(mkv_file: str, stream_index: int, output_dir: str) -> List[Tuple[float, float, str]]:
    """
    Extract PGS subtitles by converting them to images using ffmpeg's pgssub decoder.
    PGS subtitles are already images, so we extract them directly.
    Returns list of (start_time, end_time, image_path) tuples.
    """
    subtitle_entries = []
    
    try:
        # Step 1: Extract PGS to SUP file first (for reference)
        sup_file = os.path.join(output_dir, "subtitles.sup")
        cmd_extract = [
            FFMPEG_PATH,
            "-i", mkv_file,
            "-map", f"0:s:{stream_index}",
            "-c", "copy",
            "-y",
            sup_file
        ]
        
        print(f"Extracting PGS stream to SUP file...")
        extract_result = subprocess.run(cmd_extract, capture_output=True, text=True, check=True)
        
        # Step 2: Get subtitle timing information using ffprobe
        # PGS subtitles have timing embedded, we need to extract it
        cmd_timing = [
            FFPROBE_PATH,
            "-i", mkv_file,
            "-select_streams", f"s:{stream_index}",
            "-show_entries", "packet=pts_time,duration_time",
            "-of", "csv=p=0",
            "-v", "quiet"
        ]
        
        print(f"Extracting subtitle timing information...")
        timing_result = subprocess.run(cmd_timing, capture_output=True, text=True, check=True)
        
        # Parse timing information
        # Format: pts_time,duration_time (one per line)
        timings = []
        for line in timing_result.stdout.strip().split('\n'):
            if line and ',' in line:
                parts = line.split(',')
                if len(parts) >= 2:
                    try:
                        pts = float(parts[0])
                        duration = float(parts[1]) if parts[1] else 0.0
                        timings.append((pts, duration))
                    except ValueError:
                        continue
        
        print(f"Found {len(timings)} subtitle packets")
        
        # Step 3: Extract PGS subtitle images
        # Use ffmpeg to decode PGS subtitles as images
        # PGS decoder outputs images directly
        frame_pattern = os.path.join(output_dir, "sub_%06d.png")
        
        cmd_decode = [
            FFMPEG_PATH,
            "-i", mkv_file,
            "-map", f"0:s:{stream_index}",
            "-vsync", "0",
            "-f", "image2",
            frame_pattern
        ]
        
        print(f"Decoding PGS subtitle images...")
        decode_result = subprocess.run(cmd_decode, capture_output=True, text=True)
        
        if decode_result.returncode != 0:
            print(f"Warning: ffmpeg decode returned code {decode_result.returncode}")
            print(f"stderr: {decode_result.stderr[:500]}")
            # Try alternative: extract frames with explicit codec
            print("Trying alternative decode method...")
            cmd_decode_alt = [
                FFMPEG_PATH,
                "-i", sup_file,
                "-vsync", "0",
                "-f", "image2",
                frame_pattern
            ]
            decode_result = subprocess.run(cmd_decode_alt, capture_output=True, text=True)
            if decode_result.returncode != 0:
                print(f"Alternative decode also failed: {decode_result.stderr[:500]}")
                return []
        
        # Step 4: Match extracted frames with timing information
        frame_files = sorted([
            os.path.join(output_dir, f) 
            for f in os.listdir(output_dir) 
            if f.startswith("sub_") and f.endswith(".png")
        ], key=lambda x: int(os.path.basename(x).replace("sub_", "").replace(".png", "")))
        
        if not frame_files:
            print("Warning: No subtitle frames generated")
            return []
        
        print(f"Found {len(frame_files)} subtitle frames and {len(timings)} timing entries")
        
        # Match frames with timing information
        # Each frame corresponds to a subtitle packet with timing
        for i, (pts, duration) in enumerate(timings):
            if i < len(frame_files):
                frame_file = frame_files[i]
                start_time = pts
                end_time = pts + duration if duration > 0 else pts + 3.0  # Default 3 seconds if no duration
                
                # Verify frame has content
                try:
                    if OCR_AVAILABLE:
                        img = Image.open(frame_file)
                        if img.mode != "L":
                            gray = img.convert("L")
                        else:
                            gray = img
                        pixels = list(gray.getdata())
                        has_content = any(pixel > 30 for pixel in pixels)
                    else:
                        # If OCR not available, assume all extracted frames have content
                        has_content = True
                    
                    if has_content:
                        subtitle_entries.append((start_time, end_time, frame_file))
                except Exception as e:
                    print(f"Error processing frame {frame_file}: {e}")
                    continue
        
        # If we don't have timing info, fall back to frame-based detection
        if not subtitle_entries and frame_files:
            print("No timing information available, using frame-based detection...")
            # Get video FPS for timestamp calculation
            cmd_fps = [
                FFPROBE_PATH,
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "stream=r_frame_rate",
                "-of", "default=noprint_wrappers=1:nokey=1",
                mkv_file
            ]
            
            fps_result = subprocess.run(cmd_fps, capture_output=True, text=True, check=True)
            fps_str = fps_result.stdout.strip()
            if "/" in fps_str:
                num, den = map(int, fps_str.split("/"))
                fps = num / den if den > 0 else 30.0
            else:
                fps = float(fps_str) if fps_str else 30.0
            
            # Group consecutive frames with subtitles
            prev_has_subtitle = False
            current_start = 0.0
            current_end = 0.0
            current_image = None
            
            for frame_file in frame_files:
                frame_num = int(os.path.basename(frame_file).replace("sub_", "").replace(".png", ""))
                timestamp = frame_num / fps
                
                # Check if frame has subtitle content
                try:
                    if OCR_AVAILABLE:
                        img = Image.open(frame_file)
                        if img.mode != "L":
                            gray = img.convert("L")
                        else:
                            gray = img
                        pixels = list(gray.getdata())
                        has_content = any(pixel > 30 for pixel in pixels)
                    else:
                        has_content = True  # Assume all frames have content if OCR not available
                    
                    if has_content:
                        if not prev_has_subtitle:
                            current_start = timestamp
                            current_image = frame_file
                        else:
                            current_end = timestamp
                        prev_has_subtitle = True
                    else:
                        if prev_has_subtitle:
                            current_end = timestamp
                            if current_image:
                                subtitle_entries.append((current_start, current_end, current_image))
                            prev_has_subtitle = False
                except Exception as e:
                    print(f"Error processing frame {frame_file}: {e}")
                    continue
            
            # Handle last subtitle
            if prev_has_subtitle and current_image:
                if subtitle_entries:
                    avg_duration = sum(end - start for start, end, _ in subtitle_entries) / len(subtitle_entries)
                    current_end = current_start + avg_duration
                else:
                    current_end = current_start + 3.0
                subtitle_entries.append((current_start, current_end, current_image))
        
    except subprocess.CalledProcessError as e:
        print(f"Error in subtitle extraction: {e}")
        if e.stderr:
            print(f"stderr: {e.stderr.decode()}")
        return []
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return []
    
    return subtitle_entries




def ocr_image(image_path: str) -> str:
    """Extract text from subtitle image using OCR."""
    if not OCR_AVAILABLE:
        # Return placeholder if OCR not available
        return "[Subtitle text - OCR not available]"
    
    try:
        image = Image.open(image_path)
        # Preprocess image for better OCR
        # Convert to grayscale if needed
        if image.mode != "L":
            image = image.convert("L")
        
        # Enhance contrast for better OCR
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)
        
        # Use pytesseract to extract text
        text = pytesseract.image_to_string(image, config="--psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:'\"-()[]{} ")
        return text.strip()
    except Exception as e:
        print(f"Error in OCR for {image_path}: {e}")
        return "[OCR Error]"


def format_vtt_time(seconds: float) -> str:
    """Convert seconds to VTT time format (HH:MM:SS.mmm)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def create_vtt_file(subtitle_entries: List[Tuple[float, float, str]], output_path: str) -> bool:
    """Create VTT file from subtitle entries."""
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("WEBVTT\n\n")
            
            for i, (start_time, end_time, image_path) in enumerate(subtitle_entries, 1):
                # Perform OCR on the image
                text = ocr_image(image_path)
                
                if text:  # Only write non-empty subtitles
                    f.write(f"{i}\n")
                    f.write(f"{format_vtt_time(start_time)} --> {format_vtt_time(end_time)}\n")
                    f.write(f"{text}\n\n")
        
        return True
    except Exception as e:
        print(f"Error creating VTT file: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Convert PGS subtitles from MKV to VTT format")
    parser.add_argument("movie_title", help="Movie title (filename without extension)")
    parser.add_argument("stream_index", type=int, nargs="?", help="Subtitle stream index (optional, will auto-detect if not provided)")
    parser.add_argument("--language", default="eng", help="Subtitle language code (default: eng)")
    parser.add_argument("--output-dir", default=SUBTITLES_DIR, help=f"Output directory for VTT files (default: {SUBTITLES_DIR})")
    
    args = parser.parse_args()
    
    # Find MKV file
    mkv_file = find_mkv_file(args.movie_title)
    if not mkv_file:
        sys.exit(1)
    
    print(f"Found MKV file: {mkv_file}")
    
    # Get subtitle stream index if not provided
    stream_index = args.stream_index
    if stream_index is None:
        stream_index = get_subtitle_stream_index(mkv_file, args.language)
        if stream_index is None:
            print(f"Error: Could not find subtitle stream for language '{args.language}'")
            sys.exit(1)
    
    print(f"Using subtitle stream index: {stream_index}")
    
    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Create temporary directory for processing
    with tempfile.TemporaryDirectory() as temp_dir:
        print(f"Extracting PGS subtitles to temporary directory...")
        
        # Extract PGS subtitles with timestamps
        subtitle_entries = extract_pgs_simple(mkv_file, stream_index, temp_dir)
        
        if not subtitle_entries:
            print("Error: No subtitle entries extracted")
            sys.exit(1)
        
        print(f"Extracted {len(subtitle_entries)} subtitle entries")
        
        # Create output VTT file path
        output_file = os.path.join(args.output_dir, f"{args.movie_title}.vtt")
        
        # Convert to VTT
        print(f"Converting to VTT format...")
        if create_vtt_file(subtitle_entries, output_file):
            print(f"Successfully created VTT file: {output_file}")
            # Print VTT content to stdout for Node.js to capture
            with open(output_file, "r", encoding="utf-8") as f:
                print(f.read())
        else:
            print("Error: Failed to create VTT file")
            sys.exit(1)


if __name__ == "__main__":
    main()

