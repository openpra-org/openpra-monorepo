#[path = "integration/algorithms/bdd_integration.rs"]
mod bdd_integration;
#[path = "integration/algorithms/cut_set_output.rs"]
mod cut_set_output;
#[path = "integration/algorithms/cut_set_xml_output.rs"]
mod cut_set_xml_output;
#[path = "integration/algorithms/pdag_integration.rs"]
mod pdag_integration;
#[path = "integration/algorithms/preprocessor_integration.rs"]
mod preprocessor_integration;
#[path = "integration/algorithms/zbdd_integration.rs"]
mod zbdd_integration;

#[path = "integration/analysis/approximations_integration.rs"]
mod approximations_integration;
#[path = "integration/analysis/event_tree_integration.rs"]
mod event_tree_integration;
#[path = "integration/analysis/event_tree_mc_correlation.rs"]
mod event_tree_mc_correlation;
#[path = "integration/analysis/event_tree_mc_semantics.rs"]
mod event_tree_mc_semantics;
#[path = "integration/analysis/event_tree_quantification.rs"]
mod event_tree_quantification;
#[path = "integration/analysis/importance_integration.rs"]
mod importance_integration;
#[path = "integration/analysis/uncertainty_integration.rs"]
mod uncertainty_integration;

#[path = "integration/cli/cli_event_tree.rs"]
mod cli_event_tree;
#[path = "integration/cli/cli_event_tree_mc.rs"]
mod cli_event_tree_mc;
#[path = "integration/cli/cli_event_tree_mc_xml_output.rs"]
mod cli_event_tree_mc_xml_output;
#[path = "integration/cli/cli_mc_xml_output.rs"]
mod cli_mc_xml_output;
#[path = "integration/cli/cli_format_matrix.rs"]
mod cli_format_matrix;
#[path = "integration/cli/cli_mocus.rs"]
mod cli_mocus;
#[path = "integration/cli/cli_test.rs"]
mod cli_test;
#[path = "integration/cli/cli_xml_output_shape.rs"]
mod cli_xml_output_shape;

#[path = "integration/core/ccf_integration.rs"]
mod ccf_integration;

#[path = "integration/cuda/cuda_dpmc_parity.rs"]
mod cuda_dpmc_parity;
#[path = "integration/cuda/cuda_event_tree_gas_leak_parity.rs"]
mod cuda_event_tree_gas_leak_parity;
#[path = "integration/cuda/cuda_event_tree_mc_parity.rs"]
mod cuda_event_tree_mc_parity;
#[path = "integration/cuda/cuda_identity_fault_tree.rs"]
mod cuda_identity_fault_tree;

#[path = "integration/gpu/gpu_mc_integration.rs"]
mod gpu_mc_integration;

#[path = "integration/io/event_tree_parser_integration.rs"]
mod event_tree_parser_integration;

#[path = "integration/mc/event_tree_dpmc_scaffolding.rs"]
mod event_tree_dpmc_scaffolding;
#[path = "integration/mc/unary_gate_mc.rs"]
mod unary_gate_mc;

#[path = "integration/workflow/full_pra_workflow.rs"]
mod full_pra_workflow;
#[path = "integration/workflow/openpra_json_parity.rs"]
mod openpra_json_parity;
#[path = "integration/workflow/openpra_json_circular_refs.rs"]
mod openpra_json_circular_refs;
#[path = "integration/workflow/openpsa_xml_converter_section6.rs"]
mod openpsa_xml_converter_section6;
#[path = "integration/workflow/openpsa_xml_collect_expression_roundtrip.rs"]
mod openpsa_xml_collect_expression_roundtrip;

#[path = "integration/workflow/openpsa_xml_event_tree_library_roundtrip.rs"]
mod openpsa_xml_event_tree_library_roundtrip;
#[path = "integration/workflow/us1_simple_fta.rs"]
mod us1_simple_fta;
#[path = "integration/workflow/us2_xml_cli.rs"]
mod us2_xml_cli;
#[path = "integration/workflow/us3_monte_carlo.rs"]
mod us3_monte_carlo;
