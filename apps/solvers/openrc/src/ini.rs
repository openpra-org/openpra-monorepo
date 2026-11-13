use std::collections::HashSet;

use indexmap::IndexMap;

use crate::error::OpenRcError;
use crate::text::{is_space, repr_str, strip, strip_end};

const DEFAULT_SECTION: &str = "DEFAULT";
const MAX_INTERPOLATION_DEPTH: usize = 10;

type Options = IndexMap<String, Vec<String>>;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct IniDocument {
    defaults: IndexMap<String, String>,
    sections: IndexMap<String, IndexMap<String, String>>,
}

#[derive(Clone, PartialEq)]
enum Cursor {
    Defaults,
    Section(String),
}

fn section_header(value: &str) -> Option<&str> {
    let rest = value.strip_prefix('[')?;
    let end = rest.rfind(']')?;
    if end == 0 {
        return None;
    }
    Some(&rest[..end])
}

fn option_parts(value: &str) -> Option<(&str, &str)> {
    let index = value.find(['=', ':'])?;
    Some((strip_end(&value[..index]), strip(&value[index + 1..])))
}

fn indent_of(line: &str) -> usize {
    line.chars()
        .position(|character| !is_space(character))
        .unwrap_or(0)
}

fn join_values(options: Options) -> IndexMap<String, String> {
    options
        .into_iter()
        .map(|(name, lines)| (name, strip_end(&lines.join("\n")).to_string()))
        .collect()
}

impl IniDocument {
    pub fn parse(lines: &[&str], source: &str) -> Result<Self, OpenRcError> {
        let mut defaults: Options = IndexMap::new();
        let mut sections: IndexMap<String, Options> = IndexMap::new();
        let mut seen_sections: HashSet<String> = HashSet::new();
        let mut seen_options: HashSet<(String, String)> = HashSet::new();
        let mut cursor: Option<Cursor> = None;
        let mut section_name = String::new();
        let mut option_name: Option<String> = None;
        let mut indent_level = 0usize;
        let mut bad_lines: Vec<(usize, String)> = Vec::new();

        for (index, line) in lines.iter().enumerate() {
            let line_number = index + 1;
            let stripped = strip(line);
            let is_comment = stripped.starts_with('#') || stripped.starts_with(';');
            let value = if is_comment { "" } else { stripped };
            if value.is_empty() {
                if !is_comment {
                    if let (Some(current), Some(name)) = (&cursor, &option_name) {
                        if !name.is_empty() {
                            let options = match current {
                                Cursor::Defaults => &mut defaults,
                                Cursor::Section(section) => &mut sections[section.as_str()],
                            };
                            options[name.as_str()].push(String::new());
                        }
                    }
                }
                continue;
            }
            let current_indent = indent_of(line);
            let continues = option_name.as_ref().is_some_and(|name| !name.is_empty())
                && current_indent > indent_level;
            if let (Some(current), true) = (&cursor, continues) {
                let options = match current {
                    Cursor::Defaults => &mut defaults,
                    Cursor::Section(section) => &mut sections[section.as_str()],
                };
                if let Some(name) = &option_name {
                    options[name.as_str()].push(value.to_string());
                }
                continue;
            }
            indent_level = current_indent;
            if let Some(header) = section_header(value) {
                section_name = header.to_string();
                if sections.contains_key(header) {
                    if seen_sections.contains(header) {
                        return Err(OpenRcError::ConfigSyntax(format!(
                            "While reading from {} [line {:2}]: section {} already exists",
                            repr_str(source),
                            line_number,
                            repr_str(header)
                        )));
                    }
                    seen_sections.insert(section_name.clone());
                    cursor = Some(Cursor::Section(section_name.clone()));
                } else if header == DEFAULT_SECTION {
                    cursor = Some(Cursor::Defaults);
                } else {
                    sections.insert(section_name.clone(), IndexMap::new());
                    seen_sections.insert(section_name.clone());
                    cursor = Some(Cursor::Section(section_name.clone()));
                }
                option_name = None;
                continue;
            }
            let Some(current) = &cursor else {
                return Err(OpenRcError::ConfigSyntax(format!(
                    "File contains no section headers.\nfile: {}, line: {}\n{}",
                    repr_str(source),
                    line_number,
                    repr_str(&format!("{line}\n"))
                )));
            };
            let Some((name, option_value)) = option_parts(value) else {
                bad_lines.push((line_number, line.to_string()));
                continue;
            };
            if name.is_empty() {
                bad_lines.push((line_number, line.to_string()));
            }
            let pair = (section_name.clone(), name.to_string());
            if seen_options.contains(&pair) {
                return Err(OpenRcError::ConfigSyntax(format!(
                    "While reading from {} [line {:2}]: option {} in section {} already exists",
                    repr_str(source),
                    line_number,
                    repr_str(name),
                    repr_str(&section_name)
                )));
            }
            seen_options.insert(pair);
            let options = match current {
                Cursor::Defaults => &mut defaults,
                Cursor::Section(section) => &mut sections[section.as_str()],
            };
            options.insert(name.to_string(), vec![option_value.to_string()]);
            option_name = Some(name.to_string());
        }

        if !bad_lines.is_empty() {
            let mut message = format!("Source contains parsing errors: {}", repr_str(source));
            for (line_number, line) in &bad_lines {
                message.push_str(&format!(
                    "\n\t[line {:2}]: {}",
                    line_number,
                    repr_str(&format!("{line}\n"))
                ));
            }
            return Err(OpenRcError::ConfigSyntax(message));
        }

        Ok(Self {
            defaults: join_values(defaults),
            sections: sections
                .into_iter()
                .map(|(name, options)| (name, join_values(options)))
                .collect(),
        })
    }

