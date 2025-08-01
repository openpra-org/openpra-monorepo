#include "ScramNodeModel.h"

// OpenPRA MEF to SCRAM Model Mapping
std::unique_ptr<scram::mef::Model> ScramNodeModel(const Napi::Object& nodeModel) {
    // Create the top-level Model with a unique name
    std::string modelName;
    if (nodeModel.Has("name")) {
        modelName = nodeModel.Get("name").ToString().Utf8Value();
    } else {
        // Generate a unique name based on timestamp
        auto now = std::chrono::system_clock::now();
        auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()
        ).count();
        modelName = "openpra_model_" + std::to_string(timestamp);
    }
    auto model = std::make_unique<scram::mef::Model>(modelName);

    // Set default analysis settings
    scram::core::Settings& settings = model->settings();
    settings.probability_analysis(true);  // Always enable probability analysis
    settings.importance_analysis(true);   // Always enable importance analysis
    settings.ccf_analysis(true);         // Always enable CCF analysis
    settings.approximation(false);       // Use exact analysis by default
    settings.rare_event(false);          // Don't use rare event approximation by default
    settings.mcub(false);                // Don't use MCUB by default
    settings.limit_order(10);            // Reasonable default for cut set order
    settings.cut_off(1e-12);            // Reasonable truncation probability
    model->mission_time().value(8760);   // Default mission time: 1 year in hours

    try {
        // Validate basic structure
        if (!ValidateSystemsAnalysis(nodeModel)) {
            return nullptr;
        }

        // Process fault trees - first check direct faultTrees
    if (nodeModel.Has("faultTrees")) {
            auto faultTrees = nodeModel.Get("faultTrees").ToObject();
            auto names = faultTrees.GetPropertyNames();
            for (size_t i = 0; i < names.Length(); i++) {
                auto name = names.Get(i).ToString();
                auto faultTree = faultTrees.Get(name).ToObject();
                auto ft = ProcessOpenPRAFaultTree(faultTree, model.get());
                ft->CollectTopEvents();
                model->Add(std::move(ft));
            }
        }
        // If no direct fault trees, try systemLogicModels
        else if (nodeModel.Has("systemLogicModels")) {
            auto logicModels = nodeModel.Get("systemLogicModels").ToObject();
            auto names = logicModels.GetPropertyNames();
            for (size_t i = 0; i < names.Length(); i++) {
                auto name = names.Get(i).ToString();
                auto logicModel = logicModels.Get(name).ToObject();
                auto ft = ProcessSystemLogicModel(logicModel, model.get());
            ft->CollectTopEvents();
            model->Add(std::move(ft));
        }
    }

        // Process system-wide basic events if present
        if (nodeModel.Has("systemBasicEvents")) {
            auto basicEvents = nodeModel.Get("systemBasicEvents").ToObject();
            ProcessSystemBasicEvents(basicEvents, model.get());
        }

        // Process CCF groups if present
        if (nodeModel.Has("commonCauseFailureGroups")) {
            auto ccfGroups = nodeModel.Get("commonCauseFailureGroups").ToObject();
            ProcessOpenPRACCFGroups(ccfGroups, model.get());
    }

    return model;

    } catch (const Napi::Error& e) {
        throw; // Rethrow Napi errors as is
    } catch (const std::exception& e) {
        throw Napi::Error::New(nodeModel.Env(), e.what());
    }
}

