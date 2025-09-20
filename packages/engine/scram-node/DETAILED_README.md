Here is a detailed, end‑to‑end explanation of how SCRAM takes Open‑PSA MEF XML, parses and maps it into the in‑memory C++ model (scram::mef), runs analyses, and then converts the results back to XML.

High‑level pipeline
- Input: One or more Open‑PSA MEF XML files (plus an optional “project/options” XML) conforming to the Relax NG schemas in share/openpsa_schema.txt.
- Parse + validate:
  - libxml2 parses each file into a DOM, XInclude is resolved, and RELAX NG validation is applied.
- Build MEF model in C++:
  - scram::mef::Initializer walks the DOM(s), creates C++ objects for gates, events, parameters, event trees, CCF groups, substitutions, alignments, etc., wires references, validates and normalizes.
- Prepare for analysis:
  - Fault trees are transformed to an indexed, analysis‑ready PDAG (scram::core::Pdag) and preprocessed (normalization, coalescing, modularization).
- Run analyses:
  - Qualitative (products) via MOCUS, ZBDD, or BDD; Quantitative (probability, SIL); Importance and Uncertainty, as requested by Settings.
- Convert results back to XML:
  - scram::Reporter streams a standards‑compliant “report” XML (conforming to the “Report Layer” schema in the same share/openpsa_schema.txt).
- Optional: Serialize the (possibly augmented) MEF model back to Open‑PSA MEF XML (scram::mef::Serialize).

Below are the key parts, in depth.

1) The XML schemas (what the input/output looks like)
- Input MEF model: The Open‑PSA MEF schemas in share/openpsa_schema.txt cover fault trees, gates, basic/house events, expressions and parameters, event trees, instructions/rules, alignments/phases, CCF groups, substitutions, and extern functions/libraries. There are two model grammars in the file; the second is the more complete one (with parameters, event trees, deviate distributions, extern functions, etc.).
- Project/options (execution settings) file: Another grammar under a root scram element allows you to point to MEF files and set algorithm/analysis/limits (algorithm = mocus|bdd|zbdd; approximations = rare‑event|mcub; limits like product‑order, mission‑time, time‑step, etc.).
- Report schema: The same file defines the “Report Layer” used for SCRAM’s result XML: information (software, time, performance, calculated‑quantities), and results (sum‑of‑products, importance, safety‑integrity‑levels, statistical measures, curves, initiating‑event sequences).

2) Parsing and validation (scram::xml)
- scram::xml::Document
  - Wraps libxml2. Documents are parsed with options enabling XInclude (XML_PARSE_XINCLUDE) and security/performance flags. After parse, xmlXIncludeProcess is applied so <xi:include> expansions are already in the DOM you see.
- scram::xml::Validator
  - Loads a RELAX NG (.rng) schema and validates a Document with xmlRelaxNGValidateDoc.
- scram::xml::Element
  - A lightweight, read‑only wrapper over libxml2 nodes with convenience methods:
    - name(), attribute("…") returning std::string_view; text() to access text nodes; child() and children() iterators; helpers to cast string to int/double/bool with error tagging.
- Error model
  - All SCRAM errors derive from scram::Error (exception), with xml::Error subclasses (ParseError, ValidityError, XIncludeError). The SCRAM_THROW macro tags errors with function/file/line and attaches rich error info (element name, attribute name, etc.).

3) Building the in‑memory MEF model (scram::mef)
3.1) The model containers and identity
- scram::mef::Model is the root container (“model” in the SCRAM code). It derives from Element and a MultiContainer that holds:
  - FaultTree, Component, Gate, BasicEvent, HouseEvent, Parameter, EventTree, FunctionalEvent, Sequence, NamedBranch, Rule, Alignment, Substitution, CcfGroup, ExternLibrary, ExternFunction<void>.
- Identity, naming, role/scoping:
  - Each MEF “thing” derives from Element (name, label, attributes) and/or Id (unique id). Role (public/private) and base_path control the unique id: public items keep their simple id; private ones are qualified with their full path (container.chain.name), matching the schema’s reference path semantics.
  - Attributes are stored in Element::AttributeMap (a small, unique key/value set).
- Tables and ownership:
  - Containers use boost::multi_index keyed by id or name and store either owning std::unique_ptr or raw pointers depending on the context.

