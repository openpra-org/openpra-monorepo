#include <memory>
#include <vector>
#include <string>
#include <unordered_map>

#include "ccf_group.h"
#include "event.h"
#include "error.h"
#include "expression.h"
#include "fault_tree.h"
#include "parameter.h"
#include "probability_analysis.h"
#include "expression/constant.h"
#include "expression/exponential.h"
#include "expression/numerical.h"
#include "expression/random_deviate.h"
#include "expression/test_event.h"

#include "QuantifyFaultTree.h"

// Step 1: TypeScript to C++ Settings Mapping
scram::core::Settings ScramNodeOptions(const Napi::Object& nodeOptions) {
    scram::core::Settings settings;

    // Algorithm (mocus, bdd, zbdd)
    if (nodeOptions.Has("mocus")) {
        if (nodeOptions.Get("mocus").ToBoolean().Value())
            settings.algorithm("mocus");
    } else if (nodeOptions.Has("bdd")) {
        if (nodeOptions.Get("bdd").ToBoolean().Value())
            settings.algorithm("bdd");
    } else if (nodeOptions.Has("zbdd")) {
        if (nodeOptions.Get("zbdd").ToBoolean().Value())
            settings.algorithm("zbdd");
    } else {
        settings.algorithm("mocus");
    }

    // Approximation (rare-event, mcub, none)
    if (nodeOptions.Has("rareEvent")) {
        if (nodeOptions.Get("rareEvent").ToBoolean().Value())
            settings.approximation("rare-event");
    } else if (nodeOptions.Has("mcub")) {
        if (nodeOptions.Get("mcub").ToBoolean().Value())
            settings.approximation("mcub");
    } else {
        settings.approximation("none");
    }

    // Prime implicants (bool)
    if (nodeOptions.Has("primeImplicants")) {
        settings.prime_implicants(nodeOptions.Get("primeImplicants").ToBoolean().Value());
    }

    // Probability analysis (bool)
    if (nodeOptions.Has("probability")) {
        settings.probability_analysis(nodeOptions.Get("probability").ToBoolean().Value());
    }

    // Importance analysis (bool)
    if (nodeOptions.Has("importance")) {
        settings.importance_analysis(nodeOptions.Get("importance").ToBoolean().Value());
    }

    // Uncertainty analysis (bool)
    if (nodeOptions.Has("uncertainty")) {
        settings.uncertainty_analysis(nodeOptions.Get("uncertainty").ToBoolean().Value());
    }

    // CCF analysis (bool)
    if (nodeOptions.Has("ccf")) {
        settings.ccf_analysis(nodeOptions.Get("ccf").ToBoolean().Value());
    }

    // Safety Integrity Levels (bool)
    if (nodeOptions.Has("sil")) {
        settings.safety_integrity_levels(nodeOptions.Get("sil").ToBoolean().Value());
    }

    // Limit order (int)
    if (nodeOptions.Has("limitOrder")) {
        settings.limit_order(nodeOptions.Get("limitOrder").ToNumber().Int32Value());
    }

    // Cut-off (double)
    if (nodeOptions.Has("cutOff")) {
        settings.cut_off(nodeOptions.Get("cutOff").ToNumber().DoubleValue());
    }

    // Mission time (double)
    if (nodeOptions.Has("missionTime")) {
        settings.mission_time(nodeOptions.Get("missionTime").ToNumber().DoubleValue());
    }

    // Time step (double)
    if (nodeOptions.Has("timeStep")) {
        settings.time_step(nodeOptions.Get("timeStep").ToNumber().DoubleValue());
    }

    // Number of trials (int)
    if (nodeOptions.Has("numTrials")) {
        settings.num_trials(nodeOptions.Get("numTrials").ToNumber().Int32Value());
    }

    // Number of quantiles (int)
    if (nodeOptions.Has("numQuantiles")) {
        settings.num_quantiles(nodeOptions.Get("numQuantiles").ToNumber().Int32Value());
    }

    // Number of bins (int)
    if (nodeOptions.Has("numBins")) {
        settings.num_bins(nodeOptions.Get("numBins").ToNumber().Int32Value());
    }

    // Seed (int)
    if (nodeOptions.Has("seed")) {
        settings.seed(nodeOptions.Get("seed").ToNumber().Int32Value());
    }

    return settings;
}

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

