//! Windows x86-64 math used by the SciPy 1.17.1 reference wheel.
//! Rust port, 2026-09-13, of MinGW-w64 acc9b9d9e: log.def.h,
//! internal_logl.S, exp.def.h, pow.def.h, powi.def.h, log2l.S,
//! exp2l.S, sin.def.h, sinl_internal.S, cos.def.h, cosl_internal.S.
//!
//! Copyright (c) 2009, 2010 by the mingw-w64 project, ZPL 2.1;
//! assembly files are public domain. Original sources, full notices and hashes
//! are retained in vendor/scipy-quantiles/reference/mingw. Error reporting is
//! handled by the quantile ABI; these functions preserve the numerical results.
//!
//! Each unsafe block takes only local pointers, balances the x87 stack, and
//! restores any temporary rounding-mode change. No state crosses calls.
use std::arch::asm;

#[no_mangle]
pub extern "C" fn hcl_mingw_sin(x: f64) -> f64 {
    if x.is_nan() {
        return x;
    }
    if x.is_infinite() {
        return f64::NAN;
    }
    let mut result = 0.0;
    unsafe {
        asm!(
            "fldl ({x})", "fsin", "fnstsw %ax", "testl $0x400, %eax", "jz 4f",
            "fldpi", "fadd %st(0)", "fxch %st(1)", "3:", "fprem1", "fnstsw %ax",
            "testl $0x400, %eax", "jnz 3b", "fstp %st(1)", "fsin", "4:", "fstpl ({result})",
            x=in(reg) &x, result=in(reg) &mut result, out("eax") _, options(att_syntax, nostack)
        );
    }
    result
}

#[no_mangle]
pub extern "C" fn hcl_mingw_cos(x: f64) -> f64 {
    if x.is_nan() {
        return x;
    }
    if x.is_infinite() {
        return f64::NAN;
    }
    let mut result = 0.0;
    unsafe {
        asm!(
            "fldl ({x})", "fcos", "fnstsw %ax", "testl $0x400, %eax", "jz 4f",
            "fldpi", "fadd %st(0)", "fxch %st(1)", "3:", "fprem1", "fnstsw %ax",
            "testl $0x400, %eax", "jnz 3b", "fstp %st(1)", "fcos", "4:", "fstpl ({result})",
            x=in(reg) &x, result=in(reg) &mut result, out("eax") _, options(att_syntax, nostack)
        );
    }
    result
}

#[no_mangle]
pub extern "C" fn hcl_mingw_log(x: f64) -> f64 {
    if x == 0.0 {
        return f64::NEG_INFINITY;
    }
    if x.is_nan() {
        return x;
    }
    if x.is_sign_negative() {
        return f64::NAN;
    }
    if x.is_infinite() {
        return f64::INFINITY;
    }
    let mut result = 0.0;
    let one = 1.0_f64;
    let limit = 0.29_f64;
    unsafe {
        asm!(
            "fldln2", "fldl ({x})", "fld %st", "fsubl ({one})",
            "fld %st", "fabs", "fcompl ({limit})", "fnstsw %ax",
            "andb $0x45, %ah", "jz 2f", "fstp %st(1)", "fyl2xp1", "jmp 3f",
            "2:", "fstp %st(0)", "fyl2x", "3:", "fstpl ({result})",
            x=in(reg) &x, one=in(reg) &one, limit=in(reg) &limit,
            result=in(reg) &mut result, out("eax") _, options(att_syntax, nostack)
        );
    }
    result
}

#[no_mangle]
pub extern "C" fn hcl_mingw_exp(x: f64) -> f64 {
    if x.is_nan() {
        return x;
    }
    if x.is_infinite() {
        return if x.is_sign_negative() {
            0.0
        } else {
            f64::INFINITY
        };
    }
    if x == 0.0 {
        return 1.0;
    }
    if x > 7.09782712893383996843E2 {
        return f64::INFINITY;
    }
    if x < -7.45133219101941108420E2 {
        return 0.0;
    }
    let c0 = 1.44268798828125_f64;
    // Exact x87 encoding of the source long-double literal
    // 7.05260771340735992468e-6L (rounded by the reference compiler).
    let c1: [u8; 10] = [0x20, 0xfa, 0xee, 0xc2, 0x5f, 0x70, 0xa5, 0xec, 0xed, 0x3f];
    let mut saved = 0_u16;
    let mut truncated = 0_u16;
    let mut result = 0.0;
    unsafe {
        asm!(
            "fldl ({x})", "fldl2e", "fmul %st(1), %st",
            "fnstcw ({saved})", "movzwl ({saved}), %eax", "orb $12, %ah",
            "movw %ax, ({truncated})", "fldcw ({truncated})",
            "frndint", "fld %st(1)", "frndint", "fldcw ({saved})",
            "fld %st(1)", "fldl ({c0})", "fld %st(2)", "fmul %st(1), %st",
            "fsubp %st, %st(2)", "fld %st(4)", "fsub %st(3), %st",
            "fmulp %st, %st(1)", "faddp %st, %st(1)", "fldt ({c1})",
            "fmul %st(4), %st", "faddp %st, %st(1)", "f2xm1", "fld1", "faddp",
            "fstp %st(1)", "fscale", "fstp %st(1)", "fstp %st(1)", "fstpl ({result})",
            x=in(reg) &x, c0=in(reg) &c0, c1=in(reg) c1.as_ptr(),
            saved=in(reg) &mut saved, truncated=in(reg) &mut truncated,
            result=in(reg) &mut result, out("eax") _, options(att_syntax, nostack)
        );
    }
    result
}

