#!/usr/bin/env python3
"""
Simplified PGS to VTT Converter
This version uses ffmpeg to extract timing and attempts to use available tools.
If pgsrip or bdsub2srt are available, it will use those. Otherwise, it provides
a basic framework that can be extended.
"""

import sys
import os
import subprocess
import tempfile
import shutil
from pathlib import Path
import argparse
from typing import List, Tuple, Optional
import time
import threading

# Check for OCR dependencies
try:
    import pytesseract
    from PIL import Image
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

# Configuration
VIDEOS_DIR = "/mnt/F898C32498C2DFEC/Videos"
SUBTITLES_DIR = "/mnt/F898C32498C2DFEC/subtitles"
FFMPEG_PATH = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE_PATH = shutil.which("ffprobe") or "ffprobe"
# Check if pgsrip is available
try:
    result = subprocess.run(["python3", "-m", "pgsrip", "--help"], capture_output=True, text=True, timeout=5)
    PGSRIP_AVAILABLE = result.returncode == 0
except:
    PGSRIP_AVAILABLE = False


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


def format_vtt_time(seconds: float) -> str:
    """Convert seconds to VTT time format (HH:MM:SS.mmm)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def convert_srt_to_vtt(srt_path: str, vtt_path: str) -> bool:
    """Convert SRT subtitle file to VTT format."""
    try:
        with open(srt_path, "r", encoding="utf-8") as srt_file:
            srt_content = srt_file.read()
        
        with open(vtt_path, "w", encoding="utf-8") as vtt_file:
            vtt_file.write("WEBVTT\n\n")
            
            # SRT format: sequence number, timecode, text, blank line
            # VTT format: sequence number (optional), timecode (with . instead of ,), text, blank line
            lines = srt_content.split('\n')
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                
                # Skip empty lines
                if not line:
                    i += 1
                    continue
                
                # Check if it's a sequence number (just digits)
                if line.isdigit():
                    # Next line should be timecode
                    if i + 1 < len(lines):
                        timecode = lines[i + 1].strip()
                        # Convert SRT timecode (00:00:00,000 --> 00:00:00,000) to VTT (00:00:00.000 --> 00:00:00.000)
                        timecode = timecode.replace(',', '.')
                        
                        # Collect text lines until blank line
                        text_lines = []
                        i += 2
                        while i < len(lines) and lines[i].strip():
                            text_lines.append(lines[i].strip())
                            i += 1
                        
                        if text_lines:
                            # Write in VTT format: timecode first, then text
                            vtt_file.write(f"{timecode}\n")
                            vtt_file.write(f"{' '.join(text_lines)}\n")
                            vtt_file.write("\n")
                i += 1
        
        return True
    except Exception as e:
        print(f"Error converting SRT to VTT: {e}", file=sys.stderr)
        return False


def get_subtitle_count(mkv_file: str, stream_index: Optional[int] = None) -> int:
    """Get the total number of subtitle packets in the file."""
    try:
        if stream_index is None:
            # Get first subtitle stream
            cmd = [
                FFPROBE_PATH,
                "-v", "error",
                "-select_streams", "s",
                "-show_entries", "packet=pts_time",
                "-of", "csv=p=0",
                mkv_file
            ]
        else:
            cmd = [
                FFPROBE_PATH,
                "-v", "error",
                "-select_streams", f"{stream_index}",
                "-show_entries", "packet=pts_time",
                "-of", "csv=p=0",
                mkv_file
            ]
        
        # Add timeout to prevent hanging
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=30)
        count = len([line for line in result.stdout.strip().split('\n') if line.strip()])
        return count
    except subprocess.TimeoutExpired:
        print(f"Warning: get_subtitle_count timed out", file=sys.stderr)
        return 0
    except Exception as e:
        print(f"Warning: Could not get subtitle count: {e}", file=sys.stderr)
        return 0


def extract_pgs_with_pgsrip(mkv_file: str, language: str, output_dir: str, movie_title: str, stream_index: Optional[int] = None) -> Optional[str]:
    """Extract PGS subtitles using pgsrip and convert to VTT."""
    if not PGSRIP_AVAILABLE:
        return None
    
    try:
        # pgsrip extracts to the same directory as the MKV file
        mkv_dir = os.path.dirname(mkv_file)
        mkv_name = os.path.splitext(os.path.basename(mkv_file))[0]
        
        # Expected SRT file path
        lang_code = "en" if language == "eng" else language[:2]
        srt_file = os.path.join(mkv_dir, f"{mkv_name}.{lang_code}.srt")
        
        # Get total subtitle count for progress tracking (with timeout - non-blocking)
        # Run this in background to avoid blocking pgsrip
        import threading
        total_count = [0]  # Use list for mutable reference
        
        def get_count():
            try:
                count = get_subtitle_count(mkv_file, stream_index)
                total_count[0] = count
                if count > 0:
                    print(f"PROGRESS:total:{count}", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"Warning: Could not get subtitle count: {e}", file=sys.stderr)
        
        count_thread = threading.Thread(target=get_count, daemon=True)
        count_thread.start()
        
        # Run pgsrip with real-time output streaming
        print(f"Using pgsrip to extract PGS subtitles...", file=sys.stderr, flush=True)
        print(f"PROGRESS:stage:collecting", file=sys.stderr, flush=True)
        print(f"DEBUG: Starting pgsrip for {mkv_file} with language {lang_code}", file=sys.stderr, flush=True)
        
        cmd = [
            "python3", "-m", "pgsrip",
            mkv_file,
            "-l", lang_code,
            "-f",  # Force re-rip if exists
            "-v"  # Verbose output for debugging
        ]
        
        print(f"DEBUG: Command: {' '.join(cmd)}", file=sys.stderr, flush=True)
        
        # Start process with streaming output
        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,  # Line buffered
                universal_newlines=True
            )
            print(f"DEBUG: Process started with PID {process.pid}", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"ERROR: Failed to start pgsrip process: {e}", file=sys.stderr, flush=True)
            return None
        
        # Use threading to read output and provide heartbeat during long OCR operations
        output_lines = []
        output_lock = threading.Lock()
        last_output_time = [time.time()]
        ripping_started = [False]
        
        def read_output():
            """Read process output in a separate thread."""
            try:
                for line in iter(process.stdout.readline, ''):
                    line = line.rstrip()
                    if line:
                        last_output_time[0] = time.time()
                        with output_lock:
                            output_lines.append(line)
                        # Filter out warnings and show only meaningful progress
                        if ("UserWarning" not in line and 
                            "click" not in line.lower() and
                            "parser" not in line.lower() and
                            "parse_args" not in line.lower() and
                            "make_parser" not in line.lower()):
                            # Show progress messages with clear prefix
                            if any(keyword in line.lower() for keyword in ["collecting", "ripping", "subtitle", "file"]):
                                print(f"[pgsrip] {line}", file=sys.stderr, flush=True)
                                # Update progress based on stage
                                if "collecting" in line.lower() and "collected" in line.lower():
                                    print(f"PROGRESS:stage:ripping", file=sys.stderr, flush=True)
                                    ripping_started[0] = True
                                elif "ripped" in line.lower():
                                    print(f"PROGRESS:stage:converting", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"Error in output reader thread: {e}", file=sys.stderr)
        
        def heartbeat():
            """Send periodic heartbeat during long OCR operations."""
            start_time = time.time()
            while True:
                time.sleep(15)  # Every 15 seconds
                process_status = process.poll()
                if ripping_started[0] and process_status is None:
                    # Process is still running and we're in ripping phase
                    elapsed = int(time.time() - last_output_time[0])
                    total_elapsed = int(time.time() - start_time)
                    if elapsed > 10:  # No output for 10+ seconds
                        # Check if process is actually using CPU
                        try:
                            import psutil
                            proc = psutil.Process(process.pid)
                            cpu_percent = proc.cpu_percent(interval=0.1)
                            memory_mb = proc.memory_info().rss / 1024 / 1024
                            print(f"PROGRESS:heartbeat:OCR in progress (processing for {total_elapsed}s, CPU: {cpu_percent:.1f}%, RAM: {memory_mb:.1f}MB, no output for {elapsed}s)", file=sys.stderr, flush=True)
                        except:
                            print(f"PROGRESS:heartbeat:OCR in progress (processing for {total_elapsed}s, no output for {elapsed}s)", file=sys.stderr, flush=True)
                elif process_status is not None:
                    # Process finished, exit heartbeat
                    break
                else:
                    # Process not started ripping yet, but still running
                    total_elapsed = int(time.time() - start_time)
                    if total_elapsed > 30:
                        print(f"PROGRESS:heartbeat:Waiting for pgsrip to start (running for {total_elapsed}s)", file=sys.stderr, flush=True)
        
        # Start output reader thread
        reader_thread = threading.Thread(target=read_output, daemon=True)
        reader_thread.start()
        
        # Start heartbeat thread for long operations
        heartbeat_thread = threading.Thread(target=heartbeat, daemon=True)
        heartbeat_thread.start()
        
        # Wait for process to complete with timeout, but check periodically
        print(f"DEBUG: Waiting for pgsrip process to complete...", file=sys.stderr, flush=True)
        start_wait = time.time()
        max_wait = 7200  # 2 hours
        
        try:
            while True:
                # Check if process is done
                return_code = process.poll()
                if return_code is not None:
                    print(f"DEBUG: Process completed with return code {return_code}", file=sys.stderr, flush=True)
                    break
                
                # Check elapsed time
                elapsed = time.time() - start_wait
                if elapsed > max_wait:
                    print(f"ERROR: pgsrip process timed out after {max_wait} seconds", file=sys.stderr, flush=True)
                    process.kill()
                    return None
                
                # Check if SRT file is being created (even if process hasn't finished)
                if ripping_started[0] and os.path.exists(srt_file):
                    file_size = os.path.getsize(srt_file)
                    if file_size > 0:
                        # File exists and has content - pgsrip is working!
                        elapsed_since_output = time.time() - last_output_time[0]
                        if elapsed_since_output > 60:  # 1 minute with no output
                            print(f"PROGRESS:heartbeat:SRT file exists ({file_size} bytes), OCR in progress (no output for {int(elapsed_since_output)}s)", file=sys.stderr, flush=True)
                            last_output_time[0] = time.time()  # Reset timer since we know it's working
                
                # Check if process is still alive and doing work
                elapsed_since_output = time.time() - last_output_time[0]
                if elapsed_since_output > 300 and ripping_started[0]:  # 5 minutes with no output during ripping
                    # Check if process is actually running
                    try:
                        # Try to send signal 0 to check if process exists
                        os.kill(process.pid, 0)
                        # Check if SRT file exists
                        if os.path.exists(srt_file):
                            current_size = os.path.getsize(srt_file)
                            print(f"WARNING: No output for {int(elapsed_since_output)}s but process is running. SRT file size: {current_size} bytes", file=sys.stderr, flush=True)
                        else:
                            print(f"WARNING: No output for {int(elapsed_since_output)}s and no SRT file yet. Process may be stuck.", file=sys.stderr, flush=True)
                    except ProcessLookupError:
                        print(f"ERROR: Process no longer exists but didn't complete", file=sys.stderr, flush=True)
                        return None
                    except Exception as e:
                        print(f"WARNING: Error checking process: {e}", file=sys.stderr, flush=True)
                
                # Wait a bit before checking again
                time.sleep(5)
                
        except KeyboardInterrupt:
            print(f"ERROR: Interrupted", file=sys.stderr, flush=True)
            process.kill()
            return None
        
        # Give reader thread a moment to finish
        reader_thread.join(timeout=2)
        print(f"DEBUG: Output reader thread finished. Collected {len(output_lines)} lines", file=sys.stderr, flush=True)
        
        if return_code != 0:
            error_msg = '\n'.join(output_lines[-10:])  # Last 10 lines for error context
            print(f"pgsrip failed with return code {return_code}", file=sys.stderr)
            if error_msg:
                print(f"Last output: {error_msg}", file=sys.stderr)
            return None
        
        # Check if SRT file was created
        if not os.path.exists(srt_file):
            print(f"SRT file not found at {srt_file}", file=sys.stderr)
            return None
        
        # Move SRT file to subtitles directory (remove from Videos directory)
        srt_dest = os.path.join(output_dir, f"{movie_title}.srt")
        try:
            shutil.move(srt_file, srt_dest)
            print(f"Moved SRT file to {srt_dest}", file=sys.stderr)
        except Exception as e:
            print(f"Warning: Could not move SRT file: {e}", file=sys.stderr)
            # Fallback: try to copy if move fails
            try:
                shutil.copy2(srt_file, srt_dest)
                print(f"Copied SRT file to {srt_dest} (move failed)", file=sys.stderr)
                # Try to remove original after copy
                try:
                    os.remove(srt_file)
                    print(f"Removed original SRT file from Videos directory", file=sys.stderr)
                except:
                    pass
            except Exception as e2:
                print(f"Error: Could not copy SRT file either: {e2}", file=sys.stderr)
                return None
        
        # Count actual subtitle lines in SRT for final progress
        try:
            with open(srt_dest, "r", encoding="utf-8") as f:
                srt_content = f.read()
                # Count subtitle entries (each starts with a number)
                import re
                subtitle_count = len(re.findall(r'^\d+$', srt_content, re.MULTILINE))
                if subtitle_count > 0:
                    print(f"PROGRESS:current:{subtitle_count}:total:{subtitle_count}", file=sys.stderr, flush=True)
        except:
            pass
        
        # Convert SRT to VTT (use the moved file in subtitles directory)
        vtt_file = os.path.join(output_dir, f"{movie_title}.vtt")
        if convert_srt_to_vtt(srt_dest, vtt_file):
            print(f"PROGRESS:complete", file=sys.stderr, flush=True)
            print(f"Successfully converted SRT to VTT using pgsrip", file=sys.stderr)
            return vtt_file
        else:
            return None
            
    except subprocess.TimeoutExpired:
        print(f"pgsrip timed out", file=sys.stderr)
        return None
    except Exception as e:
        print(f"Error using pgsrip: {e}", file=sys.stderr)
        return None


def extract_pgs_with_ffmpeg(mkv_file: str, stream_index: int, output_dir: str) -> Tuple[List[Tuple[float, float, Optional[str]]], Optional[str]]:
    """
    Extract PGS subtitle timing and images using ffmpeg/ffprobe.
    Returns tuple of (list of (start_time, end_time, image_path) tuples, temp_dir).
    """
    subtitle_entries = []
    temp_dir = tempfile.mkdtemp(prefix="pgs_extract_")
    
    try:
        # Step 1: Extract timing information from subtitle stream
        # Note: stream_index is the absolute stream index, not subtitle stream number
        cmd_timing = [
            FFPROBE_PATH,
            "-i", mkv_file,
            "-select_streams", f"{stream_index}",
            "-show_entries", "packet=pts_time,duration_time",
            "-of", "csv=p=0",
            "-v", "quiet"
        ]
        
        print("Extracting subtitle timing information...", file=sys.stderr)
        timing_result = subprocess.run(cmd_timing, capture_output=True, text=True, check=True)
        
        timings = []
        for line in timing_result.stdout.strip().split('\n'):
            if line and ',' in line:
                parts = line.split(',')
                if len(parts) >= 2:
                    try:
                        pts = float(parts[0])
                        duration = float(parts[1]) if parts[1] and parts[1] != 'N/A' else 3.0
                        timings.append((pts, duration))
                    except ValueError:
                        continue
        
        if not timings:
            print("Warning: No timing information found", file=sys.stderr)
            print(f"ffprobe output: {timing_result.stdout[:500]}", file=sys.stderr)
            return [], temp_dir
        
        print(f"Found {len(timings)} subtitle packets", file=sys.stderr)
        
        # Step 2: Extract PGS subtitle images
        # Note: ffmpeg cannot directly extract PGS (image-based) subtitle frames
        # PGS subtitles are bitmap-based and require specialized tools or libraries to extract
        # For now, we'll create entries with timing but without images
        # Full text extraction would require tools like bdsub2srt, pgsrip, or a Python SUP parser
        
        print("Note: PGS subtitle image extraction requires specialized tools.", file=sys.stderr)
        print("Creating subtitle entries with timing information only...", file=sys.stderr)
        
        # Create subtitle entries with timing but no image paths
        # The VTT creation function will handle missing images gracefully
        frame_files = []  # No frames extracted - will use placeholder text
        
        # Step 3: Create subtitle entries from timing information
        # Since we can't extract PGS images with ffmpeg, we'll create entries with timing only
        for pts, duration in timings:
            start_time = pts
            end_time = pts + duration if duration > 0 else pts + 3.0
            # No image path - will use placeholder text in VTT
            subtitle_entries.append((start_time, end_time, None))
        
        return subtitle_entries, temp_dir
        
    except subprocess.CalledProcessError as e:
        print(f"Error extracting PGS: {e}", file=sys.stderr)
        if e.stderr:
            print(f"stderr: {e.stderr}", file=sys.stderr)
        if e.stdout:
            print(f"stdout: {e.stdout[:500]}", file=sys.stderr)
        return [], temp_dir
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return [], temp_dir


def extract_text_from_image(image_path: Optional[str]) -> str:
    """Extract text from a PGS subtitle image using OCR."""
    if image_path is None:
        return "[PGS subtitle - image extraction not available]"
    
    if not OCR_AVAILABLE:
        return "[OCR not available]"
    
    try:
        img = Image.open(image_path)
        
        # Convert to grayscale if needed
        if img.mode != "L":
            img = img.convert("L")
        
        # Enhance contrast for better OCR
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)
        
        # Use pytesseract to extract text
        # Configure for subtitle text (single block, no digits)
        custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?;:-\'"()[]{} '
        text = pytesseract.image_to_string(img, config=custom_config)
        
        # Clean up the text
        text = text.strip()
        # Remove extra whitespace
        text = ' '.join(text.split())
        
        return text if text else "[No text detected]"
    except Exception as e:
        print(f"Error extracting text from {image_path}: {e}", file=sys.stderr)
        return "[OCR error]"


def create_vtt_from_subtitles(subtitle_entries: List[Tuple[float, float, Optional[str]]], output_path: str, movie_title: str, temp_dir: Optional[str] = None) -> bool:
    """
    Create a VTT file with timing and extracted text from PGS subtitle images.
    """
    try:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("WEBVTT\n\n")
            
            for i, (start_time, end_time, image_path) in enumerate(subtitle_entries, 1):
                # Extract text from image if available
                text = extract_text_from_image(image_path)
                
                f.write(f"{i}\n")
                f.write(f"{format_vtt_time(start_time)} --> {format_vtt_time(end_time)}\n")
                f.write(f"{text}\n\n")
        
        print(f"Created VTT file with {len(subtitle_entries)} subtitle entries")
        
        # Cleanup temp directory if provided
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception as e:
                print(f"Warning: Could not cleanup temp directory: {e}")
        
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
    
    # Create output VTT file path
    output_file = os.path.join(args.output_dir, f"{args.movie_title}.vtt")
    
    # Try using pgsrip first if available
    if PGSRIP_AVAILABLE:
        print(f"Attempting to use pgsrip for PGS extraction...", file=sys.stderr)
        vtt_file = extract_pgs_with_pgsrip(mkv_file, args.language, args.output_dir, args.movie_title, stream_index)
        if vtt_file and os.path.exists(vtt_file):
            print(f"Successfully created VTT file using pgsrip: {vtt_file}")
            # Print VTT content to stdout for Node.js to capture
            with open(vtt_file, "r", encoding="utf-8") as f:
                print(f.read())
            sys.exit(0)
        else:
            print(f"pgsrip failed or not available, falling back to manual extraction...", file=sys.stderr)
    
    # Fallback to manual extraction with timing only
    # Check if OCR is available before proceeding
    if not OCR_AVAILABLE:
        print("ERROR: OCR tools (pytesseract and pillow) are required for PGS subtitle conversion.", file=sys.stderr)
        print("Install with: pip3 install pytesseract pillow", file=sys.stderr)
        print("Also install Tesseract OCR: sudo apt-get install tesseract-ocr", file=sys.stderr)
        sys.exit(1)
    
    # Extract PGS subtitles (timing + images)
    print(f"Extracting PGS subtitles...", file=sys.stderr)
    subtitle_entries, temp_dir = extract_pgs_with_ffmpeg(mkv_file, stream_index, args.output_dir)
    print(f"DEBUG: subtitle_entries count: {len(subtitle_entries)}, temp_dir: {temp_dir}", file=sys.stderr)
    if not subtitle_entries:
        # Cleanup temp directory if no entries
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except:
                pass
        print("Error: No subtitle entries extracted", file=sys.stderr)
        sys.exit(1)
    
    print(f"Extracted {len(subtitle_entries)} subtitle entries", file=sys.stderr)
    
    # Create VTT file with OCR text extraction
    print(f"Creating VTT file with OCR text extraction...", file=sys.stderr)
    if create_vtt_from_subtitles(subtitle_entries, output_file, args.movie_title, temp_dir):
        print(f"Successfully created VTT file: {output_file}")
        # Print VTT content to stdout for Node.js to capture
        with open(output_file, "r", encoding="utf-8") as f:
            print(f.read())
    else:
        print("Error: Failed to create VTT file", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

