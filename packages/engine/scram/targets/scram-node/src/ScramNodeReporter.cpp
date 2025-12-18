#include <cmath>
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <limits>
#include <memory>
#include <sstream>
#include <string>
#include <string_view>
#include <utility>
#include <variant>
#include <vector>
#include "ScramNodeReporter.h"
#include "settings.h"
#include "mocus.h"
#include "bdd.h"
#include "zbdd.h"
#include "probability_analysis.h"
#include "fault_tree_analysis.h"

namespace {

struct JsonScope {
  enum class Type { kObject, kArray } type;
  bool first = true;
};

class JsonWriter {
public:
  explicit JsonWriter(std::ostream &os) : os_(os) {}

  void BeginObject() {
    BeforeValue();
    os_ << '{';
    stack_.push_back({JsonScope::Type::kObject, true});
  }

  void EndObject() {
    os_ << '}';
    if (!stack_.empty())
      stack_.pop_back();
  }

  void BeginArray() {
    BeforeValue();
    os_ << '[';
    stack_.push_back({JsonScope::Type::kArray, true});
  }

  void EndArray() {
    os_ << ']';
    if (!stack_.empty())
      stack_.pop_back();
  }

  void Key(std::string_view key) {
    if (stack_.empty() || stack_.back().type != JsonScope::Type::kObject)
      return;
    auto &scope = stack_.back();
    if (!scope.first)
      os_ << ',';
    scope.first = false;
    WriteStringLiteral(key);
    os_ << ':';
  }

  void String(std::string_view value) {
    BeforeValue();
    WriteStringLiteral(value);
  }

  void Number(double value) {
    BeforeValue();
    if (std::isfinite(value)) {
      std::ostringstream oss;
      oss.setf(std::ios::fmtflags(0), std::ios::floatfield);
      oss << std::setprecision(std::numeric_limits<double>::digits10 + 1) << value;
      os_ << oss.str();
    } else {
      os_ << "null";
    }
  }

  void Integer(std::int64_t value) {
    BeforeValue();
    os_ << value;
  }

  void Unsigned(std::uint64_t value) {
    BeforeValue();
    os_ << value;
  }

  void Bool(bool value) {
    BeforeValue();
    os_ << (value ? "true" : "false");
  }

  void Null() {
    BeforeValue();
    os_ << "null";
  }

private:
  void BeforeValue() {
    if (stack_.empty())
      return;
    auto &scope = stack_.back();
    if (scope.type == JsonScope::Type::kArray) {
      if (!scope.first)
        os_ << ',';
      scope.first = false;
    }
  }

  void WriteStringLiteral(std::string_view value) {
    os_ << '"';
    for (unsigned char c : value) {
      switch (c) {
        case '"': os_ << "\\\""; break;
        case '\\': os_ << "\\\\"; break;
        case '\b': os_ << "\\b"; break;
        case '\f': os_ << "\\f"; break;
        case '\n': os_ << "\\n"; break;
        case '\r': os_ << "\\r"; break;
        case '\t': os_ << "\\t"; break;
        default:
          if (c < 0x20) {
            os_ << "\\u";
            constexpr char hex[] = "0123456789abcdef";
            const unsigned int uc = static_cast<unsigned int>(c);
            os_ << '0'
              << '0'
              << hex[(uc >> 4) & 0xF]
              << hex[uc & 0xF];
          } else {
            os_ << static_cast<char>(c);
          }
      }
    }
    os_ << '"';
  }

