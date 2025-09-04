#include "ScramNodeModel.h"
#include <iostream>
#include <array>
#include <functional>
#include <stdexcept>
#include <algorithm>
#include <cstdint>

// Helper function to recursively parse gates and events from fault tree structure
void ParseFaultTreeElements(const Napi::Object& node, std::vector<ParsedGate>& parsedGates,
		std::vector<ParsedBasicEvent>& parsedBasicEvents, std::set<std::string>& seenBasicEvents,
		const std::string& basePath) {
	std::string nodeName = node.Get("name").ToString().Utf8Value();
	std::string nodeType = node.Has("type") ? node.Get("type").ToString().Utf8Value() : "unknown";
	// std::cout << " Parsing node: " << nodeName << " (type: " << nodeType << ")" << std::endl;

	// If this is a gate
	if (node.Has("type") && node.Get("type").ToString().Utf8Value() != "basic") {
		ParsedGate gate = ParseGate(node);
		gate.base_path = basePath;
		parsedGates.push_back(gate);
		// std::cout << " -> Added gate: " << gate.name << " with " << gate.gate_refs << " gate refs and " << gate.event_refs.size() << " event refs" << std::endl;

		// Recursively parse child gates
		if (node.Has("gates")) {
			Napi::Array gatesArr = node.Get("gates").As<Napi::Array>();
			for (uint32_t i = 0; i < gatesArr.Length(); ++i) {
				Napi::Object childGateObj = gatesArr.Get(i).As<Napi::Object>();
				ParseFaultTreeElements(childGateObj, parsedGates, parsedBasicEvents, seenBasicEvents, basePath);
			}
		}
	}

	// Parse child events
	if (node.Has("events")) {
		Napi::Array eventsArr = node.Get("events").As<Napi::Array>();
		for (uint32_t i = 0; i < eventsArr.Length(); ++i) {
			Napi::Object eventObj = eventsArr.Get(i).As<Napi::Object>();
			ParseFaultTreeElements(eventObj, parsedGates, parsedBasicEvents, seenBasicEvents, basePath);
		}
	} else if (node.Has("type") && node.Get("type").ToString().Utf8Value() == "basic") {
		// Only add if we haven't seen this basic event before
		if (seenBasicEvents.find(nodeName) == seenBasicEvents.end()) {
			ParsedBasicEvent event = ParseBasicEvent(node);
			event.base_path = basePath;
			parsedBasicEvents.push_back(event);
			seenBasicEvents.insert(nodeName);
			// std::cout << " -> Added basic event: " << event.name << std::endl;
		} else {
			std::cout << " -> Skipped duplicate basic event: " << nodeName << std::endl;
		}
	}
}

// Step 1: Parse JSON into intermediate structures
ParsedBasicEvent ParseBasicEvent(const Napi::Object& nodeEvent) {
	ParsedBasicEvent parsed;
	parsed.name = nodeEvent.Get("name").ToString().Utf8Value();

	if (nodeEvent.Has("description")) {
		parsed.description = nodeEvent.Get("description").ToString().Utf8Value();
	}

	if (nodeEvent.Has("type")) {
		parsed.type = nodeEvent.Get("type").ToString().Utf8Value();
	} else {
		parsed.type = "basic";
	}

	if (nodeEvent.Has("value")) {
		parsed.value = nodeEvent.Get("value");
	}

	if (nodeEvent.Has("systemMissionTime")) {
		parsed.systemMissionTime = nodeEvent.Get("systemMissionTime").ToNumber().DoubleValue();
	}

	if (nodeEvent.Has("basePath")) {
		parsed.base_path = nodeEvent.Get("basePath").ToString().Utf8Value();
	}

	return parsed;
}

ParsedGate ParseGate(const Napi::Object& nodeGate) {
	ParsedGate parsed;
	parsed.name = nodeGate.Get("name").ToString().Utf8Value();

	if (nodeGate.Has("description")) {
		parsed.description = nodeGate.Get("description").ToString().Utf8Value();
	}

	if (nodeGate.Has("type")) {
		parsed.type = nodeGate.Get("type").ToString().Utf8Value();
	} else {
		parsed.type = "and";
	}

	// Parse child gates
	if (nodeGate.Has("gates")) {
		Napi::Array gatesArr = nodeGate.Get("gates").As<Napi::Array>();
		for (uint32_t i = 0; i < gatesArr.Length(); ++i) {
			Napi::Object childGateObj = gatesArr.Get(i).As<Napi::Object>();
			std::string childName = childGateObj.Get("name").ToString().Utf8Value();
			parsed.gate_refs.push_back(childName);
		}
	}

	// Parse child events
	if (nodeGate.Has("events")) {
		Napi::Array eventsArr = nodeGate.Get("events").As<Napi::Array>();
		for (uint32_t i = 0; i < eventsArr.Length(); ++i) {
			Napi::Object eventObj = eventsArr.Get(i).As<Napi::Object>();
			std::string eventName = eventObj.Get("name").ToString().Utf8Value();
			parsed.event_refs.push_back(eventName);
		}
	}

	// Parse min/max numbers for atleast/cardinality gates
	if (parsed.type == "atleast" || parsed.type == "cardinality") {
		if (nodeGate.Has("minNumber")) {
			parsed.min_number = nodeGate.Get("minNumber").ToNumber().Int32Value();
		}
		if (parsed.type == "cardinality" && nodeGate.Has("maxNumber")) {
			parsed.max_number = nodeGate.Get("maxNumber").ToNumber().Int32Value();
		}
	}

	if (nodeGate.Has("basePath")) {
		parsed.base_path = nodeGate.Get("basePath").ToString().Utf8Value();
	}

	return parsed;
}

ParsedParameter ParseParameter(const Napi::Object& nodeParam) {
	ParsedParameter parsed;
	parsed.name = nodeParam.Get("name").ToString().Utf8Value();

	if (nodeParam.Has("description")) {
		parsed.description = nodeParam.Get("description").ToString().Utf8Value();
	}

	if (nodeParam.Has("value")) {
		parsed.value = nodeParam.Get("value");
	}

	if (nodeParam.Has("unit")) {
		parsed.unit = nodeParam.Get("unit").ToString().Utf8Value();
	}

	if (nodeParam.Has("basePath")) {
		parsed.base_path = nodeParam.Get("basePath").ToString().Utf8Value();
	}

	return parsed;
}

