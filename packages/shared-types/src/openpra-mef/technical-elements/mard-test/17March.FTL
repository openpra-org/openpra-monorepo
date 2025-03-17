TUTORIAL, BORON-FT =
BORON-FT                                         OR   OP-BORON BORON-PUMP
^EOS
TUTORIAL, HPI-FT =
HPI-FT                                           OR   HPI-VALVES HPI-PUMP TANK
HPI-VALVES                                       OR   HPI-VALVES-INDEP HPI-VALVES-CCF
HPI-VALVES-INDEP                                 AND  HPI-VALVE-A HPI-VALVE-B
^EOS
TUTORIAL, LPI-FT =
LPI-FT                                           OR   LPI-PUMPS TANK LPI-VALVES
LPI-PUMPS                                        OR   LPI-PUMPS-INDEP LPI-PUMPS-CCF
LPI-PUMPS-INDEP                                  AND  LPI-PUMP-A LPI-PUMP-B
LPI-VALVES                                       OR   LPI-VALVES-CCF LPI-VALVES-INDEP
LPI-VALVES-INDEP                                 AND  LPI-VALVE-A LPI-VALVE-B LPI-VALVE-C
^EOS
TUTORIAL, REACTOR-TRIP-FT =
REACTOR-TRIP-FT                                  OR   TRIP-SIGNAL ROD-INSERTION-MECHANISM
TRIP-SIGNAL                                      OR   TRIP-CCF TRIP-A-AND-B
TRIP-A-AND-B                                     AND  TRIP-SYSTEM-A TRIP-SYSTEM-B
^EOS
TUTORIAL, REDUCE-PRESSURE-FT =
REDUCE-PRESSURE-FT                               OR   OP-REDUCE-PRESSURE INSTRUMENT-REDUCE-PRESSURE RELIEF-VALVES
RELIEF-VALVES                                    AND  RELIEF-VALVE-A RELIEF-VALVE-B
^EOS
