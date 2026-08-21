//! dataset-gen
//!
//! Reads `data/countries.json` (country metadata + flag image URLs, pre-fetched
//! from the restcountries v5 API), downloads each flag PNG (cached under
//! `data/flags/`), and reduces every flag's pixels into a small palette of
//! dominant colours with percentage coverage. The result is written to
//! `dataset/flags.json` at the repo root — the dataset the Convexity game
//! reads to render its colour-distribution charts and score guesses.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

/// Max distinct colours kept per flag.
const MAX_COLORS: usize = 16;
/// Stop adding colours once cumulative coverage passes this, even if under
/// MAX_COLORS — most flags are 2-4 flat colours and don't need 8 entries.
const COVERAGE_STOP: f64 = 0.9995;
/// Pixels with alpha below this are treated as transparent padding and skipped.
const ALPHA_CUTOFF: u8 = 128;
/// Quantization bucket width per channel (16 -> 16 levels/channel, 4096 buckets).
/// Flat vector-art flag colours cluster tightly, so this merges anti-aliasing
/// noise into the same bucket as the intended colour without losing distinct hues.
const BUCKET_BITS: u32 = 4;
/// Render width (px) used when rasterizing each flag's SVG. SVGs are the
/// source of truth for colour (flat vector fills, no JPEG/PNG compression
/// artefacts); we rasterize at a fixed size purely to reuse the pixel-histogram
/// pipeline below. Height follows the SVG's native aspect ratio.
const RENDER_WIDTH: u32 = 600;

#[derive(Debug, Deserialize)]
struct CountryMeta {
    cca2: String,
    cca3: String,
    name: String,
    region: String,
    subregion: String,
    continents: Vec<String>,
    population: Option<u64>,
    area_km2: Option<f64>,
    landlocked: Option<bool>,
    borders: Vec<String>,
    capital: Vec<String>,
    #[allow(dead_code)]
    flag_png_url: String,
    flag_svg_url: String,
    independent: Option<bool>,
}

#[derive(Debug, Serialize)]
struct FlagColor {
    hex: String,
    pct: f64,
}

#[derive(Debug, Serialize)]
struct FlagEntry {
    cca2: String,
    cca3: String,
    name: String,
    region: String,
    subregion: String,
    continents: Vec<String>,
    population: Option<u64>,
    area_km2: Option<f64>,
    landlocked: Option<bool>,
    borders: Vec<String>,
    capital: Vec<String>,
    colors: Vec<FlagColor>,
}

fn main() -> Result<()> {
    let repo_root = repo_root()?;
    let meta_path = repo_root.join("dataset-gen/data/countries.json");
    let flags_dir = repo_root.join("dataset-gen/data/flags");
    let out_path = repo_root.join("dataset/flags.json");

    fs::create_dir_all(&flags_dir)?;
    fs::create_dir_all(out_path.parent().unwrap())?;

    let countries: Vec<CountryMeta> = serde_json::from_slice(
        &fs::read(&meta_path).with_context(|| format!("reading {}", meta_path.display()))?,
    )?;

    let client = reqwest::blocking::Client::builder()
        .user_agent("convexity-dataset-gen/0.1")
        .build()?;

    let mut entries = Vec::with_capacity(countries.len());
    let mut failures = Vec::new();

    for (i, c) in countries.iter().enumerate() {
        print!("[{}/{}] {} ({})... ", i + 1, countries.len(), c.name, c.cca2);
        match process_country(&client, &flags_dir, c) {
            Ok(entry) => {
                println!("{} colors", entry.colors.len());
                entries.push(entry);
            }
            Err(e) => {
                println!("SKIPPED: {e}");
                failures.push(c.cca2.clone());
            }
        }
    }

    let min_path = write_json_pair(&out_path, &entries)?;

    println!(
        "\nWrote {} flags to {} + {} ({} failed: {:?})",
        entries.len(),
        out_path.display(),
        min_path.display(),
        failures.len(),
        failures
    );

    Ok(())
}

/// Writes `path` as pretty-printed JSON and a sibling `.min.json` as
/// minified JSON (no whitespace) — the pretty file is for diffing/review,
/// the minified one is the smaller payload the game actually fetches.
/// Returns the minified file's path.
fn write_json_pair(path: &Path, value: &impl Serialize) -> Result<PathBuf> {
    let pretty = serde_json::to_string_pretty(value)?;
    fs::write(path, pretty)?;

    let min_path = minified_path(path);
    let minified = serde_json::to_string(value)?;
    fs::write(&min_path, minified)?;

    Ok(min_path)
}

