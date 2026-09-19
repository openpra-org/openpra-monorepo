# Source-term fixture

`MelMACCS-published-source-term.inp` contains source-term records from the published MelMACCS 4.0.0 User Guide, Appendix C, pages 75–85:
https://maccs.sandia.gov/rest-api/document/download/95

The example contains 69 nuclides, 10 chemical groups and 8 release segments. PDF line wrapping was joined; the published data values were retained. Release heights are explicitly zero. This excerpt is not a complete runnable MACCS deck.

The Step 01 importer reads `ISMAXGRP`, `ISGRPNAM`, `ISNUMISO`, `ISOTPGRP`, `RDCORINV`, `RDNUMREL`, `RDPDELAY`, `RDPLUDUR`, `RDPLHITE` and `RDRELFRC` records. Inventory is in Bq, timing in seconds, height in metres, and segment fractions are relative to the initial chemical-group inventory. Non-unit `RDCORSCA` values are rejected instead of silently rescaling inventory. Missing segment quantities remain absent.
