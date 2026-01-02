#!/bin/bash

# Script to remove all .mp4 files from the specified directory
TARGET_DIR="/mnt/F898C32498C2DFEC/Videos"

# Check if directory exists
if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Directory '$TARGET_DIR' does not exist."
    exit 1
fi

# Count .mp4 files
MP4_COUNT=$(find "$TARGET_DIR" -type f -name "*.mp4" | wc -l)

if [ "$MP4_COUNT" -eq 0 ]; then
    echo "No .mp4 files found in '$TARGET_DIR'"
    exit 0
fi

# Show what will be deleted
echo "Found $MP4_COUNT .mp4 file(s) in '$TARGET_DIR'"
echo ""
echo "The following files will be deleted:"
find "$TARGET_DIR" -type f -name "*.mp4" -printf "  %p\n"
echo ""

# Ask for confirmation
read -p "Are you sure you want to delete these files? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

# Remove .mp4 files
echo "Removing .mp4 files..."
find "$TARGET_DIR" -type f -name "*.mp4" -delete

# Verify deletion
REMAINING=$(find "$TARGET_DIR" -type f -name "*.mp4" | wc -l)

if [ "$REMAINING" -eq 0 ]; then
    echo "Successfully removed $MP4_COUNT .mp4 file(s)."
else
    echo "Warning: $REMAINING .mp4 file(s) still remain (may be due to permissions)."
    exit 1
fi

