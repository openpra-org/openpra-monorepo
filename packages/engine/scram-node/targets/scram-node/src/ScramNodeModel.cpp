#include "ScramNodeModel.h"
#include <stack>
#include <unordered_map>
#include <algorithm>

void ParseModelRepresentation(const std::string& modelRep, scram::mef::FaultTree* ft, scram::mef::Model* model);
void ProcessSystemBasicEvents(const Napi::Object& basicEvents, scram::mef::Model* model);

std::unique_ptr<scram::mef::Model> ScramNodeModel(const Napi::Object& nodeModel) {
    std::string modelName;
    if (nodeModel.Has("name")) {
        modelName = nodeModel.Get("name").ToString().Utf8Value();
    } else {
        auto now = std::chrono::system_clock::now();
        auto timestamp = std::chrono::duration_cast<std::chrono::milliseconds>(
            now.time_since_epoch()
        ).count();
        modelName = "openpra_model_" + std::to_string(timestamp);
    }
    auto model = std::make_unique<scram::mef::Model>(modelName);

    model->mission_time().value(8760);

    try {
        if (!nodeModel.Has("faultTrees") && !nodeModel.Has("systemLogicModels")) {
            throw Napi::Error::New(nodeModel.Env(), 
                "Model must have either faultTrees or systemLogicModels");
        }

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

        if (nodeModel.Has("systemBasicEvents")) {
            auto basicEvents = nodeModel.Get("systemBasicEvents").ToObject();
            ProcessSystemBasicEvents(basicEvents, model.get());
        }

        if (nodeModel.Has("commonCauseFailureGroups")) {
            auto ccfGroups = nodeModel.Get("commonCauseFailureGroups").ToObject();
            ProcessOpenPRACCFGroups(ccfGroups, model.get());
        }

        return model;

    } catch (const Napi::Error& e) {
        throw;
    } catch (const std::exception& e) {
        throw Napi::Error::New(nodeModel.Env(), e.what());
    }
}

