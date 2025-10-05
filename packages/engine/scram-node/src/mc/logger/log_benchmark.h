#pragma once

/*
 * CSV benchmark logger – instantiable version.
 *
 * Example:
 *   scram::log::BenchmarkLogger bench{"run.csv"};
 *   bench.log_pairs(vec);
 *
 *   // or to stream:
 *   scram::log::BenchmarkLogger bench{std::cout};
 */

#include <fstream>
#include <iostream>
#include <memory>
#include <mutex>
#include <string>
#include <utility>
#include <vector>
#include <algorithm>

namespace scram::log {

class BenchmarkLogger {
 private:
  std::ostream *os_{};                       // non-owning
  std::unique_ptr<std::ofstream> owned_;     // when we own a file
  std::mutex mtx_;
  std::vector<std::string> header_keys_;
  bool header_written_ = false;

  void write_header() {
    bool first = true;
    for (const auto &k : header_keys_) {
      if (!first) (*os_) << ','; else first = false;
      (*os_) << k;
    }
    (*os_) << '\n';
    os_->flush();
    header_written_ = true;
  }

  void ensure_header(const std::vector<std::pair<std::string,std::string>> &pairs) {
    if (!os_) return;
    if (header_keys_.empty()) {
      header_keys_.reserve(pairs.size());
      for (const auto &p : pairs) header_keys_.push_back(p.first);
    }
    if (!header_written_) {
      // For streams, always write header on first use. For owned file, only
      // emit header when the file is empty (newly created).
      if (!owned_ || owned_->tellp() == 0) {
        write_header();
      } else {
        header_written_ = true; // assume header already present in file
      }
    }
  }

 public:
  explicit BenchmarkLogger(std::ostream &os) : os_{&os} {}
  explicit BenchmarkLogger(const std::string &filename) {
    owned_ = std::make_unique<std::ofstream>(filename, std::ios::app);
    os_ = owned_.get();
  }

  // -------------------------------------------------------------------------
  template <typename First, typename... Rest>
  void log_row(const First &first, const Rest &... rest) {
    std::lock_guard<std::mutex> lock(mtx_);
    if (!os_) return;
    (*os_) << first;
    (( (*os_) << ',' << rest ), ...);
    (*os_) << '\n';
    os_->flush();
  }

  void log_pairs(const std::vector<std::pair<std::string,std::string>> &pairs) {
    std::lock_guard<std::mutex> lock(mtx_);
    if (!os_) return;
    ensure_header(pairs);
    bool first = true;
    for (const auto &k : header_keys_) {
      if (!first) (*os_) << ','; else first = false;
      auto it = std::find_if(pairs.begin(), pairs.end(), [&](const auto &pr){ return pr.first==k; });
      if (it != pairs.end()) (*os_) << it->second;
    }
    (*os_) << '\n';
    os_->flush();
  }
};

} // namespace scram::log 