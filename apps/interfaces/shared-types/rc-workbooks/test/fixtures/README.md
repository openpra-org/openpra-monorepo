# Source-term fixture

`MelMACCS-published-source-term.inp` contains source-term records from the published MelMACCS 4.0.0 User Guide, Appendix C, pages 75–85:
https://maccs.sandia.gov/rest-api/document/download/95

The example contains 69 nuclides, 10 chemical groups and 8 release segments. PDF line wrapping was joined; the published data values were retained. Release heights are explicitly zero. This excerpt is not a complete runnable MACCS deck.

The Step 01 importer reads `ISMAXGRP`, `ISGRPNAM`, `ISNUMISO`, `ISOTPGRP`, `RDCORINV`, `RDNUMREL`, `RDPDELAY`, `RDPLUDUR`, `RDPLHITE` and `RDRELFRC` records. Inventory is in Bq, timing in seconds, height in metres, and segment fractions are relative to the initial chemical-group inventory. Non-unit `RDCORSCA` values are rejected instead of silently rescaling inventory. Missing segment quantities remain absent.

`NNDC-ENSDF-2023-04-03-standard-decay-library.txt` holds 86 complete decay datasets copied byte for byte from the NNDC ENSDF archival distribution of 2023-04-03 (ensdf_230403.zip, SHA-256 d785cc0194cee046d6d98986035161464a3ead9ccc215ce3c0e295b97c3d3b4d). It covers the 75 radionuclides of the published source term and the generic HTGR and SFR inventories.