namespace {

scram::mef::Connective ConvertNodeType(const std::string& openPraType) {
    static const std::unordered_map<std::string, scram::mef::Connective> typeMap = {
        {"AND_GATE", scram::mef::kAnd},
        {"OR_GATE", scram::mef::kOr},
        {"NAND_GATE", scram::mef::kNand},
        {"NOR_GATE", scram::mef::kNor},
        {"XOR_GATE", scram::mef::kXor},
        {"VOTE_GATE", scram::mef::kAtleast},
        {"NOT_GATE", scram::mef::kNot}
    };
    
    auto it = typeMap.find(openPraType);
    if (it == typeMap.end()) {
        throw std::runtime_error("Unsupported gate type: " + openPraType);
    }
    return it->second;
}

bool IsSpecialEventType(const std::string& nodeType) {
    return nodeType == "TRUE_EVENT" || 
           nodeType == "FALSE_EVENT" || 
           nodeType == "PASS_EVENT" || 
           nodeType == "INIT_EVENT";
}

bool IsTransferGate(const std::string& nodeType) {
    return nodeType == "TRANSFER_IN" || nodeType == "TRANSFER_OUT";
}

std::unique_ptr<scram::mef::BasicEvent> CreateSpecialEvent(
    const std::string& name,
    const std::string& nodeType,
    const std::string& basePath
) {
    auto event = std::make_unique<scram::mef::BasicEvent>(
        name, basePath, scram::mef::RoleSpecifier::kPrivate);
    
    if (nodeType == "TRUE_EVENT") {
        event->expression(&scram::mef::ConstantExpression::kOne);
    } else if (nodeType == "FALSE_EVENT") {
        event->expression(&scram::mef::ConstantExpression::kZero);
    } else if (nodeType == "PASS_EVENT") {
        event->expression(&scram::mef::ConstantExpression::kOne);
    }
    
    return event;
}

double ExtractProbability(const Napi::Object& event) {
    if (event.Has("probability")) {
        return event.Get("probability").ToNumber().DoubleValue();
    }
    
    if (event.Has("probabilityModel")) {
        auto probModel = event.Get("probabilityModel").ToObject();
        return probModel.Get("value").ToNumber().DoubleValue();
    }
    
    if (event.Has("expression")) {
        auto expr = event.Get("expression").ToObject();
        if (expr.Has("value")) {
            return expr.Get("value").ToNumber().DoubleValue();
        }
    }
    
    throw Napi::Error::New(event.Env(), "No valid probability information found");
}

std::unique_ptr<scram::mef::FaultTree> ProcessOpenPRAFaultTree(const Napi::Object& faultTree, scram::mef::Model* model) {
    std::string name = faultTree.Get("name").ToString().Utf8Value();
    auto ft = std::make_unique<scram::mef::FaultTree>(name);

    if (faultTree.Has("nodes")) {
        auto nodes = faultTree.Get("nodes").ToObject();
        auto nodeNames = nodes.GetPropertyNames();
        
        for (size_t i = 0; i < nodeNames.Length(); i++) {
            auto nodeName = nodeNames.Get(i).ToString();
            auto node = nodes.Get(nodeName).ToObject();
            
            std::string nodeType = node.Get("nodeType").ToString().Utf8Value();
            
            if (nodeType == "HOUSE_EVENT") {
                auto he = std::make_unique<scram::mef::HouseEvent>(nodeName.Utf8Value());
                if (node.Has("houseEventValue")) {
                    he->state(node.Get("houseEventValue").ToBoolean().Value());
                }
                ft->Add(he.get());
                model->Add(std::move(he));
            }
            else if (nodeType == "BASIC_EVENT" || nodeType == "UNDEVELOPED_EVENT") {
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
                auto event = CreateSpecialEvent(nodeName.Utf8Value(), nodeType, ft->name());
                ft->Add(event.get());
                model->Add(std::move(event));
            }
            else if (IsTransferGate(nodeType)) {
                if (nodeType == "TRANSFER_IN") {
                    if (!node.Has("transferTreeId") || !node.Has("sourceNodeId")) {
                        throw std::runtime_error("Transfer-in gate missing required fields: " + nodeName.Utf8Value());
                    }
                    
                    std::string targetTree = node.Get("transferTreeId").ToString().Utf8Value();
                    std::string sourceNode = node.Get("sourceNodeId").ToString().Utf8Value();
                    
                    auto gate = std::make_unique<scram::mef::Gate>(nodeName.Utf8Value());
                    gate->SetAttribute({"transfer_tree", targetTree});
                    gate->SetAttribute({"source_node", sourceNode});
                    
                    ft->Add(gate.get());
                    model->Add(std::move(gate));
                }
            }
            else {
                auto gate = std::make_unique<scram::mef::Gate>(nodeName.Utf8Value());
                
                if (nodeType == "VOTE_GATE" && node.Has("minNumber")) {
                    gate->SetAttribute({"min_number", 
                        std::to_string(node.Get("minNumber").ToNumber().Int32Value())});
                }
                
                ft->Add(gate.get());
                model->Add(std::move(gate));
            }
        }
        
        for (size_t i = 0; i < nodeNames.Length(); i++) {
            auto nodeName = nodeNames.Get(i).ToString();
            auto node = nodes.Get(nodeName).ToObject();
            
            if (node.Has("inputs")) {
                auto inputs = node.Get("inputs").As<Napi::Array>();
                scram::mef::Formula::ArgSet argSet;
                
                for (size_t j = 0; j < inputs.Length(); j++) {
                    std::string inputName = inputs.Get(j).ToString().Utf8Value();
                    scram::mef::Gate* gate = nullptr;
                    scram::mef::BasicEvent* be = nullptr;
                    try {
                        gate = &model->Get<scram::mef::Gate>(inputName);
                    } catch (...) {
                        try {
                            be = &model->Get<scram::mef::BasicEvent>(inputName);
                        } catch (...) {
                            throw std::runtime_error("Referenced node not found: " + inputName);
                        }
                    }
                    
                    if (gate) {
                        argSet.Add(gate);
                    } else if (be) {
                        argSet.Add(be);
                    }
                }
                
                std::string nodeType = node.Get("nodeType").ToString().Utf8Value();
                
                if (nodeType == "TRANSFER_OUT") {
                    continue;
                }
                
                scram::mef::Gate& gate = model->Get<scram::mef::Gate>(nodeName.Utf8Value());
                
                if (nodeType == "TRANSFER_IN") {
                    continue;
                }
                else if (nodeType == "VOTE_GATE") {
                    int minNumber = node.Get("minNumber").ToNumber().Int32Value();
                    auto formula = std::make_unique<scram::mef::Formula>(
                        scram::mef::kAtleast,
                        std::move(argSet),
                        minNumber
                    );
                    gate.formula(std::move(formula));
                }
                else {
                    auto formula = std::make_unique<scram::mef::Formula>(
                        ConvertNodeType(nodeType),
                        std::move(argSet)
                    );
                    gate.formula(std::move(formula));
                }
            }
        }
    }

    if (faultTree.Has("quantificationSettings")) {
        auto settings = faultTree.Get("quantificationSettings").ToObject();
        
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
    }

    return ft;
}

std::unique_ptr<scram::mef::FaultTree> ProcessSystemLogicModel(const Napi::Object& logicModel, scram::mef::Model* model) {
    std::string name = logicModel.Get("systemReference").ToString().Utf8Value();
    auto ft = std::make_unique<scram::mef::FaultTree>(name);

    if (logicModel.Has("basicEvents")) {
        auto events = logicModel.Get("basicEvents").As<Napi::Array>();
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

    if (logicModel.Has("modelRepresentation")) {
        std::string modelRep = logicModel.Get("modelRepresentation").ToString().Utf8Value();
        ParseModelRepresentation(modelRep, ft.get(), model);
    }

    return ft;
}

scram::mef::Gate* ProcessLogicToken(
    const std::string& token,
    scram::mef::FaultTree* ft,
    scram::mef::Model* model,
    std::map<std::string, scram::mef::Gate*>& gateCache
) {
    std::string cleanToken = token;
    cleanToken.erase(0, cleanToken.find_first_not_of(" \t\n\r"));
    cleanToken.erase(cleanToken.find_last_not_of(" \t\n\r") + 1);

    if (gateCache.count(cleanToken)) {
        return gateCache[cleanToken];
    }

    try {
        scram::mef::Gate& existing = model->Get<scram::mef::Gate>(cleanToken);
        return &existing;
    } catch (...) {
    }

    auto be = std::make_unique<scram::mef::BasicEvent>(cleanToken);
    auto* bePtr = be.get();
    ft->Add(bePtr);
    model->Add(std::move(be));
    
    return nullptr;
}

void ParseModelRepresentation(
    const std::string& modelRep,
    scram::mef::FaultTree* ft,
    scram::mef::Model* model
) {
    std::map<std::string, scram::mef::Gate*> gateCache;
    std::stack<std::string> operatorStack;
    std::stack<scram::mef::Formula::ArgSet> argStack;
    size_t gateCounter = 0;

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
                    auto* gate = ProcessLogicToken(token, ft, model, gateCache);
                    if (gate) {
                        currentArgs.Add(gate);
                    }
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
                    auto* gate = ProcessLogicToken(token, ft, model, gateCache);
                    if (gate) {
                        currentArgs.Add(gate);
                    }
                    token.clear();
                    readingToken = false;
                }

                if (!operatorStack.empty()) {
                    std::string op = operatorStack.top();
                    operatorStack.pop();

                    std::string gateName = "G" + std::to_string(++gateCounter);
                    auto gate = std::make_unique<scram::mef::Gate>(gateName);
                    
                    scram::mef::Connective gateType;
                    if (op == "AND" || op == "[") {
                        gateType = scram::mef::kAnd;
                    } else if (op == "OR") {
                        gateType = scram::mef::kOr;
                    } else {
                        throw std::runtime_error("Unsupported operator: " + op);
                    }

                    auto formula = std::make_unique<scram::mef::Formula>(
                        gateType, std::move(currentArgs));
                    gate->formula(std::move(formula));

                    auto* gatePtr = gate.get();
                    ft->Add(gatePtr);
                    model->Add(std::move(gate));
                    gateCache[gateName] = gatePtr;

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
                        auto* gate = ProcessLogicToken(token, ft, model, gateCache);
                        if (gate) {
                            currentArgs.Add(gate);
                        }
                        token.clear();
                        readingToken = false;
                    }
                    operatorStack.push("AND");
                    i += 2;
                } else {
                    token += c;
                    readingToken = true;
                }
                break;
            }
            case 'O': {
                if (i + 1 < cleanRep.length() && cleanRep.substr(i, 2) == "OR") {
                    if (readingToken) {
                        auto* gate = ProcessLogicToken(token, ft, model, gateCache);
                        if (gate) {
                            currentArgs.Add(gate);
                        }
                        token.clear();
                        readingToken = false;
                    }
                    operatorStack.push("OR");
                    i += 1;
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

    if (readingToken && !token.empty()) {
        auto* gate = ProcessLogicToken(token, ft, model, gateCache);
        if (gate) {
            currentArgs.Add(gate);
        }
    }
}

void ProcessSystemBasicEvents(const Napi::Object& basicEvents, scram::mef::Model* model) {
    auto names = basicEvents.GetPropertyNames();
    for (size_t i = 0; i < names.Length(); i++) {
        auto name = names.Get(i).ToString();
        auto event = basicEvents.Get(name).ToObject();
        
        auto be = std::make_unique<scram::mef::BasicEvent>(name.Utf8Value());
        
        if (event.Has("probability")) {
            double prob = ExtractProbability(event);
            auto expr = std::make_unique<scram::mef::ConstantExpression>(prob);
            be->expression(expr.get());
            model->Add(std::move(expr));
        }
        
        model->Add(std::move(be));
    }
}

void ProcessOpenPRACCFGroups(const Napi::Object& ccfGroups, scram::mef::Model* model) {
    auto names = ccfGroups.GetPropertyNames();
    for (size_t i = 0; i < names.Length(); i++) {
        auto name = names.Get(i).ToString();
        auto group = ccfGroups.Get(name).ToObject();
        
        std::string modelType = group.Get("modelType").ToString().Utf8Value();
        std::unique_ptr<scram::mef::CcfGroup> ccf;
        
        if (modelType == "BETA_FACTOR") {
            ccf = std::make_unique<scram::mef::BetaFactorModel>(name.Utf8Value());
        } else if (modelType == "MGL") {
            ccf = std::make_unique<scram::mef::MglModel>(name.Utf8Value());
        } else if (modelType == "ALPHA_FACTOR") {
            ccf = std::make_unique<scram::mef::AlphaFactorModel>(name.Utf8Value());
        } else {
            throw std::runtime_error("Unsupported CCF model type: " + modelType);
        }
        
        if (group.Has("members")) {
            auto members = group.Get("members").ToObject();
            if (members.Has("basicEvents")) {
                auto events = members.Get("basicEvents").As<Napi::Array>();
                for (size_t j = 0; j < events.Length(); j++) {
                    auto event = events.Get(j).ToObject();
                    std::string eventId = event.Get("id").ToString().Utf8Value();
                    scram::mef::BasicEvent& be = model->Get<scram::mef::BasicEvent>(eventId);
                    ccf->AddMember(&be);
                }
            }
        }
        
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

    if (nodeEventTree.Has("eventSequences")) {
        Napi::Array seqArr = nodeEventTree.Get("eventSequences").As<Napi::Array>();
        for (uint32_t i = 0; i < seqArr.Length(); ++i) {
            Napi::Object seqObj = seqArr.Get(i).As<Napi::Object>();
            std::string seqName = seqObj.Get("endState").ToString().Utf8Value();
            auto seq = std::make_unique<scram::mef::Sequence>(seqName);
            et->Add(seq.get());
            model->Add(std::move(seq));
        }
        
        EventTreeTrieNode trieRoot;
        BuildEventTreeTrie(trieRoot, seqArr);

        auto buildBranch = [&](EventTreeTrieNode* node, size_t level, auto&& buildBranchRef) -> std::unique_ptr<scram::mef::Branch> {
            auto branch = std::make_unique<scram::mef::Branch>();
            if (!node->endState.empty()) {
                auto& seq = et->Get<scram::mef::Sequence>(node->endState);
                branch->target(&seq);
                return branch;
            }
            if (level < functionalEventOrder.size()) {
                std::string feName = functionalEventOrder[level];
                auto& fe = et->Get<scram::mef::FunctionalEvent>(feName);
                std::vector<scram::mef::Path> paths;
                for (auto& [state, child] : node->children) {
                    auto path = scram::mef::Path(state);
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

        auto initialBranch = buildBranch(&trieRoot, 0, buildBranch);
        et->initial_state(*initialBranch);
    }

    if (nodeEventTree.Has("initiatingEvent")) {
        Napi::Object ieObj = nodeEventTree.Get("initiatingEvent").As<Napi::Object>();
        auto ie = ScramNodeInitiatingEvent(ieObj, model);
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
    if (nodeIE.Has("frequency")) {
        double freq = nodeIE.Get("frequency").ToNumber().DoubleValue();
        ie->SetAttribute(scram::mef::Attribute("frequency", std::to_string(freq)));
    }
    if (nodeIE.Has("unit")) {
        std::string unit = nodeIE.Get("unit").ToString().Utf8Value();
        ie->SetAttribute(scram::mef::Attribute("unit", unit));
    }
    return ie;
}

std::unique_ptr<scram::mef::FaultTree> ScramNodeFaultTree(const Napi::Object& nodeFaultTree, scram::mef::Model* model) {
    std::string name = nodeFaultTree.Get("name").ToString().Utf8Value();
    auto ft = std::make_unique<scram::mef::FaultTree>(name);

    if (nodeFaultTree.Has("description")) {
        ft->label(nodeFaultTree.Get("description").ToString().Utf8Value());
    }

    if (nodeFaultTree.Has("ccfGroups")) {
        Napi::Array ccfArr = nodeFaultTree.Get("ccfGroups").As<Napi::Array>();
        for (uint32_t i = 0; i < ccfArr.Length(); ++i) {
            Napi::Object ccfObj = ccfArr.Get(i).As<Napi::Object>();
            auto ccf = ScramNodeCCFGroup(ccfObj, model, ft->name());
            ft->Add(ccf.get());
            model->Add(std::move(ccf));
        }
    }

    if (nodeFaultTree.Has("topEvent")) {
        Napi::Object gateObj = nodeFaultTree.Get("topEvent").As<Napi::Object>();
        auto gate = ScramNodeGate(gateObj, model, ft->name());
        ft->Add(gate.get());
        model->Add(std::move(gate));
    }

    return ft;
}

std::unique_ptr<scram::mef::Gate> ScramNodeGate(const Napi::Object& nodeGate, scram::mef::Model* model, const std::string& basePath) {
    std::string name = nodeGate.Get("name").ToString().Utf8Value();
    auto it = std::find_if(model->table<scram::mef::Gate>().begin(), model->table<scram::mef::Gate>().end(),
        [&](const scram::mef::Gate& g) { return g.name() == name; });
    if (it != model->table<scram::mef::Gate>().end()) {
        return std::unique_ptr<scram::mef::Gate>(const_cast<scram::mef::Gate*>(&(*it)));
    }
    auto gate = std::make_unique<scram::mef::Gate>(name, basePath, scram::mef::RoleSpecifier::kPublic);

    if (nodeGate.Has("description")) {
        gate->label(nodeGate.Get("description").ToString().Utf8Value());
    }

    scram::mef::Connective type = scram::mef::kAnd;
    if (nodeGate.Has("type")) {
        type = ScramNodeGateType(nodeGate.Get("type").ToString().Utf8Value());
    }
    scram::mef::Formula::ArgSet argSet;

    if (nodeGate.Has("gates")) {
        Napi::Array gatesArr = nodeGate.Get("gates").As<Napi::Array>();
        for (uint32_t i = 0; i < gatesArr.Length(); ++i) {
            Napi::Object childGateObj = gatesArr.Get(i).As<Napi::Object>();
            auto childGate = ScramNodeGate(childGateObj, model, basePath);
            argSet.Add(childGate.get());
            model->Add(std::move(childGate));
        }
    }

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
                auto be = ScramNodeBasicEvent(eventObj, model, basePath);
                argSet.Add(be.get());
                model->Add(std::move(be));
            } else {
                throw std::runtime_error("Unknown event type in gate: " + eventType);
            }
        }
    }

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

std::unique_ptr<scram::mef::BasicEvent> ScramNodeBasicEvent(const Napi::Object& nodeEvent, scram::mef::Model* model, const std::string& basePath) {
    std::string name = nodeEvent.Get("name").ToString().Utf8Value();
    auto be = std::make_unique<scram::mef::BasicEvent>(name, basePath, scram::mef::RoleSpecifier::kPublic);

    if (nodeEvent.Has("description")) {
        be->label(nodeEvent.Get("description").ToString().Utf8Value());
    }

    if (nodeEvent.Has("value")) {
        scram::mef::Expression* expr = ScramNodeValue(nodeEvent.Get("value"), model, basePath);
        be->expression(expr);
    }

    return be;
}

std::unique_ptr<scram::mef::HouseEvent> ScramNodeHouseEvent(const Napi::Object& nodeEvent, scram::mef::Model* model, const std::string& basePath) {
    std::string name = nodeEvent.Get("name").ToString().Utf8Value();
    auto he = std::make_unique<scram::mef::HouseEvent>(name, basePath, scram::mef::RoleSpecifier::kPublic);

    if (nodeEvent.Has("description")) {
        he->label(nodeEvent.Get("description").ToString().Utf8Value());
    }

    if (nodeEvent.Has("value")) {
        bool state = nodeEvent.Get("value").ToBoolean().Value();
        he->state(state);
    }

    return he;
}

std::unique_ptr<scram::mef::Parameter> ScramNodeParameter(const Napi::Object& nodeParam, scram::mef::Model* model, const std::string& basePath) {
    std::string name = nodeParam.Get("name").ToString().Utf8Value();
    auto param = std::make_unique<scram::mef::Parameter>(name, basePath, scram::mef::RoleSpecifier::kPublic);

    if (nodeParam.Has("description")) {
        param->label(nodeParam.Get("description").ToString().Utf8Value());
    }

    if (nodeParam.Has("value")) {
        scram::mef::Expression* expr = ScramNodeValue(nodeParam.Get("value"), model, basePath);
        param->expression(expr);
    }

    if (nodeParam.Has("unit")) {
        std::string unitStr = nodeParam.Get("unit").ToString().Utf8Value();
        param->unit(ScramNodeUnit(unitStr));
    }

    return param;
}

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

    if (nodeCCF.Has("description")) {
        ccf->label(nodeCCF.Get("description").ToString().Utf8Value());
    }

    if (nodeCCF.Has("members")) {
        Napi::Array membersArr = nodeCCF.Get("members").As<Napi::Array>();
        for (uint32_t i = 0; i < membersArr.Length(); ++i) {
            std::string memberName = membersArr.Get(i).ToString().Utf8Value();
            auto be = std::make_unique<scram::mef::BasicEvent>(memberName, basePath, scram::mef::RoleSpecifier::kPublic);
            ccf->AddMember(be.get());
            model->Add(std::move(be));
        }
    }

    if (nodeCCF.Has("distribution")) {
        scram::mef::Expression* distr = ScramNodeValue(nodeCCF.Get("distribution"), model, basePath);
        ccf->AddDistribution(distr);
    }

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

scram::mef::Expression* ScramNodeValue(const Napi::Value& nodeValue, scram::mef::Model* model, const std::string& basePath) {
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
        #define NUM_OP_UNARY(NAME, CLASS) \
            if (obj.Has(#NAME)) { \
                auto val = obj.Get(#NAME); \
                scram::mef::Expression* arg = ScramNodeValue(val, model, basePath); \
                auto expr = std::make_unique<CLASS>(arg); \
                scram::mef::Expression* ptr = expr.get(); \
                model->Add(std::move(expr)); \
                return ptr; \
            }

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

        NUM_OP_NARY(add, scram::mef::Add)
        NUM_OP_NARY(sub, scram::mef::Sub)
        NUM_OP_NARY(mul, scram::mef::Mul)
        NUM_OP_NARY(div, scram::mef::Div)
        NUM_OP_NARY(min, scram::mef::Min)
        NUM_OP_NARY(max, scram::mef::Max)
        NUM_OP_NARY(mean, scram::mef::Mean)
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
        if (obj.Has("pi")) {
            return &scram::mef::ConstantExpression::kPi;
        }
        if (obj.Has("parameter")) {
            Napi::Object paramObj = obj.Get("parameter").As<Napi::Object>();
            auto param = ScramNodeParameter(paramObj, model, basePath);
            scram::mef::Expression* ptr = param.get();
            model->Add(std::move(param));
            return ptr;
        }
        if (obj.Has("systemMissionTime")) {
            return &model->mission_time();
        }
        throw std::runtime_error("Unknown value object in ScramNodeValue");
    }
    throw std::runtime_error("Unsupported value type in ScramNodeValue");
}
