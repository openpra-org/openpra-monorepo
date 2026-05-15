use praxis::openpra_mef::addon_openpsa_xml::parse_openpsa_xml_with_mode;
use praxis::openpra_mef::contracts::ResolveMode;
use praxis::openpra_mef::serialize::json_contract_in::render_openpra_contract_value;
use std::path::{Path, PathBuf};

const FIXTURES: [&str; 7] = [
    "ATRS.xml",
    "CRW.xml",
    "LOHTL.xml",
    "LOOP.xml",
    "PCL.xml",
    "SGTL-M.xml",
    "SGTL-S.xml",
];

fn default_xml_dir() -> PathBuf {
    PathBuf::from("tests/fixtures/eta/EventTrees/MHTGR/OpenPSA_XML")
}

fn default_out_dir() -> PathBuf {
    PathBuf::from("tmp/mhtgr_openpra_json")
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut xml_dir = default_xml_dir();
    let mut out_dir = default_out_dir();

    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--xml-dir" => {
                let value = args.next().ok_or("--xml-dir requires a value")?;
                xml_dir = PathBuf::from(value);
            }
            "--out-dir" => {
                let value = args.next().ok_or("--out-dir requires a value")?;
                out_dir = PathBuf::from(value);
            }
            other => {
                return Err(format!(
                    "Unknown argument '{other}'. Supported: --xml-dir PATH --out-dir PATH"
                )
                .into());
            }
        }
    }

    std::fs::create_dir_all(&out_dir)?;

    for fixture in FIXTURES {
        let xml_path = xml_dir.join(fixture);
        let xml = std::fs::read_to_string(&xml_path)
            .map_err(|err| format!("Failed to read {}: {err}", xml_path.display()))?;

        let bundle = parse_openpsa_xml_with_mode(&xml, ResolveMode::Compatible)
            .map_err(|err| format!("Conversion failed for {}: {err}", xml_path.display()))?;
        let internal = bundle
            .model
            .as_ref()
            .ok_or("Converted bundle missing model")?;
        let contract_value = render_openpra_contract_value(internal);
        let rendered = serde_json::to_string_pretty(&contract_value)?;

        let base = Path::new(fixture)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or(fixture);
        let out_path = out_dir.join(format!("{base}.openpra.json"));
        std::fs::write(&out_path, format!("{rendered}\n"))?;
        println!("WROTE {}", out_path.display());
    }

    Ok(())
}