ParsedCCFGroup ParseCCFGroup(const Napi::Object& nodeCCF) {
	ParsedCCFGroup parsed;
	parsed.name = nodeCCF.Get("name").ToString().Utf8Value();
	parsed.model_type = nodeCCF.Get("model").ToString().Utf8Value();

	if (nodeCCF.Has("description")) {
		parsed.description = nodeCCF.Get("description").ToString().Utf8Value();
	}

	// Parse members
	if (nodeCCF.Has("members")) {
		Napi::Array membersArr = nodeCCF.Get("members").As<Napi::Array>();
		for (uint32_t i = 0; i < membersArr.Length(); ++i) {
			std::string memberName = membersArr.Get(i).ToString().Utf8Value();
			parsed.member_refs.push_back(memberName);
		}
	}

	// Parse distribution
	if (nodeCCF.Has("distribution")) {
		parsed.distribution = nodeCCF.Get("distribution");
	}

	// Parse factors
	if (nodeCCF.Has("factors")) {
		Napi::Array factorsArr = nodeCCF.Get("factors").As<Napi::Array>();
		for (uint32_t i = 0; i < factorsArr.Length(); ++i) {
			Napi::Object factorObj = factorsArr.Get(i).As<Napi::Object>();
			int level = factorObj.Has("level") ? factorObj.Get("level").ToNumber().Int32Value() : 0;
			Napi::Value factorValue = factorObj.Get("factorValue");
			parsed.factors.emplace_back(level, factorValue);
		}
	}

	if (nodeCCF.Has("basePath")) {
		parsed.base_path = nodeCCF.Get("basePath").ToString().Utf8Value();
	}

	return parsed;
}

ParsedFaultTree ParseFaultTree(const Napi::Object& nodeFaultTree) {
	ParsedFaultTree parsed;
	parsed.name = nodeFaultTree.Get("name").ToString().Utf8Value();

	if (nodeFaultTree.Has("description")) {
		parsed.description = nodeFaultTree.Get("description").ToString().Utf8Value();
	}

	if (nodeFaultTree.Has("topEvent")) {
		Napi::Object topEventObj = nodeFaultTree.Get("topEvent").As<Napi::Object>();
		parsed.top_event_ref = topEventObj.Get("name").ToString().Utf8Value();
	}

	// Parse CCF groups
	if (nodeFaultTree.Has("ccfGroups")) {
		Napi::Array ccfArr = nodeFaultTree.Get("ccfGroups").As<Napi::Array>();
		for (uint32_t i = 0; i < ccfArr.Length(); ++i) {
			Napi::Object ccfObj = ccfArr.Get(i).As<Napi::Object>();
			std::string ccfName = ccfObj.Get("name").ToString().Utf8Value();
			parsed.ccf_group_refs.push_back(ccfName);
		}
	}

	return parsed;
}

ParsedEventTree ParseEventTree(const Napi::Object& nodeEventTree) {
	ParsedEventTree parsed;
	parsed.name = nodeEventTree.Get("name").ToString().Utf8Value();

	if (nodeEventTree.Has("description")) {
		parsed.description = nodeEventTree.Get("description").ToString().Utf8Value();
	}

	if (nodeEventTree.Has("initiatingEvent")) {
		Napi::Object ieObj = nodeEventTree.Get("initiatingEvent").As<Napi::Object>();
		parsed.initiating_event_ref = ieObj.Get("name").ToString().Utf8Value();
	}

	// Parse sequences to extract functional events
	if (nodeEventTree.Has("eventSequences")) {
		Napi::Array seqArr = nodeEventTree.Get("eventSequences").As<Napi::Array>();
		std::set<std::string> feNames;

		for (uint32_t i = 0; i < seqArr.Length(); ++i) {
			Napi::Object seqObj = seqArr.Get(i).As<Napi::Object>();
			ParsedEventSequence sequence;
			sequence.end_state = seqObj.Get("endState").ToString().Utf8Value();

			Napi::Array feArr = seqObj.Get("functionalEvents").As<Napi::Array>();
			for (uint32_t j = 0; j < feArr.Length(); ++j) {
				Napi::Object feObj = feArr.Get(j).As<Napi::Object>();
				ParsedFunctionalEvent fe;
				fe.name = feObj.Get("name").ToString().Utf8Value();
				fe.state = feObj.Get("state").ToString().Utf8Value();

				if (feObj.Has("refGate")) {
					Napi::Object refGateObj = feObj.Get("refGate").As<Napi::Object>();
					fe.ref_gate_ref = refGateObj.Get("name").ToString().Utf8Value();
				}

				sequence.functional_events.push_back(fe);

				// Collect unique functional event names
				if (feNames.insert(fe.name).second) {
					parsed.functional_event_refs.push_back(fe.name);
				}
			}

			parsed.sequences.push_back(sequence);
		}
	}

	return parsed;
}

ParsedInitiatingEvent ParseInitiatingEvent(const Napi::Object& nodeIE) {
	ParsedInitiatingEvent parsed;
	parsed.name = nodeIE.Get("name").ToString().Utf8Value();

	if (nodeIE.Has("description")) {
		parsed.description = nodeIE.Get("description").ToString().Utf8Value();
	}

	if (nodeIE.Has("frequency")) {
		parsed.frequency = nodeIE.Get("frequency").ToNumber().DoubleValue();
	} else {
		parsed.frequency = 1.0; // default frequency
	}

	if (nodeIE.Has("unit")) {
		parsed.unit = nodeIE.Get("unit").ToString().Utf8Value();
	} else {
		parsed.unit = "year-1"; // default unit
	}

	return parsed;
}

// Step 2: Build SCRAM elements from parsed structures
std::unique_ptr<scram::mef::BasicEvent> BuildBasicEvent(const ParsedBasicEvent& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	auto be = std::make_unique<scram::mef::BasicEvent>(parsed.name);

	if (!parsed.description.empty()) {
		be->label(parsed.description);
	}

	if (!parsed.value.IsEmpty() && !parsed.value.IsUndefined() && !parsed.value.IsNull()) {
		scram::mef::Expression* expr = BuildExpression(parsed.value, model, registry, parsed.base_path);
		be->expression(expr);
	}

	// Handle systemMissionTime if present
	if (parsed.systemMissionTime.has_value()) {
		// Set system mission time - this would need to be implemented based on SCRAM's API
		// For now, we'll store it as an attribute
		be->SetAttribute(scram::mef::Attribute("systemMissionTime", std::to_string(parsed.systemMissionTime.value())));
	}

	return be;
}

std::unique_ptr<scram::mef::HouseEvent> BuildHouseEvent(const ParsedBasicEvent& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	auto he = std::make_unique<scram::mef::HouseEvent>(parsed.name);

	if (!parsed.description.empty()) {
		he->label(parsed.description);
	}

	// Value (state)
	if (!parsed.value.IsEmpty() && !parsed.value.IsUndefined() && !parsed.value.IsNull()) {
		bool state = parsed.value.ToBoolean().Value();
		he->state(state);
	}

	return he;
}

