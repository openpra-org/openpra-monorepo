##################################
The Open-PSA Model Exchange Format
##################################

Open Probabilistic Safety Assessment Initiative hopes
to bring international community of PSA together
to improve the tools, techniques, and quality of PSA
in a non-competitive and open manner
for the benefit of the community [OPSA]_ [MEF]_.

The initiative deals with the following issues in the current PSA:

- Quality assurance of calculations
- Unfounded reliance on numerical approximations and truncation
- Portability of the models between different software
- Clarity of the models
- Completeness of the models
- Modeling of human actions
- Better visualization of PSA results
- Difficulty of different software working with the same PSA model
- Lack of data and software backward and forward compatibility
- No universal format for industry data

In order to facilitate information exchange and quality assurance,
the Open-PSA community has developed a model exchange format([MEF]_) for PSA
that covers most needs to describe the analysis input for PSA tools.
Moreover, the MEF defines the following requirements
for its development and use:

- Soundness
- Completeness
- Clarity
- Generality
- Extensibility

The MEF is designed with the "declarative modeling" criterion
"to present a more informative view of the actual systems, components,
and interactions which the model represents".
This paradigm is followed from the structured programming techniques.

More information about the initiative and format can be found on [OPSA]_.


.. _opsa_support:

Supported Open-PSA MEF Features
===============================

The difference between `the Open-PSA MEF schema <https://github.com/open-psa/schemas/>`_
and SCRAM's :ref:`schema` can be used
to identify the supported and unsupported features.

- Label
- Attributes
- Public and Private Roles
- Alignment and Phases
- Substitutions (delete terms, recovery rules, exchange events)
- Event Tree Layer

    * Initiating events
    * Sequences
    * Functional events
    * Branches
    * Instructions (collect-expression, collect-formula, if-then-else, block, rule, link)
    * Set-instructions (set-house-event)
    * Set-instruction directions (forward)

- Fault Tree Layer

    * Components
    * Basic events
    * House events (Boolean constant)
    * Gates (Nested formulae)

- Model Data
- Common Cause Failure Groups (beta-factor, MGL, alpha-factor, phi-factor)
- Parameters
- Expressions

    * Constant expressions
    * System mission time
    * Parameter
    * Numerical operations
    * Boolean operations
    * Conditional operations
    * Random deviate (normal, log-normal, histogram, uniform, gamma, beta)
    * Built-in expressions (exponential, GLM, Weibull, periodic-test, extern-function)
    * Test event (test-initiating-event, test-functional-event)


Deviations from the Open-PSA MEF
================================

- Arbitrary nesting of Boolean formulae is `not allowed <https://github.com/open-psa/mef/pull/58>`_.
- XOR and IFF connectives `require exactly 2 arguments <https://github.com/open-psa/mef/pull/59>`_.
- Extern function and library are implemented following
  `the new proposal <https://github.com/open-psa/mef/pull/53>`_.
- `XInclude instead of the 'include' directive <https://github.com/open-psa/mef/pull/47>`_.
- Redefinition of fault tree variables (e.g., basic-events, parameters) is an
  `error <https://github.com/open-psa/mef/issues/50>`_.
- Substitution names are required.
- Attributes must be `unique <https://github.com/open-psa/mef/issues/60>`_.
- Recursive parameters are not allowed.
- Recursive event-tree rules and links (instructions) are not allowed.
- Mixing collect-expression and collect-formula is not allowed.
  `Issue #183 <https://github.com/rakhimov/scram/issues/183>`_
- An empty text in XML attributes or elements is considered an error.


Translators to the Open-PSA MEF
===============================

Various translators from other formats, such as Aralia,
can be found in `the Open-PSA MEF translators repository`_.

.. _the Open-PSA MEF translators repository: https://github.com/open-psa/translators/
