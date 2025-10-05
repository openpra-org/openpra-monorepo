# Monte Carlo Estimation of Boolean Function Probability

Let $ X = (X_1, \ldots, X_k) $ be independent Bernoulli random variables with parameter vector $ p $, and let $ F : \{0,1\}^k \to \{0,1\} $ be a Boolean expression (e.g., fault-tree, PDAG, etc.).

Our target quantity is

$$
G(F, p) := \mathbb{P}[F(X) = 1].
$$

While exact data-structure methods (BDD, ZBDD, ADD), inclusion–exclusion, or rare-event approximations can compute $ G $, our implementation relies on a massively parallel Monte Carlo estimator:

---

## Monte Carlo Estimator

1. **Sampling:**  
   Draw $ N $ independent samples $ X^{(1)}, \ldots, X^{(N)} $ from the Bernoulli distribution.

2. **Indicator Calculation:**  
   Form the indicators $ I_i = F(X^{(i)}) $.

3. **Sample Mean:**  
   Compute the sample mean:
   $$
   G_n = \frac{1}{N} \sum_{i=1}^{N} I_i.
   $$

**Assumptions:**
- The samples are i.i.d.
- $ F $ takes values in $ \{0,1\} $.

---

## Mathematical Guarantees

- **Unbiasedness:**  
  $$
  \mathbb{E}[G_n] = G(F, p)
  $$

- **Law of Large Numbers (LLN):**  
  $$
  G_n \to G \quad \text{almost surely as } N \to \infty
  $$

- **Central Limit Theorem (CLT):**  
  $$
  \sqrt{N}(G_n - G) \xrightarrow{d} \mathcal{N}(0,\, p(1-p))
  $$
  so the standard error is
  $$
  \mathrm{SE} = \sqrt{\frac{p(1-p)}{N}}
  $$
  Since $ p $ is unknown, we plug in $ \hat{p} = G_n $, giving
  $$
  \widehat{\mathrm{SE}} = \sqrt{\frac{\hat{p}(1-\hat{p})}{N}}
  $$

- **Confidence Interval:**  
  With confidence level $ 1 - \alpha $, the normal approximation yields the interval
  $$
  \mathrm{CI}_{1-\alpha} = G_n \pm z_{1-\alpha/2} \cdot \widehat{\mathrm{SE}}
  $$

---

## Controlling Precision

A target half-width $ \varepsilon $ and confidence $ 1-\alpha $ imply the classic rule:
$$
N \geq \frac{z^2 \cdot p(1-p)}{\varepsilon^2} \approx \frac{z^2 \cdot 0.25}{\varepsilon^2}
$$
(worst-case variance).

The convergence controller:
- Starts with an initial $ N $
- Runs the kernels on GPU/SYCL
- Updates the tally after each batch
- Stops early when
  $$
  \widehat{\mathrm{SE}} \cdot z_{1-\alpha/2} \leq \varepsilon
  $$
  and the normal-approximation sanity check ($ n\hat{p} \geq 10 $ and $ n(1-\hat{p}) \geq 10 $) passes.

---

## Diagnostics (Optional)

If a ground-truth probability $ q $ is supplied via `--oracle-p`, we also report:

- **Absolute / Relative Error:**  
  $$
  |G_n - q|, \quad \frac{|G_n - q|}{q}
  $$

- **Z-score:**  
  $$
  z_{\text{obs}} = \frac{G_n - q}{\widehat{\mathrm{SE}}}
  $$
  and its two-sided p-value

- **CI Coverage Flag:**  
  (Does $ q $ lie inside the confidence interval?)

- **Over-/Under-sampling Ratio:**  
  $$
  \frac{N}{N_{\text{required}}(q, \varepsilon, \alpha)}
  $$

These metrics help validate randomness quality, detect bias, and tune batch sizes.