std::unique_ptr<scram::mef::Parameter> BuildParameter(const ParsedParameter& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	auto param = std::make_unique<scram::mef::Parameter>(parsed.name);

	if (!parsed.description.empty()) {
		param->label(parsed.description);
	}

	if (!parsed.value.IsEmpty() && !parsed.value.IsUndefined() && !parsed.value.IsNull()) {
		scram::mef::Expression* expr = BuildExpression(parsed.value, model, registry, parsed.base_path);
		param->expression(expr);
	}

	if (!parsed.unit.empty()) {
		param->unit(ScramNodeUnit(parsed.unit));
	}

	return param;
}

std::unique_ptr<scram::mef::CcfGroup> BuildCCFGroup(const ParsedCCFGroup& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	std::string modelType = ScramNodeCCFModelType(parsed.model_type);
	std::unique_ptr<scram::mef::CcfGroup> ccf;

	if (modelType == "beta-factor") {
		ccf = std::make_unique<scram::mef::BetaFactorModel>(parsed.name);
	} else if (modelType == "MGL") {
		ccf = std::make_unique<scram::mef::MglModel>(parsed.name);
	} else if (modelType == "alpha-factor") {
		ccf = std::make_unique<scram::mef::AlphaFactorModel>(parsed.name);
	} else {
		throw std::runtime_error("Unknown CCF model type: " + modelType);
	}

	if (!parsed.description.empty()) {
		ccf->label(parsed.description);
	}

	// Add distribution
	if (!parsed.distribution.IsEmpty() && !parsed.distribution.IsUndefined() && !parsed.distribution.IsNull()) {
		scram::mef::Expression* distr = BuildExpression(parsed.distribution, model, registry, parsed.base_path);
		ccf->AddDistribution(distr);
	}

	// Add factors
	for (const auto& [level, factorValue] : parsed.factors) {
		scram::mef::Expression* factorExpr = BuildExpression(factorValue, model, registry, parsed.base_path);
		ccf->AddFactor(factorExpr, level ? std::optional<int>(level) : std::nullopt);
	}

	return ccf;
}

std::unique_ptr<scram::mef::Gate> BuildGate(const ParsedGate& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	auto gate = std::make_unique<scram::mef::Gate>(parsed.name);

	if (!parsed.description.empty()) {
		gate->label(parsed.description);
	}

	scram::mef::Connective type = ScramNodeGateType(parsed.type);
	scram::mef::Formula::ArgSet argSet;

	// Build formula with proper min/max numbers
	std::optional<int> min_number = parsed.min_number;
	std::optional<int> max_number = parsed.max_number;

	auto formula = std::make_unique<scram::mef::Formula>(type, std::move(argSet), min_number, max_number);
	gate->formula(std::move(formula));

	return gate;
}

std::unique_ptr<scram::mef::Gate> BuildGateWithFormula(const ParsedGate& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	auto gate = std::make_unique<scram::mef::Gate>(parsed.name);

	if (!parsed.description.empty()) {
		gate->label(parsed.description);
	}

	// Build complete formula with all arguments resolved
	scram::mef::Connective type = ScramNodeGateType(parsed.type);
	scram::mef::Formula::ArgSet argSet;

	// Add child gates
	for (const auto& gateRef : parsed.gate_refs) {
		auto childGate = registry.FindElement<scram::mef::Gate>(gateRef);
		if (childGate) {
			argSet.Add(childGate);
		} else {
			throw std::runtime_error("Child gate not found: " + gateRef);
		}
	}

	// Add child events
	for (const auto& eventRef : parsed.event_refs) {
		auto event = registry.FindElement<scram::mef::BasicEvent>(eventRef);
		if (event) {
			argSet.Add(event);
		} else {
			throw std::runtime_error("Child event not found: " + eventRef);
		}
	}

	// Validate that we have at least 2 arguments (SCRAM requirement)
	if (argSet.size() < 2) {
		throw std::runtime_error("Gate " + parsed.name + " must have at least 2 arguments, but has " + std::to_string(argSet.size()));
	}

	// Build formula with proper min/max numbers and resolved arguments
	std::optional<int> min_number = parsed.min_number;
	std::optional<int> max_number = parsed.max_number;

	auto formula = std::make_unique<scram::mef::Formula>(type, std::move(argSet), min_number, max_number);
	gate->formula(std::move(formula));

	return gate;
}

// Expression builder for complex Value types
scram::mef::Expression* BuildExpression(const Napi::Value& nodeValue, scram::mef::Model* model, const ElementRegistry& registry, const std::string& basePath) {
	if (nodeValue.IsBoolean()) {
		bool val = nodeValue.ToBoolean().Value();
		return val ? &scram::mef::ConstantExpression::kOne : &scram::mef::ConstantExpression::kZero;
	}

	if (nodeValue.IsNumber()) {
		double val = nodeValue.ToNumber().DoubleValue();
		auto expr = std::make_unique<scram::mef::ConstantExpression>(val);
		scram::mef::Expression* ptr = expr.get();
		model->Add(std::move(expr));
		return ptr;
	}

	if (nodeValue.IsString()) {
		std::string paramName = nodeValue.ToString().Utf8Value();
		// Try to find parameter in registry first
		if (auto param = registry.FindElement<scram::mef::Parameter>(paramName)) {
			param->usage(true);
			return param;
		}
		// Fall back to model lookup
		const auto& params = model->table<scram::mef::Parameter>();
		auto it = std::find_if(params.begin(), params.end(),
			[&](const scram::mef::Parameter& p) { return p.name() == paramName; });
		if (it != params.end()) {
			it->usage(true);
			return const_cast<scram::mef::Parameter*>(&(*it));
		}
		throw std::runtime_error("Unknown parameter reference: " + paramName);
	}

	if (nodeValue.IsObject()) {
		Napi::Object obj = nodeValue.As<Napi::Object>();

		// Check for Parameter object
		if (obj.Has("name") && obj.Has("value")) {
			ParsedParameter parsedParam = ParseParameterValue(obj);
			return BuildParameterExpression(parsedParam, model, registry);
		}

		// Check for BuiltInFunction
		if (obj.Has("exponential") || obj.Has("GLM") || obj.Has("Weibull") || obj.Has("periodicTest")) {
			ParsedBuiltInFunction parsedFunc = ParseBuiltInFunction(obj);
			return BuildBuiltInFunctionExpression(parsedFunc, model, registry);
		}

		// Check for RandomDeviate
		if (obj.Has("uniformDeviate") || obj.Has("normalDeviate") || obj.Has("lognormalDeviate") ||
			obj.Has("gammaDeviate") || obj.Has("betaDeviate") || obj.Has("histogram")) {
			ParsedRandomDeviate parsedDeviate = ParseRandomDeviate(obj);
			return BuildRandomDeviateExpression(parsedDeviate, model, registry);
		}

		// Check for NumericalOperation
		if (obj.Has("neg") || obj.Has("add") || obj.Has("sub") || obj.Has("mul") || obj.Has("div") ||
			obj.Has("pow") || obj.Has("sin") || obj.Has("cos") || obj.Has("tan") || obj.Has("log") ||
			obj.Has("exp") || obj.Has("sqrt") || obj.Has("abs") || obj.Has("min") || obj.Has("max")) {
			ParsedNumericalOperation parsedOp = ParseNumericalOperation(obj);
			return BuildNumericalOperationExpression(parsedOp, model, registry);
		}
	}

	throw std::runtime_error("Unsupported value type in BuildExpression");
}

