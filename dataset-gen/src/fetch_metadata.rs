//! fetch-metadata
//!
//! Pulls country metadata (population, area, region, continents, borders,
//! capital, flag image URLs) from the restcountries v5 API and writes it to
//! `dataset-gen/data/countries.json`. Run this once (or whenever the source
//! data should be refreshed) before running the `dataset-gen` binary, which
//! consumes that file to build `dataset/flags.json`.
//!
//! Requires RESTCOUNTRIES_KEY, either as an env var or in a `.env` file at
//! the repo root (see `.env.example`). Get a key at https://restcountries.com/plans

use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const API_BASE: &str = "https://api.restcountries.com/countries/v5";
/// Max objects per request on the free plan.
const PAGE_LIMIT: u32 = 100;

#[derive(Debug, Deserialize)]
struct ApiResponse {
    data: Option<ApiData>,
    errors: Option<Vec<ApiError>>,
}

#[derive(Debug, Deserialize)]
struct ApiError {
    message: String,
}

#[derive(Debug, Deserialize)]
struct ApiData {
    objects: Vec<ApiCountry>,
    meta: ApiMeta,
}

#[derive(Debug, Deserialize)]
struct ApiMeta {
    more: bool,
}

#[derive(Debug, Deserialize)]
struct ApiCountry {
    names: ApiNames,
    codes: ApiCodes,
    region: String,
    subregion: String,
    continents: Vec<String>,
    population: Option<u64>,
    area: Option<ApiArea>,
    landlocked: Option<bool>,
    borders: Vec<String>,
    capitals: Vec<ApiCapital>,
    flag: ApiFlag,
    classification: Option<ApiClassification>,
}

#[derive(Debug, Deserialize)]
struct ApiNames {
    common: String,
}

#[derive(Debug, Deserialize)]
struct ApiCodes {
    alpha_2: String,
    alpha_3: String,
}

#[derive(Debug, Deserialize)]
struct ApiArea {
    kilometers: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct ApiCapital {
    name: String,
}

#[derive(Debug, Deserialize)]
struct ApiFlag {
    url_png: String,
    url_svg: String,
}

#[derive(Debug, Deserialize)]
struct ApiClassification {
    sovereign: Option<bool>,
}

/// Output shape — matches what `dataset-gen`'s `CountryMeta` deserializes.
#[derive(Debug, Serialize)]
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
    flag_svg_url: String,
    independent: Option<bool>,
}

fn main() -> Result<()> {
    let repo_root = repo_root()?;
    // Load .env from repo root if present; a real env var still wins.
    let _ = dotenvy::from_path(repo_root.join(".env"));

    let key = std::env::var("RESTCOUNTRIES_KEY").context(
        "RESTCOUNTRIES_KEY not set. Copy .env.example to .env and fill it in, \
         or set the env var directly.",
    )?;
    if key.trim().is_empty() {
        bail!("RESTCOUNTRIES_KEY is empty");
    }

    let client = reqwest::blocking::Client::builder()
        .user_agent("convexity-dataset-gen/0.1")
        .build()?;

    let mut all = Vec::new();
    let mut offset = 0u32;
    loop {
        print!("fetching offset={offset}... ");
        let url = format!("{API_BASE}?limit={PAGE_LIMIT}&offset={offset}");
        let resp: ApiResponse = client
            .get(&url)
            .header("Authorization", format!("Bearer {key}"))
            .send()
            .with_context(|| format!("requesting {url}"))?
            .json()
            .with_context(|| format!("parsing response from {url}"))?;

        if let Some(errors) = resp.errors {
            let msgs: Vec<_> = errors.iter().map(|e| e.message.as_str()).collect();
            bail!("API error: {}", msgs.join("; "));
        }
        let data = resp.data.context("response had neither data nor errors")?;
        println!("{} objects", data.objects.len());

        let more = data.meta.more;
        all.extend(data.objects);
        if !more {
            break;
        }
        offset += PAGE_LIMIT;
    }

    let out: Vec<CountryMeta> = all
        .into_iter()
        .filter(|c| !c.codes.alpha_2.is_empty() && !c.codes.alpha_3.is_empty())
        .map(|c| CountryMeta {
            cca2: c.codes.alpha_2,
            cca3: c.codes.alpha_3,
            name: c.names.common,
            region: c.region,
            subregion: c.subregion,
            continents: c.continents,
            population: c.population,
            area_km2: c.area.and_then(|a| a.kilometers),
            landlocked: c.landlocked,
            borders: c.borders,
            capital: c.capitals.into_iter().map(|cap| cap.name).collect(),
            flag_png_url: c.flag.url_png,
            flag_svg_url: c.flag.url_svg,
            independent: c.classification.and_then(|cl| cl.sovereign),
        })
        .collect();

    let out_path = repo_root.join("dataset-gen/data/countries.json");
    fs::create_dir_all(out_path.parent().unwrap())?;
    fs::write(&out_path, serde_json::to_string_pretty(&out)?)?;

    println!("Wrote {} countries to {}", out.len(), out_path.display());
    Ok(())
}

fn repo_root() -> Result<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .map(|p| p.to_path_buf())
        .context("dataset-gen has no parent directory")
}