namespace {

// Helper to validate SystemsAnalysis structure
bool ValidateSystemsAnalysis(const Napi::Object& obj) {
    if (!obj.Has("systemLogicModels") && !obj.Has("faultTrees")) {
        throw Napi::Error::New(obj.Env(), 
            "SystemsAnalysis must have either systemLogicModels or faultTrees");
        return false;
    }
    return true;
}

// Helper to convert OpenPRA MEF node types to SCRAM types
scram::mef::Connective ConvertNodeType(const std::string& openPraType) {
    static const std::unordered_map<std::string, scram::mef::Connective> typeMap = {
        {"AND_GATE", scram::mef::kAnd},
        {"OR_GATE", scram::mef::kOr},
        {"INHIBIT_GATE", scram::mef::kInhibit},
        {"NAND_GATE", scram::mef::kNand},
        {"NOR_GATE", scram::mef::kNor},
        {"XOR_GATE", scram::mef::kXor},
        {"VOTE_GATE", scram::mef::kAtleast},  // k-out-of-n gate
        {"NOT_GATE", scram::mef::kNot}
    };
    
    auto it = typeMap.find(openPraType);
    if (it == typeMap.end()) {
        throw std::runtime_error("Unsupported gate type: " + openPraType);
    }
    return it->second;
}

// Helper to check if a node type is a special event
bool IsSpecialEventType(const std::string& nodeType) {
    return nodeType == "TRUE_EVENT" || 
           nodeType == "FALSE_EVENT" || 
           nodeType == "PASS_EVENT" || 
           nodeType == "INIT_EVENT";
}

// Helper to check if a node type is a transfer gate
bool IsTransferGate(const std::string& nodeType) {
    return nodeType == "TRANSFER_IN" || nodeType == "TRANSFER_OUT";
}

// Helper to create a special event
std::unique_ptr<scram::mef::BasicEvent> CreateSpecialEvent(
    const std::string& name,
    const std::string& nodeType,
    const std::string& basePath
) {
    auto event = std::make_unique<scram::mef::BasicEvent>(
        name, basePath, scram::mef::RoleSpecifier::kPrivate);
    
    // Set probability based on event type
    if (nodeType == "TRUE_EVENT") {
        event->expression(&scram::mef::ConstantExpression::kOne);
    } else if (nodeType == "FALSE_EVENT") {
        event->expression(&scram::mef::ConstantExpression::kZero);
    } else if (nodeType == "PASS_EVENT") {
        // Pass events are treated as TRUE events
        event->expression(&scram::mef::ConstantExpression::kOne);
    }
    // INIT_EVENT is handled separately through initiating events
    
    return event;
}

// Helper to extract probability information from SystemBasicEvent
double ExtractProbability(const Napi::Object& event) {
    if (event.Has("probability")) {
        return event.Get("probability").ToNumber().DoubleValue();
    }
    
    if (event.Has("probabilityModel")) {
        auto probModel = event.Get("probabilityModel").ToObject();
        // Handle probability model conversion
        // This is simplified - would need more complex handling for different models
        return probModel.Get("value").ToNumber().DoubleValue();
    }
    
    if (event.Has("expression")) {
        auto expr = event.Get("expression").ToObject();
        if (expr.Has("value")) {
            return expr.Get("value").ToNumber().DoubleValue();
        }
        // Handle other expression types
    }
    
    throw Napi::Error::New(event.Env(), "No valid probability information found");
}

// Process a fault tree from OpenPRA MEF format
std::unique_ptr<scram::mef::FaultTree> ProcessOpenPRAFaultTree(const Napi::Object& faultTree, scram::mef::Model* model) {
    std::string name = faultTree.Get("name").ToString().Utf8Value();
    auto ft = std::make_unique<scram::mef::FaultTree>(name);

    // Process nodes
    if (faultTree.Has("nodes")) {
        auto nodes = faultTree.Get("nodes").ToObject();
        auto nodeNames = nodes.GetPropertyNames();
        
        // First pass: Create all nodes
        for (size_t i = 0; i < nodeNames.Length(); i++) {
            auto nodeName = nodeNames.Get(i).ToString();
            auto node = nodes.Get(nodeName).ToObject();
            
            std::string nodeType = node.Get("nodeType").ToString().Utf8Value();
            
            if (nodeType == "HOUSE_EVENT") {
                // Create house event
                auto he = std::make_unique<scram::mef::HouseEvent>(nodeName.Utf8Value());
                if (node.Has("houseEventValue")) {
                    he->state(node.Get("houseEventValue").ToBoolean().Value());
                }
                ft->Add(he.get());
                model->Add(std::move(he));
            }
            else if (nodeType == "BASIC_EVENT" || nodeType == "UNDEVELOPED_EVENT") {
                // Create basic event
                auto be = std::make_unique<scram::mef::BasicEvent>(nodeName.Utf8Value());
                if (node.Has("probability")) {
                    double prob = ExtractProbability(node);
                    auto expr = std::make_unique<scram::mef::ConstantExpression>(prob);
                    be->expression(expr.get());
                    model->Add(std::move(expr));
                }
                ft->Add(be.get());
                model->Add(std::move(be));
            }
            else if (IsSpecialEventType(nodeType)) {
                // Create special event (TRUE, FALSE, PASS, INIT)
                auto event = CreateSpecialEvent(nodeName.Utf8Value(), nodeType, ft->name());
                ft->Add(event.get());
                model->Add(std::move(event));
            }
            else if (IsTransferGate(nodeType)) {
                if (nodeType == "TRANSFER_IN") {
                    // Handle transfer-in gate
                    if (!node.Has("transferTreeId") || !node.Has("sourceNodeId")) {
                        throw std::runtime_error("Transfer-in gate missing required fields: " + nodeName.Utf8Value());
                    }
                    
                    std::string targetTree = node.Get("transferTreeId").ToString().Utf8Value();
                    std::string sourceNode = node.Get("sourceNodeId").ToString().Utf8Value();
                    
                    // Create a proxy gate that will be resolved later
                    auto gate = std::make_unique<scram::mef::Gate>(nodeName.Utf8Value());
                    gate->SetAttribute({"transfer_tree", targetTree});
                    gate->SetAttribute({"source_node", sourceNode});
                    
                    ft->Add(gate.get());
                    model->Add(std::move(gate));
                }
                // TRANSFER_OUT is handled implicitly by being referenced
            }
            else {
                // Create regular gate
                auto gate = std::make_unique<scram::mef::Gate>(nodeName.Utf8Value());
                
                // For vote gates (k-out-of-n), handle additional parameters
                if (nodeType == "VOTE_GATE" && node.Has("minNumber")) {
                    gate->SetAttribute({"min_number", 
                        std::to_string(node.Get("minNumber").ToNumber().Int32Value())});
                }
                
                ft->Add(gate.get());
                model->Add(std::move(gate));
            }
        }
        
        // Second pass: Connect nodes
        for (size_t i = 0; i < nodeNames.Length(); i++) {
            auto nodeName = nodeNames.Get(i).ToString();
            auto node = nodes.Get(nodeName).ToObject();
            
            if (node.Has("inputs")) {
                auto inputs = node.Get("inputs").ToObject();
                scram::mef::Formula::ArgSet argSet;
                
                for (size_t j = 0; j < inputs.Length(); j++) {
                    std::string inputName = inputs.Get(j).ToString().Utf8Value();
                    // Find the referenced node
                    auto* arg = model->Get<scram::mef::Formula::Arg>(inputName);
                    if (!arg) {
                        throw std::runtime_error("Referenced node not found: " + inputName);
                    }
                    argSet.Add(arg);
                }
                
                std::string nodeType = node.Get("nodeType").ToString().Utf8Value();
                
                // Skip transfer-out gates as they are handled by transfer-in
                if (nodeType == "TRANSFER_OUT") {
                    continue;
                }
                
                auto* gate = model->Get<scram::mef::Gate>(nodeName.Utf8Value());
                if (!gate) {
                    throw std::runtime_error("Gate not found: " + nodeName.Utf8Value());
                }
                
                // Handle different gate types
                if (nodeType == "TRANSFER_IN") {
                    // Transfer gates are handled in a post-processing step
                    continue;
                }
                else if (nodeType == "VOTE_GATE") {
                    // k-out-of-n gate
                    int minNumber = node.Get("minNumber").ToNumber().Int32Value();
                    auto formula = std::make_unique<scram::mef::Formula>(
                        scram::mef::kAtleast,
                        std::move(argSet),
                        minNumber  // k in k-out-of-n
                    );
                    gate->formula(std::move(formula));
                }
                else {
                    // Regular gates (AND, OR, NAND, NOR, etc.)
                    auto formula = std::make_unique<scram::mef::Formula>(
                        ConvertNodeType(nodeType),
                        std::move(argSet)
                    );
                    gate->formula(std::move(formula));
                }
            }
        }
    }

    // Post-process transfer gates
    for (const auto& gate : model->table<scram::mef::Gate>()) {
        if (gate.HasAttribute("transfer_tree")) {
            std::string targetTree = gate.GetAttribute("transfer_tree").value;
            std::string sourceNode = gate.GetAttribute("source_node").value;
            
            // Find the target fault tree
            const auto& faultTrees = model->table<scram::mef::FaultTree>();
            auto targetFt = std::find_if(faultTrees.begin(), faultTrees.end(),
                [&](const scram::mef::FaultTree& ft) { return ft.name() == targetTree; });
                
            if (targetFt == faultTrees.end()) {
                throw std::runtime_error("Transfer target tree not found: " + targetTree);
            }
            
            // Find the source node in the target tree
            auto* sourceGate = model->Get<scram::mef::Gate>(sourceNode);
            if (!sourceGate) {
                throw std::runtime_error("Transfer source node not found: " + sourceNode);
            }
            
            // Copy the formula from the source gate
            auto formula = std::make_unique<scram::mef::Formula>(
                sourceGate->formula().type(),
                sourceGate->formula().args()
            );
            const_cast<scram::mef::Gate&>(gate).formula(std::move(formula));
        }
    }

    // Handle quantification settings if present
    if (faultTree.Has("quantificationSettings")) {
        auto settings = faultTree.Get("quantificationSettings").ToObject();
        
        // Set analysis method
        if (settings.Has("method")) {
            std::string method = settings.Get("method").ToString().Utf8Value();
            scram::core::Settings& analysisSettings = model->settings();
            
            // Reset all method flags first
            analysisSettings.approximation(false);
            analysisSettings.rare_event(false);
            analysisSettings.mcub(false);
            
            // Set the requested method
            if (method == "exact") {
                // Use exact analysis (default)
                analysisSettings.approximation(false);
            } else if (method == "rare-event") {
                analysisSettings.rare_event(true);
                analysisSettings.approximation(true);
            } else if (method == "mcub") {
                analysisSettings.mcub(true);
                analysisSettings.approximation(true);
            } else if (method == "mincut") {
                analysisSettings.approximation(true);
            }
        }
        
        // Set truncation limit
        if (settings.Has("truncationLimit")) {
            double limit = settings.Get("truncationLimit").ToNumber().DoubleValue();
            model->settings().cut_off(limit);
        }
        
        // Set maximum order for products
        if (settings.Has("maxOrder")) {
            int maxOrder = settings.Get("maxOrder").ToNumber().Int32Value();
            model->settings().limit_order(maxOrder);
        }
        
        // Store settings as attributes for reference
        ft->SetAttribute({"quantification_method", 
            settings.Has("method") ? settings.Get("method").ToString().Utf8Value() : "exact"});
        
        if (settings.Has("truncationLimit")) {
            ft->SetAttribute({"truncation_limit", 
                std::to_string(settings.Get("truncationLimit").ToNumber().DoubleValue())});
        }
        
        if (settings.Has("maxOrder")) {
            ft->SetAttribute({"max_order", 
                std::to_string(settings.Get("maxOrder").ToNumber().Int32Value())});
        }
    } else {
        // Set default settings
        model->settings().approximation(false);  // Use exact analysis by default
    }

    return ft;
}

// Process a system logic model into a fault tree
std::unique_ptr<scram::mef::FaultTree> ProcessSystemLogicModel(const Napi::Object& logicModel, scram::mef::Model* model) {
    std::string name = logicModel.Get("systemReference").ToString().Utf8Value();
    auto ft = std::make_unique<scram::mef::FaultTree>(name);

    // Process basic events first
    if (logicModel.Has("basicEvents")) {
        auto events = logicModel.Get("basicEvents").ToArray();
        for (size_t i = 0; i < events.Length(); i++) {
            auto event = events.Get(i).ToObject();
            std::string eventName = event.Get("id").ToString().Utf8Value();
            auto be = std::make_unique<scram::mef::BasicEvent>(eventName);
            
            if (event.Has("probability")) {
                double prob = ExtractProbability(event);
                auto expr = std::make_unique<scram::mef::ConstantExpression>(prob);
                be->expression(expr.get());
                model->Add(std::move(expr));
            }
            
            ft->Add(be.get());
            model->Add(std::move(be));
        }
    }

    // Process model representation
    if (logicModel.Has("modelRepresentation")) {
        std::string modelRep = logicModel.Get("modelRepresentation").ToString().Utf8Value();
        ParseModelRepresentation(modelRep, ft.get(), model);
    }

    return ft;
}

// Helper function to parse a token and create/get the corresponding node
scram::mef::Formula::Arg* ProcessLogicToken(
    const std::string& token,
    scram::mef::FaultTree* ft,
    scram::mef::Model* model,
    std::map<std::string, scram::mef::Gate*>& gateCache
) {
    // Remove any whitespace
    std::string cleanToken = token;
    cleanToken.erase(0, cleanToken.find_first_not_of(" \t\n\r"));
    cleanToken.erase(cleanToken.find_last_not_of(" \t\n\r") + 1);

    // Check if this token exists in the model
    if (auto* existing = model->Get<scram::mef::Formula::Arg>(cleanToken)) {
        return existing;
    }

    // Check if it's a gate in our cache
    if (gateCache.count(cleanToken)) {
        return gateCache[cleanToken];
    }

    // If not found, create a new basic event
    auto be = std::make_unique<scram::mef::BasicEvent>(cleanToken);
    auto* bePtr = be.get();
    ft->Add(bePtr);
    model->Add(std::move(be));
    return bePtr;
}

// Helper function to parse model representation string
void ParseModelRepresentation(
    const std::string& modelRep,
    scram::mef::FaultTree* ft,
    scram::mef::Model* model
) {
    std::map<std::string, scram::mef::Gate*> gateCache;
    std::stack<std::string> operatorStack;
    std::stack<scram::mef::Formula::ArgSet> argStack;
    size_t gateCounter = 0;

    // Remove whitespace and validate brackets
    std::string cleanRep = modelRep;
    cleanRep.erase(std::remove_if(cleanRep.begin(), cleanRep.end(), 
        [](char c) { return std::isspace(c); }), cleanRep.end());

    std::string token;
    bool readingToken = false;
    scram::mef::Formula::ArgSet currentArgs;

    for (size_t i = 0; i < cleanRep.length(); ++i) {
        char c = cleanRep[i];

        switch (c) {
            case '[': {
                if (readingToken) {
                    auto* arg = ProcessLogicToken(token, ft, model, gateCache);
                    currentArgs.Add(arg);
                    token.clear();
                    readingToken = false;
                }
                operatorStack.push("[");
                argStack.push(std::move(currentArgs));
                currentArgs = scram::mef::Formula::ArgSet();
                break;
            }
            case ']': {
                if (readingToken) {
                    auto* arg = ProcessLogicToken(token, ft, model, gateCache);
                    currentArgs.Add(arg);
                    token.clear();
                    readingToken = false;
                }

                // Pop operator and create gate
                if (!operatorStack.empty()) {
                    std::string op = operatorStack.top();
                    operatorStack.pop();

                    // Create a new gate for this subexpression
                    std::string gateName = "G" + std::to_string(++gateCounter);
                    auto gate = std::make_unique<scram::mef::Gate>(gateName);
                    
                    // Determine gate type from operator
                    scram::mef::Connective gateType;
                    if (op == "AND" || op == "[") {
                        gateType = scram::mef::kAnd;
                    } else if (op == "OR") {
                        gateType = scram::mef::kOr;
                    } else {
                        throw std::runtime_error("Unsupported operator: " + op);
                    }

                    // Create formula for the gate
                    auto formula = std::make_unique<scram::mef::Formula>(
                        gateType, std::move(currentArgs));
                    gate->formula(std::move(formula));

                    // Add gate to model and cache
                    auto* gatePtr = gate.get();
                    ft->Add(gatePtr);
                    model->Add(std::move(gate));
                    gateCache[gateName] = gatePtr;

                    // Add this gate to parent's args if there is a parent
                    if (!argStack.empty()) {
                        currentArgs = std::move(argStack.top());
                        argStack.pop();
                        currentArgs.Add(gatePtr);
                    }
                }
                break;
            }
            case 'A': {
                if (i + 2 < cleanRep.length() && cleanRep.substr(i, 3) == "AND") {
                    if (readingToken) {
                        auto* arg = ProcessLogicToken(token, ft, model, gateCache);
                        currentArgs.Add(arg);
                        token.clear();
                        readingToken = false;
                    }
                    operatorStack.push("AND");
                    i += 2;  // Skip the rest of "AND"
                } else {
                    token += c;
                    readingToken = true;
                }
                break;
            }
            case 'O': {
                if (i + 1 < cleanRep.length() && cleanRep.substr(i, 2) == "OR") {
                    if (readingToken) {
                        auto* arg = ProcessLogicToken(token, ft, model, gateCache);
                        currentArgs.Add(arg);
                        token.clear();
                        readingToken = false;
                    }
                    operatorStack.push("OR");
                    i += 1;  // Skip the rest of "OR"
                } else {
                    token += c;
                    readingToken = true;
                }
                break;
            }
            default: {
                token += c;
                readingToken = true;
                break;
            }
        }
    }

    // Handle any remaining token
    if (readingToken && !token.empty()) {
        auto* arg = ProcessLogicToken(token, ft, model, gateCache);
        currentArgs.Add(arg);
    }

    // The last gate created should be the top event
    if (!gateCache.empty()) {
        std::string topGateName = "G" + std::to_string(gateCounter);
        ft->top_events().push_back(gateCache[topGateName]);
    }
}
}