// Step 3: Main model building function
std::unique_ptr<scram::mef::Model> ScramNodeModel(const Napi::Object& nodeModel) {
	// Create the top-level Model
	std::string modelName = nodeModel.Has("name") ? nodeModel.Get("name").ToString().Utf8Value() : "model";
	auto model = std::make_unique<scram::mef::Model>(modelName);

	// Description (optional)
	if (nodeModel.Has("description")) {
		model->label(nodeModel.Get("description").ToString().Utf8Value());
	}

	// Set global mission time if present
	if (nodeModel.Has("missionTime")) {
		double mt = nodeModel.Get("missionTime").ToNumber().DoubleValue();
		model->mission_time().value(mt);
	}

	// Create element registry
	ElementRegistry registry;
 
	// Phase 1: Parse all elements into intermediate structures
	std::vector<ParsedBasicEvent> parsedBasicEvents;
	std::vector<ParsedGate> parsedGates;
	std::vector<ParsedParameter> parsedParameters;
	std::vector<ParsedCCFGroup> parsedCCFGroups;
	std::vector<ParsedFaultTree> parsedFaultTrees;
	std::vector<ParsedEventTree> parsedEventTrees;
	std::vector<ParsedInitiatingEvent> parsedInitiatingEvents;
	std::set<std::string> seenInitiatingEventNames;

	// Parse basic events
	if (nodeModel.Has("basicEvents")) {
		Napi::Array beArr = nodeModel.Get("basicEvents").As<Napi::Array>();
		std::cout << "Found " << beArr.Length() << " items in basicEvents" << std::endl;
		for (uint32_t i = 0; i < beArr.Length(); ++i) {
			Napi::Object beObj = beArr.Get(i).As<Napi::Object>();
			parsedBasicEvents.push_back(ParseBasicEvent(beObj));
		}
	}
 
	// Parse modelData (alternative format for basic events)
	if (nodeModel.Has("modelData")) {
		Napi::Array mdArr = nodeModel.Get("modelData").As<Napi::Array>();
		std::cout << "Found " << mdArr.Length() << " items in modelData" << std::endl;
		for (uint32_t i = 0; i < mdArr.Length(); ++i) {
			Napi::Object mdObj = mdArr.Get(i).As<Napi::Object>();
			ParsedBasicEvent be;
			be.name = mdObj.Get("name").ToString().Utf8Value();
			if (mdObj.Has("description")) {
				be.description = mdObj.Get("description").ToString().Utf8Value();
			}
			be.type = "basic";
			if (mdObj.Has("value")) {
				be.value = mdObj.Get("value");
			}
			if (mdObj.Has("systemMissionTime")) {
				be.systemMissionTime = mdObj.Get("systemMissionTime").ToNumber().DoubleValue();
			}
			parsedBasicEvents.push_back(be);
		}
		std::cout << " Added " << mdArr.Length() << " basic events from modelData" << std::endl;
	}
 
	// Parse parameters
	if (nodeModel.Has("parameters")) {
		Napi::Array paramArr = nodeModel.Get("parameters").As<Napi::Array>();
		for (uint32_t i = 0; i < paramArr.Length(); ++i) {
			Napi::Object paramObj = paramArr.Get(i).As<Napi::Object>();
			parsedParameters.push_back(ParseParameter(paramObj));
		}
	}
 
	// Parse CCF groups
	if (nodeModel.Has("ccfGroups")) {
		Napi::Array ccfArr = nodeModel.Get("ccfGroups").As<Napi::Array>();
		for (uint32_t i = 0; i < ccfArr.Length(); ++i) {
			Napi::Object ccfObj = ccfArr.Get(i).As<Napi::Object>();
			parsedCCFGroups.push_back(ParseCCFGroup(ccfObj));
		}
	}
 
	// Parse gates
	if (nodeModel.Has("gates")) {
		Napi::Array gateArr = nodeModel.Get("gates").As<Napi::Array>();
		std::cout << "Found " << gateArr.Length() << " items in gates" << std::endl;
		for (uint32_t i = 0; i < gateArr.Length(); ++i) {
			Napi::Object gateObj = gateArr.Get(i).As<Napi::Object>();
			parsedGates.push_back(ParseGate(gateObj));
		}
	}
 
	// Parse fault trees and extract gates/events from hierarchical structure
	if (nodeModel.Has("faultTrees")) {
		Napi::Array ftArr = nodeModel.Get("faultTrees").As<Napi::Array>();
		std::cout << "Found " << ftArr.Length() << " fault trees" << std::endl;
		for (uint32_t i = 0; i < ftArr.Length(); ++i) {
			Napi::Object ftObj = ftArr.Get(i).As<Napi::Object>();
			parsedFaultTrees.push_back(ParseFaultTree(ftObj));

			// Extract gates and events from the fault tree structure
			if (ftObj.Has("topEvent")) {
				Napi::Object topEventObj = ftObj.Get("topEvent").As<Napi::Object>();
				std::cout << "Parsing fault tree elements from top event: " << topEventObj.Get("name").ToString().Utf8Value() << std::endl;
				std::set<std::string> seenBasicEvents;
				ParseFaultTreeElements(topEventObj, parsedGates, parsedBasicEvents, seenBasicEvents);
				std::cout << "Extracted " << parsedGates.size() << " gates from fault tree structure" << std::endl;
			}
		}
	}
 
	// Parse event trees
	if (nodeModel.Has("eventTrees")) {
		Napi::Array etArr = nodeModel.Get("eventTrees").As<Napi::Array>();
		for (uint32_t i = 0; i < etArr.Length(); ++i) {
			Napi::Object etObj = etArr.Get(i).As<Napi::Object>();
			parsedEventTrees.push_back(ParseEventTree(etObj));
			// Also parse initiating event from within ET to create/ensure IE
			if (etObj.Has("initiatingEvent")) {
				Napi::Object ieObj = etObj.Get("initiatingEvent").As<Napi::Object>();
				std::string ieName = ieObj.Get("name").ToString().Utf8Value();
				if (seenInitiatingEventNames.insert(ieName).second) {
					parsedInitiatingEvents.push_back(ParseInitiatingEvent(ieObj));
				}
			}
		}
	}
 
	// Parse initiating events (top-level optional; avoid duplicates)
	if (nodeModel.Has("initiatingEvents")) {
		Napi::Array ieArr = nodeModel.Get("initiatingEvents").As<Napi::Array>();
		for (uint32_t i = 0; i < ieArr.Length(); ++i) {
			Napi::Object ieObj = ieArr.Get(i).As<Napi::Object>();
			std::string ieName = ieObj.Get("name").ToString().Utf8Value();
			if (seenInitiatingEventNames.insert(ieName).second) {
				parsedInitiatingEvents.push_back(ParseInitiatingEvent(ieObj));
			}
		}
	}
 
	// Summary of parsing phase
	std::cout << "=== PARSING PHASE COMPLETE ===" << std::endl;
	std::cout << "Parsed: " << parsedBasicEvents.size() << " basic events, "
		<< parsedGates.size() << " gates, " << parsedFaultTrees.size() << " fault trees" << std::endl;

	// Phase 2: Build SCRAM elements in dependency order
	// First, build basic events and parameters (no dependencies)
	std::cout << "=== PHASE 2: Building Basic Elements ===" << std::endl;
	std::cout << "Building " << parsedBasicEvents.size() << " basic events..." << std::endl;
	for (const auto& parsed : parsedBasicEvents) {
		// std::cout << "Building basic event: " << parsed.name << std::endl;
		auto be = BuildBasicEvent(parsed, model.get(), registry);
		registry.RegisterElement(parsed.name, std::move(be));
	}
	std::cout << " ￾ Basic events built successfully" << std::endl;
 
	if (!parsedParameters.empty()) {
		std::cout << "Building " << parsedParameters.size() << " parameters..." << std::endl;
		for (const auto& parsed : parsedParameters) {
			auto param = BuildParameter(parsed, model.get(), registry);
			registry.RegisterElement(parsed.name, std::move(param));
		}
		std::cout << " ￾ Parameters built successfully" << std::endl;
	}
 
	// Then build CCF groups
	if (!parsedCCFGroups.empty()) {
		std::cout << "Building " << parsedCCFGroups.size() << " CCF groups..." << std::endl;
		for (const auto& parsed : parsedCCFGroups) {
			auto ccf = BuildCCFGroup(parsed, model.get(), registry);
			registry.RegisterElement(parsed.name, std::move(ccf));
		}
		std::cout << " ￾ CCF groups built successfully" << std::endl;
	}
 
	// Phase 3: Build gates with complete formulas in dependency order
	std::cout << "=== PHASE 3: Building Gates ===" << std::endl;
	std::cout << "Building " << parsedGates.size() << " gates in dependency order..." << std::endl;

	// Show what's available in the registry
	std::cout << "Available basic events in registry: " << registry.GetElements<scram::mef::BasicEvent>().size() << " events" << std::endl;

	// Print dependency information (summary)
	std::cout << "Gate dependencies: " << parsedGates.size() << " gates to build" << std::endl;

	// Build gates in dependency order using topological sort
	std::vector<ParsedGate> remainingGates = parsedGates;
	std::set<std::string> builtGateNames;
	int iteration = 0;
 
	while (!remainingGates.empty()) {
		iteration++;
		std::cout << "Iteration " << iteration << ": " << remainingGates.size() << " gates remaining" << std::endl;

		bool progressMade = false;
		std::vector<ParsedGate> stillRemaining;

		for (const auto& parsed : remainingGates) {
			// Check if all child gates and events are available
			bool allDependenciesAvailable = true;

			// Check child gates
			for (const auto& gateRef : parsed.gate_refs) {
				if (builtGateNames.find(gateRef) == builtGateNames.end()) {
					allDependenciesAvailable = false;
					break;
				}
			}

			// Check child events
			for (const auto& eventRef : parsed.event_refs) {
				if (!registry.FindElement<scram::mef::BasicEvent>(eventRef)) {
					allDependenciesAvailable = false;
					break;
				}
			}

			if (allDependenciesAvailable) {
				// Build gate with complete formula
				auto gate = BuildGateWithFormula(parsed, model.get(), registry);
				registry.RegisterElement(parsed.name, std::move(gate));
				builtGateNames.insert(parsed.name);
				progressMade = true;
			} else {
				// Keep for next iteration
				stillRemaining.push_back(parsed);
			}
		}

		// If no progress was made in this iteration, we have a circular dependency
		if (!progressMade && !stillRemaining.empty()) {
			std::string errorMsg = "Circular dependency detected after " + std::to_string(iteration) + " iterations. Gates with unresolved dependencies: ";
			for (const auto& gate : stillRemaining) {
				errorMsg += gate.name + " ";
			}
			throw std::runtime_error(errorMsg);
		}

		remainingGates = std::move(stillRemaining);
	}
 
	std::cout << "All " << parsedGates.size() << " gates built successfully in " << iteration << " iterations!" << std::endl;

	// Phase 4: Resolve CCF group members
	if (!parsedCCFGroups.empty()) {
		std::cout << "Resolving CCF group members..." << std::endl;
		for (const auto& parsed : parsedCCFGroups) {
			auto ccf = registry.FindElement<scram::mef::CcfGroup>(parsed.name);
			if (ccf) {
				for (const auto& memberRef : parsed.member_refs) {
					auto member = registry.FindElement<scram::mef::BasicEvent>(memberRef);
					if (member) {
						ccf->AddMember(member);
					} else {
						throw std::runtime_error("CCF group member not found: " + memberRef);
					}
				}
			}
		}
		std::cout << " ￾ CCF group members resolved successfully" << std::endl;
	}
 
	// Phase 5: Build fault trees and event trees with resolved references
	if (!parsedFaultTrees.empty()) {
		std::cout << "Building " << parsedFaultTrees.size() << " fault trees..." << std::endl;
		for (const auto& parsed : parsedFaultTrees) {
			auto ft = ScramNodeFaultTree(parsed, model.get(), registry);
			ft->CollectTopEvents();
			model->Add(std::move(ft));
		}
		std::cout << " ￾ Fault trees built successfully" << std::endl;
	}

	if (!parsedEventTrees.empty()) {
		std::cout << "Building " << parsedEventTrees.size() << " event trees..." << std::endl;
		for (const auto& parsed : parsedEventTrees) {
			auto et = ScramNodeEventTree(parsed, model.get(), registry);
			model->Add(std::move(et));
		}
		std::cout << " ￾ Event trees built successfully" << std::endl;
	}
 
	// Phase 6: Build initiating events
	if (!parsedInitiatingEvents.empty()) {
		std::cout << "Building " << parsedInitiatingEvents.size() << " initiating events..." << std::endl;
		for (const auto& parsed : parsedInitiatingEvents) {
			auto ie = ScramNodeInitiatingEvent(parsed, model.get());
			model->Add(std::move(ie));
		}
		std::cout << " ￾ Initiating events built successfully" << std::endl;
	}

	// Transfer all elements from registry to model
	std::cout << "Finalizing model..." << std::endl;
	registry.ExtractAllToModel(model.get());

	// Link InitiatingEvent -> EventTree by name reference captured in parsedEventTrees
	{
		std::unordered_map<std::string, scram::mef::EventTree*> etByName;
		for (auto& et : model->event_trees()) {
			etByName.emplace(et.name(), const_cast<scram::mef::EventTree*>(&et));
		}
		std::unordered_map<std::string, scram::mef::InitiatingEvent*> ieByName;
		for (auto& ie : model->initiating_events()) {
			ieByName.emplace(ie.name(), const_cast<scram::mef::InitiatingEvent*>(&ie));
		}
		for (const auto& pet : parsedEventTrees) {
			if (pet.initiating_event_ref.empty()) continue;
			auto itET = etByName.find(pet.name);
			auto itIE = ieByName.find(pet.initiating_event_ref);
			if (itET == etByName.end()) {
				throw std::runtime_error("EventTree not found for linking: " + pet.name);
			}
			if (itIE == ieByName.end()) {
				throw std::runtime_error("InitiatingEvent '" + pet.initiating_event_ref + "' not found to link ET '" + pet.name + "'");
			}
			itIE->second->event_tree(itET->second);
		}
	}

	std::cout << "=== MODEL BUILDING COMPLETE ===" << std::endl;
	std::cout << "Final model contains: " << model->basic_events().size() << " basic events, "
		<< model->gates().size() << " gates, " << model->fault_trees().size() << " fault trees" << std::endl;

	return model;
}

