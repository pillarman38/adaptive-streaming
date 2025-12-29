# PGS to VTT Conversion

## Current Implementation

The `pgs_to_vtt_simple.py` script extracts PGS subtitle timing information from MKV files and creates VTT files with proper timestamps. Currently, it creates placeholder text entries that indicate OCR is needed for full text extraction.

## Features

- ✅ Extracts subtitle timing information (start/end times)
- ✅ Creates properly formatted VTT files
- ⚠️ Text extraction requires OCR tools (pytesseract + pillow)

## Installation for Full OCR Support

To enable text extraction from PGS subtitle images:

```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install tesseract-ocr python3-pip

# Install Python packages
pip3 install pytesseract pillow
```

## Usage

```bash
python3 server/models/pgs_to_vtt_simple.py "Movie Title" [stream_index]
```

## Future Enhancements

1. **OCR Integration**: Once pytesseract and pillow are installed, the script can extract text from PGS subtitle images
2. **Specialized Tools**: Consider using tools like `pgsrip` or `bdsub2srt` for better PGS parsing
3. **Batch Processing**: Add support for processing multiple movies at once

## Current Limitations

- Text extraction requires OCR libraries to be installed
- PGS subtitles are image-based and need special handling
- ffmpeg's subtitle filter doesn't support PGS directly

## Notes

The script currently creates VTT files with timing information and placeholder text. The timing is accurate, which is the most critical part for subtitle synchronization. Text can be added later through:
- Manual editing
- OCR processing (once libraries are installed)
- Using specialized PGS extraction tools

