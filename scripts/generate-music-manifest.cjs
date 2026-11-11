/**
 * Generate public/music/manifest.json from the MP3 files present in public/music/.
 *
 * Filename pattern:
 *   [song name] - [artist name]_128k.mp3
 *
 * The first " - " (dash surrounded by spaces) separates song title from artist.
 * The trailing "_128k.mp3" is stripped from the artist portion.
 */
const fs = require("fs");
const path = require("path");

const MUSIC_DIR = path.join(__dirname, "..", "public", "music");
const MANIFEST_PATH = path.join(MUSIC_DIR, "manifest.json");
const SUFFIX = "_128k.mp3";
const SEPARATOR = " - ";

function parseFilename(file) {
    if (!file.endsWith(SUFFIX)) return null;
    const base = file.slice(0, -SUFFIX.length); // remove "_128k.mp3"
    const sepIdx = base.indexOf(SEPARATOR);
    if (sepIdx === -1) return null;
    const title = base.slice(0, sepIdx).trim();
    const artist = base.slice(sepIdx + SEPARATOR.length).trim();
    if (!title || !artist) return null;
    return { title, artist };
}

function slugify(str) {
    return str
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function main() {
    const entries = fs.readdirSync(MUSIC_DIR)
        .filter((f) => f.toLowerCase().endsWith(".mp3") && f !== "manifest.json")
        .sort();

    const tracks = [];
    const seen = new Set();

    for (const file of entries) {
        const parsed = parseFilename(file);
        if (!parsed) {
            console.warn(`[manifest] Skipping unrecognized file: ${file}`);
            continue;
        }
        let id = slugify(parsed.title);
        // ensure unique ids
        let n = 2;
        let candidate = id;
        while (seen.has(candidate)) {
            candidate = `${id}-${n++}`;
        }
        seen.add(candidate);
        id = candidate;

        tracks.push({
            id,
            file,
            title: parsed.title,
            artist: parsed.artist,
        });
    }

    const manifest = { tracks };
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 4) + "\n");
    console.log(`[manifest] Wrote ${tracks.length} track(s) to ${MANIFEST_PATH}`);
    for (const t of tracks) {
        console.log(`  - ${t.id}: "${t.title}" — ${t.artist} (${t.file})`);
    }
}

main();