3.2) Who does the DOM → MEF object mapping?
- scram::mef::Initializer is the orchestrator:
  - Constructor Initializer(xml_files, Settings, allow_extern, extra_validator)
    - Validates files exist, checks no duplicates.
    - For each file: scram::xml::Document doc(file, validator); then ProcessInputFile(doc).
    - Keeps all DOMs alive (documents_) so string_views into DOM remain valid during initialization.
  - ProcessInputFile(Document):
    - Walks the root <opsa-mef> (according to the schema) and dispatches:
      - defne-fault-tree → DefneFaultTree
      - defne-component → DefneComponent
      - defne-parameter → registers Parameter
      - defne-event-tree → DefneEventTree
      - defne-rule → register rules
      - defne-initiating-event
      - defne-alignment / defne-phase
      - defne-CCF-group
      - defne-substitution
      - defne-extern-library / defne-extern-function
      - model-data (house/basic events/parameters at model scope)
    - Because MEF allows forward references (e.g., formula referencing a gate defined later) and cross‑file references, many objects are first registered (by name/id) and then fully “defined” later. The Initializer therefore uses a large “To‑Be‑Defined” (tbd_) list:
        TbdContainer<Parameter, BasicEvent, Gate, CcfGroup, Sequence, EventTree,
                     InitiatingEvent, Rule, Alignment, Substitution>
    - After all files: ProcessTbdElements() resolves the “late” definitions in a second pass.
  - Reference resolution:
    - GetEntity<T>() resolves a reference string either by id or by full dotted path (child components). It uses both the model’s id‑based tables and PathTable<T> (full_path unique) to match the schema’s reference grammar.
  - Specific constructs mapping (per schema):

    Fault trees and components
    - defne-fault-tree, defne-component:
      - Registers scram::mef::FaultTree or Component, sets role/label/attributes.
      - Then RegisterFaultTreeData:
        - defne-gate → Gate + its mef::Formula
        - defne-basic-event → BasicEvent with optional <expression>
        - defne-house-event → HouseEvent with optional <constant value="…">
        - defne-parameter → Parameter with <expression>, optional unit
        - defne-CCF-group → see below
        - Nested defne-component (components are hierarchical)
      - FaultTree::CollectTopEvents() is available later to identify analysis targets by graph reachability.

    Gates and formulas
    - XML <formula> maps to scram::mef::Formula(connective, ArgSet, [min,max]).
      - Connectives supported in code: and, or, atleast, xor, not, nand, nor, null, iff, imply, cardinality (kConnectiveToString).
      - Arguments map to Formula::Arg { bool complement; ArgEvent event; }, where ArgEvent is a variant of Gate*, BasicEvent*, HouseEvent*.
      - The Initializer’s GetFormula() walks XML and builds the Formula recursively, calling GetEvent() or nesting formulas as needed.
      - Min/max attributes for atleast/cardinality are validated and stored.
      - The resulting Gate::formula() owns a unique_ptr<Formula>.

    Basic events and parameters
    - BasicEvent may have an <expression> describing its probability; Parameter always has one. Parameter has optional unit per schema; SCRAM stores Units in Parameter::unit().
    - The Initializer implements a registry of “extractors” for expressions:
      - ExtractorMap maps string names (like "exponential", "add", "sin", "normal-deviate", etc.) to factory functions that return a std::unique_ptr<scram::mef::Expression>.
      - Expressions implemented include:
        - Constants: bool/int/foat → ConstantExpression with value.
        - Parameters: <parameter name="…"> or <system-mission-time unit="…"> → references a Parameter or MissionTime expression.
        - Numerical operations: neg/add/sub/mul/div/pi/abs/acos/…/mean → scram::mef::NaryExpression specializations (see expression/numerical.h).
        - Boolean operations: not/and/or/eq/df/lt/gt/leq/geq → boolean.h.
        - Conditionals: <ite>, <switch>/<case>.
        - Built‑ins: <exponential>, <GLM>, <Weibull>, <periodic-test> (expression/exponential.h, expressions for periodic test variants).
        - Random deviates: uniform/normal/lognormal/gamma/beta/histogram (expression/random_deviate.h).
        - Extern functions: <extern-function> is resolved via ExternLibrary/ExternFunction and wrapped in ExternExpression (expression/extern.h).
      - Expression nodes register their argument expressions for validation and later sampling (uncertainty).

    Event trees
    - defne-event-tree / defne-functional-event / defne-sequence / defne-branch / initial-state:
      - scram::mef::EventTree holds FunctionalEvent, Sequence, NamedBranch, Fork, Path and a Branch initial_state.
      - Branches are trees of either nested forks or end‑states (sequence or branch reference).
      - Instructions in branches or sequences:
        - Set: <set-house-event> → Instruction: SetHouseEvent(name, state).
        - Collect: <collect-formula> → CollectFormula(unique_ptr<Formula>).
                   <collect-expression> → CollectExpression(Expression*).
        - Conditional: <if> → IfThenElse(Expression*, Instruction*, [else]).
        - Block: <block> → Block(std::vector<Instruction*>).
        - Rule: <rule name="…"> → reference to a previously defined Rule (which is itself a reusable sequence of instructions).
        - Link: <event-tree name="…"> → Link to another EventTree.
      - Evaluation context for test‑events: scram::mef::Context is set by analyses to carry the initiating event and the state of functional events during an event‑tree walk.

    Alignments/phases
    - defne-alignment / defne-phase:
      - scram::mef::Alignment contains scram::mef::Phase(name, time_fraction).
      - Phase may hold phase‑specific instructions (e.g., set‑house‑event), and Validate() ensures all phase time fractions are consistent (sum to 1).

    CCF groups
    - defne-CCF-group: scram::mef::CcfGroup with a model type (beta‑factor, MGL, alpha‑factor, phi‑factor), members (BasicEvent references), distribution (<expression>), and one or more <factor> expressions. Subclasses implement CalculateProbabilities():
      - BetaFactorModel, MglModel, AlphaFactorModel, PhiFactorModel.
      - After Validate(), ApplyModel() creates derived CcfEvent(s) and potentially a replacement Gate per member for CCF‑aware analyses.

    Substitutions
    - defne-substitution: scram::mef::Substitution with name, optional traditional type (delete‑terms, recovery‑rule, exchange‑event), hypothesis <formula>, optional <source> (list of BasicEvent), and a <target> which is either basic‑event or constant(true/false). Validate() checks setup; type() can classify to the “traditional” form. Non‑declarative substitutions (with a source list) are applied later by analysis.

  - Finalization & validation
    - ProcessTbdElements(): fills in the postponed definitions once all referenced objects are known.
    - ValidateInitialization():
      - Cycle checks (scram::mef::cycle) across gates, parameters, instructions, named branches, and event trees (DetectCycle/ContinueConnector specializations); throws CycleError with a formatted cycle “A->B->…->A”.
      - Validate expressions (domain/range checks, positivity/probability intervals; e.g., Exponential/GLM/Weibull validate parameters).
      - Ensure model setup consistency: non‑declarative substitutions constraints, event‑tree consistency (no mixing collect‑formula and collect‑expression; link usage only in sequences), functional event order correctness, etc. There are helper methods EnsureNoSubstitutionConflicts(), EnsureNoCcfSubstitutions(), EnsureSubstitutionsWithApproximations().
    - SetupForAnalysis():
      - Applies meta‑logical layers (CCF group ApplyModel; substitutions constraints) so the MEF model is ready for conversion to analysis graphs.

