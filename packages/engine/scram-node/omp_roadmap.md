#  Open MP Implementation of scram-cpp
<!-- TOC -->
* [Open MP Implementation of scram-cpp](#open-mp-implementation-of-scram-cpp)
    * [CMakeLists.txt Modification](#cmakeliststxt-modification)
    * [Quantification Configuration](#quantification-configuration)
        * [Only Quantification](#only-quantification)
        * [Quantification + Importance Analysis](#quantification--importance-analysis)
        * [Quantification + Uncertainty Analysis](#quantification--uncertainty-analysis)
        * [Quantification + Importance Analysis + Uncertainty Analysis](#quantification--importance-analysis--uncertainty-analysis)
        * [Quantification + CCF + Importance Analysis + Uncertainty Analysis](#quantification--ccf--importance-analysis--uncertainty-analysis)
    * [Notes](#notes)
        * [Pseudocode](#pseudocode)
            * [1. Initialize libxml2](#1-initialize-libxml2)
            * [2. Setup xml error handling](#2-setup-xml-error-handling)
            * [3. Parse command line arguments](#3-parse-command-line-arguments)
            * [4. Run scram](#4-run-scram)
            * [5. Exception handling](#5-exception-handling)
    * [Results](#results)
    * [Issues](#issues)
    * [Development Environment](#development-environment)
<!-- TOC -->
## CMakeLists.txt Modification
**NOTE:** I added openmp support to ```compiler configurations``` section of CMakeLists.txt. If you want to use openmp, you should add following lines to CMakeLists.txt.
```cmake
include(FindOpenMP)
if(OPENMP_FOUND)
    set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${OpenMP_C_FLAGS}")
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${OpenMP_CXX_FLAGS}")
    set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${OpenMP_EXE_LINKER_FLAGS}")
endif ()
```

## Quantification Configuration
- Simple test fault tree for testing all kinds of implemententations or improvements: ```HIPPS.xml``` located in ```../input/HIPPS```
- Difficult fault tree configuration:
```commandline
/home/egemen-ubuntu/Repo/Gitlab-OpenPRA/Profiling/PRA-Engines/scram-profiling/fault-trees/ft-450.xml --mocus --probability --mcub -o /home/egemen-ubuntu/Repo/Gitlab-OpenPRA/Profiling/PRA-Engines/scram-profiling/fault-trees/ft-450-out_serial3.xml
```
### Only Quantification
- **MOCUS MCUB** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --mocus --probability --mcub -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_MOCUS_MCUB.xml
```
- **MOCUS RARE EVENT** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --mocus --probability -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_MOCUS_RARE.xml
```
**NOTE:** Default approximation method is ```RARE-EVENT```. If you want to use ```MCUB``` method, you should add ```--mcub``` argument.
- **BDD** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --bdd --probability -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_BDD.xml
```
**NOTE:**```BDD``` algorithm is default algorithm. If you do not specify any algorithm, ```BDD``` algorithm will be used.
- **ZBDD MCUB** program arguments:
 ```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --zbdd --probability --mcub -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_ZBDD_MCUB.xml
```
- **ZBDD RARE EVENT** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --zbdd --probability -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_ZBDD_RARE.xml
```
**NOTE:** Default approximation method is ```RARE-EVENT```. If you want to use ```MCUB``` method, you should add ```--mcub``` argument.
### Quantification + Importance Analysis
- **MOCUS MCUB** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --mocus --probability --mcub --importance -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_MOCUS_MCUB_IMP.xml
```
- **MOCUS RARE EVENT** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --mocus --probability --importance -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_MOCUS_RARE_IMP.xml
```
- **BDD** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --bdd --probability --importance -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_BDD_IMP.xml
```
- **ZBDD MCUB** program arguments:
 ```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --zbdd --probability --mcub --importance -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_ZBDD_MCUB_IMP.xml
```

- **ZBDD RARE EVENT** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --zbdd --probability --importance -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_ZBDD_RARE_IMP.xml
```
### Quantification + Uncertainty Analysis
- **MOCUS MCUB** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --mocus --probability --mcub --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_MOCUS_MCUB_UNCERT.xml
```
- **MOCUS RARE EVENT** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --mocus --probability --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_MOCUS_RARE_UNCERT.xml
```
- **BDD** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --bdd --probability --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_BDD_UNCERT.xml
```
- **ZBDD MCUB** program arguments:
 ```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --zbdd --probability --mcub --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_ZBDD_MCUB_UNCERT.xml
```

- **ZBDD RARE EVENT** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --zbdd --probability --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_ZBDD_RARE_UNCERT.xml
```
### Quantification + Importance Analysis + Uncertainty Analysis
- **MOCUS MCUB** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --mocus --probability --mcub --importance --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_MOCUS_MCUB_IMP_UNCERT.xml
```
- **MOCUS RARE EVENT** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --mocus --probability --importance --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_MOCUS_RARE_IMP_UNCERT.xml
```
- **BDD** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --bdd --probability --importance --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_BDD_IMP_UNCERT.xml
```
- **ZBDD MCUB** program arguments:
 ```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --zbdd --probability --mcub --importance --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_ZBDD_MCUB_IMP_UNCERT.xml
```

- **ZBDD RARE EVENT** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --zbdd --probability --uncertainty --importance --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_ZBDD_RARE_IMP_UNCERT.xml
```

### Quantification + CCF + Importance Analysis + Uncertainty Analysis
**NOTE**: CCF is only available if it is defined in the fault tree. ```HIPPS.xml``` has NO CCF definition!.
- **MOCUS MCUB** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --mocus --probability --mcub --ccf --importance --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_MOCUS_MCUB_CCF_IMP_UNCERT.xml
```
- **MOCUS RARE EVENT** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --mocus --probability --ccf --importance --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_MOCUS_RARE_CCF_IMP_UNCERT.xml
```
- **BDD** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --bdd --probability --ccf --importance --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_BDD_CCF_IMP_UNCERT.xml
```
- **ZBDD MCUB** program arguments:
 ```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --zbdd --probability --mcub --ccf --importance --uncertainty --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_ZBDD_MCUB_CCF_IMP_UNCERT.xml
```

- **ZBDD RARE EVENT** program arguments:
```commandline
/home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS.xml --zbdd --probability --ccf --uncertainty --importance --num-trials 10000 -o /home/egemen-ubuntu/Repo/Space/OpenPRA/scram-cpp/input/HIPPS/HIPPS_ZBDD_RARE_CCF_IMP_UNCERT.xml
```

## Notes

### Pseudocode
```pseudocode
// 1. Initialize libxml2
// 2. Setup xml error handling
// 3. Parse command line arguments
// 4. Run scram
// 5. Exception handling
```
#### 1. Initialize libxml2
```c++
xmlInitParser();
```

#### 2. Setup xml error handling
```c++ 

```

#### 3. Parse command line arguments
```c++

```

#### 4. Run scram
- ```settings.h``` includes all defaults settings along with parameters that can be set by the user.
  Default parameters are set as ```private```
- **MOCUS** and **ZBDD** based analyses run with the **RARE-EVENT** approximation method by default.
  If you want to use **MCUB** approximation method, you should add ```--mcub``` argument to the command line.
- Prime implicants can only be calculated with **BDD-based** algorithms.
- **Importance analysis** is performed with **probability analysis**.
- **Uncertainty analysis** implies probability analysis, so the **probability analysis** is turned on implicitly.
- Other default settings can be found below:
```c++
bool probability_analysis_ = false;  ///< A flag for probability analysis.
bool safety_integrity_levels_ = false;  ///< Calculation of the SIL metrics.
bool importance_analysis_ = false;  ///< A flag for importance analysis.
bool uncertainty_analysis_ = false;  ///< A flag for uncertainty analysis.
bool ccf_analysis_ = false;  ///< A flag for common-cause analysis.
bool prime_implicants_ = false;  ///< Calculation of prime implicants.
/// Qualitative analysis algorithm.
Algorithm algorithm_ = Algorithm::kBdd;
/// The approximations for calculations.
Approximation approximation_ = Approximation::kNone;
int limit_order_ = 20;  ///< Limit on the order of products.
int seed_ = 0;  ///< The seed for the pseudo-random number generator.
int num_trials_ = 1e3;  ///< The number of trials for Monte Carlo simulations.
int num_quantiles_ = 20;  ///< The number of quantiles for distributions.
int num_bins_ = 20;  ///< The number of bins for histograms.
double mission_time_ = 8760;  ///< System mission time.
double time_step_ = 0;  ///< The time step for probability analyses.
double cut_off_ = 1e-8;  ///< The cut-off probability for products.
```
- In addition to give the models and configurations via commandline, everything can be given via a Project File,
  which is so powerful and make process traceable. Below is an *example* ```xml``` project file:
```xml
<?xml version="1.0"?>           <!-- version number is required -->
<scram>                         <!-- root element must be <scram> -->
  <model>                       <!-- <model> is child of <scram> -->
    <file>two_train.xml</file>  <!-- input file -->
  </model>
  <options>                     <!-- <options> is a child of <model> -->
    <!-- other <options> are:
     <algorithm></algorithm> 
     <prime-implicants></prime-implicant>
     <approximation></approximation> -->
    <analysis importance="true" uncertainty="false" ccf="false"/>
    <!-- other <analysis> attributes are probability, importance, uncertainty, ccf, and sil-->
    <limits>
      <!-- other <limits> are:
       <time-step></time-step>
       <number-of-trials></number-of-trials>
       <number-of-quantiles></number-of-quantiles>
       <number-of-bins></number-of-bins>
       <seed></seed> -->
      <product-order>10</product-order>
      <mission-time>8760</mission-time>
      <cut-off>0.001</cut-off>
    </limits>
  </options>
</scram>
```
- ```boost::multi_index_container``` is used as data structure to store model and its associated data.
  This container provides a powerful, flexible, and efficient way to manage elements with multiple indices.
- **Note for Future**: ```initializer.cc``` class has a function called ```ProcessInputFiles``` which is a good
  candidate getting benefit from ```MPI``` while quantifying more than 1 fault tree. The work can be distributed
  here.
- **TODO**:List/details implemented expressions to capture basic event failures. That enables determining
  limitations and highlights necessary improvement, especially for large fault trees.
- **TODO**:```logger.h``` logs various detailed information. It may be worth to export those information during
  enhancement process.
- One specific run time pattern that is important for ```mocus``` algorithm in terms of getting benefit from
  **parallel computing**.
    - ```void RiskAnalysis::Analyze() noexcept``` in ```risk_analysis.cc```
    - ```void RiskAnalysis::RunAnalysis(std::optional<Context> context) noexcept```
    - ```void RiskAnalysis::RunAnalysis(const mef::Gate& target, Result* result) noexcept```
    - ```template <class Algorithm> void RiskAnalysis::RunAnalysis(const mef::Gate& target, Result* result) noexcept```
    - ```void FaultTreeAnalysis::Analyze() noexcept``` in ```fault_tree_analysis.cc```
    - ```const Zbdd& GenerateProducts(const Pdag* graph) noexcept override``` in ```fault_tree_analysis.h```
    - ```void Mocus::Analyze(const Pdag*) noexcept``` in ```mocus.cc```
    - ```Mocus::AnalyzeModule(const Gate& gate, const Settings& settings) noexcept``` which is the function
      that should be parallelized.
    - ```void Zbdd::Analyze(const Pdag* graph) noexcept``` in ```zbdd.cc```
-

#### 5. Exception handling
```c++

```

## Results
- ```OpenMP``` implementation to ```McubCalculater::Calculate``` function for ```HIPPS.xml``` fault tree
  with the quantification result of **9 cutsets**:

| Option                              | Serial Elapsed Time (msec) | Parallel Elapsed Time (msec) | Speed Up |
|-------------------------------------|----------------------------|------------------------------|----------|
| Original implementation             | 0.0165 (total of 59.6165)  | unable to implement!         | -        |
| Egemen's alternative implementation | 0.0157 (total of 57.4682)  | 0.3299 (total of 57.9893)    | 0.04     |

**NOTE**: I do not expect any speed up with this fault tree since the loop iteration is just 9; which
even slower the get calculation results.

- ```OpenMP``` implementation to ```McubCalculater::Calculate``` function for ```ft-450.xml``` fault tree
  which is quite complicated fault tree has the quantification results of **73,178,913 cutsets**:

| Option                              | Serial Elapsed Time (msec) | Parallel Elapsed Time (msec) | Speed Up |
|-------------------------------------|----------------------------|------------------------------|----------|
| Original implementation             | 16143.6 (total of 447160)  | unable to implement!         | -        |
| Egemen's alternative implementation | 35644.9 (total of 468679)  | 35078 (total of 521997)      | 1.01     |

**NOTE**: I do not see any speed up in whole function. My thought is,
```std::vector<std::vector<int>> cut_sets_vector(cut_sets.begin(), cut_sets.end())``` operation in
```McubCalculater::Calculate``` is expensive. Next step, I will only measure the elapse time for ```for```
loop.

- ```OpenMP``` implementation to ```McubCalculater::Calculate``` function for ```ft-450.xml``` fault tree
  which is quite complicated fault tree has the quantification results of **73,178,913 cutsets**,
  measuring only ```for``` loop:

| Option                              | Serial Elapsed Time (msec) | Parallel Elapsed Time (msec) | Speed Up |
|-------------------------------------|----------------------------|------------------------------|----------|
| Original implementation             | 16082.4 (total of 450707)  | unable to implement!         |          |
| Egemen's alternative implementation | 1157.89 (total of 467422)  | 248.782 (total of 536458)    | 4.65     |

**NOTE**: Finally, *semi*-success! My implementation completes ~13 times faster than original ```for``` loop.
Also, parallel version of my implementation gains around 4.65 speed up. The issue is the cost of
```std::vector<std::vector<int>> cut_sets_vector(cut_sets.begin(), cut_sets.end())```. I need to better
way to iterate through. The cost is ```35644.9 - 1157.89 = 34487.01``` *milliseconds*.


## Issues

## Development Environment
- Processor: Intel® Core™ i7-8700 CPU @ 3.20GHz × 12
- Memory: 16029 MiB
- Machine Type : Desktop
- Operating System: Ubuntu 22.04.3 LTS




