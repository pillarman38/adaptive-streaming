import re

def nanoseconds_to_time(nanoseconds):
    seconds = nanoseconds / 1e9
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    seconds = int(seconds % 60)
    return f"{hours:02}:{minutes:02}:{seconds:02}"

with open('J:/chapters.txt', 'r') as file:
    content = file.read()

chapters = re.findall(r'START=(\d+)\nEND=(\d+)\ntitle=(.+)', content)

for i, (start, end, title) in enumerate(chapters):
    start_time = nanoseconds_to_time(int(start))
    end_time = nanoseconds_to_time(int(end))
    print(f"Chapter {i+1}: {title}")
    print(f"Start: {start_time}")
    print(f"End: {end_time}")
    print()