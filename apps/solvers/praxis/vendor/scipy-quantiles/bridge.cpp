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
#include <xsf/cephes/ndtri.h>
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

extern "C" {
struct HclQuantileResult { double value; int status; };

// CPython math.erf also delegates to the platform C math function.
double hcl_math_erf(double x) noexcept { return std::erf(x); }

HclQuantileResult hcl_scipy_quantile(int family, double q, double a, double b) noexcept {
    kernel_status = 0;
    double value = std::numeric_limits<double>::quiet_NaN();
    try {
        if (family == 0) {
            using namespace boost::math::policies;
            using BetaPolicyForStats = policy<domain_error<ignore_error>,
                overflow_error<user_error>, evaluation_error<user_error>,
                promote_double<false>>;
            value = boost::math::ibeta_inv(a, b, q, BetaPolicyForStats());
        } else if (family == 1) {
            value = xsf::cephes::ndtri(q);
        } else if (family == 2) {
            value = xsf::cephes::igami(a, q);
        } else if (family == 3) {
            // scipy.stats.expon._ppf: -scipy.special.log1p(-q).
            value = -xsf::cephes::log1p(-q);
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
