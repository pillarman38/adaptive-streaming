# To run bash in powershell use "& .\DolbyVisionMuxer.sh"
# output hevc
echo $1

I:/ffmpeg -y -i "I:/Videos/$1.mkv" -map 0:0 -c copy I:/BL_EL_RPU.hevc -map 0:1 -c eac3 -ac 6 I:/pcm.mov
# read varname

# # #remove the enhencement layer and preserve the RPU
I:/dovi_tool -m 2 convert I:/BL_EL_RPU.hevc --discard

# # # merge both outputs with dv 5 profile
I:/mp4box -tmp "I:/" -add BL_RPU.hevc -add I:/pcm.mov:lang=eng -new "I:/Videos/$1.mp4"
mv "I:/Videos/$1.mkv" "I:/ConvertedDVMKVs/$1.mkv"
echo "Done!"
read varnamey