// Process CCF groups from OpenPRA format
void ProcessOpenPRACCFGroups(const Napi::Object& ccfGroups, scram::mef::Model* model) {
    auto names = ccfGroups.GetPropertyNames();
    for (size_t i = 0; i < names.Length(); i++) {
        auto name = names.Get(i).ToString();
        auto group = ccfGroups.Get(name).ToObject();
        
        std::string modelType = group.Get("modelType").ToString().Utf8Value();
        std::unique_ptr<scram::mef::CcfGroup> ccf;
        
        // Map OpenPRA CCF model types to SCRAM types
        if (modelType == "BETA_FACTOR") {
            ccf = std::make_unique<scram::mef::BetaFactorModel>(name.Utf8Value());
        } else if (modelType == "MGL") {
            ccf = std::make_unique<scram::mef::MglModel>(name.Utf8Value());
        } else if (modelType == "ALPHA_FACTOR") {
            ccf = std::make_unique<scram::mef::AlphaFactorModel>(name.Utf8Value());
        } else {
            throw std::runtime_error("Unsupported CCF model type: " + modelType);
        }
        
        // Add members
        if (group.Has("members")) {
            auto members = group.Get("members").ToObject();
            if (members.Has("basicEvents")) {
                auto events = members.Get("basicEvents").ToArray();
                for (size_t j = 0; j < events.Length(); j++) {
                    auto event = events.Get(j).ToObject();
                    std::string eventId = event.Get("id").ToString().Utf8Value();
                    auto* be = model->Get<scram::mef::BasicEvent>(eventId);
                    if (!be) {
                        throw std::runtime_error("Referenced basic event not found: " + eventId);
                    }
                    ccf->AddMember(be);
                }
            }
        }
        
        // Add model parameters
        if (group.Has("modelParameters")) {
            auto params = group.Get("modelParameters").ToObject();
            auto paramNames = params.GetPropertyNames();
            for (size_t j = 0; j < paramNames.Length(); j++) {
                auto paramName = paramNames.Get(j).ToString();
                double value = params.Get(paramName).ToNumber().DoubleValue();
                auto expr = std::make_unique<scram::mef::ConstantExpression>(value);
                ccf->AddFactor(expr.get());
                model->Add(std::move(expr));
            }
        }
        
        model->Add(std::move(ccf));
    }
}

} // anonymous namespace

