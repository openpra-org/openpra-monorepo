fn without_digit_separators(text: &str) -> Option<String> {
    if !text.contains('_') {
        return Some(text.to_string());
    }
    let bytes = text.as_bytes();
    let mut cleaned = String::with_capacity(text.len());
    for (index, character) in text.char_indices() {
        if character != '_' {
            cleaned.push(character);
            continue;
        }
        let digit_before = index > 0 && bytes[index - 1].is_ascii_digit();
        let digit_after = index + 1 < bytes.len() && bytes[index + 1].is_ascii_digit();
        if !digit_before || !digit_after {
            return None;
        }
    }
    Some(cleaned)
}

pub fn parse_float(text: &str) -> Option<f64> {
    without_digit_separators(text.trim())?.parse::<f64>().ok()
}

pub fn parse_int(text: &str) -> Option<i64> {
    let cleaned = without_digit_separators(text.trim())?;
    let digits = cleaned
        .strip_prefix('-')
        .or_else(|| cleaned.strip_prefix('+'))
        .unwrap_or(&cleaned);
    if digits.is_empty() || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    cleaned.parse::<i64>().ok()
}

pub fn round_to_digits(value: f64, digits: usize) -> f64 {
    if !value.is_finite() {
        return value;
    }
    format!("{value:.digits$}").parse::<f64>().unwrap_or(value)
}

pub fn sum_floats<I: IntoIterator<Item = f64>>(values: I) -> f64 {
    let mut iterator = values.into_iter();
    let Some(first) = iterator.next() else {
        return 0.0;
    };
    let mut total = 0.0 + first;
    let mut compensation = 0.0;
    for value in iterator {
        let next = total + value;
        if total.abs() >= value.abs() {
            compensation += (total - next) + value;
        } else {
            compensation += (value - next) + total;
        }
        total = next;
    }
    if compensation != 0.0 && compensation.is_finite() {
        total += compensation;
    }
    total
}

pub fn modulo(value: f64, divisor: f64) -> f64 {
    let mut remainder = value % divisor;
    if remainder != 0.0 {
        if (divisor < 0.0) != (remainder < 0.0) {
            remainder += divisor;
        }
    } else {
        remainder = 0.0_f64.copysign(divisor);
    }
    remainder
}

pub fn max_of(first: f64, second: f64) -> f64 {
    if second > first {
        second
    } else {
        first
    }
}

pub fn min_of(first: f64, second: f64) -> f64 {
    if second < first {
        second
    } else {
        first
    }
}

pub fn power(base: f64, exponent: f64) -> f64 {
    base.powf(std::hint::black_box(exponent))
}

pub fn square(value: f64) -> f64 {
    power(value.abs(), 2.0)
}
