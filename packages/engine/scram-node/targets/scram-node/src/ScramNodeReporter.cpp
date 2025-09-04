#include <cstdlib>
#include <string>
#include <utility>
#include "ScramNodeReporter.h"
#include "settings.h"
#include "mocus.h"
#include "bdd.h"
#include "zbdd.h"
#include "probability_analysis.h"
#include "fault_tree_analysis.h"

// Forward declarations of local helpers
static Napi::Object BuildSumOfProductsForGate(Napi::Env env,
                                              const scram::mef::Gate& gate,
                                              const scram::core::RiskAnalysis& analysis);
static Napi::Array  ScramNodeProductList(Napi::Env env,
                                         const scram::core::ProductContainer& products,
                                         const scram::core::ProbabilityAnalysis* pa);

// Main entry point: C++ to TypeScript Report Mapping
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
  mf.Set("faultTrees",        Napi::Number::New(env, model.fault_trees().size()));
  mf.Set("gates",             Napi::Number::New(env, model.gates().size()));
  mf.Set("basicEvents",       Napi::Number::New(env, model.basic_events().size()));
  mf.Set("houseEvents",       Napi::Number::New(env, model.house_events().size()));
  mf.Set("undevelopedEvents", Napi::Number::New(env, 0)); // Not tracked separately in SCRAM
  mf.Set("ccfGroups",         Napi::Number::New(env, model.ccf_groups().size()));
  mf.Set("eventTrees",        Napi::Number::New(env, model.event_trees().size()));
  mf.Set("initiatingEvents",  Napi::Number::New(env, model.initiating_events().size()));
  return mf;
}

// Results Layer: integrates event tree and fault tree results
Napi::Object ScramNodeResults(Napi::Env env, const scram::core::RiskAnalysis& analysis) {
  Napi::Object results = Napi::Object::New(env);

  // --- Event Tree Results (with per-sequence cut sets) ---
  if (!analysis.event_tree_results().empty()) {
    Napi::Array ieArr = Napi::Array::New(env, analysis.event_tree_results().size());
    uint32_t idx = 0;
    for (const auto& etaResult : analysis.event_tree_results()) {
      if (etaResult.event_tree_analysis) {
        const auto& eta = *etaResult.event_tree_analysis;
        Napi::Object ieResult = Napi::Object::New(env);

        const auto& ie = eta.initiating_event();
        ieResult.Set("name", ie.name());
        if (!ie.label().empty())
          ieResult.Set("description", ie.label());

        // frequency per year (read from attribute "frequency")
        double ie_freq = 1.0;
        if (const auto* attr = ie.GetAttribute("frequency"))
          ie_freq = std::strtod(attr->value().c_str(), nullptr);

        Napi::Array seqArr = Napi::Array::New(env, eta.sequences().size());
        uint32_t sidx = 0;

        for (const auto& seq : eta.sequences()) {
          Napi::Object seqObj = Napi::Object::New(env);

          // Sequence name: we use the sequence's MEF name directly
          seqObj.Set("name", seq.sequence.name());

          // Frequency per year = IE frequency * sequence probability
          seqObj.Set("value", Napi::Number::New(env, seq.p_sequence * ie_freq));

          // Add cut sets for the sequence gate (if gate exists)
          if (seq.gate) {
            // EventTreeAnalysis gave us a concrete Gate that represents this sequence's AND-collection.
            // Build a sum-of-products report object for this gate by running a local FTA.
            Napi::Object sop = BuildSumOfProductsForGate(env, *seq.gate, analysis);
            seqObj.Set("cutSets", sop);
          }

          seqArr.Set(sidx++, seqObj);
        }

        ieResult.Set("sequences", seqArr);
        ieArr.Set(idx++, ieResult);
      }
    }
    results.Set("initiatingEvents", ieArr);
  }

  // --- Fault Tree and Other Results ---
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

  // Sum of Products (Cut Sets) for fault-tree targets
  Napi::Array sopArr = Napi::Array::New(env);
  uint32_t sopIdx = 0;

  // For each result (per analysis target)
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
  if (silIdx   > 0) results.Set("safetyIntegrityLevels", silArr);
  if (curveIdx > 0) results.Set("curves",                 curvesArr);
  if (statIdx  > 0) results.Set("statisticalMeasures",   statArr);
  if (impIdx   > 0) results.Set("importance",            importanceArr);
  if (sopIdx   > 0) results.Set("sumOfProducts",         sopArr);

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
    bin.Set("number",     Napi::Number::New(env, idx + 1));
    bin.Set("value",      Napi::Number::New(env, value));
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
  sil.Set("PFDavg",       Napi::Number::New(env, silData.pfd_avg));
  sil.Set("PFHavg",       Napi::Number::New(env, silData.pfh_avg));
  sil.Set("PFDhistogram", ScramNodeHistogram(env, silData.pfd_fractions));
  sil.Set("PFHhistogram", ScramNodeHistogram(env, silData.pfh_fractions));
  return sil;
}

