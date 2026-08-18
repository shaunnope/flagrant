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
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Max distinct colours kept per flag. Anti-aliasing / gradients otherwise
/// explode the palette into hundreds of near-duplicate shades.
const MAX_COLORS: usize = 8;
/// Stop adding colours once cumulative coverage passes this, even if under
/// MAX_COLORS — most flags are 2-4 flat colours and don't need 8 entries.
const COVERAGE_STOP: f64 = 0.99;
/// Pixels with alpha below this are treated as transparent padding and skipped.
const ALPHA_CUTOFF: u8 = 128;
/// Quantization bucket width per channel (16 -> 16 levels/channel, 4096 buckets).
/// Flat vector-art flag colours cluster tightly, so this merges anti-aliasing
/// noise into the same bucket as the intended colour without losing distinct hues.
const BUCKET_BITS: u32 = 4;

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
    flag_png_url: String,
    #[allow(dead_code)]
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

    let json = serde_json::to_string_pretty(&entries)?;
    fs::write(&out_path, json)?;

    println!(
        "\nWrote {} flags to {} ({} failed: {:?})",
        entries.len(),
        out_path.display(),
        failures.len(),
        failures
    );

    Ok(())
}

fn process_country(
    client: &reqwest::blocking::Client,
    flags_dir: &Path,
    c: &CountryMeta,
) -> Result<FlagEntry> {
    let png_bytes = fetch_flag_png(client, flags_dir, c)?;
    let img = image::load_from_memory(&png_bytes)
        .with_context(|| format!("decoding flag image for {}", c.cca2))?
        .to_rgba8();

    let colors = dominant_colors(&img);

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

/// Downloads (or reads from cache) the PNG bytes for a country's flag.
fn fetch_flag_png(
    client: &reqwest::blocking::Client,
    flags_dir: &Path,
    c: &CountryMeta,
) -> Result<Vec<u8>> {
    let cache_path: PathBuf = flags_dir.join(format!("{}.png", c.cca2.to_lowercase()));
    if let Ok(bytes) = fs::read(&cache_path) {
        return Ok(bytes);
    }

    if c.flag_png_url.is_empty() {
        anyhow::bail!("no flag_png_url for {}", c.cca2);
    }

    // One retry — flaky network hiccups shouldn't drop a whole country.
    let bytes = (0..2)
        .find_map(|attempt| {
            client
                .get(&c.flag_png_url)
                .send()
                .and_then(|r| r.error_for_status())
                .and_then(|r| r.bytes())
                .map(|b| b.to_vec())
                .map_err(|e| {
                    if attempt == 0 {
                        eprintln!("  retrying {} after error: {e}", c.flag_png_url);
                    }
                    e
                })
                .ok()
        })
        .with_context(|| format!("downloading {}", c.flag_png_url))?;

    fs::write(&cache_path, &bytes)?;
    Ok(bytes)
}

/// Quantizes flag pixels into buckets, keeps the top colours by coverage,
/// and returns them as hex + percentage, normalized to sum to 100.
fn dominant_colors(img: &image::RgbaImage) -> Vec<FlagColor> {
    let mut freq: HashMap<(u8, u8, u8), u64> = HashMap::new();
    let mut counted: u64 = 0;

    for px in img.pixels() {
        let [r, g, b, a] = px.0;
        if a < ALPHA_CUTOFF {
            continue;
        }
        let key = (quantize(r), quantize(g), quantize(b));
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
    kept.into_iter()
        .map(|((r, g, b), p)| FlagColor {
            hex: bucket_to_hex(r, g, b),
            pct: (p / kept_total) * 100.0,
        })
        .collect()
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