// Step 3: C++ to TypeScript Report Mapping
// Main entry point
Napi::Object ScramNodeReport(Napi::Env env, const scram::core::RiskAnalysis& analysis) {
    Napi::Object report = Napi::Object::New(env);

    // Model features
    report.Set("modelFeatures", ScramNodeModelFeatures(env, analysis.model()));

    // Results
    report.Set("results", ScramNodeResults(env, analysis));

    return report;
}

// Model Features
Napi::Object ScramNodeModelFeatures(Napi::Env env, const scram::mef::Model& model) {
    Napi::Object mf = Napi::Object::New(env);
    if (!model.HasDefaultName()) mf.Set("name", model.name());
    mf.Set("faultTrees", Napi::Number::New(env, model.fault_trees().size()));
    mf.Set("gates", Napi::Number::New(env, model.gates().size()));
    mf.Set("basicEvents", Napi::Number::New(env, model.basic_events().size()));
    mf.Set("houseEvents", Napi::Number::New(env, model.house_events().size()));
    mf.Set("undevelopedEvents", Napi::Number::New(env, 0)); // Not tracked separately in SCRAM
    mf.Set("ccfGroups", Napi::Number::New(env, model.ccf_groups().size()));
    return mf;
}

// Results Layer
Napi::Object ScramNodeResults(Napi::Env env, const scram::core::RiskAnalysis& analysis) {
    Napi::Object results = Napi::Object::New(env);

    // Safety Integrity Levels (SIL)
    Napi::Array silArr = Napi::Array::New(env);
    uint32_t silIdx = 0;

    // Curves
    Napi::Array curvesArr = Napi::Array::New(env);
    uint32_t curveIdx = 0;

    // Statistical Measures (Uncertainty)
    Napi::Array statArr = Napi::Array::New(env);
    uint32_t statIdx = 0;

    // Importance
    Napi::Array importanceArr = Napi::Array::New(env);
    uint32_t impIdx = 0;

    // Sum of Products (Cut Sets)
    Napi::Array sopArr = Napi::Array::New(env);
    uint32_t sopIdx = 0;

    // For each result (per gate/sequence)
    for (const auto& result : analysis.results()) {
        // Fault Tree Analysis (Sum of Products)
        if (result.fault_tree_analysis) {
            sopArr.Set(sopIdx++, ScramNodeSumOfProducts(env, *result.fault_tree_analysis, result.probability_analysis.get()));
        }
        // Probability Analysis (Curve, SIL)
        if (result.probability_analysis) {
            // Curve
            if (!result.probability_analysis->p_time().empty()) {
                curvesArr.Set(curveIdx++, ScramNodeCurve(env, *result.probability_analysis));
            }
            // SIL
            if (result.probability_analysis->settings().safety_integrity_levels()) {
                silArr.Set(silIdx++, ScramNodeSafetyIntegrityLevels(env, *result.probability_analysis));
            }
        }
        // Importance
        if (result.importance_analysis) {
            importanceArr.Set(impIdx++, ScramNodeImportance(env, *result.importance_analysis));
        }
        // Uncertainty
        if (result.uncertainty_analysis) {
            statArr.Set(statIdx++, ScramNodeStatisticalMeasure(env, *result.uncertainty_analysis));
        }
    }

    // Set arrays if not empty
    if (silIdx > 0) results.Set("safetyIntegrityLevels", silArr);
    if (curveIdx > 0) results.Set("curves", curvesArr);
    if (statIdx > 0) results.Set("statisticalMeasures", statArr);
    if (impIdx > 0) results.Set("importance", importanceArr);
    if (sopIdx > 0) results.Set("sumOfProducts", sopArr);

    return results;
}

// Histogram Bin Array
template <typename ArrayType>
Napi::Array ScramNodeHistogram(Napi::Env env, const ArrayType& hist) {
    Napi::Array arr = Napi::Array::New(env, hist.size());
    double lower = 0;
    uint32_t idx = 0;
    for (const auto& pair : hist) {
        double upper = pair.first;
        double value = pair.second;
        Napi::Object bin = Napi::Object::New(env);
        bin.Set("number", Napi::Number::New(env, idx + 1));
        bin.Set("value", Napi::Number::New(env, value));
        bin.Set("lowerBound", Napi::Number::New(env, lower));
        bin.Set("upperBound", Napi::Number::New(env, upper));
        arr.Set(idx++, bin);
        lower = upper;
    }
    return arr;
}