  std::ostream &os_;
  std::vector<JsonScope> stack_;
};

template <typename T>
inline void WriteSize(JsonWriter &writer, T value) {
  writer.Unsigned(static_cast<std::uint64_t>(value));
}

template <typename ArrayType>
void WriteHistogram(JsonWriter &writer, const ArrayType &hist) {
  writer.BeginArray();
  double lower = 0.0;
  std::size_t idx = 0;
  for (const auto &pair : hist) {
    double upper = pair.first;
    double val = pair.second;
    writer.BeginObject();
    writer.Key("number");
    WriteSize(writer, idx + 1);
    writer.Key("value");
    writer.Number(val);
    writer.Key("lowerBound");
    writer.Number(lower);
    writer.Key("upperBound");
    writer.Number(upper);
    writer.EndObject();
    lower = upper;
    ++idx;
  }
  writer.EndArray();
}

void WriteQuantilesJson(JsonWriter &writer, const std::vector<double> &quantiles, double /*mean*/, double /*sigma*/) {
  writer.BeginArray();
  double prev = 0.0;
  const double denom = quantiles.empty() ? 1.0 : static_cast<double>(quantiles.size());
  for (std::size_t i = 0; i < quantiles.size(); ++i) {
    writer.BeginObject();
    writer.Key("number");
    WriteSize(writer, i + 1);
    writer.Key("value");
    writer.Number(static_cast<double>(i + 1) / denom);
    writer.Key("lowerBound");
    writer.Number(prev);
    writer.Key("upperBound");
    writer.Number(quantiles[i]);
    writer.EndObject();
    prev = quantiles[i];
  }
  writer.EndArray();
}

void WriteSafetyIntegrityLevelsJson(JsonWriter &writer, const scram::core::ProbabilityAnalysis &pa) {
  writer.BeginObject();
  const auto &silData = pa.sil();
  writer.Key("PFDavg");
  writer.Number(silData.pfd_avg);
  writer.Key("PFHavg");
  writer.Number(silData.pfh_avg);
  writer.Key("PFDhistogram");
  WriteHistogram(writer, silData.pfd_fractions);
  writer.Key("PFHhistogram");
  WriteHistogram(writer, silData.pfh_fractions);
  writer.EndObject();
}

void WriteCurveJson(JsonWriter &writer, const scram::core::ProbabilityAnalysis &pa) {
  writer.BeginObject();
  writer.Key("xTitle");
  writer.String("Mission time");
  writer.Key("yTitle");
  writer.String("Probability");
  writer.Key("xUnit");
  writer.String("hours");
  writer.Key("points");
  writer.BeginArray();
  for (const auto &[y, x] : pa.p_time()) {
    writer.BeginObject();
    writer.Key("x");
    writer.Number(x);
    writer.Key("y");
    writer.Number(y);
    writer.EndObject();
  }
  writer.EndArray();
  writer.EndObject();
}

void WriteStatisticalMeasureJson(JsonWriter &writer, const scram::core::UncertaintyAnalysis &ua) {
  writer.BeginObject();
  writer.Key("mean");
  writer.Number(ua.mean());
  writer.Key("standardDeviation");
  writer.Number(ua.sigma());

  writer.Key("confdenceRange");
  writer.BeginObject();
  writer.Key("percentage");
  WriteSize(writer, 95);
  writer.Key("lowerBound");
  writer.Number(ua.confidence_interval().first);
  writer.Key("upperBound");
  writer.Number(ua.confidence_interval().second);
  writer.EndObject();

  writer.Key("errorFactor");
  writer.BeginObject();
  writer.Key("percentage");
  WriteSize(writer, 95);
  writer.Key("value");
  writer.Number(ua.error_factor());
  writer.EndObject();

  writer.Key("quantiles");
  WriteQuantilesJson(writer, ua.quantiles(), ua.mean(), ua.sigma());

  writer.Key("histogram");
  writer.BeginArray();
  const auto &distribution = ua.distribution();
  for (std::size_t i = 0; i + 1 < distribution.size(); ++i) {
    writer.BeginObject();
    writer.Key("number");
    WriteSize(writer, i + 1);
    writer.Key("value");
    writer.Number(distribution[i + 1].second);
    writer.Key("lowerBound");
    writer.Number(distribution[i].first);
    writer.Key("upperBound");
    writer.Number(distribution[i + 1].first);
    writer.EndObject();
  }
  writer.EndArray();

  writer.EndObject();
}

void WriteImportanceJson(JsonWriter &writer, const scram::core::ImportanceAnalysis &ia) {
  writer.BeginObject();
  writer.Key("basicEvents");
  WriteSize(writer, ia.importance().size());
  writer.Key("events");
  writer.BeginArray();
  for (const auto &entry : ia.importance()) {
    writer.BeginObject();
    writer.Key("type");
    writer.String("basic-event");
    writer.Key("name");
    writer.String(entry.event.name());
    writer.Key("factors");
    writer.BeginObject();
    writer.Key("occurrence");
    writer.Number(entry.factors.occurrence);
    writer.Key("probability");
    writer.Number(entry.event.p());
    writer.Key("DIF");
    writer.Number(entry.factors.dif);
    writer.Key("MIF");
    writer.Number(entry.factors.mif);
    writer.Key("CIF");
    writer.Number(entry.factors.cif);
    writer.Key("RRW");
    writer.Number(entry.factors.rrw);
    writer.Key("RAW");
    writer.Number(entry.factors.raw);
    writer.EndObject();
    writer.EndObject();
  }
  writer.EndArray();
  writer.EndObject();
}

void WriteDistributionJson(JsonWriter &writer, const std::vector<int> &distribution) {
  writer.BeginArray();
  for (int value : distribution) {
    writer.Integer(value);
  }
  writer.EndArray();
}

void WriteProductListJson(JsonWriter &writer,
              const scram::core::ProductContainer &products,
              const scram::core::ProbabilityAnalysis *pa,
              bool exclude_product_lists = false) {
  if (exclude_product_lists) {
    // Skip writing the full product list to save space
    return;
  }
  
  writer.BeginArray();
  double sum = 0.0;
  if (pa) {
    for (const auto &product : products) {
      sum += product.p();
    }
  }
  for (const auto &product : products) {
    writer.BeginObject();
    writer.Key("order");
    WriteSize(writer, product.size());
    if (pa) {
      const double prob = product.p();
      writer.Key("probability");
      writer.Number(prob);
      if (sum != 0.0) {
        writer.Key("contribution");
        writer.Number(prob / sum);
      }
    }
    writer.Key("literals");
    writer.BeginArray();
    for (const auto &literal : product) {
      writer.BeginObject();
      writer.Key("type");
      writer.String(literal.complement ? "not-basic-event" : "basic-event");
      writer.Key("name");
      writer.String(literal.event.name());
      writer.EndObject();
    }
    writer.EndArray();
    writer.EndObject();
  }
  writer.EndArray();
}

void WriteSumOfProductsJson(JsonWriter &writer,
              const scram::core::FaultTreeAnalysis &fta,
              const scram::core::ProbabilityAnalysis *pa,
              const scram::core::RiskAnalysis::Result *result,
              bool exclude_product_lists = false) {
  writer.BeginObject();
  if (!fta.has_products()) {
    writer.Key("basicEvents");
    WriteSize(writer, 0);
    writer.Key("products");
    WriteSize(writer, 0);
    if (pa) {
      writer.Key("probability");
      writer.Number(pa->p_total());
    }
    writer.EndObject();
    return;
  }

  const auto &products = fta.products();
  writer.Key("basicEvents");
  WriteSize(writer, products.product_events().size());
  writer.Key("products");
  WriteSize(writer, products.size());
  if (pa) {
    writer.Key("probability");
    writer.Number(pa->p_total());
  }
  if (!products.distribution().empty()) {
    writer.Key("distribution");
    WriteDistributionJson(writer, products.distribution());
  }

  if (const auto* summary = fta.last_product_summary()) {
    writer.Key("originalProducts");
    writer.Integer(summary->original_product_count);
    writer.Key("prunedProducts");
    writer.Integer(summary->pruned_products);
    writer.Key("cutOffApplied");
    writer.Bool(summary->cut_off_applied);
    if (summary->cut_off_applied) {
      writer.Key("appliedCutOff");
      writer.Number(summary->applied_cut_off);
    }
  }
  if (fta.adaptive_mode_used()) {
    writer.Key("adaptive");
    writer.Bool(true);
    const double target = fta.adaptive_target_probability();
    if (target > 0.0) {
      writer.Key("adaptiveTarget");
      writer.Number(target);
    }
    if (const auto* summary = fta.last_product_summary(); summary && summary->cut_off_applied) {
      writer.Key("adaptiveCutOff");
      writer.Number(summary->applied_cut_off);
    }
  }
  
  if (!exclude_product_lists) {
    writer.Key("productList");
    WriteProductListJson(writer, products, pa, exclude_product_lists);
  }
  
  // Add calculation time stats if available
  if (result) {
    writer.Key("calculationTime");
    writer.BeginObject();
    
    if (result->preprocessing_seconds) {
      writer.Key("preprocessing");
      writer.Number(*result->preprocessing_seconds);
    }
    
    if (result->fault_tree_analysis) {
      writer.Key("products");
      writer.Number(result->fault_tree_analysis->analysis_time());
    }
    
    if (result->probability_analysis) {
      writer.Key("probability");
      writer.Number(result->probability_analysis->analysis_time());
    }
    
    if (result->importance_analysis) {
      writer.Key("importance");
      writer.Number(result->importance_analysis->analysis_time());
    }
    
    if (result->uncertainty_analysis) {
      writer.Key("uncertainty");
      writer.Number(result->uncertainty_analysis->analysis_time());
    }
    
    if (result->report_generation_seconds) {
      writer.Key("reportGeneration");
      writer.Number(*result->report_generation_seconds);
    }
    
    writer.EndObject();
  }
  
  writer.EndObject();
}

void WriteSumOfProductsForGate(JsonWriter &writer,
                 const scram::mef::Gate &gate,
                 const scram::core::RiskAnalysis &analysis,
                 double initiating_frequency,
                 bool exclude_product_lists = false) {
  using scram::core::Algorithm;
  using scram::core::Approximation;

  const auto &settings = analysis.settings();

  if (settings.algorithm() == Algorithm::kMocus) {
    scram::core::FaultTreeAnalyzer<scram::core::Mocus> fta(gate, settings);
    fta.initiating_event_frequency(initiating_frequency);
    fta.Analyze();

    std::unique_ptr<scram::core::ProbabilityAnalysis> pa;
    if (settings.probability_analysis()) {
      if (settings.approximation() == Approximation::kMcub) {
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::McubCalculator>>(
          &fta,
          const_cast<scram::mef::MissionTime *>(&analysis.model().mission_time()));
        paLocal->Analyze();
        pa = std::move(paLocal);
      } else {
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::RareEventCalculator>>(
          &fta,
          const_cast<scram::mef::MissionTime *>(&analysis.model().mission_time()));
        paLocal->Analyze();
        pa = std::move(paLocal);
      }
    }

    WriteSumOfProductsJson(writer, fta, pa.get(), nullptr, exclude_product_lists);
    return;
  }

  if (settings.algorithm() == Algorithm::kZbdd) {
    scram::core::FaultTreeAnalyzer<scram::core::Zbdd> fta(gate, settings);
    fta.initiating_event_frequency(initiating_frequency);
    fta.Analyze();

    std::unique_ptr<scram::core::ProbabilityAnalysis> pa;
    if (settings.probability_analysis()) {
      if (settings.approximation() == Approximation::kMcub) {
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::McubCalculator>>(
          &fta,
          const_cast<scram::mef::MissionTime *>(&analysis.model().mission_time()));
        paLocal->Analyze();
        pa = std::move(paLocal);
      } else {
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::RareEventCalculator>>(
          &fta,
          const_cast<scram::mef::MissionTime *>(&analysis.model().mission_time()));
        paLocal->Analyze();
        pa = std::move(paLocal);
      }
    }

    WriteSumOfProductsJson(writer, fta, pa.get(), nullptr, exclude_product_lists);
    return;
  }

  // Default to exact BDD analysis when no other algorithm matches.
  {
    scram::core::FaultTreeAnalyzer<scram::core::Bdd> fta(gate, settings);
    fta.initiating_event_frequency(initiating_frequency);
    fta.Analyze();

    std::unique_ptr<scram::core::ProbabilityAnalysis> pa;
    if (settings.probability_analysis()) {
      auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::Bdd>>(
        &fta,
        const_cast<scram::mef::MissionTime *>(&analysis.model().mission_time()));
      paLocal->Analyze();
      pa = std::move(paLocal);
    }

    WriteSumOfProductsJson(writer, fta, pa.get(), nullptr, exclude_product_lists);
  }
}

void WriteSumOfProductsResult(JsonWriter &writer,
                const scram::core::FaultTreeAnalysis &fta,
                const scram::core::ProbabilityAnalysis *pa,
                const scram::core::RiskAnalysis::Result *result,
                bool exclude_product_lists = false) {
  WriteSumOfProductsJson(writer, fta, pa, result, exclude_product_lists);
}

struct ResultCounts {
  std::size_t sil = 0;
  std::size_t curve = 0;
  std::size_t stat = 0;
  std::size_t importance = 0;
  std::size_t sop = 0;
};

ResultCounts CountResultArtifacts(const scram::core::RiskAnalysis &analysis) {
  ResultCounts counts;
  for (const auto &result : analysis.results()) {
    if (result.fault_tree_analysis) {
      ++counts.sop;
    }
    if (result.probability_analysis) {
      if (!result.probability_analysis->p_time().empty()) {
        ++counts.curve;
      }
      if (result.probability_analysis->settings().safety_integrity_levels()) {
        ++counts.sil;
      }
    }
    if (result.importance_analysis) {
      ++counts.importance;
    }
    if (result.uncertainty_analysis) {
      ++counts.stat;
    }
  }
  return counts;
}

const scram::core::RiskAnalysis::Result *FindSequenceResult(
    const scram::core::RiskAnalysis &analysis,
    const scram::mef::InitiatingEvent &initiating_event,
    const scram::mef::Sequence &sequence);

void WriteModelFeaturesJson(JsonWriter &writer, const scram::mef::Model &model) {
  writer.BeginObject();
  if (!model.HasDefaultName()) {
    writer.Key("name");
    writer.String(model.name());
  }
  writer.Key("faultTrees");
  WriteSize(writer, model.fault_trees().size());
  writer.Key("gates");
  WriteSize(writer, model.gates().size());
  writer.Key("basicEvents");
  WriteSize(writer, model.basic_events().size());
  writer.Key("houseEvents");
  WriteSize(writer, model.house_events().size());
  writer.Key("undevelopedEvents");
  WriteSize(writer, 0);
  writer.Key("ccfGroups");
  WriteSize(writer, model.ccf_groups().size());
  writer.Key("eventTrees");
  WriteSize(writer, model.event_trees().size());
  writer.Key("initiatingEvents");
  WriteSize(writer, model.initiating_events().size());
  writer.EndObject();
}

void WriteEventTreeResultsJson(JsonWriter &writer, const scram::core::RiskAnalysis &analysis, bool exclude_product_lists = false) {
  if (analysis.event_tree_results().empty()) {
    return;
  }
  writer.Key("initiatingEvents");
  writer.BeginArray();
  for (const auto &etaResult : analysis.event_tree_results()) {
    if (!etaResult.event_tree_analysis) {
      continue;
    }
    const auto &eta = *etaResult.event_tree_analysis;
    writer.BeginObject();
    const auto &ie = eta.initiating_event();
    writer.Key("name");
    writer.String(ie.name());
    if (!ie.label().empty()) {
      writer.Key("description");
      writer.String(ie.label());
    }
    if (ie.HasFrequency()) {
      writer.Key("frequency");
      writer.Number(ie.frequency_value());
    }

    writer.Key("sequences");
    writer.BeginArray();
    for (const auto &seq : eta.sequences()) {
      writer.BeginObject();
      writer.Key("name");
      writer.String(seq.sequence.name());
      writer.Key("value");
      writer.Number(seq.p_sequence);
      
      // Add calculation-time fields for this sequence
      const auto *sequence_result = FindSequenceResult(analysis, ie, seq.sequence);
      if (sequence_result) {
        writer.Key("calculationTime");
        writer.BeginObject();
        
        if (sequence_result->preprocessing_seconds) {
          writer.Key("preprocessing");
          writer.Number(*sequence_result->preprocessing_seconds);
        }
        
        if (sequence_result->fault_tree_analysis) {
          writer.Key("products");
          writer.Number(sequence_result->fault_tree_analysis->analysis_time());
        }
        
        if (sequence_result->probability_analysis) {
          writer.Key("probability");
          writer.Number(sequence_result->probability_analysis->analysis_time());
        }
        
        if (sequence_result->importance_analysis) {
          writer.Key("importance");
          writer.Number(sequence_result->importance_analysis->analysis_time());
        }
        
        if (sequence_result->uncertainty_analysis) {
          writer.Key("uncertainty");
          writer.Number(sequence_result->uncertainty_analysis->analysis_time());
        }
        
        if (sequence_result->report_generation_seconds) {
          writer.Key("reportGeneration");
          writer.Number(*sequence_result->report_generation_seconds);
        }
        
        writer.EndObject();
      }
      
      if (seq.gate) {
        writer.Key("cutSets");
        if (sequence_result && sequence_result->fault_tree_analysis) {
          WriteSumOfProductsResult(writer, *sequence_result->fault_tree_analysis,
                                   sequence_result->probability_analysis.get(), nullptr, exclude_product_lists);
        } else {
          const double initiating_frequency = ie.HasFrequency() ? ie.frequency_value() : 1.0;
          WriteSumOfProductsForGate(writer, *seq.gate, analysis, initiating_frequency, exclude_product_lists);
        }
      }
      writer.EndObject();
    }
    writer.EndArray();
    writer.EndObject();
  }
  writer.EndArray();
}

void WriteResultsJson(JsonWriter &writer, const scram::core::RiskAnalysis &analysis, bool exclude_product_lists = false) {
  writer.BeginObject();

  WriteEventTreeResultsJson(writer, analysis, exclude_product_lists);

  const ResultCounts counts = CountResultArtifacts(analysis);

  if (counts.sil > 0) {
    writer.Key("safetyIntegrityLevels");
    writer.BeginArray();
    for (const auto &result : analysis.results()) {
      if (result.probability_analysis &&
        result.probability_analysis->settings().safety_integrity_levels()) {
        WriteSafetyIntegrityLevelsJson(writer, *result.probability_analysis);
      }
    }
    writer.EndArray();
  }

  if (counts.curve > 0) {
    writer.Key("curves");
    writer.BeginArray();
    for (const auto &result : analysis.results()) {
      if (result.probability_analysis && !result.probability_analysis->p_time().empty()) {
        WriteCurveJson(writer, *result.probability_analysis);
      }
    }
    writer.EndArray();
  }

  if (counts.stat > 0) {
    writer.Key("statisticalMeasures");
    writer.BeginArray();
    for (const auto &result : analysis.results()) {
      if (result.uncertainty_analysis) {
        WriteStatisticalMeasureJson(writer, *result.uncertainty_analysis);
      }
    }
    writer.EndArray();
  }

  if (counts.importance > 0) {
    writer.Key("importance");
    writer.BeginArray();
    for (const auto &result : analysis.results()) {
      if (result.importance_analysis) {
        WriteImportanceJson(writer, *result.importance_analysis);
      }
    }
    writer.EndArray();
  }

  if (counts.sop > 0) {
    writer.Key("sumOfProducts");
    writer.BeginArray();
    for (const auto &result : analysis.results()) {
      if (!result.fault_tree_analysis) {
        continue;
      }
      const auto *pa = result.probability_analysis.get();
      WriteSumOfProductsResult(writer, *result.fault_tree_analysis, pa, &result, exclude_product_lists);
    }
    writer.EndArray();
  }

  writer.EndObject();
}

const scram::core::RiskAnalysis::Result *FindSequenceResult(
    const scram::core::RiskAnalysis &analysis,
    const scram::mef::InitiatingEvent &initiating_event,
    const scram::mef::Sequence &sequence) {
  for (const auto &result : analysis.results()) {
    if (const auto *sequence_target = std::get_if<std::pair<const scram::mef::InitiatingEvent &, const scram::mef::Sequence &>>(
            &result.id.target)) {
      if (&sequence_target->first == &initiating_event && &sequence_target->second == &sequence) {
        return &result;
      }
    }
  }
  return nullptr;
}

} // namespace

