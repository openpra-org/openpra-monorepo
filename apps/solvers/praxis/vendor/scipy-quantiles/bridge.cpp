// C ABI for the unchanged kernels used by scipy.stats in SciPy 1.17.1.
// Policy and exception mapping follow scipy/special/boost_special_functions.h
// beta_ppf_wrap/ibeta_inv_wrap. Python warning/error reporting is returned to
// Rust as a status; it never unwinds across the ABI. See README.md and licenses.
#include <cmath>
#include <limits>
#include <stdexcept>
#if defined(_WIN32) && (defined(_M_X64) || defined(__x86_64__))
#include "windows_math.h"
#endif
#include <boost/math/special_functions/beta.hpp>
#include <boost/math/special_functions/gamma.hpp>
#include <xsf/cephes/ndtr.h>
#include <xsf/cephes/ndtri.h>
#include <xsf/cephes/gamma.h>
#include <xsf/cephes/igam.h>
#include <xsf/cephes/igami.h>
#include <xsf/cephes/unity.h>

namespace {
thread_local int kernel_status = 0;
}

namespace xsf {
void set_error(const char*, sf_error_t code, const char*, ...) {
    if (code != SF_ERROR_OK) kernel_status = 1;
}
}

namespace boost { namespace math { namespace policies {
template <class RealType>
RealType user_evaluation_error(const char*, const char*, const RealType& value) {
    kernel_status = 1;  // SciPy warns and returns its best value.
    return value;
}
template <class RealType>
RealType user_overflow_error(const char*, const char*, const RealType&) {
    kernel_status = 2;  // SciPy raises a Python OverflowError.
    return 0;
}
}}}

namespace {
using namespace boost::math::policies;
using StatsPolicy = policy<domain_error<ignore_error>,
    overflow_error<user_error>, evaluation_error<user_error>,
    promote_double<false>>;
}

extern "C" {
struct PraxisSpecialResult { double value; int status; };

// CPython math.erf also delegates to the platform C math function.
double praxis_math_erf(double x) noexcept { return std::erf(x); }

PraxisSpecialResult praxis_special_function(int function, double x, double a, double b) noexcept {
    kernel_status = 0;
    double value = std::numeric_limits<double>::quiet_NaN();
    try {
        switch (function) {
        case 0: value = boost::math::ibeta_inv(a, b, x, StatsPolicy()); break;
        case 1: value = xsf::cephes::ndtri(x); break;
        case 2: value = xsf::cephes::igami(a, x); break;
        // scipy.stats.expon._ppf: -scipy.special.log1p(-q).
        case 3: value = -xsf::cephes::log1p(-x); break;
        case 4: value = boost::math::ibeta(a, b, x, StatsPolicy()); break;
        case 5: value = boost::math::ibetac(a, b, x, StatsPolicy()); break;
        case 6: value = boost::math::ibetac_inv(a, b, x, StatsPolicy()); break;
        case 7: value = boost::math::ibeta_derivative(a, b, x, StatsPolicy()); break;
        case 8: value = xsf::cephes::igam(a, x); break;
        case 9: value = xsf::cephes::igamc(a, x); break;
        case 10: value = xsf::cephes::igamci(a, x); break;
        case 11: value = boost::math::gamma_p_derivative(a, x, StatsPolicy()); break;
        case 12: value = xsf::cephes::ndtr(x); break;
        case 13: value = xsf::cephes::log1p(x); break;
        case 14: value = xsf::cephes::expm1(x); break;
        case 15: value = xsf::cephes::Gamma(x); break;
        case 16: value = xsf::cephes::lgam(x); break;
        default: kernel_status = 2; break;
        }
    } catch (const std::overflow_error&) {
        value = std::numeric_limits<double>::infinity();
        kernel_status = 1;
    } catch (const std::underflow_error&) {
        value = 0;
        kernel_status = 1;
    } catch (...) {
        kernel_status = 2;
    }
    return {value, kernel_status};
}
}