static void BuildEventTreeTrie(
    EventTreeTrieNode& root,
    const Napi::Array& sequences
) {
    for (uint32_t i = 0; i < sequences.Length(); ++i) {
        Napi::Object seqObj = sequences.Get(i).As<Napi::Object>();
        Napi::Array feArr = seqObj.Get("functionalEvents").As<Napi::Array>();
        EventTreeTrieNode* node = &root;
        for (uint32_t j = 0; j < feArr.Length(); ++j) {
            Napi::Object feObj = feArr.Get(j).As<Napi::Object>();
            std::string state = feObj.Get("state").ToString().Utf8Value();
            Napi::Value refGate = feObj.Has("refGate") ? feObj.Get("refGate") : Napi::Value();
            if (node->children.count(state) == 0) {
                node->children[state] = std::make_unique<EventTreeTrieNode>();
            }
            if (!refGate.IsEmpty() && !refGate.IsUndefined() && !refGate.IsNull()) {
                node->refGates[state] = refGate;
            }
            node = node->children[state].get();
        }
        node->endState = seqObj.Get("endState").ToString().Utf8Value();
    }
}

std::unique_ptr<scram::mef::EventTree> ScramNodeEventTree(const Napi::Object& nodeEventTree, scram::mef::Model* model) {
    std::string name = nodeEventTree.Get("name").ToString().Utf8Value();
    auto et = std::make_unique<scram::mef::EventTree>(name);

    // 1. Functional Events: collect all unique names from all sequences
    std::vector<std::string> functionalEventOrder;
    std::set<std::string> feNames;
    if (nodeEventTree.Has("eventSequences")) {
        Napi::Array seqArr = nodeEventTree.Get("eventSequences").As<Napi::Array>();
        for (uint32_t i = 0; i < seqArr.Length(); ++i) {
            Napi::Object seqObj = seqArr.Get(i).As<Napi::Object>();
            Napi::Array feArr = seqObj.Get("functionalEvents").As<Napi::Array>();
            for (uint32_t j = 0; j < feArr.Length(); ++j) {
                Napi::Object feObj = feArr.Get(j).As<Napi::Object>();
                std::string feName = feObj.Get("name").ToString().Utf8Value();
                if (feNames.insert(feName).second) {
                    functionalEventOrder.push_back(feName);
                    auto fe = std::make_unique<scram::mef::FunctionalEvent>(feName);
                    et->Add(std::move(fe));
                }
            }
        }
    }

    // 2. Sequences (end states)
    if (nodeEventTree.Has("eventSequences")) {
        Napi::Array seqArr = nodeEventTree.Get("eventSequences").As<Napi::Array>();
        for (uint32_t i = 0; i < seqArr.Length(); ++i) {
            Napi::Object seqObj = seqArr.Get(i).As<Napi::Object>();
            std::string seqName = seqObj.Get("endState").ToString().Utf8Value();
            auto seq = std::make_unique<scram::mef::Sequence>(seqName);
            et->Add(seq.get());
            model->Add(std::move(seq));
        }
        // 3. Build the trie
        EventTreeTrieNode trieRoot;
        BuildEventTreeTrie(trieRoot, seqArr);

        // 4. Recursively build the event tree structure
        auto buildBranch = [&](EventTreeTrieNode* node, size_t level, auto&& buildBranchRef) -> std::unique_ptr<scram::mef::Branch> {
            auto branch = std::make_unique<scram::mef::Branch>();
            // If this is a leaf, attach the sequence
            if (!node->endState.empty()) {
                auto& seq = et->Get<scram::mef::Sequence>(node->endState);
                branch->target(&seq);
                return branch;
            }
            // Otherwise, fork on the current functional event
            if (level < functionalEventOrder.size()) {
                std::string feName = functionalEventOrder[level];
                auto& fe = et->Get<scram::mef::FunctionalEvent>(feName);
                std::vector<scram::mef::Path> paths;
                for (auto& [state, child] : node->children) {
                    auto path = scram::mef::Path(state);
                    // Attach collect-formula instruction if refGate is present
                    if (node->refGates.count(state)) {
                        scram::mef::Instruction* instr = nullptr;
                        Napi::Value refGateVal = node->refGates[state];
                        if (!refGateVal.IsEmpty() && !refGateVal.IsUndefined() && !refGateVal.IsNull()) {
                            Napi::Object refGateObj = refGateVal.As<Napi::Object>();
                            std::string refGateName = refGateObj.Get("name").ToString().Utf8Value();
                            scram::mef::Gate* gateRaw = nullptr;
                            auto gatesTable = model->table<scram::mef::Gate>();
                            auto it = std::find_if(gatesTable.begin(), gatesTable.end(),
                                [&](const scram::mef::Gate& g) { return g.name() == refGateName; });
                            if (it != gatesTable.end()) {
                                gateRaw = const_cast<scram::mef::Gate*>(&(*it));
                            } else {
                                throw std::runtime_error("Referenced gate not found: " + refGateName);
                            }
                            instr = new scram::mef::CollectFormula(
                                std::make_unique<scram::mef::Formula>(
                                    scram::mef::kNull, scram::mef::Formula::ArgSet{gateRaw}
                                )
                            );
                        }
                        if (instr) {
                            std::vector<scram::mef::Instruction*> instrs = {instr};
                            path.instructions(instrs);
                        }
                    }
                    // Recursively build the child branch
                    auto childBranch = buildBranchRef(child.get(), level + 1, buildBranchRef);
                    path.target(childBranch->target());
                    paths.push_back(std::move(path));
                }
                auto fork = std::make_unique<scram::mef::Fork>(fe, std::move(paths));
                branch->target(fork.get());
                et->Add(std::move(fork));
            }
            return branch;
        };

        // 5. Set the initial state
        auto initialBranch = buildBranch(&trieRoot, 0, buildBranch);
        et->initial_state(*initialBranch);
    }

    // 6. Initiating Event (optional, for OpenPSA compatibility)
    // If the event tree has an initiating event, create and add it to the model
    if (nodeEventTree.Has("initiatingEvent")) {
        Napi::Object ieObj = nodeEventTree.Get("initiatingEvent").As<Napi::Object>();
        auto ie = ScramNodeInitiatingEvent(ieObj, model);
        // Link the event tree to the initiating event
        ie->event_tree(et.get());
        model->Add(std::move(ie));
    }

    return et;
}