    pub fn has_section(&self, section: &str) -> bool {
        self.sections.contains_key(section)
    }

    pub fn options(&self, section: &str) -> Vec<String> {
        let mut names: Vec<String> = Vec::new();
        if let Some(options) = self.sections.get(section) {
            names.extend(options.keys().cloned());
            for name in self.defaults.keys() {
                if !options.contains_key(name) {
                    names.push(name.clone());
                }
            }
        }
        names
    }

    fn raw(&self, section: &str, option: &str) -> Option<&str> {
        self.sections
            .get(section)?
            .get(option)
            .or_else(|| self.defaults.get(option))
            .map(String::as_str)
    }

    pub fn has_option(&self, section: &str, option: &str) -> bool {
        self.raw(section, option).is_some()
    }

    pub fn get(&self, section: &str, option: &str) -> Result<Option<String>, OpenRcError> {
        let Some(raw) = self.raw(section, option) else {
            return Ok(None);
        };
        let mut text = String::with_capacity(raw.len());
        self.interpolate(section, option, raw, raw, 1, &mut text)?;
        Ok(Some(text))
    }

    fn interpolate(
        &self,
        section: &str,
        option: &str,
        raw: &str,
        value: &str,
        depth: usize,
        text: &mut String,
    ) -> Result<(), OpenRcError> {
        if depth > MAX_INTERPOLATION_DEPTH {
            return Err(OpenRcError::ConfigSyntax(format!(
                "Recursion limit exceeded in value substitution: option {} in section {} \
                 contains an interpolation key which cannot be substituted in {} steps. \
                 Raw value: {}",
                repr_str(option),
                repr_str(section),
                MAX_INTERPOLATION_DEPTH,
                repr_str(raw)
            )));
        }
        let mut rest = value;
        while !rest.is_empty() {
            let Some(position) = rest.find('%') else {
                text.push_str(rest);
                return Ok(());
            };
            text.push_str(&rest[..position]);
            rest = &rest[position..];
            let after = &rest[1..];
            if let Some(remaining) = after.strip_prefix('%') {
                text.push('%');
                rest = remaining;
                continue;
            }
            let reference = after.strip_prefix('(').and_then(|inner| {
                let end = inner.find(')')?;
                let tail = inner[end + 1..].strip_prefix('s')?;
                if end == 0 {
                    return None;
                }
                Some((&inner[..end], tail))
            });
            if after.starts_with('(') {
                let Some((name, tail)) = reference else {
                    return Err(OpenRcError::ConfigSyntax(format!(
                        "bad interpolation variable reference {}",
                        repr_str(rest)
                    )));
                };
                rest = tail;
                let Some(replacement) = self.raw(section, name) else {
                    return Err(OpenRcError::ConfigSyntax(format!(
                        "Bad value substitution: option {} in section {} contains an \
                         interpolation key {} which is not a valid option name. Raw value: {}",
                        repr_str(option),
                        repr_str(section),
                        repr_str(name),
                        repr_str(raw)
                    )));
                };
                if replacement.contains('%') {
                    self.interpolate(section, option, raw, replacement, depth + 1, text)?;
                } else {
                    text.push_str(replacement);
                }
                continue;
            }
            return Err(OpenRcError::ConfigSyntax(format!(
                "'%' must be followed by '%' or '(', found: {}",
                repr_str(rest)
            )));
        }
        Ok(())
    }
}
