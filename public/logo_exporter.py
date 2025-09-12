# public/logo_exporter.py
from PIL import Image
import os

# Get the directory where this script is located
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Input file and output folder (relative to script)
input_file = os.path.join(BASE_DIR, "logo.png")
output_folder = BASE_DIR

# Sizes needed for web apps / manifest.json
sizes = [16, 32, 192, 512]

def export_icons(input_file, output_folder, sizes):
    # Make sure output folder exists
    os.makedirs(output_folder, exist_ok=True)

    # Open the logo
    img = Image.open(input_file).convert("RGBA")

    # Export each size
    for size in sizes:
        resized = img.resize((size, size), Image.LANCZOS)
        filename = f"logo{size}.png"
        path = os.path.join(output_folder, filename)
        resized.save(path, format="PNG")
        print(f"✅ Saved {path}")

    # Export favicon.ico (multi-size)
    ico_path = os.path.join(output_folder, "favicon.ico")
    img.save(
        ico_path,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    )
    print(f"✅ Saved {ico_path}")

if __name__ == "__main__":
    export_icons(input_file, output_folder, sizes)
