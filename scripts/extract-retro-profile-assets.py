from collections import deque
from pathlib import Path
import sys

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "design-reference" / "sector-nine-retro-assets.png"
OUTPUT = ROOT / "public" / "profile-assets" / "retro"


def transparent_dark_region(image: Image.Image, seeds: list[tuple[int, int]], threshold: int = 52) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    seen: set[tuple[int, int]] = set()
    queue = deque(seeds)
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or x < 0 or y < 0 or x >= rgba.width or y >= rgba.height:
            continue
        seen.add((x, y))
        r, g, b, _ = pixels[x, y]
        if max(r, g, b) > threshold:
            continue
        pixels[x, y] = (r, g, b, 0)
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    return rgba


def remove_number(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    # The labels occupy the source collage's outer top-left margin, not the
    # avatar aperture. Remove that margin entirely instead of repainting art.
    for y in range(min(23, rgba.height)):
        for x in range(min(40, rgba.width)):
            pixels[x, y] = (0, 0, 0, 0)
    return rgba


def save_asset(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "PNG", optimize=True)


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Reference image not found: {SOURCE}")
    source = Image.open(SOURCE).convert("RGB")
    if source.width != 1280 or source.height not in (853, 854):
        raise SystemExit(f"Unexpected reference dimensions: {source.size}; expected 1280x853/854")

    # Separator positions are measured from the supplied 1280 px collage. They
    # deliberately exclude neighbouring cells instead of assuming a uniform grid.
    x_starts = [6, 140, 275, 410, 546, 675, 809, 942, 1064, 1180]
    x_ends = [134, 268, 403, 540, 668, 802, 935, 1058, 1174, 1275]
    y_starts = [6, 126, 245, 359, 477]
    y_ends = [121, 240, 354, 472, 595]
    for row, y in enumerate(y_starts):
        for col, x in enumerate(x_starts):
            number = row * 10 + col + 1
            crop = source.crop((x, y, x_ends[col], y_ends[row]))
            crop = remove_number(crop)
            crop = transparent_dark_region(crop, [(crop.width // 2, crop.height // 2)], 48)
            save_asset(crop, OUTPUT / "frames" / f"frame-{number:02d}.png")
            thumb = crop.copy()
            thumb.thumbnail((72, 72), Image.Resampling.LANCZOS)
            thumb_canvas = Image.new("RGBA", (72, 72), (0, 0, 0, 0))
            thumb_canvas.alpha_composite(thumb, ((72 - thumb.width) // 2, (72 - thumb.height) // 2))
            save_asset(thumb_canvas, OUTPUT / "frames" / "thumbs" / f"frame-{number:02d}.png")

    rank_boxes = [(39, 640, 388, 681), (39, 685, 388, 726), (39, 730, 388, 771), (39, 776, 388, 817)]
    rank_names = ["new-recruit", "active-player", "elite-player", "veteran"]
    for name, box in zip(rank_names, rank_boxes):
        save_asset(source.crop(box).convert("RGBA"), OUTPUT / "ranks" / f"{name}.png")

    badge_boxes = [(432, 640, 776, 681), (432, 685, 776, 726), (432, 730, 776, 771), (432, 776, 776, 817)]
    badge_names = ["clan-owner", "clan-leader", "clan-member", "custom-title"]
    for name, box in zip(badge_names, badge_boxes):
        save_asset(source.crop(box).convert("RGBA"), OUTPUT / "badges" / f"{name}.png")

    medal_boxes = [
        (824, 632, 892, 716), (902, 632, 970, 716), (980, 632, 1048, 716),
        (1058, 632, 1126, 716), (1136, 632, 1204, 716),
        (815, 723, 883, 817), (889, 723, 957, 817), (963, 723, 1031, 817),
        (1037, 723, 1105, 817), (1111, 723, 1179, 817), (1185, 723, 1263, 817),
    ]
    for number, box in enumerate(medal_boxes, 1):
        medal = source.crop(box)
        seeds = [(0, 0), (medal.width - 1, 0), (0, medal.height - 1), (medal.width - 1, medal.height - 1)]
        medal = transparent_dark_region(medal, seeds, 36)
        save_asset(medal, OUTPUT / "medals" / f"level-{number:02d}.png")

    print(f"Extracted 69 original assets to {OUTPUT}")


if __name__ == "__main__":
    main()