/// `foo/flags.json` -> `foo/flags.min.json`.
fn minified_path(path: &Path) -> PathBuf {
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    path.with_file_name(format!("{stem}.min.json"))
}

fn process_country(
    client: &reqwest::blocking::Client,
    flags_dir: &Path,
    c: &CountryMeta,
) -> Result<FlagEntry> {
    let svg_bytes = fetch_flag_svg(client, flags_dir, c)?;
    let tree = usvg::Tree::from_data(&svg_bytes, &usvg::Options::default())
        .with_context(|| format!("parsing flag SVG for {}", c.cca2))?;
    let palette = declared_colors(&tree);
    let img = rasterize_svg(&tree)
        .with_context(|| format!("rasterizing flag SVG for {}", c.cca2))?;

    let colors = dominant_colors(&img, &palette);

    Ok(FlagEntry {
        cca2: c.cca2.clone(),
        cca3: c.cca3.clone(),
        name: c.name.clone(),
        region: c.region.clone(),
        subregion: c.subregion.clone(),
        continents: c.continents.clone(),
        population: c.population,
        area_km2: c.area_km2,
        landlocked: c.landlocked,
        borders: c.borders.clone(),
        capital: c.capital.clone(),
        colors,
    })
}

/// Downloads (or reads from cache) the SVG bytes for a country's flag. SVGs
/// are used instead of the PNG variant because they're flat vector fills —
/// the true colour palette — with no resize/compression artefacts to filter.
fn fetch_flag_svg(
    client: &reqwest::blocking::Client,
    flags_dir: &Path,
    c: &CountryMeta,
) -> Result<Vec<u8>> {
    let cache_path: PathBuf = flags_dir.join(format!("{}.svg", c.cca2.to_lowercase()));
    if let Ok(bytes) = fs::read(&cache_path) {
        return Ok(bytes);
    }

    if c.flag_svg_url.is_empty() {
        anyhow::bail!("no flag_svg_url for {}", c.cca2);
    }

    // One retry — flaky network hiccups shouldn't drop a whole country.
    let bytes = (0..2)
        .find_map(|attempt| {
            client
                .get(&c.flag_svg_url)
                .send()
                .and_then(|r| r.error_for_status())
                .and_then(|r| r.bytes())
                .map(|b| b.to_vec())
                .map_err(|e| {
                    if attempt == 0 {
                        eprintln!("  retrying {} after error: {e}", c.flag_svg_url);
                    }
                    e
                })
                .ok()
        })
        .with_context(|| format!("downloading {}", c.flag_svg_url))?;

    fs::write(&cache_path, &bytes)?;
    Ok(bytes)
}

/// Walks the parsed SVG tree and collects every solid fill/stroke colour
/// actually declared in the document (gradients/patterns skipped — flags
/// essentially never use them). This is the true palette: rasterizing can
/// only ever blend between these colours at edges, it can't invent new ones,
/// so snapping pixels to the nearest entry here eliminates anti-aliasing
/// noise outright instead of merely bucketing it small.
fn declared_colors(tree: &usvg::Tree) -> Vec<(u8, u8, u8)> {
    fn walk(group: &usvg::Group, out: &mut HashSet<(u8, u8, u8)>) {
        for node in group.children() {
            match node {
                usvg::Node::Group(g) => walk(g, out),
                usvg::Node::Path(p) => {
                    if let Some(usvg::Paint::Color(c)) = p.fill().map(|f| f.paint()) {
                        out.insert((c.red, c.green, c.blue));
                    }
                    if let Some(usvg::Paint::Color(c)) = p.stroke().map(|s| s.paint()) {
                        out.insert((c.red, c.green, c.blue));
                    }
                }
                _ => {}
            }
        }
    }

    let mut out = HashSet::new();
    walk(tree.root(), &mut out);
    out.into_iter().collect()
}

/// Rasterizes an SVG into an RGBA image at a fixed width, preserving the
/// SVG's native aspect ratio. Flat vector fills rasterize with only a thin
/// anti-aliased edge between colours, so the pixel-histogram approach in
/// `dominant_colors` still applies cleanly on top.
fn rasterize_svg(tree: &usvg::Tree) -> Result<image::RgbaImage> {
    let size = tree.size();
    let scale = RENDER_WIDTH as f32 / size.width();
    let width = RENDER_WIDTH;
    let height = ((size.height() * scale).round() as u32).max(1);

    let mut pixmap =
        tiny_skia::Pixmap::new(width, height).context("allocating render target")?;
    resvg::render(
        tree,
        tiny_skia::Transform::from_scale(scale, scale),
        &mut pixmap.as_mut(),
    );

    // tiny_skia stores premultiplied RGBA; un-premultiply so plain-alpha
    // consumers (and our alpha cutoff below) see the true fill colour.
    let mut img = image::RgbaImage::new(width, height);
    for (px, out) in pixmap.pixels().iter().zip(img.pixels_mut()) {
        let a = px.alpha();
        let unmul = |c: u8| -> u8 {
            if a == 0 {
                0
            } else {
                ((c as u16 * 255) / a as u16).min(255) as u8
            }
        };
        out.0 = [unmul(px.red()), unmul(px.green()), unmul(px.blue()), a];
    }
    Ok(img)
}