4) From MEF model to analysis graphs and computations (scram::core)
4.1) PDAG construction (indexed fault tree)
- scram::core::Pdag takes a top gate (mef::Gate) and builds a propositional directed acyclic graph:
  - Assigns each BasicEvent a sequential Variable index (kVariableStartIndex=2) and each Gate a unique index thereafter; Constant TRUE is index 1; complements are represented by negative indices in some contexts.
  - Converts mef::Formula connectives into PDAG::Gate with Connective enum (kAnd, kOr, kAtleast, kXor, kNot, kNand, kNor, kNull). Complex connectives (xor, imply, iff, cardinality, atleast) are lowered to a normalized combination of OR/AND (+ auxiliary gates) where needed.
  - Applies declarative substitutions immediately; collects non‑declarative substitutions for post‑processing.
  - Records coherence and normality flags, and registers “Null” (pass‑through) gates for cleanup.

4.2) Preprocessing (scram::core::Preprocessor)
- Each analysis algorithm has a tailored preprocessor (CustomPreprocessor<Mocus|Zbdd|Bdd>) but they share a pipeline:
  - Phase 1: cleanup constants & pass‑through gates; partial normalization; removal of NULL gates; propagation of constants (MakeConstant & ProcessConstantArg).
  - Phase 2: exploit original structure (detect multiple definitions, detect & create modules—independent subgraphs, coalesce gates of same logic, boolean optimization).
  - Phase 3: normalize to basic gates (AND/OR), including lowering XOR and ATLEAST; notify parents of negative gates and push negations down; assign topological order.
  - Phase 4: push complements to the leaves (De Morgan) to get negation normal form (only positive AND/OR above variables), honoring modules if kept intact.
  - Phase 5: final cleanup and layering (alternate AND/OR layers), ready for the target algorithm.