// Safety Integrity Levels
Napi::Object ScramNodeSafetyIntegrityLevels(Napi::Env env, const scram::core::ProbabilityAnalysis& pa) {
    Napi::Object sil = Napi::Object::New(env);
    const auto& silData = pa.sil();
    sil.Set("PFDavg", Napi::Number::New(env, silData.pfd_avg));
    sil.Set("PFHavg", Napi::Number::New(env, silData.pfh_avg));
    sil.Set("PFDhistogram", ScramNodeHistogram(env, silData.pfd_fractions));
    sil.Set("PFHhistogram", ScramNodeHistogram(env, silData.pfh_fractions));
    return sil;
}

// Curve (Risk Curve)
Napi::Object ScramNodeCurve(Napi::Env env, const scram::core::ProbabilityAnalysis& pa) {
    Napi::Object curve = Napi::Object::New(env);
    curve.Set("xTitle", "Mission time");
    curve.Set("yTitle", "Probability");
    curve.Set("xUnit", "hours");
    Napi::Array points = Napi::Array::New(env, pa.p_time().size());
    uint32_t idx = 0;
    for (const auto& [y, x] : pa.p_time()) {
        Napi::Object pt = Napi::Object::New(env);
        pt.Set("x", Napi::Number::New(env, x));
        pt.Set("y", Napi::Number::New(env, y));
        points.Set(idx++, pt);
    }
    curve.Set("points", points);
    return curve;
}

// Statistical Measure (Uncertainty)
Napi::Object ScramNodeStatisticalMeasure(Napi::Env env, const scram::core::UncertaintyAnalysis& ua) {
    Napi::Object stat = Napi::Object::New(env);
    stat.Set("mean", Napi::Number::New(env, ua.mean()));
    stat.Set("standardDeviation", Napi::Number::New(env, ua.sigma()));
    // Confidence range (95%)
    Napi::Object conf = Napi::Object::New(env);
    conf.Set("percentage", Napi::Number::New(env, 95));
    conf.Set("lowerBound", Napi::Number::New(env, ua.confidence_interval().first));
    conf.Set("upperBound", Napi::Number::New(env, ua.confidence_interval().second));
    stat.Set("confidenceRange", conf);
    // Error factor (95%)
    Napi::Object ef = Napi::Object::New(env);
    ef.Set("percentage", Napi::Number::New(env, 95));
    ef.Set("value", Napi::Number::New(env, ua.error_factor()));
    stat.Set("errorFactor", ef);
    // Quantiles
    stat.Set("quantiles", ScramNodeQuantiles(env, ua.quantiles(), ua.mean(), ua.sigma()));
    // Histogram
    Napi::Array hist = Napi::Array::New(env, ua.distribution().size() - 1);
    for (size_t i = 0; i + 1 < ua.distribution().size(); ++i) {
        Napi::Object bin = Napi::Object::New(env);
        bin.Set("number", Napi::Number::New(env, i + 1));
        bin.Set("value", Napi::Number::New(env, ua.distribution()[i + 1].second));
        bin.Set("lowerBound", Napi::Number::New(env, ua.distribution()[i].first));
        bin.Set("upperBound", Napi::Number::New(env, ua.distribution()[i + 1].first));
        hist.Set(i, bin);
    }
    stat.Set("histogram", hist);
    return stat;
}

// Quantiles
Napi::Array ScramNodeQuantiles(Napi::Env env, const std::vector<double>& quantiles, double mean, double sigma) {
    Napi::Array arr = Napi::Array::New(env, quantiles.size());
    double prev = 0;
    double delta = 1.0 / quantiles.size();
    for (size_t i = 0; i < quantiles.size(); ++i) {
        Napi::Object q = Napi::Object::New(env);
        q.Set("number", Napi::Number::New(env, i + 1));
        q.Set("value", Napi::Number::New(env, delta * (i + 1)));
        q.Set("lowerBound", Napi::Number::New(env, prev));
        q.Set("upperBound", Napi::Number::New(env, quantiles[i]));
        arr.Set(i, q);
        prev = quantiles[i];
    }
    return arr;
}

