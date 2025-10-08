/*
 * Copyright (C) 2014-2018 Olzhas Rakhimov
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/// @file

#pragma once
#include <string>

#include <boost/program_options.hpp>

namespace po = boost::program_options;

namespace ScramCLI {
/// Provides an options value type.
#define OPT_VALUE(type) po::value<type>()->value_name(#type)

/// @returns Command-line option descriptions.
inline po::options_description ConstructOptions() {
    using path = std::string; // To print argument type as path.

    // ------------------------------------------------------------------
    //  Monte-Carlo specific options
    // ------------------------------------------------------------------
    po::options_description mc("Monte Carlo Options");
    mc.add_options()
        ("monte-carlo", "enable monte carlo sampling")
        ("early-stop", "stop on convergence (implied if N=0)")
        ("seed", OPT_VALUE(int)->default_value(372), "PRNG seed")
        ("num-trials,N", OPT_VALUE(double)->default_value(0), "bernoulli trials [N ∈ ℕ, 0=auto]")
        ("overhead-ratio,r", OPT_VALUE(double),"allocator overhead per node [0.05]")
        ("delta,d", OPT_VALUE(double)->default_value(0.001),"compute as ε=δ·p̂ [δ > 0]")
        ("burn-in,b", OPT_VALUE(double)->default_value(1<<20), "trials before convergence check [0=off]")
        ("confidence,a", OPT_VALUE(double), "two-sided conf. lvl [0.99]")
        ("policy,P", OPT_VALUE(std::string)->default_value("bayes"), "convergence policy [bayes|wald]");

    // ------------------------------------------------------------------
    //  graph compilation specific options
    // ------------------------------------------------------------------
    po::options_description gc("Graph Compilation Options");
    gc.add_options()
        ("no-kn", "expand k/n to and/or [off]")
        ("no-xor", "expand xor to and/or [off]")
        ("nnf", "compile to negation normal form [off]")
        ("preprocessor", "stop analysis after preprocessing")
        ("compilation-passes,c", OPT_VALUE(int)->default_value(2), "0=off 1=null-only 2=optimize 4-8=multipass");

    // ------------------------------------------------------------------
    //  Debug options
    // ------------------------------------------------------------------
    po::options_description debug("Debug Options");
    debug.add_options()
        ("watch,w", "enable watch mode [off]")
        ("oracle,p", OPT_VALUE(double)->default_value(-1.0), "true µ [µ ∈ [0,∞), -1=off]")
        ("help,h", "display this help message")
        ("verbosity,V", OPT_VALUE(int)->default_value(0), "set log verbosity [0,7]")
        ("version,v", "display version information")
        ("print", "print analysis results to terminal")
        ("serialize", "serialize the input model and exit")
        ("no-report", "don't generate analysis report")
        ("no-indent", "omit indented whitespace in output XML");

        po::options_description desc("Legacy Options");
        desc.add_options()
            ("project", OPT_VALUE(path), "project analysis config file")
            ("allow-extern", "**UNSAFE** allow external libraries")
            ("validate", "validate input files without analysis")
            ("pdag", "perform qualitative analysis with PDAG")
            ("bdd", "perform qualitative analysis with BDD")
            ("zbdd", "perform qualitative analysis with ZBDD")
            ("mocus", "perform qualitative analysis with MOCUS")
            ("prime-implicants", "calculate prime implicants")
            ("probability", "perform probability analysis")
            ("importance", "perform importance analysis")
            ("uncertainty", "perform uncertainty analysis")
            ("ccf", "compute common-cause failures")
            ("sil", "compute safety-integrity-level metrics")
            ("rare-event", "use the rare event approximation")
            ("mcub", "use the MCUB approximation")
            ("limit-order,l", OPT_VALUE(int), "upper limit for the product order")
            ("cut-off", OPT_VALUE(double), "cut-off probability for products")
            ("mission-time", OPT_VALUE(double), "system mission time in hours")
            ("time-step", OPT_VALUE(double), "timestep in hours")
            ("num-quantiles", OPT_VALUE(int),"number of quantiles for distributions")
            ("num-bins", OPT_VALUE(int), "number of bins for histograms")
            ("output,o", OPT_VALUE(path), "output file for reports");

        mc.add(gc).add(debug).add(desc);
    // clang-format on
    return mc;
}
#undef OPT_VALUE
} // namespace ScramCLI