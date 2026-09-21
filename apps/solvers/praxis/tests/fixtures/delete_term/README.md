# Delete-term regression inputs

Run the complete suite from the PRAXIS crate directory:

```text
cargo test --test delete_term_regression -- --nocapture
```

The tests compare PRAXIS with an independent, explicit set-family oracle. The
oracle expands positive failure formulas by Cartesian union, minimizes them by
Boolean absorption, and deletes a candidate `C` exactly when a cut set of a
succeeded system is a subset of `C`. It does not call any BDD or ZBDD operation.

## Large shared-event sequence

[`shared_multi_state_large.xml`](shared_multi_state_large.xml) is a native
OpenPSA input that travels through the event-tree parser, sequence builder, and
direct ZBDD delete-term path. Its target sequence contains three failed states
followed by three successful states. Every one of the six functional-event
fault trees references the same events:

```text
X, A, B, C, D, U1, U2, U3, U4, U5, U6, U7, U8
```

Let:

```text
R  = X(U1 + U2 + U3 + U4 + U5 + U6 + U7 + U8)
F1 = R + AB + CD
F2 = R + AC + BD
F3 = R + AD + BC
S1 = AB + XCD(U1 U2 U3 U4 U5 U6 U7 U8)
S2 = AC + XBD(U1 U2 U3 U4 U5 U6 U7 U8)
S3 = BC + XAD(U1 U2 U3 U4 U5 U6 U7 U8)
```

Before delete-term:

```text
F1 F2 F3 = R + ABC + ABD + ACD + BCD
```

That is 12 minimal cut sets: eight order-2 sets and four order-3 sets. Applying
the three successful systems deletes all four order-3 sets:

```text
S1 deletes ABD (and ABC)
S2 deletes ACD (and ABC)
S3 deletes BCD (and ABC)
```

The known final answer is therefore exactly:

```text
XU1, XU2, XU3, XU4, XU5, XU6, XU7, XU8
```

Each success tree is necessary: omitting `S1`, `S2`, or `S3` restores `ABD`,
`ACD`, or `BCD`, respectively. The regression test verifies these variants in
both the independent oracle and PRAXIS.

## Limit expectations

`X=0.1`, `Un=10^-n`, and the initiating-event frequency is 10. The cutoff is
therefore tested on sequence frequency, `IE * product probability`.

| Configuration | Expected cut sets |
| --- | ---: |
| No limits | 8 |
| Order limit 1 | 0 |
| Order limit 2 | 8 |
| Cutoff `5e-6`, IE frequency 1 | 4 (`XU1` through `XU4`) |
| Cutoff `5e-6`, IE frequency 10 | 5 (`XU1` through `XU5`) |

The table-driven portion of the Rust test also covers single OR failure,
AND expansion, exact and partial deletion, singleton subset deletion, disjoint
success logic, multiple failures and successes, shared-event absorption, total
deletion, duplicate/nonminimal terms, an expanded two-out-of-three formula, and
a native `atleast min="2"` gate.
