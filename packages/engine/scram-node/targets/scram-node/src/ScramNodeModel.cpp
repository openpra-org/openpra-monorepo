#include "ScramNodeModel.h"

// Step 2: TypeScript to C++ Model Mapping
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

    // Fault Trees
    if (nodeModel.Has("faultTrees")) {
        Napi::Array ftArr = nodeModel.Get("faultTrees").As<Napi::Array>();
        for (uint32_t i = 0; i < ftArr.Length(); ++i) {
            Napi::Object ftObj = ftArr.Get(i).As<Napi::Object>();
            auto ft = ScramNodeFaultTree(ftObj, model.get());
            ft->CollectTopEvents();
            model->Add(std::move(ft));
        }
    }

    return model;
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