// New function: Build model and return summary info without running analysis
Napi::Value BuildModelOnly(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();
	if (info.Length() < 1) {
		Napi::TypeError::New(env, "Model object is required").ThrowAsJavaScriptException();
		return env.Null();
	}
	if (!info[0].IsObject()) {
		Napi::TypeError::New(env, "Model object required").ThrowAsJavaScriptException();
		return env.Null();
	}
	Napi::Object nodeModel = info[0].As<Napi::Object>();

	try {
		// Build the model (this will show the diagnostic output)
		auto model = ScramNodeModel(nodeModel);

		// Create a summary object to return
		Napi::Object summary = Napi::Object::New(env);

		// Get model statistics
		summary.Set("totalBasicEvents", model->basic_events().size());
		summary.Set("totalGates", model->gates().size());
		summary.Set("totalFaultTrees", model->fault_trees().size());
		summary.Set("totalParameters", model->parameters().size());
		summary.Set("totalCCFGroups", model->ccf_groups().size());

		// Get basic event names
		Napi::Array basicEventNames = Napi::Array::New(env);
		int i = 0;
		for (const auto& event : model->basic_events()) {
			basicEventNames.Set(i++, event.name());
		}
		summary.Set("basicEventNames", basicEventNames);

		// Get gate names
		Napi::Array gateNames = Napi::Array::New(env);
		i = 0;
		for (const auto& gate : model->gates()) {
			gateNames.Set(i++, gate.name());
		}
		summary.Set("gateNames", gateNames);

		// Get fault tree names
		Napi::Array faultTreeNames = Napi::Array::New(env);
		i = 0;
		for (const auto& ft : model->fault_trees()) {
			faultTreeNames.Set(i++, ft.name());
		}
		summary.Set("faultTreeNames", faultTreeNames);

		summary.Set("message", "Model built successfully! Use QuantifyModel() to run analysis.");

		return summary;

	} catch (const std::exception& e) {
		Napi::Error::New(env, std::string("Failed to build model: ") + e.what()).ThrowAsJavaScriptException();
		return env.Null();
	}
}

