use std::path::{Component, Path, PathBuf};

use crate::error::OpenRcError;

pub fn is_space(character: char) -> bool {
    character.is_whitespace() || ('\u{1c}'..='\u{1f}').contains(&character)
}

pub fn strip(text: &str) -> &str {
    text.trim_matches(is_space)
}

pub fn strip_end(text: &str) -> &str {
    text.trim_end_matches(is_space)
}

pub fn split_lines(text: &str) -> Vec<&str> {
    let mut lines = Vec::new();
    let bytes = text.as_bytes();
    let mut start = 0;
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'\n' => {
                lines.push(&text[start..index]);
                index += 1;
                start = index;
            }
            b'\r' => {
                lines.push(&text[start..index]);
                index += 1;
                if index < bytes.len() && bytes[index] == b'\n' {
                    index += 1;
                }
                start = index;
            }
            _ => index += 1,
        }
    }
    if start < bytes.len() {
        lines.push(&text[start..]);
    }
    lines
}

fn scientific_parts(text: &str) -> (Vec<u8>, i32) {
    let (mantissa, exponent) = text.split_once('e').unwrap_or((text, "0"));
    let digits: Vec<u8> = mantissa.bytes().filter(u8::is_ascii_digit).collect();
    (digits, exponent.parse().unwrap_or(0))
}

fn ends_exactly_after(magnitude: f64, significant: usize) -> bool {
    let (digits, _) = scientific_parts(&format!("{magnitude:.800e}"));
    digits.iter().skip(significant).all(|digit| *digit == b'0')
}

fn decimal_digits(value: f64) -> (bool, String, i32) {
    let magnitude = value.abs();
    let (mut digits, exponent) = scientific_parts(&format!("{magnitude:e}"));
    let count = digits.len();
    if digits[count - 1] % 2 == 1 {
        let (longer, longer_exponent) = scientific_parts(&format!("{magnitude:.count$e}"));
        let mut halfway = digits.clone();
        halfway[count - 1] -= 1;
        halfway.push(b'5');
        if longer_exponent == exponent
            && longer == halfway
            && ends_exactly_after(magnitude, count + 1)
        {
            digits[count - 1] -= 1;
        }
    }
    let digits = String::from_utf8(digits).unwrap_or_default();
    (value.is_sign_negative(), digits, exponent + 1)
}

pub fn repr_float(value: f64) -> String {
    if value.is_nan() {
        return "nan".to_string();
    }
    if value.is_infinite() {
        return if value < 0.0 { "-inf" } else { "inf" }.to_string();
    }
    let (negative, digits, point) = decimal_digits(value);
    let count = digits.len() as i32;
    let mut text = String::new();
    if negative {
        text.push('-');
    }
    if point <= -4 || point > 16 {
        text.push_str(&digits[..1]);
        if count > 1 {
            text.push('.');
            text.push_str(&digits[1..]);
        }
        let exponent = point - 1;
        text.push('e');
        text.push(if exponent < 0 { '-' } else { '+' });
        text.push_str(&format!("{:02}", exponent.abs()));
    } else if point <= 0 {
        text.push_str("0.");
        for _ in 0..(-point) {
            text.push('0');
        }
        text.push_str(&digits);
    } else if point >= count {
        text.push_str(&digits);
        for _ in 0..(point - count) {
            text.push('0');
        }
        text.push_str(".0");
    } else {
        let split = point as usize;
        text.push_str(&digits[..split]);
        text.push('.');
        text.push_str(&digits[split..]);
    }
    text
}

fn non_finite_text(value: f64) -> Option<String> {
    if value.is_nan() {
        return Some("nan".to_string());
    }
    if value.is_infinite() {
        return Some(if value < 0.0 { "-inf" } else { "inf" }.to_string());
    }
    None
}

pub fn format_fixed(value: f64, precision: usize) -> String {
    if let Some(text) = non_finite_text(value) {
        return text;
    }
    format!("{value:.precision$}")
}

pub fn format_exp(value: f64, precision: usize) -> String {
    if let Some(text) = non_finite_text(value) {
        return text;
    }
    let scientific = format!("{value:.precision$e}");
    let (mantissa, exponent) = scientific.split_once('e').unwrap_or((&scientific, "0"));
    let (sign, digits) = match exponent.strip_prefix('-') {
        Some(digits) => ('-', digits),
        None => ('+', exponent),
    };
    format!("{mantissa}e{sign}{digits:0>2}")
}

pub fn pad_left(text: &str, width: usize) -> String {
    format!("{text:>width$}")
}

pub fn pad_right(text: &str, width: usize) -> String {
    format!("{text:<width$}")
}

fn is_hidden(character: char) -> bool {
    let code = character as u32;
    character.is_control()
        || (character != ' ' && character.is_whitespace())
        || code == 0xad
        || (0x200b..=0x200f).contains(&code)
        || (0x2028..=0x202e).contains(&code)
        || (0x2060..=0x2064).contains(&code)
        || code == 0xfeff
}

pub fn repr_str(text: &str) -> String {
    let quote = if text.contains('\'') && !text.contains('"') {
        '"'
    } else {
        '\''
    };
    let mut result = String::with_capacity(text.len() + 2);
    result.push(quote);
    for character in text.chars() {
        match character {
            '\\' => result.push_str("\\\\"),
            '\n' => result.push_str("\\n"),
            '\r' => result.push_str("\\r"),
            '\t' => result.push_str("\\t"),
            _ if character == quote => {
                result.push('\\');
                result.push(character);
            }
            _ if is_hidden(character) => {
                let code = character as u32;
                if code < 0x100 {
                    result.push_str(&format!("\\x{code:02x}"));
                } else if code < 0x10000 {
                    result.push_str(&format!("\\u{code:04x}"));
                } else {
                    result.push_str(&format!("\\U{code:08x}"));
                }
            }
            _ => result.push(character),
        }
    }
    result.push(quote);
    result
}

pub fn repr_str_list(items: &[&str]) -> String {
    let parts: Vec<String> = items.iter().map(|item| repr_str(item)).collect();
    format!("[{}]", parts.join(", "))
}

pub fn path_text(path: &Path) -> String {
    let normalized: PathBuf = path
        .components()
        .filter(|component| !matches!(component, Component::CurDir))
        .collect();
    if normalized.as_os_str().is_empty() {
        return ".".to_string();
    }
    normalized.display().to_string()
}

pub fn read_file_text(path: &Path) -> Result<String, OpenRcError> {
    std::fs::read_to_string(path).map_err(|error| {
        let message = format!("{}: {error}", path_text(path));
        if error.kind() == std::io::ErrorKind::NotFound {
            OpenRcError::FileNotFound(message)
        } else {
            OpenRcError::Io(message)
        }
    })
}
