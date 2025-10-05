#pragma once
#include <string>
#include <sstream>
#include <iomanip>
#include <chrono>
#include <ctime>

namespace scram::log {
// Generic value → string conversion for CSV.
template <typename T>
inline std::string csv_string(const T &v) {
    if constexpr (std::is_same_v<bool, std::decay_t<T>>) {
        return v ? "1" : "0";
    } else {
        return std::to_string(v);
    }
}

// Specializations for floating-point types to use scientific notation with precision 8
template <>
inline std::string csv_string(const float &v) {
    std::ostringstream oss;
    oss << std::scientific << std::setprecision(8) << v;
    return oss.str();
}

template <>
inline std::string csv_string(const double &v) {
    std::ostringstream oss;
    oss << std::scientific << std::setprecision(8) << v;
    return oss.str();
}

inline std::string csv_string(const char *s) { return std::string{s}; }
inline std::string csv_string(const std::string &s) { return s; }

/**
 * @brief Generate a timestamp string in YYYYMMDD_HHMMSS format.
 * 
 * Useful for creating unique filenames with current local time.
 * 
 * @return Formatted timestamp string
 */
inline std::string timestamp_string(const std::string &prefix = "", const std::string &suffix = "") {
    std::ostringstream ts_ss;
    const auto now = std::chrono::system_clock::now();
    const std::time_t t = std::chrono::system_clock::to_time_t(now);
    std::tm tm{};
#if defined(_MSC_VER)
    localtime_s(&tm, &t);
#else
    localtime_r(&t, &tm);
#endif
    ts_ss << std::put_time(&tm, "%Y%m%d_%H%M%S");
    return prefix + "_" + ts_ss.str() + "_" +suffix + ".csv";
}


template<typename pair_type>
inline void write_csv_header(std::ostream &os) {
    const auto pairs = csv_pairs(pair_type{}); // default instance for header names
    bool first = true;
    for (const auto &p : pairs) {
        if (!first) os << ','; else first = false;
        os << p.first;
    }
}

template<typename pair_type>
inline void write_csv_row(const pair_type &s, std::ostream &os) {
    const auto pairs = csv_pairs(s);
    bool first = true;
    for (const auto &p : pairs) {
        if (!first) os << ','; else first = false;
        os << p.second;
    }
}



}