// Curve (Risk Curve)
Napi::Object ScramNodeCurve(Napi::Env env, const scram::core::ProbabilityAnalysis& pa) {
  Napi::Object curve = Napi::Object::New(env);
  curve.Set("xTitle", "Mission time");
  curve.Set("yTitle", "Probability");
  curve.Set("xUnit",  "hours");
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
  stat.Set("mean",              Napi::Number::New(env, ua.mean()));
  stat.Set("standardDeviation", Napi::Number::New(env, ua.sigma()));
  // Confidence range (95%)
  Napi::Object conf = Napi::Object::New(env);
  conf.Set("percentage", Napi::Number::New(env, 95));
  conf.Set("lowerBound", Napi::Number::New(env, ua.confdence_interval().first));
  conf.Set("upperBound", Napi::Number::New(env, ua.confdence_interval().second));
  stat.Set("confdenceRange", conf);
  // Error factor (95%)
  Napi::Object ef = Napi::Object::New(env);
  ef.Set("percentage", Napi::Number::New(env, 95));
  ef.Set("value",      Napi::Number::New(env, ua.error_factor()));
  stat.Set("errorFactor", ef);
  // Quantiles
  stat.Set("quantiles", ScramNodeQuantiles(env, ua.quantiles(), ua.mean(), ua.sigma()));
  // Histogram
  Napi::Array hist = Napi::Array::New(env, ua.distribution().size() - 1);
  for (size_t i = 0; i + 1 < ua.distribution().size(); ++i) {
    Napi::Object bin = Napi::Object::New(env);
    bin.Set("number",     Napi::Number::New(env, i + 1));
    bin.Set("value",      Napi::Number::New(env, ua.distribution()[i + 1].second));
    bin.Set("lowerBound", Napi::Number::New(env, ua.distribution()[i].first));
    bin.Set("upperBound", Napi::Number::New(env, ua.distribution()[i + 1].first));
    hist.Set(i, bin);
  }
  stat.Set("histogram", hist);
  return stat;
}

