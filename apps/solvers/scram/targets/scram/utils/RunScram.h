/*
 * Copyright (C) 2014-2018 Olzhas Rakhimov
 * Copyright (C) 2024 OpenPRA ORG Inc.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// @file

#pragma once

#include <cstdint>
#include <cstdio> // vsnprintf
#include <fstream>
#include <iomanip>
#include <memory>
#include <optional>
#include <sstream>
#include <string>
#include <vector>
#ifdef __unix__
#include <unistd.h>
#endif

#include "initializer.h"
#include "reporter.h"
#include "risk_analysis.h"
#include "serialization.h"
#include "settings.h"
#include <boost/exception/all.hpp>
#include <boost/program_options.hpp>

#include "ConstructSettings.h"

namespace po = boost::program_options;

namespace ScramCLI {

namespace detail {

struct MemorySnapshot {
    std::optional<double> rss_mib;
    std::optional<double> peak_rss_mib;
};

inline double BytesToMiB(std::uint64_t bytes) {
    return static_cast<double>(bytes) / (1024.0 * 1024.0);
}

inline std::string FormatMiB(std::uint64_t bytes) {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(2) << BytesToMiB(bytes);
    return oss.str();
}

#ifdef __unix__
inline long ResolvePageSize() {
    long page_size = ::sysconf(_SC_PAGESIZE);
    return page_size > 0 ? page_size : 4096;
}

inline std::optional<std::uint64_t> ReadResidentSetSizeBytes() {
    std::ifstream statm("/proc/self/statm");
    if (!statm.is_open()) {
        return std::nullopt;
    }
    std::uint64_t total_pages = 0;
    std::uint64_t rss_pages = 0;
    statm >> total_pages >> rss_pages;
    if (!statm) {
        return std::nullopt;
    }
    const std::uint64_t page_size = static_cast<std::uint64_t>(ResolvePageSize());
    return rss_pages * page_size;
}

inline std::optional<std::uint64_t> ReadPeakResidentSetBytes() {
    std::ifstream status("/proc/self/status");
    if (!status.is_open()) {
        return std::nullopt;
    }
    const std::string label = "VmHWM:";
    std::string line;
    while (std::getline(status, line)) {
        if (line.rfind(label, 0) == 0) {
            std::istringstream iss(line.substr(label.size()));
            std::uint64_t value_kib = 0;
            iss >> value_kib;
            if (!iss) {
                return std::nullopt;
            }
            return value_kib * 1024;
        }
    }
    return std::nullopt;
}
#else
inline std::optional<std::uint64_t> ReadResidentSetSizeBytes() {
    return std::nullopt;
}

inline std::optional<std::uint64_t> ReadPeakResidentSetBytes() {
    return std::nullopt;
}
#endif

inline MemorySnapshot CaptureMemoryUsage() {
    MemorySnapshot snapshot;
    if (const auto rss_bytes = ReadResidentSetSizeBytes()) {
        snapshot.rss_mib = BytesToMiB(*rss_bytes);
    }
    if (const auto peak_bytes = ReadPeakResidentSetBytes()) {
        snapshot.peak_rss_mib = BytesToMiB(*peak_bytes);
    }
    return snapshot;
}

inline void LogMemoryUsage(const char *label, const MemorySnapshot &snapshot) {
    if (snapshot.rss_mib) {
        LOG(scram::INFO) << label << " RSS: " << std::fixed << std::setprecision(2) << *snapshot.rss_mib << " MiB";
    } else {
        LOG(scram::DEBUG1) << "Unable to resolve resident set size for " << label;
    }
    if (snapshot.peak_rss_mib) {
        LOG(scram::INFO) << label << " peak RSS: " << std::fixed << std::setprecision(2) << *snapshot.peak_rss_mib << " MiB";
    }
}

inline void LogElapsed(const char *label, double seconds) {
    std::ostringstream oss;
    oss << label << " duration: " << std::fixed << std::setprecision(3) << seconds << " s";
    LOG(scram::INFO) << oss.str();
}

} // namespace detail

/// Main body of command-line entrance to run the program.
///
/// @param[in] vm  Variables map of program options.
///
/// @throws Error  Exceptions specific to SCRAM.
/// @throws boost::exception  Boost errors with the variables map.
/// @throws std::exception  All other problems.
inline void RunScram(const po::variables_map &vm) {
    CLOCK(total_run_time);
    scram::core::Settings settings; // Analysis settings.
    std::vector<std::string> input_files;
    ConstructSettings(vm, &settings);
    if (vm.contains("input-files")) {
        auto cmd_input = vm["input-files"].as<std::vector<std::string>>();
        input_files.insert(input_files.end(), cmd_input.begin(), cmd_input.end());
    }
    // Make the CLI-provided input files available inside the analysis settings instance.
    settings.input_files(input_files);
    // Process input files
    // into valid analysis containers and constructs.
    // Throws if anything is invalid.
    std::unique_ptr<scram::mef::Model> model = scram::mef::Initializer(input_files, settings, vm.contains("allow-extern")).model();
    settings.model(model.get());

    if (vm.contains("serialize"))
        return Serialize(*model, stdout);
    if (vm.contains("validate"))
        return; // Stop if only validation is requested.

    // Initiate risk analysis with the given information.
    scram::core::RiskAnalysis analysis(model.get(), settings);
    CLOCK(analysis_time);
    analysis.Analyze();
    const double analysis_seconds = DUR(analysis_time);
    detail::LogElapsed("SCRAM analysis", analysis_seconds);
    const auto post_analysis_snapshot = detail::CaptureMemoryUsage();
    detail::LogMemoryUsage("Post-analysis", post_analysis_snapshot);

    scram::core::RiskAnalysis::RuntimeMetrics runtime_metrics;
    runtime_metrics.analysis_seconds = analysis_seconds;
    runtime_metrics.total_runtime_seconds = DUR(total_run_time);
    runtime_metrics.post_analysis_rss_mib = post_analysis_snapshot.rss_mib;
    runtime_metrics.post_analysis_peak_rss_mib = post_analysis_snapshot.peak_rss_mib;
    runtime_metrics.post_run_rss_mib = post_analysis_snapshot.rss_mib;
    runtime_metrics.post_run_peak_rss_mib = post_analysis_snapshot.peak_rss_mib;
    analysis.set_runtime_metrics(runtime_metrics);

    if (vm.contains("no-report") || vm.contains("preprocessor") || vm.contains("print")) {
        const double total_runtime_seconds = runtime_metrics.total_runtime_seconds.value_or(0.0);
        detail::LogElapsed("SCRAM total runtime", total_runtime_seconds);
        detail::LogMemoryUsage("Post-run", post_analysis_snapshot);
        return;
    }
    scram::Reporter reporter;
    const bool indent = !(vm.contains("no-indent"));
    if (vm.contains("output")) {
        reporter.Report(analysis, vm["output"].as<std::string>(), indent, total_run_time);
    } else {
        reporter.Report(analysis, stdout, indent, total_run_time);
    }
    runtime_metrics.total_runtime_seconds = DUR(total_run_time);
    analysis.set_runtime_metrics(runtime_metrics);
    const double total_runtime_seconds = runtime_metrics.total_runtime_seconds.value_or(0.0);
    detail::LogElapsed("SCRAM total runtime", total_runtime_seconds);
    detail::LogMemoryUsage("Post-run", post_analysis_snapshot);
}

} // namespace ScramCLI
