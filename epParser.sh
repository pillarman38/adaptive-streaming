#!/bin/bash
input="J:/Shows/Star Wars The Clone Wars/Season 7/Disc 1/title_t00.mkv"
chapters=(
"00:00:00"
"00:23:51"
"00:47:22"
"01:05:45"
"01:28:52"
"01:51:01"
"02:15:14"
"02:39:00"
"03:01:40"
"03:28:37"
"03:53:33"
"04:17:46"
"04:41:32"
)
for ((i=0; i<${#chapters[@]}-1; i++)); do
  start=${chapters[$i]}
  end=${chapters[$i+1]}
  output="J:/Shows/Star Wars The Clone Wars/Season 7/Disc 1/part$((i+1)).mkv"
  J:/ffmpeg -y -i "$input" -ss "$start" -to "$end" -map 0 -sn -c copy "$output"
done