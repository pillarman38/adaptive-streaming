#!/bin/bash

# Directory containing MP4 files
input_directory="J:/Shows/Star Wars The Clone Wars/Season 3/Disc 3"
output_directory="J:/Shows/Star Wars The Clone Wars/Season 3/Disc 3"

# Create output directory if it doesn't exist
mkdir -p "$output_directory"

# Loop through all MP4 files in the input directory
for input_file in "$input_directory"/*.mp4; do
  # Extract the base name of the file (without extension)
  base_name=$(basename "$input_file" .mp4)
  
  # Define the output file path
  output_file="$output_directory/$base_name.mkv"
  
  # Convert MP4 to MKV losslessly
  J:/ffmpeg -y -i "$input_file" -map 0:v:0 -map 0:a -sn -c copy "$output_file"
done

echo "Conversion complete!"