- The preprocessor has many dedicated helpers: MarkCoherence, DetectModules, MergeCommonArgs, DetectDistributivity, BooleanOptimization, DecomposeCommonNodes, and more. Gates/variables maintain parent maps to enable factoring and optimization.

4.3) Qualitative analysis (products)
- MOCUS (scram::core::Mocus):
  - Works on normalized, coherent PDAG; produces minimal cut sets using a specialized zbdd::CutSetContainer (a ZBDD tuned for “gates on top, variables below” ordering), with complement elimination/minimization facilities afterwards.
- ZBDD (scram::core::Zbdd):
  - Converts the PDAG directly to a general Zero‑Suppressed BDD of sets. Supports modular combination (modules_ map), minimization (subset removal), pruning by order (limit_order), complement elimination for non‑coherent graphs, and application of non‑declarative substitutions after the set structure is built. Provides begin()/end() iterators over products (sets of int variable indices, possibly through module expansion).
- BDD (scram::core::Bdd):
  - Converts PDAG to a Reduced Ordered BDD with attributed edges (only one terminal TRUE); supports Apply<AND/OR>, consensus, and exact probability evaluation later.

4.4) Quantitative analysis
- Probability analysis (scram::core::ProbabilityAnalysis and ProbabilityAnalyzer)
  - For MOCUS/ZBDD results: RareEventCalculator and McubCalculator compute total probability from cut sets and variable probabilities (Pdag::IndexMap<double> p_vars). The MissionTime parameter can be used to evaluate time‑dependent built‑ins (Exponential/GLM/Weibull/PeriodicTest).
  - For BDD: ProbabilityAnalyzer<Bdd> traverses the BDD and computes exact probabilities by dynamic programming over the graph, caching probabilities on vertices (Ite::p()).
  - p_time() computes probability vs. time if you set Settings::time_step().
  - SIL metrics (PFDavg, PFHavg and histograms) are computed if requested (safety_integrity_levels), from the p_time curve and mission time.
- Importance analysis (Birnbaum MIF, CIF, DIF, RAW/RRW)
  - Given the probability analyzer, computes event occurrences in products, conditional probabilities, etc.
- Uncertainty analysis (Monte Carlo)
  - Gathers deviate expressions of variables (Uniform, Normal, Lognormal, Gamma, Beta, Histogram) and repeatedly samples variable probabilities into a private copy of p_vars, calls CalculateTotalProbability for each trial, and produces mean/sigma, error factor, quantiles, histogram densities.

5) Converting results back to XML
- scram::Reporter (reporter.h / xml_stream.h)
  - Uses scram::xml::Stream and StreamElement to emit a standards‑compliant “report” document. The streaming API:
    - Writes a root <report> with nested <information> and <results>, indenting and properly escaping XML; ensures element/attribute ordering legality, and closes tags via RAII.
  - Information layer:
    - software (name, version), time (string), optional performance: <performance><calculation-time …> with durations; calculated‑quantities with approximation/method limits; model‑features (counts of FT, ET, gates, events, etc.); warnings and optional feedback.
  - Results layer (as requested by your settings):
    - Sum of products: <sum-of-products …> with counts, optional total probability, distribution (vector of counts by order), and one <product> per cut set with order, probability contribution (if computed), and children <literal>, including <not><basic-event …/></not> and composite CCF events rendered as <ccf-event ccf-group="…" order="k" group-size="N"> …</ccf-event>.
    - Importance: <importance …> with one entry per basic or CCF event and attributes occurrence, probability, DIF, MIF, CIF, RRW, RAW.
    - Safety Integrity Levels: <safety-integrity-levels PFD-avg="…" PFH-avg="…"> with two histograms (PFD and PFH) each as <histogram number="…"><bin number="…"
      value="…" lower-bound="…" upper-bound="…"/></histogram>.
    - Statistical measure (uncertainty): <measure> containing mean, standard-deviation, confidence-range, error-factor, quantiles, and histogram.
    - Curves: <curve X-title="…" Y-title="…"> with <point X="…" Y="…"/>.
    - Initiating event analysis: aggregated event‑tree results by initiating event and sequence values.
  - The emitted structure directly matches the “Report Layer” grammar in the same share/openpsa_schema.txt.

6) Optional: serializing the (MEF) model itself back to XML
- scram::mef::Serialize(Model&, FILE*|path)
  - Emits a MEF XML describing gates, events, parameters, etc., suitable for GUI export or interchange. This is separate from the report.