// powi.def.h's finite, nonzero branch. pow.def.h handles special values first.
fn integer_power(x: f64, exponent: i32) -> f64 {
    let mut d = x.abs();
    let mut u = exponent.unsigned_abs();
    if exponent < 0 {
        d = 1.0 / d;
    }
    let mut result = if u & 1 != 0 { d } else { 1.0 };
    u >>= 1;
    while u > 0 {
        d *= d;
        if u & 1 != 0 {
            result *= d;
        }
        u >>= 1;
    }
    if x.is_sign_negative() && exponent & 1 != 0 {
        -result
    } else {
        result
    }
}

#[no_mangle]
pub extern "C" fn hcl_mingw_pow(x: f64, y: f64) -> f64 {
    if y == 0.0 || x == 1.0 {
        return 1.0;
    }
    if x.is_nan() {
        return x;
    }
    if y.is_nan() {
        return y;
    }
    let noninteger = y.fract() != 0.0;
    let half = y * 0.5;
    let odd = half.fract() != 0.0;
    if x == 0.0 {
        if y.is_infinite() {
            return if y.is_sign_negative() {
                f64::INFINITY
            } else {
                0.0
            };
        }
        if x.is_sign_negative() && noninteger {
            return if y.is_sign_negative() { 1.0 / -x } else { 0.0 };
        }
        if !y.is_sign_negative() {
            return if odd && x.is_sign_negative() {
                -0.0
            } else {
                0.0
            };
        }
        return if odd && x.is_sign_negative() {
            f64::NEG_INFINITY
        } else {
            f64::INFINITY
        };
    }
    if y.is_infinite() {
        if x.is_infinite() {
            return if y.is_sign_negative() {
                0.0
            } else {
                f64::INFINITY
            };
        }
        if x.abs() == 1.0 {
            return 1.0;
        }
        return if (x.abs() > 1.0) != y.is_sign_negative() {
            f64::INFINITY
        } else {
            0.0
        };
    }
    if x.is_infinite() {
        if x.is_sign_negative() && noninteger {
            return if y.is_sign_negative() { 1.0 / -x } else { -x };
        }
        let result = if y.is_sign_negative() {
            0.0
        } else {
            f64::INFINITY
        };
        return if odd && x.is_sign_negative() {
            -result
        } else {
            result
        };
    }
    if noninteger {
        if x.is_sign_negative() {
            return -f64::NAN;
        }
        if y == 0.5 {
            let mut result = 0.0;
            unsafe {
                asm!("fldl ({x})", "fsqrt", "fstpl ({result})", x=in(reg) &x, result=in(reg) &mut result, options(att_syntax, nostack));
            }
            return result;
        }
    } else if y >= i32::MIN as f64 && y <= i32::MAX as f64 {
        return integer_power(x, y as i32);
    }
    // pow.def.h: exp2l((long double)y * log2l(fabs(x))). Keep the
    // logarithm and product in x87 precision until the final double store.
    let magnitude = x.abs();
    let limit = 0.29_f64;
    let mut saved = 0_u16;
    let mut truncated = 0_u16;
    let mut result = 0.0;
    unsafe {
        asm!(
            "fld1", "fldl ({x})", "fld %st", "fsub %st(2), %st",
            "fld %st", "fabs", "fcompl ({limit})", "fnstsw %ax",
            "andb $0x45, %ah", "jz 2f", "fstp %st(1)", "fyl2xp1", "jmp 3f",
            "2:", "fstp %st(0)", "fyl2x", "3:", "fmull ({y})",
            "fld %st", "fnstcw ({saved})", "movzwl ({saved}), %eax", "orb $12, %ah",
            "movw %ax, ({truncated})", "fldcw ({truncated})", "frndint", "fldcw ({saved})",
            "fsubr %st, %st(1)", "fxch", "f2xm1", "fld1", "faddp", "fscale",
            "fstp %st(1)", "fstpl ({result})",
            x=in(reg) &magnitude, y=in(reg) &y, limit=in(reg) &limit,
            saved=in(reg) &mut saved, truncated=in(reg) &mut truncated,
            result=in(reg) &mut result, out("eax") _, options(att_syntax, nostack)
        );
    }
    if x.is_sign_negative() && odd {
        -result
    } else {
        result
    }
}
