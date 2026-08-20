use approx::assert_abs_diff_eq;
use praxis::core::event::BasicEvent;
use praxis::core::fault_tree::FaultTree;
use praxis::core::gate::{Formula, Gate};
use praxis::hcl::{
    parse_xdsl, quantify_hcl, CanonicalBayesianNetwork, CanonicalBayesianVariable, HclBindingSpec,
    HclEvidenceSpec, HclModel, HclRequest, HclSettings,
};
use tensorbayes::{EvidenceBatch, ExecutionEngine};

fn two_event_fault_tree() -> FaultTree {
    let mut fault_tree = FaultTree::new("hcl", "TOP").unwrap();
    fault_tree
        .add_basic_event(BasicEvent::new("A".to_string(), 0.2).unwrap())
        .unwrap();
    fault_tree
        .add_basic_event(BasicEvent::new("B".to_string(), 0.24).unwrap())
        .unwrap();
    let mut top = Gate::new("TOP".to_string(), Formula::And).unwrap();
    top.add_operand("A".to_string());
    top.add_operand("B".to_string());
    fault_tree.add_gate(top).unwrap();
    fault_tree
}

fn canonical_network() -> CanonicalBayesianNetwork {
    CanonicalBayesianNetwork {
        id: Some("correlated".to_string()),
        variables: vec![
            CanonicalBayesianVariable {
                name: "A".to_string(),
                states: vec!["false".to_string(), "true".to_string()],
                parents: vec![],
                probabilities: vec![0.8, 0.2],
            },
            CanonicalBayesianVariable {
                name: "B".to_string(),
                states: vec!["false".to_string(), "true".to_string()],
                parents: vec!["A".to_string()],
                probabilities: vec![0.9, 0.1, 0.2, 0.8],
            },
        ],
    }
}

fn bindings() -> Vec<HclBindingSpec> {
    vec![
        HclBindingSpec {
            event: "A".to_string(),
            node: "A".to_string(),
            true_states: vec!["true".to_string()],
        },
        HclBindingSpec {
            event: "B".to_string(),
            node: "B".to_string(),
            true_states: vec!["true".to_string()],
        },
    ]
}

#[test]
fn public_model_and_quantify_api_preserve_correlation() {
    let model = HclModel::new(
        two_event_fault_tree(),
        canonical_network().into_graph().unwrap(),
    )
    .unwrap()
    .with_bindings(bindings());
    let settings = HclSettings {
        variable_order: Some(vec!["A".to_string(), "B".to_string()]),
        ..HclSettings::default()
    };

    let result = quantify_hcl(&model, &settings).unwrap();
    assert_abs_diff_eq!(result.probability, 0.16, epsilon = 1e-12);
    assert_eq!(result.variable_order, vec!["A", "B"]);
    assert!(result.bridge.bn_query_cache_misses >= 2);
    assert_eq!(result.junction_tree.num_cliques, 1);

    let json = result.to_json_pretty().unwrap();
    assert!(json.contains("\"probability\": 0.16000000000000003"));
}

#[test]
fn versioned_canonical_request_builds_a_model() {
    let request_json = serde_json::json!({
        "schema_version": 1,
        "network": {
            "format": "canonical",
            "id": "correlated",
            "variables": canonical_network().variables,
        },
        "bindings": bindings(),
        "base_evidence": [],
        "settings": { "variable_order": ["A", "B"] }
    })
    .to_string();

    let request = HclRequest::from_json(&request_json).unwrap();
    let (model, settings) = request.into_model(two_event_fault_tree()).unwrap();
    let result = quantify_hcl(&model, &settings).unwrap();
    assert_abs_diff_eq!(result.probability, 0.16, epsilon = 1e-12);
}

#[test]
fn minimal_xdsl_import_preserves_states_parent_order_and_cpt_layout() {
    let xdsl = r#"
        <smile version="1.0" id="correlated">
          <nodes>
            <cpt id="A">
              <state id="false"/><state id="true"/>
              <probabilities>0.8 0.2</probabilities>
            </cpt>
            <cpt id="B">
              <state id="false"/><state id="true"/>
              <parents>A</parents>
              <probabilities>0.9 0.1 0.2 0.8</probabilities>
            </cpt>
          </nodes>
          <extensions><genie name="ignored-layout"/></extensions>
        </smile>
    "#;
    let canonical = parse_xdsl(xdsl).unwrap();
    assert_eq!(canonical.id.as_deref(), Some("correlated"));
    assert_eq!(canonical.variables[1].parents, vec!["A"]);

    let graph = canonical.into_graph().unwrap();
    let b = graph.node_id("B").unwrap();
    let tree =
        tensorbayes::CompiledJunctionTree::compile(graph, tensorbayes::CompileHeuristic::MinFill)
            .unwrap();
    let mut engine = ExecutionEngine::new(tree);
    let evidence = EvidenceBatch::new(1, 2, vec![1, -1]).unwrap();
    let marginal = engine.evaluate(&evidence, b).unwrap();
    assert_abs_diff_eq!(marginal.values()[1], 0.8, epsilon = 1e-12);
}

#[test]
fn request_base_evidence_uses_names() {
    let model = HclModel::new(
        two_event_fault_tree(),
        canonical_network().into_graph().unwrap(),
    )
    .unwrap()
    .with_bindings(bindings())
    .with_base_evidence(vec![HclEvidenceSpec {
        node: "A".to_string(),
        state: "true".to_string(),
    }]);
    let result = quantify_hcl(&model, &HclSettings::default()).unwrap();
    assert_abs_diff_eq!(result.probability, 0.8, epsilon = 1e-12);
}

#[test]
fn xdsl_rejects_non_cpt_nodes() {
    let error =
        parse_xdsl(r#"<smile><nodes><decision id="D"><state id="no"/></decision></nodes></smile>"#)
            .unwrap_err();
    assert!(error
        .to_string()
        .contains("unsupported XDSL node type 'decision'"));
}

#[test]
fn request_rejects_unknown_schema_versions() {
    let request = serde_json::json!({
        "schema_version": 99,
        "network": { "format": "canonical", "variables": [] }
    });
    let error = HclRequest::from_json(&request.to_string()).unwrap_err();
    assert!(error
        .to_string()
        .contains("unsupported HCL request schema version"));
}