void ScramNodeReportToJsonStream(std::ostream &out,
                                 const scram::core::RiskAnalysis &analysis,
                                 bool exclude_product_lists) {
  JsonWriter writer(out);
  writer.BeginObject();
  writer.Key("modelFeatures");
  WriteModelFeaturesJson(writer, analysis.model());
  writer.Key("results");
  WriteResultsJson(writer, analysis, exclude_product_lists);
  
  // Add runtime summary if available
  if (analysis.runtime_metrics()) {
    writer.Key("runtimeSummary");
    writer.BeginObject();
    const auto& metrics = *analysis.runtime_metrics();
    writer.Key("analysisSeconds");
    writer.Number(metrics.analysis_seconds);
    if (metrics.total_runtime_seconds) {
      writer.Key("totalSeconds");
      writer.Number(*metrics.total_runtime_seconds);
    }
    writer.EndObject();
  }
  
  writer.EndObject();
}

// Forward declarations of local helpers
static Napi::Object BuildSumOfProductsForGate(Napi::Env env,
                                              const scram::mef::Gate& gate,
                                              const scram::core::RiskAnalysis& analysis,
                                              double initiating_frequency = 1.0);

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
        if (ie.HasFrequency())
          ieResult.Set("frequency", Napi::Number::New(env, ie.frequency_value()));

        Napi::Array seqArr = Napi::Array::New(env, eta.sequences().size());
        uint32_t sidx = 0;

        for (const auto& seq : eta.sequences()) {
          Napi::Object seqObj = Napi::Object::New(env);

          // Sequence name: we use the sequence's MEF name directly
          seqObj.Set("name", seq.sequence.name());

          // Frequency per year reported directly from the quantified sequence
          seqObj.Set("value", Napi::Number::New(env, seq.p_sequence));

          // Add calculation-time fields for this sequence
          const auto *sequence_result = FindSequenceResult(analysis, ie, seq.sequence);
          if (sequence_result) {
            Napi::Object calcTime = Napi::Object::New(env);
            
            if (sequence_result->preprocessing_seconds) {
              calcTime.Set("preprocessing", Napi::Number::New(env, *sequence_result->preprocessing_seconds));
            }
            
            if (sequence_result->fault_tree_analysis) {
              calcTime.Set("products", Napi::Number::New(env, sequence_result->fault_tree_analysis->analysis_time()));
            }
            
            if (sequence_result->probability_analysis) {
              calcTime.Set("probability", Napi::Number::New(env, sequence_result->probability_analysis->analysis_time()));
            }
            
            if (sequence_result->importance_analysis) {
              calcTime.Set("importance", Napi::Number::New(env, sequence_result->importance_analysis->analysis_time()));
            }
            
            if (sequence_result->uncertainty_analysis) {
              calcTime.Set("uncertainty", Napi::Number::New(env, sequence_result->uncertainty_analysis->analysis_time()));
            }
            
            if (sequence_result->report_generation_seconds) {
              calcTime.Set("reportGeneration", Napi::Number::New(env, *sequence_result->report_generation_seconds));
            }
            
            seqObj.Set("calculationTime", calcTime);
          }

          // Add cut sets for the sequence gate (if gate exists)
          if (seq.gate) {
            if (sequence_result && sequence_result->fault_tree_analysis) {
              Napi::Object sop = ScramNodeSumOfProducts(env, *sequence_result->fault_tree_analysis,
                                                       sequence_result->probability_analysis.get(), nullptr);
              seqObj.Set("cutSets", sop);
            } else {
              const double initiating_frequency = ie.HasFrequency() ? ie.frequency_value() : 1.0;
              Napi::Object sop = BuildSumOfProductsForGate(env, *seq.gate, analysis, initiating_frequency);
              seqObj.Set("cutSets", sop);
            }
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
      sopArr.Set(sopIdx++, ScramNodeSumOfProducts(env, *result.fault_tree_analysis, result.probability_analysis.get(), &result));
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
  conf.Set("lowerBound", Napi::Number::New(env, ua.confidence_interval().first));
  conf.Set("upperBound", Napi::Number::New(env, ua.confidence_interval().second));
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
Napi::Object ScramNodeSumOfProducts(Napi::Env env, const scram::core::FaultTreeAnalysis& fta, const scram::core::ProbabilityAnalysis* pa, const scram::core::RiskAnalysis::Result* result) {
  Napi::Object sop = Napi::Object::New(env);
  // Products may not be generated in BDD probability-only mode.
  if (!fta.has_products()) {
    sop.Set("basicEvents", Napi::Number::New(env, 0));
    sop.Set("products",    Napi::Number::New(env, 0));
    if (pa) {
      sop.Set("probability", Napi::Number::New(env, pa->p_total()));
    }
    // Do not set distribution or productList when products are not available.
    return sop;
  }

  const auto& products = fta.products();
  sop.Set("basicEvents", Napi::Number::New(env, products.product_events().size()));
  sop.Set("products",    Napi::Number::New(env, products.size()));
  
  // Set probability from probability analysis
  double totalProb = 0.0;
  if (pa) {
    totalProb = pa->p_total();
    sop.Set("probability", Napi::Number::New(env, totalProb));
  }
  
  // Distribution
  if (!products.distribution().empty()) {
    Napi::Array dist = Napi::Array::New(env, products.distribution().size());
    for (size_t i = 0; i < products.distribution().size(); ++i) {
      dist.Set(i, Napi::Number::New(env, products.distribution()[i]));
    }
    sop.Set("distribution", dist);
  }

  const auto* summary = fta.last_product_summary();
  if (summary) {
    sop.Set("originalProducts", Napi::Number::New(env, summary->original_product_count));
  }

  if (fta.adaptive_mode_used()) {
    double exactProb = fta.adaptive_target_probability();
    if (exactProb > 0.0) {
      sop.Set("exactProbability", Napi::Number::New(env, exactProb));
      
      // In adaptive mode, approximateProbability is the truncated probability
      if (pa) {
        sop.Set("approximateProbability", Napi::Number::New(env, totalProb));
        if (exactProb > 0.0 && totalProb > 0.0) {
          double relativeError = std::abs(totalProb - exactProb) / exactProb;
          sop.Set("relativeError", Napi::Number::New(env, relativeError));
        }
      }
    }
  }
  // Product List
  sop.Set("productList", ScramNodeProductList(env, products, pa));
  
  // Add calculation time stats if available
  if (result) {
    Napi::Object calcTime = Napi::Object::New(env);
    
    if (result->preprocessing_seconds) {
      calcTime.Set("preprocessing", Napi::Number::New(env, *result->preprocessing_seconds));
    }
    
    if (result->fault_tree_analysis) {
      calcTime.Set("products", Napi::Number::New(env, result->fault_tree_analysis->analysis_time()));
    }
    
    if (result->probability_analysis) {
      calcTime.Set("probability", Napi::Number::New(env, result->probability_analysis->analysis_time()));
    }
    
    if (result->importance_analysis) {
      calcTime.Set("importance", Napi::Number::New(env, result->importance_analysis->analysis_time()));
    }
    
    if (result->uncertainty_analysis) {
      calcTime.Set("uncertainty", Napi::Number::New(env, result->uncertainty_analysis->analysis_time()));
    }
    
    if (result->report_generation_seconds) {
      calcTime.Set("reportGeneration", Napi::Number::New(env, *result->report_generation_seconds));
    }
    
    sop.Set("calculationTime", calcTime);
  }
  
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
                                              const scram::core::RiskAnalysis& analysis,
                                              double initiating_frequency) {
  using scram::core::Settings;
  using scram::core::Algorithm;
  using scram::core::Approximation;

  const Settings& settings = analysis.settings();

  // Qualitative analysis (algorithm)
  Napi::Object sop = Napi::Object::New(env);

  // Dispatch by algorithm
  if (settings.algorithm() == Algorithm::kMocus) {
    scram::core::FaultTreeAnalyzer<scram::core::Mocus> fta(gate, settings);
    fta.initiating_event_frequency(initiating_frequency);
    fta.Analyze();
    const bool has_products = fta.has_products() && !fta.products().empty();

    if (!has_products) {
      sop.Set("basicEvents", Napi::Number::New(env, 0));
      sop.Set("products",    Napi::Number::New(env, 0));
    }
    else {
      const auto& products = fta.products();
      sop.Set("basicEvents", Napi::Number::New(env, products.product_events().size()));
      sop.Set("products",    Napi::Number::New(env, products.size()));
      // Distribution
      if (!products.distribution().empty()) {
        Napi::Array dist = Napi::Array::New(env, products.distribution().size());
        for (size_t i = 0; i < products.distribution().size(); ++i) {
          dist.Set(i, Napi::Number::New(env, products.distribution()[i]));
        }
        sop.Set("distribution", dist);
      }
    }

    // Probability analysis (approximation or exact depending on settings)
    std::unique_ptr<scram::core::ProbabilityAnalysis> pa;
    if (settings.probability_analysis()) {
      if (settings.approximation() == Approximation::kMcub) {
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::McubCalculator>>(&fta,
          const_cast<scram::mef::MissionTime*>(&analysis.model().mission_time()));
        paLocal->Analyze();
        sop.Set("probability", Napi::Number::New(env, paLocal->p_total()));
        if (has_products) sop.Set("productList", ScramNodeProductList(env, fta.products(), paLocal.get()));
        pa = std::move(paLocal);
      } else { // rare-event default for MOCUS
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::RareEventCalculator>>(&fta,
          const_cast<scram::mef::MissionTime*>(&analysis.model().mission_time()));
        paLocal->Analyze();
        sop.Set("probability", Napi::Number::New(env, paLocal->p_total()));
        if (has_products) sop.Set("productList", ScramNodeProductList(env, fta.products(), paLocal.get()));
        pa = std::move(paLocal);
      }
    } else {
      if (has_products) sop.Set("productList", ScramNodeProductList(env, fta.products(), nullptr));
    }
    return sop;
  }

  if (settings.algorithm() == Algorithm::kZbdd) {
    scram::core::FaultTreeAnalyzer<scram::core::Zbdd> fta(gate, settings);
    fta.initiating_event_frequency(initiating_frequency);
    fta.Analyze();
    const bool has_products = fta.has_products() && !fta.products().empty();

    if (!has_products) {
      sop.Set("basicEvents", Napi::Number::New(env, 0));
      sop.Set("products",    Napi::Number::New(env, 0));
    } else {
      const auto& products = fta.products();
      sop.Set("basicEvents", Napi::Number::New(env, products.product_events().size()));
      sop.Set("products",    Napi::Number::New(env, products.size()));
      if (!products.distribution().empty()) {
        Napi::Array dist = Napi::Array::New(env, products.distribution().size());
        for (size_t i = 0; i < products.distribution().size(); ++i) {
          dist.Set(i, Napi::Number::New(env, products.distribution()[i]));
        }
        sop.Set("distribution", dist);
      }
    }

    std::unique_ptr<scram::core::ProbabilityAnalysis> pa;
    if (settings.probability_analysis()) {
      if (settings.approximation() == Approximation::kMcub) {
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::McubCalculator>>(&fta,
          const_cast<scram::mef::MissionTime*>(&analysis.model().mission_time()));
        paLocal->Analyze();
        sop.Set("probability", Napi::Number::New(env, paLocal->p_total()));
        if (has_products) sop.Set("productList", ScramNodeProductList(env, fta.products(), paLocal.get()));
        pa = std::move(paLocal);
      } else { // rare-event default for ZBDD
        auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::RareEventCalculator>>(&fta,
          const_cast<scram::mef::MissionTime*>(&analysis.model().mission_time()));
        paLocal->Analyze();
        sop.Set("probability", Napi::Number::New(env, paLocal->p_total()));
        if (has_products) sop.Set("productList", ScramNodeProductList(env, fta.products(), paLocal.get()));
        pa = std::move(paLocal);
      }
    } else {
      if (has_products) sop.Set("productList", ScramNodeProductList(env, fta.products(), nullptr));
    }
    return sop;
  }

  // Algorithm::kBdd (exact)
  {
    scram::core::FaultTreeAnalyzer<scram::core::Bdd> fta(gate, settings);
    fta.initiating_event_frequency(initiating_frequency);
    fta.Analyze();
    const bool has_products = fta.has_products() && !fta.products().empty();
    if (!has_products) {
      sop.Set("basicEvents", Napi::Number::New(env, 0));
      sop.Set("products",    Napi::Number::New(env, 0));
    } else {
      const auto& products = fta.products();
      sop.Set("basicEvents", Napi::Number::New(env, products.product_events().size()));
      sop.Set("products",    Napi::Number::New(env, products.size()));
      if (!products.distribution().empty()) {
        Napi::Array dist = Napi::Array::New(env, products.distribution().size());
        for (size_t i = 0; i < products.distribution().size(); ++i) {
          dist.Set(i, Napi::Number::New(env, products.distribution()[i]));
        }
        sop.Set("distribution", dist);
      }
    }

    std::unique_ptr<scram::core::ProbabilityAnalysis> pa;
    if (settings.probability_analysis()) {
      auto paLocal = std::make_unique<scram::core::ProbabilityAnalyzer<scram::core::Bdd>>(&fta,
        const_cast<scram::mef::MissionTime*>(&analysis.model().mission_time()));
      paLocal->Analyze();
      sop.Set("probability", Napi::Number::New(env, paLocal->p_total()));
      if (has_products) {
        sop.Set("productList", ScramNodeProductList(env, fta.products(), paLocal.get()));
      }
      pa = std::move(paLocal);
    } else {
      if (has_products) sop.Set("productList", ScramNodeProductList(env, fta.products(), nullptr));
    }
    return sop;
  }
}

// Extract only metadata without building massive N-API productList objects
// Returns minimal stats: model features, counts, probabilities, timing - NO productLists
Napi::Object ScramNodeExtractMetadataFromFile(Napi::Env env, const std::string& filePath, const scram::core::RiskAnalysis& analysis) {
  Napi::Object result = Napi::Object::New(env);
  
  // Model features (lightweight)
  Napi::Object modelFeatures = Napi::Object::New(env);
  const auto& model = analysis.model();
  if (!model.HasDefaultName()) {
    modelFeatures.Set("name", model.name());
  }
  modelFeatures.Set("faultTrees", Napi::Number::New(env, model.fault_trees().size()));
  modelFeatures.Set("gates", Napi::Number::New(env, model.gates().size()));
  modelFeatures.Set("basicEvents", Napi::Number::New(env, model.basic_events().size()));
  modelFeatures.Set("houseEvents", Napi::Number::New(env, model.house_events().size()));
  modelFeatures.Set("ccfGroups", Napi::Number::New(env, model.ccf_groups().size()));
  modelFeatures.Set("eventTrees", Napi::Number::New(env, model.event_trees().size()));
  modelFeatures.Set("initiatingEvents", Napi::Number::New(env, model.initiating_events().size()));
  result.Set("modelFeatures", modelFeatures);
  
  // Results with metadata only (no productLists)
  Napi::Object results = Napi::Object::New(env);
  
  // Event tree results (sequences with stats only)
  if (!analysis.event_tree_results().empty()) {
    Napi::Array ieArr = Napi::Array::New(env);
    uint32_t ieIdx = 0;
    
    for (const auto& etaResult : analysis.event_tree_results()) {
      if (etaResult.event_tree_analysis) {
        const auto& eta = *etaResult.event_tree_analysis;
        const auto& ie = eta.initiating_event();
        
        Napi::Object ieObj = Napi::Object::New(env);
        ieObj.Set("name", ie.name());
        if (!ie.label().empty()) {
          ieObj.Set("description", ie.label());
        }
        if (ie.HasFrequency()) {
          ieObj.Set("frequency", Napi::Number::New(env, ie.frequency_value()));
        }
        
        Napi::Array seqArr = Napi::Array::New(env);
        uint32_t seqIdx = 0;
        
        for (const auto& seq : eta.sequences()) {
          Napi::Object seqObj = Napi::Object::New(env);
          seqObj.Set("name", seq.sequence.name());
          seqObj.Set("value", Napi::Number::New(env, seq.p_sequence));
          
          // Add cut set metadata with adaptive fields if available
          if (seq.gate) {
            const auto *sequence_result = FindSequenceResult(analysis, ie, seq.sequence);
            
            Napi::Object cutSets = Napi::Object::New(env);
            cutSets.Set("probability", Napi::Number::New(env, seq.p_sequence));
            
            // Add adaptive fields if this sequence was analyzed with adaptive mode
            if (sequence_result && sequence_result->fault_tree_analysis) {
              const auto& fta = *sequence_result->fault_tree_analysis;
              
              if (fta.has_products()) {
                const auto& products = fta.products();
                cutSets.Set("products", Napi::Number::New(env, products.size()));
                
                const auto* summary = fta.last_product_summary();
                if (summary) {
                  cutSets.Set("originalProducts", Napi::Number::New(env, summary->original_product_count));
                }
                
                if (fta.adaptive_mode_used()) {
                  const double exactProb = fta.adaptive_target_probability();
                  
                  if (exactProb > 0.0) {
                    cutSets.Set("exactProbability", Napi::Number::New(env, exactProb));
                    
                    // For sequences, the approximate probability needs to be calculated
                    // The probability_analysis may be null in metadata extraction mode
                    double approxProb = seq.p_sequence;
                    
                    if (sequence_result->probability_analysis) {
                      // If available, use the probability analysis result
                      approxProb = sequence_result->probability_analysis->p_total();
                    }
                    
                    // Always set approximateProbability
                    cutSets.Set("approximateProbability", Napi::Number::New(env, approxProb));
                    
                    // Only calculate relative error if both probabilities are non-zero
                    if (exactProb > 0.0 && approxProb > 0.0) {
                      const double relativeError = std::abs(approxProb - exactProb) / exactProb;
                      cutSets.Set("relativeError", Napi::Number::New(env, relativeError));
                    }
                  }
                }
              }
            }
            
            seqObj.Set("cutSets", cutSets);
          }
          
          seqArr.Set(seqIdx++, seqObj);
        }
        
        ieObj.Set("sequences", seqArr);
        ieArr.Set(ieIdx++, ieObj);
      }
    }
    
    results.Set("initiatingEvents", ieArr);
  }
  
  // Fault tree results (counts and probabilities only)
  Napi::Array sopArr = Napi::Array::New(env);
  uint32_t sopIdx = 0;
  
  for (const auto& analysisResult : analysis.results()) {
    if (analysisResult.fault_tree_analysis) {
      const auto& fta = *analysisResult.fault_tree_analysis;
      
      Napi::Object sop = Napi::Object::New(env);
      
      if (fta.has_products()) {
        const auto& products = fta.products();
        sop.Set("basicEvents", Napi::Number::New(env, products.product_events().size()));
        sop.Set("products", Napi::Number::New(env, products.size()));
        
        if (analysisResult.probability_analysis) {
          sop.Set("probability", Napi::Number::New(env, analysisResult.probability_analysis->p_total()));
        }
        
        // Distribution (lightweight - just integers)
        if (!products.distribution().empty()) {
          Napi::Array dist = Napi::Array::New(env);
          for (size_t i = 0; i < products.distribution().size(); ++i) {
            dist.Set(i, Napi::Number::New(env, products.distribution()[i]));
          }
          sop.Set("distribution", dist);
        }

        const auto* summary = fta.last_product_summary();
        if (summary) {
          sop.Set("originalProducts", Napi::Number::New(env, summary->original_product_count));
        }
        
        if (fta.adaptive_mode_used()) {
          const double exactProb = fta.adaptive_target_probability();
          if (exactProb > 0.0) {
            sop.Set("exactProbability", Napi::Number::New(env, exactProb));
            
            // Set approximateProbability and relativeError
            if (analysisResult.probability_analysis) {
              const double approxProb = analysisResult.probability_analysis->p_total();
              sop.Set("approximateProbability", Napi::Number::New(env, approxProb));
              if (exactProb > 0.0 && approxProb > 0.0) {
                const double relativeError = std::abs(approxProb - exactProb) / exactProb;
                sop.Set("relativeError", Napi::Number::New(env, relativeError));
              }
            }
          }
        }
      } else {
        sop.Set("basicEvents", Napi::Number::New(env, 0));
        sop.Set("products", Napi::Number::New(env, 0));
        if (analysisResult.probability_analysis) {
          sop.Set("probability", Napi::Number::New(env, analysisResult.probability_analysis->p_total()));
        }
      }
      
      sopArr.Set(sopIdx++, sop);
    }
  }
  
  if (sopIdx > 0) {
    results.Set("sumOfProducts", sopArr);
  }
  
  result.Set("results", results);
  
  // Runtime summary
  if (analysis.runtime_metrics()) {
    Napi::Object runtimeSummary = Napi::Object::New(env);
    const auto& metrics = *analysis.runtime_metrics();
    runtimeSummary.Set("analysisSeconds", Napi::Number::New(env, metrics.analysis_seconds));
    if (metrics.total_runtime_seconds) {
      runtimeSummary.Set("totalSeconds", Napi::Number::New(env, *metrics.total_runtime_seconds));
    }
    result.Set("runtimeSummary", runtimeSummary);
  }
  
  return result;
}