use std::{env, fs, path::Path};

// Preserve the vendored source bytes. In the private Windows build copy,
// change only the namespace of five runtime calls to the reference MinGW
// ports. In particular, log1p/expm1 remain UCRT calls, as in the SciPy wheel.
fn windows_headers(source: &Path, destination: &Path) {
    fs::create_dir_all(destination).expect("create Windows kernel headers");
    for entry in fs::read_dir(source).expect("read kernel headers") {
        let entry = entry.expect("read kernel header entry");
        let path = entry.path();
        let target = destination.join(entry.file_name());
        if path.is_dir() {
            windows_headers(&path, &target);
            continue;
        }
        let input = fs::read_to_string(&path).expect("read original kernel header");
        let mut output = String::with_capacity(input.len());
        let mut rest = input.as_str();
        while let Some(index) = rest.find("std::") {
            output.push_str(&rest[..index]);
            rest = &rest[index + 5..];
            let end = rest
                .find(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))
                .unwrap_or(rest.len());
            output.push_str(
                if matches!(&rest[..end], "log" | "exp" | "pow" | "sin" | "cos") {
                    "hcl_windows_math::"
                } else {
                    "std::"
                },
            );
        }
        output.push_str(rest);
        fs::write(target, output).expect("write Windows kernel header adapter");
    }
}

fn main() {
    // HCL_MH uses these SciPy kernels for its LHS inverse CDFs. Compile the
    // unchanged numerical dependency, with a small C ABI for the Rust port.
    println!("cargo:rerun-if-changed=vendor/scipy-quantiles");
    let windows_x64 = env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && env::var("CARGO_CFG_TARGET_ARCH").as_deref() == Ok("x86_64");
    let mut build = cc::Build::new();
    if windows_x64 {
        let include = Path::new(&env::var_os("OUT_DIR").unwrap()).join("windows-include");
        windows_headers(Path::new("vendor/scipy-quantiles/include"), &include);
        build.include(include);
        // boost/math/tools/config.hpp selects these settings for the
        // reference wheel's GCC compiler. Do not use MSVC's method 2.
        build.define("BOOST_MATH_POLY_METHOD", "3");
        build.define("BOOST_MATH_RATIONAL_METHOD", "3");
    } else {
        build.include("vendor/scipy-quantiles/include");
    }
    build
        .cpp(true)
        .std("c++17")
        .define("BOOST_MATH_STANDALONE", None)
        .define("SP_SPECFUN_ERROR", None)
        .file("vendor/scipy-quantiles/bridge.cpp")
        .flag_if_supported("/fp:precise")
        .flag_if_supported("-ffp-contract=off")
        .warnings(false)
        .compile("hcl_scipy_quantiles");
}