std::unique_ptr<scram::mef::InitiatingEvent> ScramNodeInitiatingEvent(const Napi::Object& nodeIE, scram::mef::Model* model) {
    std::string name = nodeIE.Get("name").ToString().Utf8Value();
    auto ie = std::make_unique<scram::mef::InitiatingEvent>(name);
    if (nodeIE.Has("description")) {
        ie->label(nodeIE.Get("description").ToString().Utf8Value());
    }
    // Frequency/unit mapping
    if (nodeIE.Has("frequency")) {
        // You may want to store this as an attribute or parameter
        double freq = nodeIE.Get("frequency").ToNumber().DoubleValue();
        ie->SetAttribute(scram::mef::Attribute("frequency", std::to_string(freq)));
    }
    if (nodeIE.Has("unit")) {
        std::string unit = nodeIE.Get("unit").ToString().Utf8Value();
        ie->SetAttribute(scram::mef::Attribute("unit", unit));
    }
    // No eventTree field here!
    return ie;
}

// FaultTree mapping
std::unique_ptr<scram::mef::FaultTree> ScramNodeFaultTree(const Napi::Object& nodeFaultTree, scram::mef::Model* model) {
    std::string name = nodeFaultTree.Get("name").ToString().Utf8Value();
    auto ft = std::make_unique<scram::mef::FaultTree>(name);

    // Description
    if (nodeFaultTree.Has("description")) {
        ft->label(nodeFaultTree.Get("description").ToString().Utf8Value());
    }

    // CCF Groups
    if (nodeFaultTree.Has("ccfGroups")) {
        Napi::Array ccfArr = nodeFaultTree.Get("ccfGroups").As<Napi::Array>();
        for (uint32_t i = 0; i < ccfArr.Length(); ++i) {
            Napi::Object ccfObj = ccfArr.Get(i).As<Napi::Object>();
            auto ccf = ScramNodeCCFGroup(ccfObj, model, ft->name());
            ft->Add(ccf.get());
            model->Add(std::move(ccf));
        }
    }

    // Top Event (Gate)
    if (nodeFaultTree.Has("topEvent")) {
        Napi::Object gateObj = nodeFaultTree.Get("topEvent").As<Napi::Object>();
        auto gate = ScramNodeGate(gateObj, model, ft->name());
        ft->Add(gate.get());
        model->Add(std::move(gate));
    }

    return ft;
}