7) Settings and how they steer everything
- scram::core::Settings (settings.h) holds:
  - Algorithm (kBdd/kZbdd/kMocus), Approximation (none/rare‑event/mcub), booleans for probability/importance/uncertainty/ccf/sil, prime_implicants (only for BDD), limits (limit_order, mission_time, time_step, cut_off, num_trials, num_quantiles, num_bins, seed).
  - Some settings are interdependent (e.g., enabling uncertainty forces probability_analysis on).
  - A project/options XML (scram grammar in the schema) can be used to set these and list model files; otherwise your host program passes a Settings object and a vector of file paths to Initializer.

8) Error handling and validation guarantees
- All domain and validity checks throw typed exceptions with rich context:
  - XML validity errors (schema), ParseErrors, XIncludeErrors.
  - MEF validity: duplicate elements, undefined references, malformed names/paths (Id/Role), invalid formulas/arguments, invalid expression domains (EnsureProbability/EnsurePositive/EnsureNonNegative/EnsureWithin).
  - Cycle detection prints the exact cycle path using Id::unique_name or full path for Links.

9) Why this matters for a TypeScript interface
- The XML→MEF mapping is already factored by “construct”:
  - Model containers (FaultTree/Component/Event/Parameter/ET/Rule/Alignment/CCF/Substitution/Extern) map cleanly to TS interfaces.
  - Expressions and formulas are recursive, typed trees; their constructors and validations correspond 1:1 to the schema element names.
  - References (id vs full path) are resolved by a single service (GetEntity) you can mirror in TS.
- After analysis, the “Report Layer” XML is a stable, typed API for results; its structure can be represented by TS types to make the C++ addon return structured results instead of raw XML if you prefer.
- If you do keep XML I/O at the Node boundary, you can rely on these schemas for runtime validation.

Trace of important classes/functions and what they do
- scram::xml::{Document, Validator, Element} — parse/validate/traverse XML.
- scram::mef::Initializer — central DOM→MEF loader:
  - ProcessInputFiles, ProcessInputFile, RegisterFaultTreeData, DefneEventTree, DefneComponent, GetFormula, GetExpression, GetParameter, DefneCcfFactor, ProcessCcfMembers, DefneExternLibraries/Function, ProcessModelData, ProcessTbdElements, ValidateInitialization, SetupForAnalysis.
- scram::mef::* — element classes:
  - Gate, BasicEvent, HouseEvent, Formula (connective + ArgSet), Parameter (Units + Expression*), MissionTime, EventTree (FunctionalEvent, Sequence, NamedBranch, Fork/Path/Branch), Instruction hierarchy (SetHouseEvent, CollectExpression, CollectFormula, IfThenElse, Block, Rule, Link), Alignment/Phase, CcfGroup* models, Substitution, ExternLibrary/ExternFunction/ExternExpression.
- scram::core::Pdag — indexed graph with Gate/Variable nodes; performs conversion from MEF formulas to gate graph; handles substitutions; stores basic events by indices; marks coherence/normality; resolves constants/nulls.
- scram::core::Preprocessor — multi‑phase transformations; gate normalization, complement propagation, module detection/coalescing; factoring and boolean optimizations.
- scram::core::{Mocus, Zbdd, Bdd} — qualitative engines; Zbdd also exposes iterators to enumerate sets and handles module joining, minimization, pruning.
- scram::core::{ProbabilityAnalysis, ProbabilityAnalyzer<Calculator>, RareEventCalculator, McubCalculator} — quantitative calculators for p_total and p(t).
- scram::core::{ImportanceAnalysis/ImportanceAnalyzer} — computes MIF/CIF/DIF/RAW/RRW and occurrences.
- scram::core::{UncertaintyAnalysis/UncertaintyAnalyzer} — Monte Carlo sampling over deviate expressions.
- scram::Reporter — streams the final report XML per schema.
- scram::mef::Serialize — optional model serialization to MEF XML.

Putting it together with a simple “flow of calls”
- Your host sets up Settings and a list of MEF XML files.
- Initializer loads each file via xml::Document (XInclude, validate), registers elements; after all files, resolves deferred definitions and validates.
- For each analysis target (e.g., each top gate), RiskAnalysis builds a Pdag, preprocesses it, and runs FaultTreeAnalyzer<Algorithm>. Then, if requested, ProbabilityAnalyzer<Calculator>, Importance, and Uncertainty; optionally EventTreeAnalysis grouped by initiating event and sequences; optionally SIL.
- Reporter takes the RiskAnalysis results and writes report XML.

That is the full conversion: XML → validated DOM → MEF objects → PDAG/BDD/ZBDD → results → report XML (and optional MEF serialization). If you want, I can sketch the exact TypeScript interfaces that correspond to these XML/MEF structures next, which will make writing the NodeJS addon more straightforward.