// FaultTree building with resolved references
std::unique_ptr<scram::mef::FaultTree> ScramNodeFaultTree(const ParsedFaultTree& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	auto ft = std::make_unique<scram::mef::FaultTree>(parsed.name);

	if (!parsed.description.empty()) {
		ft->label(parsed.description);
	}

	// Add CCF groups
	for (const auto& ccfRef : parsed.ccf_group_refs) {
		auto ccf = registry.FindElement<scram::mef::CcfGroup>(ccfRef);
		if (ccf) {
			ft->Add(ccf);
		} else {
			throw std::runtime_error("CCF group not found: " + ccfRef);
		}
	}

	// Set top event
	if (!parsed.top_event_ref.empty()) {
		auto topEvent = registry.FindElement<scram::mef::Gate>(parsed.top_event_ref);
		if (topEvent) {
			ft->Add(topEvent);
		} else {
			throw std::runtime_error("Top event not found: " + parsed.top_event_ref);
		}
	}

	return ft;
}

// EventTree building with resolved references
std::unique_ptr<scram::mef::EventTree> ScramNodeEventTree(const ParsedEventTree& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	using namespace scram::mef;

	auto et = std::make_unique<EventTree>(parsed.name);
	if (!parsed.description.empty()) {
		et->label(parsed.description);
	}

	// 1) Functional events registry
	std::unordered_map<std::string, FunctionalEvent*> feByName;
	feByName.reserve(parsed.functional_event_refs.size());
	for (const auto& feName : parsed.functional_event_refs) {
		auto fe = std::make_unique<FunctionalEvent>(feName);
		FunctionalEvent* fePtr = fe.get();
		et->Add(std::move(fe));
		feByName.emplace(feName, fePtr);
	}

	// 2) Create sequences; attach CollectFormula instructions based on FE states
	std::vector<Sequence*> seqPtrs;
	seqPtrs.reserve(parsed.sequences.size());

	auto makeCollectFormula = [&](const scram::mef::Gate* gate, bool complement) -> scram::mef::Instruction* {
		Formula::ArgSet as;
		as.Add(const_cast<Gate*>(gate));
		std::unique_ptr<Formula> f;
		if (complement) f = std::make_unique<Formula>(kNot, std::move(as));
		else            f = std::make_unique<Formula>(kNull, std::move(as));
		auto instr = std::make_unique<CollectFormula>(std::move(f));
		Instruction* p = instr.get();
		model->Add(std::move(instr));
		return p;
	};

	for (const auto& seqParsed : parsed.sequences) {
		auto seq = std::make_unique<Sequence>(seqParsed.end_state);
		Sequence* seqPtr = seq.get();
		et->Add(seq.get());
		model->Add(std::move(seq));
		seqPtrs.push_back(seqPtr);

		std::vector<Instruction*> instrs;
		instrs.reserve(seqParsed.functional_events.size());
		for (const auto& fe : seqParsed.functional_events) {
			if (fe.ref_gate_ref.empty()) continue;
			auto g = registry.FindElement<Gate>(fe.ref_gate_ref);
			if (!g) {
				throw std::runtime_error("EventTree '" + parsed.name +
					"': functional event '" + fe.name +
					"' references unknown gate '" + fe.ref_gate_ref + "'");
			}
			if (fe.state == "failure") {
				instrs.push_back(makeCollectFormula(g, false));
			} else if (fe.state == "success") {
				instrs.push_back(makeCollectFormula(g, true));
			} else if (fe.state == "bypass") {
				// no op
			} else {
				throw std::runtime_error("EventTree '" + parsed.name +
					"': functional event '" + fe.name +
					"' has unknown state '" + fe.state + "'");
			}
		}
		if (!instrs.empty()) {
			seqPtr->instructions(std::move(instrs));
		}
	}

	// 3) Fork chain over functional_event_refs to dispatch sequences by FE states
	std::vector<std::unordered_map<std::string, std::string>> seqStateMap(parsed.sequences.size());
	for (size_t i = 0; i < parsed.sequences.size(); ++i) {
		for (const auto& fe : parsed.sequences[i].functional_events) {
			seqStateMap[i][fe.name] = fe.state;
		}
	}

	// recursive builder: returns Fork* added to ET
	std::function<Fork*(size_t, const std::vector<size_t>&)> buildFork =
		[&](size_t level, const std::vector<size_t>& indices) -> Fork* {
			if (level >= parsed.functional_event_refs.size()) {
				return nullptr;
			}
			const std::string& feName = parsed.functional_event_refs[level];
			auto itFE = feByName.find(feName);
			if (itFE == feByName.end()) {
				throw std::runtime_error("EventTree '" + parsed.name + "': unknown functional event '" + feName + "' in order.");
			}
			auto fork = std::make_unique<Fork>(*itFE->second, std::vector<scram::mef::Path>{});
			Fork* forkPtr = fork.get();

			std::array<const char*, 3> stateOrder{{"failure","success","bypass"}};
			for (const char* state : stateOrder) {
				std::vector<size_t> next;
				next.reserve(indices.size());
				for (size_t idx : indices) {
					auto sit = seqStateMap[idx].find(feName);
					std::string s = (sit != seqStateMap[idx].end() ? sit->second : std::string("bypass"));
					if (s == state) {
						next.push_back(idx);
					}
				}
				if (next.empty()) continue;

				Path path(state);
				if (level + 1 < parsed.functional_event_refs.size()) {
					Fork* child = buildFork(level + 1, next);
					if (!child) {
						if (next.size() != 1) {
							throw std::runtime_error("EventTree '" + parsed.name + "': non-unique leaf under functional chain.");
						}
						path.target(seqPtrs[next.front()]);
					} else {
						path.target(child);
					}
				} else {
					if (next.size() != 1) {
						throw std::runtime_error("EventTree '" + parsed.name + "': non-unique leaf for final level.");
					}
					path.target(seqPtrs[next.front()]);
				}
				forkPtr->paths().push_back(std::move(path));
			}

			if (forkPtr->paths().empty()) {
				return nullptr;
			}

			et->Add(std::move(fork));
			return forkPtr;
		};

	std::vector<size_t> rootIdx(parsed.sequences.size());
	for (size_t i = 0; i < rootIdx.size(); ++i) rootIdx[i] = i;

	scram::mef::Branch initial;
	if (!parsed.functional_event_refs.empty()) {
		Fork* rootFork = buildFork(0, rootIdx);
		if (!rootFork) {
			if (seqPtrs.size() == 1) {
				initial.target(seqPtrs[0]);
			} else {
				throw std::runtime_error("EventTree '" + parsed.name + "': no paths constructed and multiple sequences present.");
			}
		} else {
			initial.target(rootFork);
		}
	} else {
		if (seqPtrs.size() == 1) {
			initial.target(seqPtrs[0]);
		} else {
			throw std::runtime_error("EventTree '" + parsed.name + "': functionalEvents are empty but sequences > 1.");
		}
	}
	et->initial_state(std::move(initial));

	// The InitiatingEvent is linked later in ScramNodeModel()
	return et;
}