// Gate mapping (recursive)
std::unique_ptr<scram::mef::Gate> ScramNodeGate(const Napi::Object& nodeGate, scram::mef::Model* model, const std::string& basePath) {
    std::string name = nodeGate.Get("name").ToString().Utf8Value();
    auto it = std::find_if(model->table<scram::mef::Gate>().begin(), model->table<scram::mef::Gate>().end(),
        [&](const scram::mef::Gate& g) { return g.name() == name; });
    if (it != model->table<scram::mef::Gate>().end()) {
        return std::unique_ptr<scram::mef::Gate>(const_cast<scram::mef::Gate*>(&(*it)));
    }
    auto gate = std::make_unique<scram::mef::Gate>(name, basePath, scram::mef::RoleSpecifier::kPublic);

    // Description
    if (nodeGate.Has("description")) {
        gate->label(nodeGate.Get("description").ToString().Utf8Value());
    }

    // Type
    scram::mef::Connective type = scram::mef::kAnd;
    if (nodeGate.Has("type")) {
        type = ScramNodeGateType(nodeGate.Get("type").ToString().Utf8Value());
    }
    // Build formula
    scram::mef::Formula::ArgSet argSet;

    // Gates (children)
    if (nodeGate.Has("gates")) {
        Napi::Array gatesArr = nodeGate.Get("gates").As<Napi::Array>();
        for (uint32_t i = 0; i < gatesArr.Length(); ++i) {
            Napi::Object childGateObj = gatesArr.Get(i).As<Napi::Object>();
            auto childGate = ScramNodeGate(childGateObj, model, basePath);
            argSet.Add(childGate.get());
            model->Add(std::move(childGate));
        }
    }

    // Events (children)
    if (nodeGate.Has("events")) {
        Napi::Array eventsArr = nodeGate.Get("events").As<Napi::Array>();
        for (uint32_t i = 0; i < eventsArr.Length(); ++i) {
            Napi::Object eventObj = eventsArr.Get(i).As<Napi::Object>();
            std::string eventType = eventObj.Has("type") ? eventObj.Get("type").ToString().Utf8Value() : "basic";
            if (eventType == "basic") {
                auto be = ScramNodeBasicEvent(eventObj, model, basePath);
                argSet.Add(be.get());
                model->Add(std::move(be));
            } else if (eventType == "house") {
                auto he = ScramNodeHouseEvent(eventObj, model, basePath);
                argSet.Add(he.get());
                model->Add(std::move(he));
            } else if (eventType == "undeveloped") {
                // For undeveloped, treat as basic event with no value
                auto be = ScramNodeBasicEvent(eventObj, model, basePath);
                argSet.Add(be.get());
                model->Add(std::move(be));
            } else {
                throw std::runtime_error("Unknown event type in gate: " + eventType);
            }
        }
    }

    // Build formula
    std::optional<int> min_number, max_number;
    if (type == scram::mef::kAtleast || type == scram::mef::kCardinality) {
        if (nodeGate.Has("minNumber")) {
            min_number = nodeGate.Get("minNumber").ToNumber().Int32Value();
        }
        if (type == scram::mef::kCardinality && nodeGate.Has("maxNumber")) {
            max_number = nodeGate.Get("maxNumber").ToNumber().Int32Value();
        }
    }
    auto formula = std::make_unique<scram::mef::Formula>(type, std::move(argSet), min_number, max_number);
    gate->formula(std::move(formula));

    return gate;
}

// BasicEvent mapping
std::unique_ptr<scram::mef::BasicEvent> ScramNodeBasicEvent(const Napi::Object& nodeEvent, scram::mef::Model* model, const std::string& basePath) {
    std::string name = nodeEvent.Get("name").ToString().Utf8Value();
    auto be = std::make_unique<scram::mef::BasicEvent>(name, basePath, scram::mef::RoleSpecifier::kPublic);

    // Description
    if (nodeEvent.Has("description")) {
        be->label(nodeEvent.Get("description").ToString().Utf8Value());
    }

    // Value (probability/expression)
    if (nodeEvent.Has("value")) {
        scram::mef::Expression* expr = ScramNodeValue(nodeEvent.Get("value"), model, basePath);
        be->expression(expr);
    }

    return be;
}

// HouseEvent mapping
std::unique_ptr<scram::mef::HouseEvent> ScramNodeHouseEvent(const Napi::Object& nodeEvent, scram::mef::Model* model, const std::string& basePath) {
    std::string name = nodeEvent.Get("name").ToString().Utf8Value();
    auto he = std::make_unique<scram::mef::HouseEvent>(name, basePath, scram::mef::RoleSpecifier::kPublic);

    // Description
    if (nodeEvent.Has("description")) {
        he->label(nodeEvent.Get("description").ToString().Utf8Value());
    }

    // Value (state)
    if (nodeEvent.Has("value")) {
        bool state = nodeEvent.Get("value").ToBoolean().Value();
        he->state(state);
    }

    return he;
}

// Parameter mapping
std::unique_ptr<scram::mef::Parameter> ScramNodeParameter(const Napi::Object& nodeParam, scram::mef::Model* model, const std::string& basePath) {
    std::string name = nodeParam.Get("name").ToString().Utf8Value();
    auto param = std::make_unique<scram::mef::Parameter>(name, basePath, scram::mef::RoleSpecifier::kPublic);

    // Description
    if (nodeParam.Has("description")) {
        param->label(nodeParam.Get("description").ToString().Utf8Value());
    }

    // Value
    if (nodeParam.Has("value")) {
        scram::mef::Expression* expr = ScramNodeValue(nodeParam.Get("value"), model, basePath);
        param->expression(expr);
    }

    // Unit
    if (nodeParam.Has("unit")) {
        std::string unitStr = nodeParam.Get("unit").ToString().Utf8Value();
        param->unit(ScramNodeUnit(unitStr));
    }

    return param;
}

// CCF Group mapping
std::unique_ptr<scram::mef::CcfGroup> ScramNodeCCFGroup(const Napi::Object& nodeCCF, scram::mef::Model* model, const std::string& basePath) {
    std::string name = nodeCCF.Get("name").ToString().Utf8Value();
    std::string modelType = ScramNodeCCFModelType(nodeCCF.Get("model").ToString().Utf8Value());
    std::unique_ptr<scram::mef::CcfGroup> ccf;
    if (modelType == "beta-factor") {
        ccf = std::make_unique<scram::mef::BetaFactorModel>(name, basePath, scram::mef::RoleSpecifier::kPublic);
    } else if (modelType == "MGL") {
        ccf = std::make_unique<scram::mef::MglModel>(name, basePath, scram::mef::RoleSpecifier::kPublic);
    } else if (modelType == "alpha-factor") {
        ccf = std::make_unique<scram::mef::AlphaFactorModel>(name, basePath, scram::mef::RoleSpecifier::kPublic);
    } else {
        throw std::runtime_error("Unknown CCF model type: " + modelType);
    }

    // Description
    if (nodeCCF.Has("description")) {
        ccf->label(nodeCCF.Get("description").ToString().Utf8Value());
    }

    // Members
    if (nodeCCF.Has("members")) {
        Napi::Array membersArr = nodeCCF.Get("members").As<Napi::Array>();
        for (uint32_t i = 0; i < membersArr.Length(); ++i) {
            std::string memberName = membersArr.Get(i).ToString().Utf8Value();
            auto be = std::make_unique<scram::mef::BasicEvent>(memberName, basePath, scram::mef::RoleSpecifier::kPublic);
            ccf->AddMember(be.get());
            model->Add(std::move(be));
        }
    }

    // Distribution
    if (nodeCCF.Has("distribution")) {
        scram::mef::Expression* distr = ScramNodeValue(nodeCCF.Get("distribution"), model, basePath);
        ccf->AddDistribution(distr);
    }

    // Factors
    if (nodeCCF.Has("factors")) {
        Napi::Array factorsArr = nodeCCF.Get("factors").As<Napi::Array>();
        for (uint32_t i = 0; i < factorsArr.Length(); ++i) {
            Napi::Object factorObj = factorsArr.Get(i).As<Napi::Object>();
            int level = factorObj.Has("level") ? factorObj.Get("level").ToNumber().Int32Value() : 0;
            scram::mef::Expression* factorValue = ScramNodeValue(factorObj.Get("factorValue"), model, basePath);
            ccf->AddFactor(factorValue, level ? std::optional<int>(level) : std::nullopt);
        }
    }

    return ccf;
}

