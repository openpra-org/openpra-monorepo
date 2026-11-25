mod support;

use openrc::dcf::{get_dcf_values, load_dcf_data};
use openrc::rcad::{Engine, GaussianOptions, Receptor};
use openrc::st::{get_nuclide_data, load_decay_data};

use support::{
    items, kind_for, number, pairs, remove_scratch, scratch_dir, segments, text, texts, vector,
    Tally,
};

#[test]
fn data_files_loaded_by_path_stay_in_use() {
    let data = vector("loaders.json");
    let directory = scratch_dir("loaders");
    for (name, content) in data["files"].as_object().expect("files") {
        std::fs::write(directory.join(name), text(content)).expect("write data file");
    }
    let absent = directory.join("absent.json");
    let bad = directory.join("bad.json");
    let list = directory.join("list.json");

    let attempts = [
        load_dcf_data(Some(&absent)).err(),
        load_dcf_data(Some(&bad)).err(),
        load_decay_data(Some(&absent)).err(),
        load_decay_data(Some(&bad)).err(),
        load_decay_data(Some(&list)).err(),
    ];
    let expected_attempts = items(&data["attempts"]);
    assert_eq!(attempts.len(), expected_attempts.len());
    for (attempt, expected) in attempts.iter().zip(expected_attempts) {
        let error = attempt.as_ref().expect("the load must fail");
        assert_eq!(
            error.kind(),
            kind_for(text(expected)),
            "{}",
            error.message()
        );
    }

    let dcf = load_dcf_data(Some(&directory.join("dcf.json"))).expect("dose coefficients");
    assert!(std::ptr::eq(dcf, load_dcf_data(None).expect("cached")));
    assert!(std::ptr::eq(
        dcf,
        load_dcf_data(Some(&absent)).expect("cached")
    ));
    assert!(data["same_dcf"].as_bool().expect("flag"));

    let decay = load_decay_data(Some(&directory.join("chains.json"))).expect("decay data");
    assert!(std::ptr::eq(decay, load_decay_data(None).expect("cached")));
    assert!(std::ptr::eq(
        decay,
        load_decay_data(Some(&absent)).expect("cached")
    ));
    assert!(data["same_decay"].as_bool().expect("flag"));
    let decay_keys: Vec<String> = decay
        .as_object()
        .expect("entries")
        .keys()
        .cloned()
        .collect();
    assert_eq!(decay_keys, texts(&data["decay_keys"]));
    assert_eq!(
        get_nuclide_data("Cs-1", None).expect("lookup"),
        Some(&data["nuclide"])
    );
    assert_eq!(
        get_dcf_values(dcf, "Cs-1", "THYROID"),
        Some(&data["lookup"])
    );

    let source = pairs(&data["source"]);
    let plume_segments = segments(&data["segments"]);
    let opts = GaussianOptions {
        simple_decay_at_receptor: true,
        compute_epz: false,
        ..GaussianOptions::default()
    };
    let receptor = Receptor {
        x_m: 1000.0,
        y_m: 0.0,
        z_m: 0.0,
    };
    let mut engine = Engine::new();
    let mut tally = Tally::new("data loaded by path");
    for organ in ["ICRP60ED", "THYROID"] {
        let actual = engine
            .run_gaussian_tede(
                &source,
                &receptor,
                86400.0,
                Some(&opts),
                organ,
                &plume_segments,
                None,
            )
            .expect("run");
        let expected = &data["results"][organ];
        let field = |name: &str| number(&expected[name]);
        tally.check(actual.chi_over_q_s_m3, field("chi_over_q_s_m3"), &|| {
            format!("{organ} chi over q")
        });
        tally.check(actual.chi_bq_s_m3, field("chi_bq_s_m3"), &|| {
            format!("{organ} integrated concentration")
        });
        tally.check(actual.tede_sv, field("tede_sv"), &|| {
            format!("{organ} dose")
        });
        tally.check(
            actual.ground_deposition_bq_m2,
            field("ground_deposition_bq_m2"),
            &|| format!("{organ} deposition"),
        );
        tally.check(actual.lmp_tede_sv, field("lmp_tede_sv"), &|| {
            format!("{organ} boundary dose")
        });
        assert_eq!(
            actual.missing_dcfs,
            texts(&expected["missing_dcfs"]),
            "{organ}"
        );
        let expected_breakdown = items(&expected["breakdown"]);
        assert_eq!(
            actual.breakdown_sv_by_nuclide.len(),
            expected_breakdown.len(),
            "{organ}"
        );
        for ((name, dose), expected_pair) in actual
            .breakdown_sv_by_nuclide
            .iter()
            .zip(expected_breakdown)
        {
            assert_eq!(name, text(&expected_pair[0]), "{organ}");
            tally.check(*dose, number(&expected_pair[1]), &|| {
                format!("{organ} breakdown {name}")
            });
        }
    }
    tally.finish();
    remove_scratch(&directory);
}
