use crate::config::PlumeSegment;

const NOBLE_GAS_ELEMENTS: [&str; 6] = ["Xe", "Kr", "Ar", "He", "Ne", "Rn"];

fn element_symbol(nuclide: &str) -> Option<String> {
    let letters: String = nuclide
        .chars()
        .skip_while(|c| c.is_ascii_digit())
        .take_while(|c| c.is_ascii_alphabetic())
        .collect();
    let mut rest = letters.chars();
    let first = rest.next()?;
    let mut symbol = String::with_capacity(letters.len());
    symbol.push(first.to_ascii_uppercase());
    for c in rest {
        symbol.push(c.to_ascii_lowercase());
    }
    Some(symbol)
}

fn group_for_element(element: &str) -> Option<usize> {
    match element {
        "Xe" | "Kr" | "Ar" | "He" | "Ne" | "Rn" => Some(1),
        "Cs" | "Rb" => Some(2),
        "Ba" | "Sr" => Some(3),
        "I" => Some(4),
        "Te" | "Se" => Some(5),
        "Ru" | "Rh" | "Tc" => Some(6),
        "Mo" | "Nb" | "Zr" | "Y" => Some(7),
        "Ce" | "Pr" | "Nd" | "Pm" | "Sm" | "Np" | "Pu" | "Am" | "Cm" => Some(8),
        "La" => Some(9),
        "U" | "Th" => Some(10),
        _ => None,
    }
}

fn default_group_deposition_velocity(group: Option<usize>) -> f64 {
    match group {
        Some(1) | Some(9) => 0.0,
        _ => 0.003,
    }
}

pub fn chemical_group_for_nuclide(nuclide: &str) -> Option<usize> {
    element_symbol(nuclide)
        .as_deref()
        .and_then(group_for_element)
}

pub fn deposition_velocity_for_nuclide(
    nuclide: &str,
    deposition_velocities_by_group: Option<&[f64]>,
) -> f64 {
    let element = element_symbol(nuclide);
    if element
        .as_deref()
        .is_some_and(|symbol| NOBLE_GAS_ELEMENTS.contains(&symbol))
    {
        return 0.0;
    }
    let group = element.as_deref().and_then(group_for_element);
    if let (Some(velocities), Some(group)) = (deposition_velocities_by_group, group) {
        if (1..=velocities.len()).contains(&group) {
            return velocities[group - 1];
        }
    }
    default_group_deposition_velocity(group)
}

#[derive(Debug, Clone, PartialEq)]
pub struct SegmentRelease {
    pub delay_s: f64,
    pub duration_s: f64,
    pub height_m: f64,
    pub released_bq: Vec<(String, f64)>,
    pub deposition_velocity_by_nuclide: Vec<(String, f64)>,
}

pub fn compute_segment_releases(
    source_term_bq: &[(String, f64)],
    plume_segments: &[PlumeSegment],
    deposition_velocities_by_group: Option<&[f64]>,
) -> Vec<SegmentRelease> {
    plume_segments
        .iter()
        .map(|segment| {
            let fractions = &segment.release_fractions_by_group;
            let mut released_bq = Vec::with_capacity(source_term_bq.len());
            let mut deposition_velocity_by_nuclide = Vec::with_capacity(source_term_bq.len());
            for (nuclide, inventory_bq) in source_term_bq {
                let release_fraction = match chemical_group_for_nuclide(nuclide) {
                    Some(group) if (1..=fractions.len()).contains(&group) => fractions[group - 1],
                    _ => 1.0,
                };
                released_bq.push((nuclide.clone(), inventory_bq * release_fraction));
                deposition_velocity_by_nuclide.push((
                    nuclide.clone(),
                    deposition_velocity_for_nuclide(nuclide, deposition_velocities_by_group),
                ));
            }
            SegmentRelease {
                delay_s: segment.delay_s,
                duration_s: segment.duration_s,
                height_m: segment.height_m,
                released_bq,
                deposition_velocity_by_nuclide,
            }
        })
        .collect()
}
