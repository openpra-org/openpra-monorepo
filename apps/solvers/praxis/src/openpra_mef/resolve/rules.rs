#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResolutionOutcome {
    Resolved,
    Placeholder,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EdgeKind {
    Required,
    Optional,
    OutOfScope,
}

pub fn edge_kind(source_element: &str, target_type: &str) -> EdgeKind {
    match (source_element, target_type) {
        ("systems-analysis", "system-logic-model") => EdgeKind::Required,
        ("systems-analysis", "system-definition") => EdgeKind::Required,
        ("systems-analysis", "data-parameter") => EdgeKind::Required,
        ("initiating-event-analysis", "initiator") => EdgeKind::Required,
        ("event-sequence-analysis", "initiator") => EdgeKind::Required,
        ("event-sequence-analysis", "system-logic-model") => EdgeKind::Required,
        ("event-sequence-analysis", "event-sequence") => EdgeKind::Required,
        ("event-sequence-quantification", "event-sequence") => EdgeKind::Required,
        ("event-sequence-quantification", "initiator") => EdgeKind::Required,
        ("event-sequence-quantification", "quantification-family") => EdgeKind::Optional,
        ("initiating-event-analysis", "data-parameter") => EdgeKind::Optional,
        ("initiating-event-analysis", "system-definition") => EdgeKind::Optional,
        ("risk-integration", _) => EdgeKind::OutOfScope,
        _ => EdgeKind::Optional,
    }
}

pub fn classify_unresolved(
    source_element: &str,
    target_type: &str,
    strict_mode: bool,
) -> ResolutionOutcome {
    match edge_kind(source_element, target_type) {
        EdgeKind::Required => ResolutionOutcome::Error,
        EdgeKind::Optional => ResolutionOutcome::Placeholder,
        EdgeKind::OutOfScope => {
            if strict_mode {
                ResolutionOutcome::Error
            } else {
                ResolutionOutcome::Placeholder
            }
        }
    }
}