// Quantiles
Napi::Array ScramNodeQuantiles(Napi::Env env, const std::vector<double>& quantiles, double /*mean*/, double /*sigma*/) {
  Napi::Array arr = Napi::Array::New(env, quantiles.size());
  double prev  = 0;
  double delta = 1.0 / (quantiles.empty() ? 1.0 : static_cast<double>(quantiles.size()));
  for (size_t i = 0; i < quantiles.size(); ++i) {
    Napi::Object q = Napi::Object::New(env);
    q.Set("number",     Napi::Number::New(env, i + 1));
    q.Set("value",      Napi::Number::New(env, delta * (i + 1)));
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

// Sum of Products (Cut Sets) for fault tree analyses (already computed by RiskAnalysis)
Napi::Object ScramNodeSumOfProducts(Napi::Env env, const scram::core::FaultTreeAnalysis& fta, const scram::core::ProbabilityAnalysis* pa) {
  Napi::Object sop = Napi::Object::New(env);
  const auto& products = fta.products();
  sop.Set("basicEvents", Napi::Number::New(env, products.product_events().size()));
  sop.Set("products",    Napi::Number::New(env, products.size()));
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

// Helper: Build sum of products for an arbitrary gate with the chosen algorithm/approximation
static Napi::Object BuildSumOfProductsForGate(Napi::Env env,
                                              const scram::mef::Gate& gate,
                                              const scram::core::RiskAnalysis& analysis) {
  using scram::core::Settings;
  using scram::core::Algorithm;
  using scram::core::Approximation;

  const Settings& settings = analysis.settings();

  // Qualitative analysis (algorithm)
  Napi::Object sop = Napi::Object::New(env);

  // Dispatch by algorithm
  if (settings.algorithm() == Algorithm::kMocus) {
    scram::core::FaultTreeAnalyzer<scram::core::Mocus> fta(gate, settings);
    fta.Analyze();
    const auto& products = fta.products();

    sop.Set("basicEvents", Napi::Number::New(env, products.product_events().size()));
    sop.Set("products",    Napi::Number::New(env, products.size()));

    // Probability analysis (approximation or exact depending on settings)
    std::unique_ptr<scram::core::ProbabilityAnalysis> pa;
    if (settings.probability_analysis()) {
      if (settings.approximation() == Approximation::kMcub) {
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::McubCalculator>>(&fta,
          const_cast<scram::mef::MissionTime*>(&analysis.model().mission_time()));
        paLocal->Analyze();
        sop.Set("probability", Napi::Number::New(env, paLocal->p_total()));
        sop.Set("productList", ScramNodeProductList(env, products, paLocal.get()));
        pa = std::move(paLocal);
      } else { // rare-event default for MOCUS
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::RareEventCalculator>>(&fta,
          const_cast<scram::mef::MissionTime*>(&analysis.model().mission_time()));
        paLocal->Analyze();
        sop.Set("probability", Napi::Number::New(env, paLocal->p_total()));
        sop.Set("productList", ScramNodeProductList(env, products, paLocal.get()));
        pa = std::move(paLocal);
      }
    } else {
      sop.Set("productList", ScramNodeProductList(env, products, nullptr));
    }

    if (!products.distribution().empty()) {
      Napi::Array dist = Napi::Array::New(env, products.distribution().size());
      for (size_t i = 0; i < products.distribution().size(); ++i) {
        dist.Set(i, Napi::Number::New(env, products.distribution()[i]));
      }
      sop.Set("distribution", dist);
    }
    return sop;
  }

  if (settings.algorithm() == Algorithm::kZbdd) {
    scram::core::FaultTreeAnalyzer<scram::core::Zbdd> fta(gate, settings);
    fta.Analyze();
    const auto& products = fta.products();

    sop.Set("basicEvents", Napi::Number::New(env, products.product_events().size()));
    sop.Set("products",    Napi::Number::New(env, products.size()));

    std::unique_ptr<scram::core::ProbabilityAnalysis> pa;
    if (settings.probability_analysis()) {
      if (settings.approximation() == Approximation::kMcub) {
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::McubCalculator>>(&fta,
          const_cast<scram::mef::MissionTime*>(&analysis.model().mission_time()));
        paLocal->Analyze();
        sop.Set("probability", Napi::Number::New(env, paLocal->p_total()));
        sop.Set("productList", ScramNodeProductList(env, products, paLocal.get()));
        pa = std::move(paLocal);
      } else { // rare-event default for ZBDD
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::RareEventCalculator>>(&fta,
          const_cast<scram::mef::MissionTime*>(&analysis.model().mission_time()));
        paLocal->Analyze();
        sop.Set("probability", Napi::Number::New(env, paLocal->p_total()));
        sop.Set("productList", ScramNodeProductList(env, products, paLocal.get()));
        pa = std::move(paLocal);
      }
    } else {
      sop.Set("productList", ScramNodeProductList(env, products, nullptr));
    }

    if (!products.distribution().empty()) {
      Napi::Array dist = Napi::Array::New(env, products.distribution().size());
      for (size_t i = 0; i < products.distribution().size(); ++i) {
        dist.Set(i, Napi::Number::New(env, products.distribution()[i]));
      }
      sop.Set("distribution", dist);
    }
    return sop;
  }

  // Algorithm::kBdd (exact)
  {
    scram::core::FaultTreeAnalyzer<scram::core::Bdd> fta(gate, settings);
    fta.Analyze();
    const auto& products = fta.products();

    sop.Set("basicEvents", Napi::Number::New(env, products.product_events().size()));
    sop.Set("products",    Napi::Number::New(env, products.size()));

    std::unique_ptr<scram::core::ProbabilityAnalysis> pa;
    if (settings.probability_analysis()) {
      auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::Bdd>>(&fta,
        const_cast<scram::mef::MissionTime*>(&analysis.model().mission_time()));
      paLocal->Analyze();
      sop.Set("probability", Napi::Number::New(env, paLocal->p_total()));
      sop.Set("productList", ScramNodeProductList(env, products, paLocal.get()));
      pa = std::move(paLocal);
    } else {
      sop.Set("productList", ScramNodeProductList(env, products, nullptr));
    }

    if (!products.distribution().empty()) {
      Napi::Array dist = Napi::Array::New(env, products.distribution().size());
      for (size_t i = 0; i < products.distribution().size(); ++i) {
        dist.Set(i, Napi::Number::New(env, products.distribution()[i]));
      }
      sop.Set("distribution", dist);
    }
    return sop;
  }
}