// Value mapping (recursive)
scram::mef::Expression* ScramNodeValue(const Napi::Value& nodeValue, scram::mef::Model* model, const std::string& basePath) {
    if (nodeValue.IsBoolean()) {
        bool val = nodeValue.ToBoolean().Value();
        return val ? &scram::mef::ConstantExpression::kOne : &scram::mef::ConstantExpression::kZero;
    }
    if (nodeValue.IsNumber()) {
        double val = nodeValue.ToNumber().DoubleValue();
        // Use float for all numbers
        auto expr = std::make_unique<scram::mef::ConstantExpression>(val);
        scram::mef::Expression* ptr = expr.get();
        model->Add(std::move(expr));
        return ptr;
    }
    if (nodeValue.IsString()) {
        // Could be a parameter reference
        std::string paramName = nodeValue.ToString().Utf8Value();
        // Try to find parameter in model
        const auto& params = model->table<scram::mef::Parameter>();
        auto it = std::find_if(params.begin(), params.end(), [&](const scram::mef::Parameter& p) { return p.name() == paramName; });
        if (it != params.end()) {
            it->usage(true);
            return const_cast<scram::mef::Parameter*>(&(*it));
        }
        throw std::runtime_error("Unknown parameter reference: " + paramName);
    }
    if (nodeValue.IsObject()) {
        Napi::Object obj = nodeValue.As<Napi::Object>();
        // Built-in functions
        if (obj.Has("exponential")) {
            Napi::Array arr = obj.Get("exponential").As<Napi::Array>();
            if (arr.Length() != 2)
                throw std::runtime_error("Exponential requires two arguments: [lambda, t]");
            scram::mef::Expression* lambda = ScramNodeValue(arr.Get(uint32_t(0)), model, basePath);
            scram::mef::Expression* t = ScramNodeValue(arr.Get(uint32_t(1)), model, basePath);
            auto expr = std::make_unique<scram::mef::Exponential>(lambda, t);
            scram::mef::Expression* ptr = expr.get();
            model->Add(std::move(expr));
            return ptr;
        }
        if (obj.Has("GLM")) {
            Napi::Array arr = obj.Get("GLM").As<Napi::Array>();
            std::vector<scram::mef::Expression*> args;
            for (uint32_t i = 0; i < arr.Length(); ++i)
                args.push_back(ScramNodeValue(arr.Get(i), model, basePath));
            auto expr = std::make_unique<scram::mef::Glm>(args[0], args[1], args[2], args[3]);
            scram::mef::Expression* ptr = expr.get();
            model->Add(std::move(expr));
            return ptr;
        }
        if (obj.Has("Weibull")) {
            Napi::Array arr = obj.Get("Weibull").As<Napi::Array>();
            std::vector<scram::mef::Expression*> args;
            for (uint32_t i = 0; i < arr.Length(); ++i)
                args.push_back(ScramNodeValue(arr.Get(i), model, basePath));
            auto expr = std::make_unique<scram::mef::Weibull>(args[0], args[1], args[2], args[3]);
            scram::mef::Expression* ptr = expr.get();
            model->Add(std::move(expr));
            return ptr;
        }
        if (obj.Has("periodicTest")) {
            Napi::Array arr = obj.Get("periodicTest").As<Napi::Array>();
            std::vector<scram::mef::Expression*> args;
            for (uint32_t i = 0; i < arr.Length(); ++i)
                args.push_back(ScramNodeValue(arr.Get(i), model, basePath));
            // PeriodicTest has overloaded constructors, handle by arg count
            std::unique_ptr<scram::mef::PeriodicTest> expr;
            switch (args.size()) {
                case 4: expr = std::make_unique<scram::mef::PeriodicTest>(args[0], args[1], args[2], args[3]); break;
                case 5: expr = std::make_unique<scram::mef::PeriodicTest>(args[0], args[1], args[2], args[3], args[4]); break;
                case 11: expr = std::make_unique<scram::mef::PeriodicTest>(args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10]); break;
                default: throw std::runtime_error("Invalid number of arguments for periodicTest");
            }
            scram::mef::Expression* ptr = expr.get();
            model->Add(std::move(expr));
            return ptr;
        }
        // Random deviates
        if (obj.Has("uniformDeviate")) {
            Napi::Array arr = obj.Get("uniformDeviate").As<Napi::Array>();
            scram::mef::Expression* a = ScramNodeValue(arr.Get(uint32_t(0)), model, basePath);
            scram::mef::Expression* b = ScramNodeValue(arr.Get(uint32_t(1)), model, basePath);
            auto expr = std::make_unique<scram::mef::UniformDeviate>(a, b);
            scram::mef::Expression* ptr = expr.get();
            model->Add(std::move(expr));
            return ptr;
        }
        if (obj.Has("normalDeviate")) {
            Napi::Array arr = obj.Get("normalDeviate").As<Napi::Array>();
            scram::mef::Expression* mu = ScramNodeValue(arr.Get(uint32_t(0)), model, basePath);
            scram::mef::Expression* sigma = ScramNodeValue(arr.Get(uint32_t(1)), model, basePath);
            auto expr = std::make_unique<scram::mef::NormalDeviate>(mu, sigma);
            scram::mef::Expression* ptr = expr.get();
            model->Add(std::move(expr));
            return ptr;
        }
        if (obj.Has("lognormalDeviate")) {
            Napi::Array arr = obj.Get("lognormalDeviate").As<Napi::Array>();
            if (arr.Length() == 2) {
                scram::mef::Expression* mu = ScramNodeValue(arr.Get(uint32_t(0)), model, basePath);
                scram::mef::Expression* sigma = ScramNodeValue(arr.Get(uint32_t(1)), model, basePath);
                auto expr = std::make_unique<scram::mef::LognormalDeviate>(mu, sigma);
                scram::mef::Expression* ptr = expr.get();
                model->Add(std::move(expr));
                return ptr;
            } else if (arr.Length() == 3) {
                scram::mef::Expression* mu = ScramNodeValue(arr.Get(uint32_t(0)), model, basePath);
                scram::mef::Expression* sigma = ScramNodeValue(arr.Get(uint32_t(1)), model, basePath);
                scram::mef::Expression* shift = ScramNodeValue(arr.Get(uint32_t(2)), model, basePath);
                auto expr = std::make_unique<scram::mef::LognormalDeviate>(mu, sigma, shift);
                scram::mef::Expression* ptr = expr.get();
                model->Add(std::move(expr));
                return ptr;
            } else {
                throw std::runtime_error("Invalid number of arguments for lognormalDeviate");
            }
        }
        if (obj.Has("gammaDeviate")) {
            Napi::Array arr = obj.Get("gammaDeviate").As<Napi::Array>();
            scram::mef::Expression* shape = ScramNodeValue(arr.Get(uint32_t(0)), model, basePath);
            scram::mef::Expression* scale = ScramNodeValue(arr.Get(uint32_t(1)), model, basePath);
            auto expr = std::make_unique<scram::mef::GammaDeviate>(shape, scale);
            scram::mef::Expression* ptr = expr.get();
            model->Add(std::move(expr));
            return ptr;
        }
        if (obj.Has("betaDeviate")) {
            Napi::Array arr = obj.Get("betaDeviate").As<Napi::Array>();
            scram::mef::Expression* alpha = ScramNodeValue(arr.Get(uint32_t(0)), model, basePath);
            scram::mef::Expression* beta = ScramNodeValue(arr.Get(uint32_t(1)), model, basePath);
            auto expr = std::make_unique<scram::mef::BetaDeviate>(alpha, beta);
            scram::mef::Expression* ptr = expr.get();
            model->Add(std::move(expr));
            return ptr;
        }
        if (obj.Has("histogram")) {
            Napi::Object histObj = obj.Get("histogram").As<Napi::Object>();
            scram::mef::Expression* base = ScramNodeValue(histObj.Get("base"), model, basePath);
            Napi::Array binsArr = histObj.Get("bins").As<Napi::Array>();
            std::vector<scram::mef::Expression*> boundaries = {base};
            std::vector<scram::mef::Expression*> weights;
            for (uint32_t i = 0; i < binsArr.Length(); ++i) {
                Napi::Array bin = binsArr.Get(i).As<Napi::Array>();
                boundaries.push_back(ScramNodeValue(bin.Get(uint32_t(0)), model, basePath));
                weights.push_back(ScramNodeValue(bin.Get(uint32_t(1)), model, basePath));
            }
            auto expr = std::make_unique<scram::mef::Histogram>(boundaries, weights);
            scram::mef::Expression* ptr = expr.get();
            model->Add(std::move(expr));
            return ptr;
        }
        // For unary ops
        #define NUM_OP_UNARY(NAME, CLASS) \
            if (obj.Has(#NAME)) { \
                auto val = obj.Get(#NAME); \
                scram::mef::Expression* arg = ScramNodeValue(val, model, basePath); \
                auto expr = std::make_unique<CLASS>(arg); \
                scram::mef::Expression* ptr = expr.get(); \
                model->Add(std::move(expr)); \
                return ptr; \
            }

        // For n-ary ops
        #define NUM_OP_NARY(NAME, CLASS) \
            if (obj.Has(#NAME)) { \
                auto val = obj.Get(#NAME); \
                Napi::Array arr = val.As<Napi::Array>(); \
                std::vector<scram::mef::Expression*> args; \
                for (uint32_t i = 0; i < arr.Length(); ++i) \
                args.push_back(ScramNodeValue(arr.Get(i), model, basePath)); \
                auto expr = std::make_unique<CLASS>(args); \
                scram::mef::Expression* ptr = expr.get(); \
                model->Add(std::move(expr)); \
                return ptr; \
            }
        // Unary ops
        NUM_OP_UNARY(neg, scram::mef::Neg)
        NUM_OP_UNARY(abs, scram::mef::Abs)
        NUM_OP_UNARY(acos, scram::mef::Acos)
        NUM_OP_UNARY(asin, scram::mef::Asin)
        NUM_OP_UNARY(atan, scram::mef::Atan)
        NUM_OP_UNARY(cos, scram::mef::Cos)
        NUM_OP_UNARY(sin, scram::mef::Sin)
        NUM_OP_UNARY(tan, scram::mef::Tan)
        NUM_OP_UNARY(cosh, scram::mef::Cosh)
        NUM_OP_UNARY(sinh, scram::mef::Sinh)
        NUM_OP_UNARY(tanh, scram::mef::Tanh)
        NUM_OP_UNARY(exp, scram::mef::Exp)
        NUM_OP_UNARY(log, scram::mef::Log)
        NUM_OP_UNARY(log10, scram::mef::Log10)
        NUM_OP_UNARY(sqrt, scram::mef::Sqrt)
        NUM_OP_UNARY(ceil, scram::mef::Ceil)
        NUM_OP_UNARY(floor, scram::mef::Floor)

        // N-ary ops
        NUM_OP_NARY(add, scram::mef::Add)
        NUM_OP_NARY(sub, scram::mef::Sub)
        NUM_OP_NARY(mul, scram::mef::Mul)
        NUM_OP_NARY(div, scram::mef::Div)
        NUM_OP_NARY(min, scram::mef::Min)
        NUM_OP_NARY(max, scram::mef::Max)
        NUM_OP_NARY(mean, scram::mef::Mean)
        // Special cases for mod, pow
        if (obj.Has("mod")) {
            Napi::Array arr = obj.Get("mod").As<Napi::Array>();
            scram::mef::Expression* a = ScramNodeValue(arr.Get(uint32_t(0)), model, basePath);
            scram::mef::Expression* b = ScramNodeValue(arr.Get(uint32_t(1)), model, basePath);
            auto expr = std::make_unique<scram::mef::Mod>(a, b);
            scram::mef::Expression* ptr = expr.get();
            model->Add(std::move(expr));
            return ptr;
        }
        if (obj.Has("pow")) {
            Napi::Array arr = obj.Get("pow").As<Napi::Array>();
            scram::mef::Expression* a = ScramNodeValue(arr.Get(uint32_t(0)), model, basePath);
            scram::mef::Expression* b = ScramNodeValue(arr.Get(uint32_t(1)), model, basePath);
            auto expr = std::make_unique<scram::mef::Pow>(a, b);
            scram::mef::Expression* ptr = expr.get();
            model->Add(std::move(expr));
            return ptr;
        }
        // pi
        if (obj.Has("pi")) {
            return &scram::mef::ConstantExpression::kPi;
        }
        // Parameter
        if (obj.Has("parameter")) {
            Napi::Object paramObj = obj.Get("parameter").As<Napi::Object>();
            auto param = ScramNodeParameter(paramObj, model, basePath);
            scram::mef::Expression* ptr = param.get();
            model->Add(std::move(param));
            return ptr;
        }
        // Built-in: systemMissionTime
        if (obj.Has("systemMissionTime")) {
            // Use model's mission_time
            return &model->mission_time();
        }
        // Fallback: error
        throw std::runtime_error("Unknown value object in ScramNodeValue");
    }
    throw std::runtime_error("Unsupported value type in ScramNodeValue");
}