// InitiatingEvent building
std::unique_ptr<scram::mef::InitiatingEvent> ScramNodeInitiatingEvent(const ParsedInitiatingEvent& parsed, scram::mef::Model* model) {
	auto ie = std::make_unique<scram::mef::InitiatingEvent>(parsed.name);

	if (!parsed.description.empty()) {
		ie->label(parsed.description);
	}

	// Set frequency and unit as attributes
	ie->SetAttribute(scram::mef::Attribute("frequency", std::to_string(parsed.frequency)));
	ie->SetAttribute(scram::mef::Attribute("unit", parsed.unit));

	return ie;
}

// Complex Value type parsing functions
ParsedParameter ParseParameterValue(const Napi::Object& nodeParam) {
	ParsedParameter parsed;
	parsed.name = nodeParam.Get("name").ToString().Utf8Value();

	if (nodeParam.Has("description")) {
		parsed.description = nodeParam.Get("description").ToString().Utf8Value();
	}

	if (nodeParam.Has("value")) {
		parsed.value = nodeParam.Get("value");
	}

	if (nodeParam.Has("unit")) {
		parsed.unit = nodeParam.Get("unit").ToString().Utf8Value();
	}

	return parsed;
}

ParsedBuiltInFunction ParseBuiltInFunction(const Napi::Object& nodeFunction) {
	ParsedBuiltInFunction parsed;

	// Determine function type and extract arguments
	if (nodeFunction.Has("exponential")) {
		parsed.function_type = "exponential";
		Napi::Array args = nodeFunction.Get("exponential").As<Napi::Array>();
		for (uint32_t i = 0; i < args.Length(); ++i) {
			parsed.arguments.push_back(args.Get(i));
		}
	} else if (nodeFunction.Has("GLM")) {
		parsed.function_type = "GLM";
		Napi::Array args = nodeFunction.Get("GLM").As<Napi::Array>();
		for (uint32_t i = 0; i < args.Length(); ++i) {
			parsed.arguments.push_back(args.Get(i));
		}
	} else if (nodeFunction.Has("Weibull")) {
		parsed.function_type = "Weibull";
		Napi::Array args = nodeFunction.Get("Weibull").As<Napi::Array>();
		for (uint32_t i = 0; i < args.Length(); ++i) {
			parsed.arguments.push_back(args.Get(i));
		}
	} else if (nodeFunction.Has("periodicTest")) {
		parsed.function_type = "periodicTest";
		Napi::Array args = nodeFunction.Get("periodicTest").As<Napi::Array>();
		for (uint32_t i = 0; i < args.Length(); ++i) {
			parsed.arguments.push_back(args.Get(i));
		}
	} else {
		throw std::runtime_error("Unknown built-in function type");
	}

	return parsed;
}

