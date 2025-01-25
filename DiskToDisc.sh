#!/bin/bash

# Function to rename directories
rename_directories() {
    for dir in "J:/Shows"/*; do
        if [ -d "$dir" ]; then
            base=$(basename "$dir")
            new_name=$(echo "$base" | sed 's/Disk/Disc/g')
            if [ "$base" != "$new_name" ]; then
                mv "$dir" "$(dirname "$dir")/$new_name"
                echo "Renamed: $base -> $new_name"
            fi
            # Recursively rename directories
            rename_directories "$dir"
        fi
    done
}

# Starting point (current directory)
start_dir="."
rename_directories "$start_dir"
