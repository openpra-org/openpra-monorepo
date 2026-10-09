// Runtime adapter for the double-only quantile bridge. Implementations are
// faithful Rust ports of MinGW-w64's x87 routines; see reference/mingw/.
#pragma once

extern "C" {
double praxis_mingw_log(double) noexcept;
double praxis_mingw_exp(double) noexcept;
double praxis_mingw_pow(double, double) noexcept;
double praxis_mingw_sin(double) noexcept;
double praxis_mingw_cos(double) noexcept;
}

namespace praxis_windows_math {
inline double log(double x) { return praxis_mingw_log(x); }
inline double exp(double x) { return praxis_mingw_exp(x); }
inline double pow(double x, double y) { return praxis_mingw_pow(x, y); }
inline double sin(double x) { return praxis_mingw_sin(x); }
inline double cos(double x) { return praxis_mingw_cos(x); }
}