// Importance Results
Napi::Object ScramNodeImportance(Napi::Env env, const scram::core::ImportanceAnalysis& ia) {
    Napi::Object imp = Napi::Object::New(env);
    imp.Set("basicEvents", Napi::Number::New(env, ia.importance().size()));
    Napi::Array events = Napi::Array::New(env, ia.importance().size());
    uint32_t idx = 0;
    for (const auto& entry : ia.importance()) {
        Napi::Object ev = Napi::Object::New(env);
        ev.Set("type", "basic-event");
        ev.Set("name", entry.event.name());
        Napi::Object factors = Napi::Object::New(env);
        factors.Set("occurrence", Napi::Number::New(env, entry.factors.occurrence));
        factors.Set("probability", Napi::Number::New(env, entry.event.p()));
        factors.Set("DIF", Napi::Number::New(env, entry.factors.dif));
        factors.Set("MIF", Napi::Number::New(env, entry.factors.mif));
        factors.Set("CIF", Napi::Number::New(env, entry.factors.cif));
        factors.Set("RRW", Napi::Number::New(env, entry.factors.rrw));
        factors.Set("RAW", Napi::Number::New(env, entry.factors.raw));
        ev.Set("factors", factors);
        events.Set(idx++, ev);
    }
    imp.Set("events", events);
    return imp;
}

// Sum of Products (Cut Sets)
Napi::Object ScramNodeSumOfProducts(Napi::Env env, const scram::core::FaultTreeAnalysis& fta, const scram::core::ProbabilityAnalysis* pa) {
    Napi::Object sop = Napi::Object::New(env);
    const auto& products = fta.products();
    sop.Set("basicEvents", Napi::Number::New(env, products.product_events().size()));
    sop.Set("products", Napi::Number::New(env, products.size()));
    if (pa) sop.Set("probability", Napi::Number::New(env, pa->p_total()));
    // Distribution
    if (!products.distribution().empty()) {
        Napi::Array dist = Napi::Array::New(env, products.distribution().size());
        for (size_t i = 0; i < products.distribution().size(); ++i) {
            dist.Set(i, Napi::Number::New(env, products.distribution()[i]));
        }
        sop.Set("distribution", dist);
    }
    // Product List
    sop.Set("productList", ScramNodeProductList(env, products, pa));
    return sop;
}

// Product List (Minimal Cut Sets)
Napi::Array ScramNodeProductList(Napi::Env env, const scram::core::ProductContainer& products, const scram::core::ProbabilityAnalysis* pa) {
    Napi::Array arr = Napi::Array::New(env, products.size());
    size_t idx = 0;
    double sum = 0;
    if (pa) {
        for (const auto& product : products) sum += product.p();
    }
    for (const auto& product : products) {
        Napi::Object prod = Napi::Object::New(env);
        prod.Set("order", Napi::Number::New(env, product.size()));
        if (pa) {
            double prob = product.p();
            prod.Set("probability", Napi::Number::New(env, prob));
            if (sum != 0) prod.Set("contribution", Napi::Number::New(env, prob / sum));
        }
        // Literals
        Napi::Array literals = Napi::Array::New(env, product.size());
        size_t lidx = 0;
        for (const auto& literal : product) {
            Napi::Object lit = Napi::Object::New(env);
            if (literal.complement) {
                lit.Set("type", "not-basic-event");
            } else {
                lit.Set("type", "basic-event");
            }
            lit.Set("name", literal.event.name());
            literals.Set(lidx++, lit);
        }
        prod.Set("literals", literals);
        arr.Set(idx++, prod);
    }
    return arr;
}

// Step 4: The Node Addon Method for Quantifying Fault Trees
Napi::Value QuantifyFaultTree(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Settings and Model - both are required").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[0].IsObject()) {
        Napi::TypeError::New(env, "Settings object required").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[1].IsObject()) {
        Napi::TypeError::New(env, "Model object required").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object nodeOptions = info[0].As<Napi::Object>();
    Napi::Object nodeModel = info[1].As<Napi::Object>();

    // 1. Map Node options/model to C++
    auto settings = ScramNodeOptions(nodeOptions);
    auto model = ScramNodeModel(nodeModel);

    // 2. Run analysis
    scram::core::RiskAnalysis analysis(model.get(), settings);

    try {
        analysis.Analyze();
    } catch (const std::exception& e) {
        Napi::Error::New(env, "Failed to analyze the fault trees").ThrowAsJavaScriptException();
        return env.Null();
    }

    try {
        // 3. Map result to Node
        Napi::Object nodeReport = ScramNodeReport(env, analysis);
        return nodeReport;
    } catch (const std::exception& e) {
        Napi::Error::New(env, "Failed to generate the quantification report").ThrowAsJavaScriptException();
        return env.Null();
    }
}