/// Buckets flag pixels by colour, keeps the top colours by coverage, and
/// returns them as hex + percentage, normalized to sum to 100.
///
/// When `palette` is non-empty (the declared SVG fill/stroke colours), every
/// pixel is snapped to its nearest palette entry — this is what actually
/// kills anti-aliasing noise, since a rasterized edge pixel can only ever be
/// a blend *between* two declared colours and gets assigned to whichever one
/// it's closer to. No new "colour" can ever be created this way. Falls back
/// to quantize-bucketing (the old approach) if the SVG had no solid colours
/// to snap to (pure gradients/patterns).
fn dominant_colors(img: &image::RgbaImage, palette: &[(u8, u8, u8)]) -> Vec<FlagColor> {
    let mut freq: HashMap<(u8, u8, u8), u64> = HashMap::new();
    let mut counted: u64 = 0;

    for px in img.pixels() {
        let [r, g, b, a] = px.0;
        if a < ALPHA_CUTOFF {
            continue;
        }
        let key = if palette.is_empty() {
            (quantize(r), quantize(g), quantize(b))
        } else {
            nearest_color(palette, r, g, b)
        };
        *freq.entry(key).or_insert(0) += 1;
        counted += 1;
    }

    if counted == 0 {
        return Vec::new();
    }

    let mut buckets: Vec<((u8, u8, u8), u64)> = freq.into_iter().collect();
    buckets.sort_unstable_by(|a, b| b.1.cmp(&a.1));

    let mut kept = Vec::new();
    let mut cumulative = 0.0f64;
    for (color, count) in buckets.into_iter() {
        if kept.len() >= MAX_COLORS || cumulative >= COVERAGE_STOP {
            break;
        }
        let pct = count as f64 / counted as f64;
        cumulative += pct;
        kept.push((color, pct));
    }

    // Renormalize the kept subset to sum to exactly 100% (dropped noise
    // folds proportionally back into the colours we're keeping).
    let kept_total: f64 = kept.iter().map(|(_, p)| p).sum();
    let to_hex = if palette.is_empty() {
        |r: u8, g: u8, b: u8| bucket_to_hex(r, g, b)
    } else {
        |r: u8, g: u8, b: u8| format!("#{r:02X}{g:02X}{b:02X}")
    };
    kept.into_iter()
        .map(|((r, g, b), p)| FlagColor {
            hex: to_hex(r, g, b),
            pct: (p / kept_total) * 100.0,
        })
        .collect()
}

/// Returns the palette entry closest to (r,g,b) by squared Euclidean
/// distance in RGB space.
fn nearest_color(palette: &[(u8, u8, u8)], r: u8, g: u8, b: u8) -> (u8, u8, u8) {
    let dist = |(pr, pg, pb): (u8, u8, u8)| -> i32 {
        let dr = pr as i32 - r as i32;
        let dg = pg as i32 - g as i32;
        let db = pb as i32 - b as i32;
        dr * dr + dg * dg + db * db
    };
    palette
        .iter()
        .copied()
        .min_by_key(|&c| dist(c))
        .expect("palette is non-empty")
}

fn quantize(channel: u8) -> u8 {
    channel >> (8 - BUCKET_BITS)
}

/// Maps a quantization bucket back to the hex colour at its bucket midpoint.
fn bucket_to_hex(r: u8, g: u8, b: u8) -> String {
    let step = 1u16 << (8 - BUCKET_BITS);
    let mid = |v: u8| -> u8 {
        let lo = (v as u16) << (8 - BUCKET_BITS);
        (lo + step / 2).min(255) as u8
    };
    format!("#{:02X}{:02X}{:02X}", mid(r), mid(g), mid(b))
}

fn repo_root() -> Result<PathBuf> {
    // CARGO_MANIFEST_DIR is dataset-gen/; repo root is its parent.
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .map(|p| p.to_path_buf())
        .context("dataset-gen has no parent directory")
}
