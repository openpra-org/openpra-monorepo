#include "ScramNodeModel.h"

// Step 1: Parse JSON into intermediate structures
ParsedBasicEvent ParseBasicEvent(const Napi::Object& nodeEvent) {
    ParsedBasicEvent parsed;
    parsed.name = nodeEvent.Get("name").ToString().Utf8Value();
    
    if (nodeEvent.Has("description")) {
        parsed.description = nodeEvent.Get("description").ToString().Utf8Value();
    }
    
    if (nodeEvent.Has("type")) {
        parsed.value_type = nodeEvent.Get("type").ToString().Utf8Value();
    } else {
        parsed.value_type = "basic";
    }
    
    if (nodeEvent.Has("value")) {
        parsed.value = nodeEvent.Get("value");
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
    auto be = std::make_unique<scram::mef::BasicEvent>(parsed.name, parsed.base_path, scram::mef::RoleSpecifier::kPublic);
    
    if (!parsed.description.empty()) {
        be->label(parsed.description);
    }
    
    if (!parsed.value.IsEmpty() && !parsed.value.IsUndefined() && !parsed.value.IsNull()) {
        scram::mef::Expression* expr = BuildExpression(parsed.value, model, registry, parsed.base_path);
        be->expression(expr);
    }
    
    return be;
}

std::unique_ptr<scram::mef::HouseEvent> BuildHouseEvent(const ParsedBasicEvent& parsed, scram::mef::Model* model, const ElementRegistry& registry) {
    auto he = std::make_unique<scram::mef::HouseEvent>(parsed.name, parsed.base_path, scram::mef::RoleSpecifier::kPublic);
    
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
    auto param = std::make_unique<scram::mef::Parameter>(parsed.name, parsed.base_path, scram::mef::RoleSpecifier::kPublic);
    
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
        ccf = std::make_unique<scram::mef::BetaFactorModel>(parsed.name, parsed.base_path, scram::mef::RoleSpecifier::kPublic);
    } else if (modelType == "MGL") {
        ccf = std::make_unique<scram::mef::MglModel>(parsed.name, parsed.base_path, scram::mef::RoleSpecifier::kPublic);
    } else if (modelType == "alpha-factor") {
        ccf = std::make_unique<scram::mef::AlphaFactorModel>(parsed.name, parsed.base_path, scram::mef::RoleSpecifier::kPublic);
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
    // Check if gate already exists
    if (auto existing = registry.FindElement<scram::mef::Gate>(parsed.name)) {
        return std::unique_ptr<scram::mef::Gate>(existing);
    }
    
    auto gate = std::make_unique<scram::mef::Gate>(parsed.name, parsed.base_path, scram::mef::RoleSpecifier::kPublic);
    
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

// Expression builder (simplified version for now)
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
    
    // For complex expressions, implement the full expression parsing logic here
    // This is a simplified version - the full implementation would handle all the
    // mathematical operations, distributions, etc.
    
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
    
    // Parse basic events
    if (nodeModel.Has("basicEvents")) {
        Napi::Array beArr = nodeModel.Get("basicEvents").As<Napi::Array>();
        for (uint32_t i = 0; i < beArr.Length(); ++i) {
            Napi::Object beObj = beArr.Get(i).As<Napi::Object>();
            parsedBasicEvents.push_back(ParseBasicEvent(beObj));
        }
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
        for (uint32_t i = 0; i < gateArr.Length(); ++i) {
            Napi::Object gateObj = gateArr.Get(i).As<Napi::Object>();
            parsedGates.push_back(ParseGate(gateObj));
        }
    }
    
    // Parse fault trees
    if (nodeModel.Has("faultTrees")) {
        Napi::Array ftArr = nodeModel.Get("faultTrees").As<Napi::Array>();
        for (uint32_t i = 0; i < ftArr.Length(); ++i) {
            Napi::Object ftObj = ftArr.Get(i).As<Napi::Object>();
            parsedFaultTrees.push_back(ParseFaultTree(ftObj));
        }
    }
    
    // Parse event trees
    if (nodeModel.Has("eventTrees")) {
        Napi::Array etArr = nodeModel.Get("eventTrees").As<Napi::Array>();
        for (uint32_t i = 0; i < etArr.Length(); ++i) {
            Napi::Object etObj = etArr.Get(i).As<Napi::Object>();
            parsedEventTrees.push_back(ParseEventTree(etObj));
        }
    }
    
    // Parse initiating events
    if (nodeModel.Has("initiatingEvents")) {
        Napi::Array ieArr = nodeModel.Get("initiatingEvents").As<Napi::Array>();
        for (uint32_t i = 0; i < ieArr.Length(); ++i) {
            Napi::Object ieObj = ieArr.Get(i).As<Napi::Object>();
            parsedInitiatingEvents.push_back(ParseInitiatingEvent(ieObj));
        }
    }
    
    // Phase 2: Build SCRAM elements in dependency order
    // First, build basic events and parameters (no dependencies)
    for (const auto& parsed : parsedBasicEvents) {
        auto be = BuildBasicEvent(parsed, model.get(), registry);
        registry.RegisterElement(parsed.name, std::move(be));
    }
    
    for (const auto& parsed : parsedParameters) {
        auto param = BuildParameter(parsed, model.get(), registry);
        registry.RegisterElement(parsed.name, std::move(param));
    }
    
    // Then build CCF groups
    for (const auto& parsed : parsedCCFGroups) {
        auto ccf = BuildCCFGroup(parsed, model.get(), registry);
        registry.RegisterElement(parsed.name, std::move(ccf));
    }
    
    // Then build gates (may depend on other gates and events)
    for (const auto& parsed : parsedGates) {
        auto gate = BuildGate(parsed, model.get(), registry);
        registry.RegisterElement(parsed.name, std::move(gate));
    }
    
    // Phase 3: Resolve all references and build complete model
    // Resolve CCF group members
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
    
    // Resolve gate arguments and build complete formulas
    for (const auto& parsed : parsedGates) {
        auto gate = registry.FindElement<scram::mef::Gate>(parsed.name);
        if (gate) {
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
            
            // Rebuild formula with resolved arguments
            scram::mef::Connective type = ScramNodeGateType(parsed.type);
            std::optional<int> min_number = parsed.min_number;
            std::optional<int> max_number = parsed.max_number;
            
            auto formula = std::make_unique<scram::mef::Formula>(type, std::move(argSet), min_number, max_number);
            gate->formula(std::move(formula));
        }
    }
    
    // Phase 4: Build fault trees and event trees with resolved references
    for (const auto& parsed : parsedFaultTrees) {
        auto ft = ScramNodeFaultTree(parsed, model.get(), registry);
        ft->CollectTopEvents();
        model->Add(std::move(ft));
    }
    
    for (const auto& parsed : parsedEventTrees) {
        auto et = ScramNodeEventTree(parsed, model.get(), registry);
        model->Add(std::move(et));
    }
    
    // Phase 5: Build initiating events
    for (const auto& parsed : parsedInitiatingEvents) {
        auto ie = ScramNodeInitiatingEvent(parsed, model.get());
        model->Add(std::move(ie));
    }
    
    // Clear registry after model is built
    registry.Clear();
    
    return model;
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
    auto et = std::make_unique<scram::mef::EventTree>(parsed.name);
    
    if (!parsed.description.empty()) {
        et->label(parsed.description);
    }
    
    // Build functional events
    for (const auto& feRef : parsed.functional_event_refs) {
        auto fe = std::make_unique<scram::mef::FunctionalEvent>(feRef);
        et->Add(std::move(fe));
    }
    
    // Build sequences
    for (const auto& seq : parsed.sequences) {
        auto sequence = std::make_unique<scram::mef::Sequence>(seq.end_state);
        et->Add(sequence.get());
        model->Add(std::move(sequence));
    }
    
    // Build initiating event
    if (!parsed.initiating_event_ref.empty()) {
        // This will be resolved when building the complete model
    }
    
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