ParsedRandomDeviate ParseRandomDeviate(const Napi::Object& nodeDeviate) {
	ParsedRandomDeviate parsed;

	// Determine deviate type and extract arguments
	if (nodeDeviate.Has("uniformDeviate")) {
		parsed.deviate_type = "uniformDeviate";
		Napi::Array args = nodeDeviate.Get("uniformDeviate").As<Napi::Array>();
		for (uint32_t i = 0; i < args.Length(); ++i) {
			parsed.arguments.push_back(args.Get(i));
		}
	} else if (nodeDeviate.Has("normalDeviate")) {
		parsed.deviate_type = "normalDeviate";
		Napi::Array args = nodeDeviate.Get("normalDeviate").As<Napi::Array>();
		for (uint32_t i = 0; i < args.Length(); ++i) {
			parsed.arguments.push_back(args.Get(i));
		}
	} else if (nodeDeviate.Has("lognormalDeviate")) {
		parsed.deviate_type = "lognormalDeviate";
		Napi::Array args = nodeDeviate.Get("lognormalDeviate").As<Napi::Array>();
		for (uint32_t i = 0; i < args.Length(); ++i) {
			parsed.arguments.push_back(args.Get(i));
		}
	} else if (nodeDeviate.Has("gammaDeviate")) {
		parsed.deviate_type = "gammaDeviate";
		Napi::Array args = nodeDeviate.Get("gammaDeviate").As<Napi::Array>();
		for (uint32_t i = 0; i < args.Length(); ++i) {
			parsed.arguments.push_back(args.Get(i));
		}
	} else if (nodeDeviate.Has("betaDeviate")) {
		parsed.deviate_type = "betaDeviate";
		Napi::Array args = nodeDeviate.Get("betaDeviate").As<Napi::Array>();
		for (uint32_t i = 0; i < args.Length(); ++i) {
			parsed.arguments.push_back(args.Get(i));
		}
	} else if (nodeDeviate.Has("histogram")) {
		parsed.deviate_type = "histogram";
		Napi::Object histObj = nodeDeviate.Get("histogram").As<Napi::Object>();
		// For histogram, we need to handle the base and bins structure
		if (histObj.Has("base")) {
			parsed.arguments.push_back(histObj.Get("base"));
		}
		if (histObj.Has("bins")) {
			Napi::Array bins = histObj.Get("bins").As<Napi::Array>();
			for (uint32_t i = 0; i < bins.Length(); ++i) {
				parsed.arguments.push_back(bins.Get(i));
			}
		}
	} else {
		throw std::runtime_error("Unknown random deviate type");
	}

	return parsed;
}

ParsedNumericalOperation ParseNumericalOperation(const Napi::Object& nodeOperation) {
	ParsedNumericalOperation parsed;

	// Determine operation type and extract arguments
	std::vector<std::string> operations = {
		"neg", "add", "sub", "mul", "div", "pow", "sin", "cos", "tan", "log", "exp", "sqrt", "abs",
		"min", "max", "mean", "pi", "acos", "asin", "atan", "cosh", "sinh", "tanh", "log10", "mod",
		"ceil", "floor"
	};

	for (const auto& op : operations) {
		if (nodeOperation.Has(op.c_str())) {
			parsed.operation = op;
			Napi::Value opValue = nodeOperation.Get(op.c_str());

			if (opValue.IsArray()) {
				Napi::Array args = opValue.As<Napi::Array>();
				for (uint32_t i = 0; i < args.Length(); ++i) {
					parsed.arguments.push_back(args.Get(i));
				}
			} else {
				// Single argument operations
				parsed.arguments.push_back(opValue);
			}
			break;
		}
	}

	if (parsed.operation.empty()) {
		throw std::runtime_error("Unknown numerical operation type");
	}

	return parsed;
}

// Complex Value type builder functions
scram::mef::Expression* BuildParameterExpression(const ParsedParameter& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	// Create a new parameter and add it to the model
	auto param = std::make_unique<scram::mef::Parameter>(parsed.name);

	if (!parsed.description.empty()) {
		param->label(parsed.description);
	}

	if (!parsed.value.IsEmpty() && !parsed.value.IsUndefined() && !parsed.value.IsNull()) {
		scram::mef::Expression* expr = BuildExpression(parsed.value, model, registry);
		param->expression(expr);
	}

	if (!parsed.unit.empty()) {
		param->unit(ScramNodeUnit(parsed.unit));
	}

	scram::mef::Expression* ptr = param.get();
	model->Add(std::move(param));
	return ptr;
}

scram::mef::Expression* BuildBuiltInFunctionExpression(const ParsedBuiltInFunction& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	// For now, implement basic support for exponential function
	// This would need to be expanded based on SCRAM's built-in function support
	if (parsed.function_type == "exponential" && parsed.arguments.size() >= 2) {
		// exponential(lambda, time) = lambda * exp(-lambda * time)
		scram::mef::Expression* lambda = BuildExpression(parsed.arguments[0], model, registry);
		scram::mef::Expression* time = BuildExpression(parsed.arguments[1], model, registry);

		// Create exponential expression - this would need to be implemented based on SCRAM's API
		// For now, return a placeholder
		auto expr = std::make_unique<scram::mef::ConstantExpression>(1.0);
		scram::mef::Expression* ptr = expr.get();
		model->Add(std::move(expr));
		return ptr;
	}

	// For other functions, return placeholder
	auto expr = std::make_unique<scram::mef::ConstantExpression>(1.0);
	scram::mef::Expression* ptr = expr.get();
	model->Add(std::move(expr));
	return ptr;
}

scram::mef::Expression* BuildRandomDeviateExpression(const ParsedRandomDeviate& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	// For now, return a placeholder constant expression
	// This would need to be implemented based on SCRAM's random deviate support
	auto expr = std::make_unique<scram::mef::ConstantExpression>(1.0);
	scram::mef::Expression* ptr = expr.get();
	model->Add(std::move(expr));
	return ptr;
}

scram::mef::Expression* BuildNumericalOperationExpression(const ParsedNumericalOperation& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
	// For now, implement basic arithmetic operations
	if (parsed.operation == "add" && parsed.arguments.size() >= 2) {
		scram::mef::Expression* left = BuildExpression(parsed.arguments[0], model, registry);
		scram::mef::Expression* right = BuildExpression(parsed.arguments[1], model, registry);

		// Create addition expression - this would need to be implemented based on SCRAM's API
		// For now, return a placeholder
		auto expr = std::make_unique<scram::mef::ConstantExpression>(1.0);
		scram::mef::Expression* ptr = expr.get();
		model->Add(std::move(expr));
		return ptr;
	} else if (parsed.operation == "mul" && parsed.arguments.size() >= 2) {
		scram::mef::Expression* left = BuildExpression(parsed.arguments[0], model, registry);
		scram::mef::Expression* right = BuildExpression(parsed.arguments[1], model, registry);

		// Create multiplication expression - this would need to be implemented based on SCRAM's API
		// For now, return a placeholder
		auto expr = std::make_unique<scram::mef::ConstantExpression>(1.0);
		scram::mef::Expression* ptr = expr.get();
		model->Add(std::move(expr));
		return ptr;
	}

	// For other operations, return placeholder
	auto expr = std::make_unique<scram::mef::ConstantExpression>(1.0);
	scram::mef::Expression* ptr = expr.get();
	model->Add(std::move(expr));
	return ptr;
}