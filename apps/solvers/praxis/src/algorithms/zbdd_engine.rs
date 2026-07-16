use std::collections::HashMap;

use tracing::trace;

use crate::algorithms::bdd_engine::{Bdd, BddRef};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct ZbddRef(u32);

pub const ZBDD_EMPTY: ZbddRef = ZbddRef(0);
pub const ZBDD_BASE: ZbddRef = ZbddRef(1);

impl ZbddRef {
    pub fn new(raw: u32) -> Self {
        Self(raw)
    }

    pub fn raw(self) -> u32 {
        self.0
    }

    pub fn index(self) -> usize {
        self.0 as usize
    }

    pub fn is_empty(self) -> bool {
        self == ZBDD_EMPTY
    }

    pub fn is_base(self) -> bool {
        self == ZBDD_BASE
    }

    pub fn is_terminal(self) -> bool {
        self.0 <= 1
    }
}

impl std::fmt::Display for ZbddRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match *self {
            ZBDD_EMPTY => write!(f, "EMPTY"),
            ZBDD_BASE => write!(f, "BASE"),
            ZbddRef(k) => write!(f, "ZbddRef({})", k),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct ZbddNode {
    pub var: usize,
    pub high: ZbddRef,
    pub low: ZbddRef,
}

impl ZbddNode {
    pub fn new(var: usize, high: ZbddRef, low: ZbddRef) -> Self {
        Self { var, high, low }
    }

    pub fn is_sentinel(self) -> bool {
        self.var == usize::MAX
    }
}

fn hash_key(var: u64, high: u32, low: u32) -> u64 {
    let mut h = var;
    h = h.wrapping_mul(0x9E3779B97F4A7C15).wrapping_add(high as u64);
    h = h.wrapping_mul(0x9E3779B97F4A7C15).wrapping_add(low as u64);
    h ^= h >> 32;
    h = h.wrapping_mul(0xD6E8FEB86659FD93);
    h ^= h >> 33;
    h
}

#[derive(Clone, Copy)]
struct UEntry {
    var: u32,
    high: u32,
    low: u32,
    val: u32,
}

const UEMPTY: UEntry = UEntry {
    var: 0,
    high: 0,
    low: 0,
    val: 0,
};

struct OpenUnique {
    slots: Vec<UEntry>,
    mask: usize,
    len: usize,
}

impl OpenUnique {
    fn new() -> Self {
        let bits = std::env::var("PRAXIS_UNIQUE_BITS")
            .ok()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(10)
            .clamp(10, 30);
        let cap = 1usize << bits;
        OpenUnique {
            slots: vec![UEMPTY; cap],
            mask: cap - 1,
            len: 0,
        }
    }

    fn get(&self, node: &ZbddNode) -> Option<ZbddRef> {
        let var = node.var as u32;
        let high = node.high.raw();
        let low = node.low.raw();
        let mut i = (hash_key(var as u64, high, low) as usize) & self.mask;
        loop {
            let e = self.slots[i];
            if e.val == 0 {
                return None;
            }
            if e.var == var && e.high == high && e.low == low {
                return Some(ZbddRef::new(e.val));
            }
            i = (i + 1) & self.mask;
        }
    }

    fn place(&mut self, var: u32, high: u32, low: u32, val: u32) {
        let mut i = (hash_key(var as u64, high, low) as usize) & self.mask;
        loop {
            let e = self.slots[i];
            if e.val == 0 {
                self.slots[i] = UEntry { var, high, low, val };
                self.len += 1;
                return;
            }
            if e.var == var && e.high == high && e.low == low {
                self.slots[i].val = val;
                return;
            }
            i = (i + 1) & self.mask;
        }
    }

    fn insert(&mut self, node: ZbddNode, r: ZbddRef) {
        if (self.len + 1) * 10 >= (self.mask + 1) * 7 {
            self.grow();
        }
        self.place(node.var as u32, node.high.raw(), node.low.raw(), r.raw());
    }

    fn grow(&mut self) {
        let new_cap = (self.mask + 1) * 2;
        let old = std::mem::replace(&mut self.slots, vec![UEMPTY; new_cap]);
        self.mask = new_cap - 1;
        self.len = 0;
        for e in old {
            if e.val != 0 {
                self.place(e.var, e.high, e.low, e.val);
            }
        }
    }

    fn remove(&mut self, node: &ZbddNode) {
        let var = node.var as u32;
        let high = node.high.raw();
        let low = node.low.raw();
        let mask = self.mask;
        let mut i = (hash_key(var as u64, high, low) as usize) & mask;
        loop {
            let e = self.slots[i];
            if e.val == 0 {
                return;
            }
            if e.var == var && e.high == high && e.low == low {
                break;
            }
            i = (i + 1) & mask;
        }
        self.len -= 1;
        let mut j = i;
        loop {
            self.slots[i].val = 0;
            loop {
                j = (j + 1) & mask;
                let e = self.slots[j];
                if e.val == 0 {
                    return;
                }
                let k = (hash_key(e.var as u64, e.high, e.low) as usize) & mask;
                let anchored = if i <= j {
                    i < k && k <= j
                } else {
                    i < k || k <= j
                };
                if !anchored {
                    break;
                }
            }
            self.slots[i] = self.slots[j];
            i = j;
        }
    }

    fn clear(&mut self) {
        for e in self.slots.iter_mut() {
            e.val = 0;
        }
        self.len = 0;
    }
}

enum UniqueTable {
    Std(HashMap<ZbddNode, ZbddRef>),
    Open(OpenUnique),
}

impl UniqueTable {
    fn new(open: bool) -> Self {
        if open {
            UniqueTable::Open(OpenUnique::new())
        } else {
            UniqueTable::Std(HashMap::new())
        }
    }

    fn get(&self, node: &ZbddNode) -> Option<ZbddRef> {
        match self {
            UniqueTable::Std(m) => m.get(node).copied(),
            UniqueTable::Open(t) => t.get(node),
        }
    }

    fn insert(&mut self, node: ZbddNode, r: ZbddRef) {
        match self {
            UniqueTable::Std(m) => {
                m.insert(node, r);
            }
            UniqueTable::Open(t) => t.insert(node, r),
        }
    }

    fn remove(&mut self, node: &ZbddNode) {
        match self {
            UniqueTable::Std(m) => {
                m.remove(node);
            }
            UniqueTable::Open(t) => t.remove(node),
        }
    }

    fn len(&self) -> usize {
        match self {
            UniqueTable::Std(m) => m.len(),
            UniqueTable::Open(t) => t.len,
        }
    }

    fn clear(&mut self) {
        match self {
            UniqueTable::Std(m) => m.clear(),
            UniqueTable::Open(t) => t.clear(),
        }
    }
}

#[derive(Clone, Copy)]
struct JEntry {
    f: u32,
    g: u32,
    bucket: u64,
    mp: f64,
    thr: f64,
    result: u32,
    used: bool,
}

const JEMPTY: JEntry = JEntry {
    f: 0,
    g: 0,
    bucket: 0,
    mp: 0.0,
    thr: 0.0,
    result: 0,
    used: false,
};

// Open-addressing cache for the budgeted join. Within one min_prob the result of
// join_budgeted_rec depends only on (f, g, threshold) where threshold = min_prob /
// p_acc is the smallest product probability still worth keeping here. Keyed by
// (f, g, mp=min_prob, bucket(thr)); each entry stores the EXACT thr it was computed
// at and is reused only when its thr is at least as low (loose) as the query's, so
// the reused result is a sound superset (bounded by the bucket width) cleaned by a
// final exact truncation. min_prob is part of the key on purpose: across two
// different min_prob values the per-product prune folds are independent floating
// point sums, so a same-min_prob match keeps the superset exact in IEEE arithmetic,
// not just in real arithmetic. Persisting the table across calls (Part C) is then
// sound because every reuse is same-min_prob. A `used` flag is mandatory because
// the join can cache ZBDD_EMPTY.
struct JoinCache {
    slots: Vec<JEntry>,
    mask: usize,
    len: usize,
    mant_bits: u32,
}

impl JoinCache {
    fn new() -> Self {
        // Sub-octave granularity for the p_acc bucket (0 = power-of-2 buckets).
        // Default 1 (half-octave) is the measured 1E-9 knee: ~full speedup at
        // negligible over-keep. PRAXIS_JOIN_G=0 trades memory for the last few %.
        let mant_bits = std::env::var("PRAXIS_JOIN_G")
            .ok()
            .and_then(|s| s.parse::<u32>().ok())
            .unwrap_or(1)
            .min(52);
        let cap = 1usize << 12;
        JoinCache {
            slots: vec![JEMPTY; cap],
            mask: cap - 1,
            len: 0,
            mant_bits,
        }
    }

    fn bucket(&self, thr: f64) -> u64 {
        // Monotonic in thr for positive floats: the exponent plus the top
        // mant_bits of the mantissa.
        thr.to_bits() >> (52 - self.mant_bits)
    }

    fn hash(f: u32, g: u32, bucket: u64, mp: f64) -> u64 {
        let mut h = (f as u64) | ((g as u64) << 32);
        h ^= bucket.wrapping_mul(0x9E3779B97F4A7C15);
        h ^= mp.to_bits().wrapping_mul(0xFF51AFD7ED558CCD);
        h = h.wrapping_mul(0xD6E8FEB86659FD93);
        h ^= h >> 32;
        h
    }

    fn get(&self, f: u32, g: u32, thr: f64, mp: f64) -> Option<u32> {
        let bucket = self.bucket(thr);
        let mut i = (Self::hash(f, g, bucket, mp) as usize) & self.mask;
        loop {
            let e = self.slots[i];
            if !e.used {
                return None;
            }
            if e.f == f && e.g == g && e.bucket == bucket && e.mp == mp {
                // Reusable only if the cached threshold is at least as low (loose)
                // as the query's, in which case the cached result is a sound superset.
                return if e.thr <= thr { Some(e.result) } else { None };
            }
            i = (i + 1) & self.mask;
        }
    }

    fn place(&mut self, f: u32, g: u32, bucket: u64, thr: f64, mp: f64, result: u32) {
        let mut i = (Self::hash(f, g, bucket, mp) as usize) & self.mask;
        loop {
            let e = self.slots[i];
            if !e.used {
                self.slots[i] = JEntry { f, g, bucket, mp, thr, result, used: true };
                self.len += 1;
                return;
            }
            if e.f == f && e.g == g && e.bucket == bucket && e.mp == mp {
                // Keep the lowest (loosest) threshold per key; it serves the most.
                if thr < e.thr {
                    self.slots[i] = JEntry { f, g, bucket, mp, thr, result, used: true };
                }
                return;
            }
            i = (i + 1) & self.mask;
        }
    }

    fn insert(&mut self, f: u32, g: u32, thr: f64, mp: f64, result: u32) {
        if (self.len + 1) * 10 >= (self.mask + 1) * 7 {
            let new_cap = (self.mask + 1) * 2;
            let old = std::mem::replace(&mut self.slots, vec![JEMPTY; new_cap]);
            self.mask = new_cap - 1;
            self.len = 0;
            for e in old {
                if e.used {
                    self.place(e.f, e.g, e.bucket, e.thr, e.mp, e.result);
                }
            }
        }
        let bucket = self.bucket(thr);
        self.place(f, g, bucket, thr, mp, result);
    }
}

const OP_UNION: u8 = 0;
const OP_SUBTRACT: u8 = 2;
const OP_MINIMIZE: u8 = 4;
const OP_PURIFY: u8 = 5;
const OP_REMOVEVAR: u8 = 6;

// Ref-holding fixed-size computed cache entry (used only when gc_on). The cache
// protects each entry's operands and result, so a cached slot cannot be recycled
// while the entry lives; eviction on collision derefs them, which bounds the cache
// and is itself the reclamation. No generation tags needed.
#[derive(Clone, Copy, Default)]
struct ComputedEntry {
    op: u8,
    used: bool,
    b_is_node: bool,
    a: u32,
    b: u32,
    result: u32,
}

pub struct ZbddEngine {
    nodes: Vec<ZbddNode>,
    unique: UniqueTable,
    computed: Vec<ComputedEntry>,
    computed_mask: usize,
    union_cache: HashMap<(ZbddRef, ZbddRef), ZbddRef>,
    join_cache: HashMap<(ZbddRef, ZbddRef), ZbddRef>,
    subtract_cache: HashMap<(ZbddRef, ZbddRef), ZbddRef>,
    difference_cache: HashMap<(ZbddRef, ZbddRef), ZbddRef>,
    minimize_cache: HashMap<ZbddRef, ZbddRef>,
    purify_cache: HashMap<ZbddRef, ZbddRef>,
    removevar_cache: HashMap<(ZbddRef, usize), ZbddRef>,
    convert_cache: HashMap<BddRef, ZbddRef>,
    var_probs: Vec<f64>,
    // Constant factor carried into every product value, so that a product's
    // accumulated value is scale * prod(var_probs). For an event-tree sequence
    // this is the initiating-event frequency, which makes the accumulated value
    // the product's frequency and lets a cut-off be compared against it
    // directly. It is 1.0 for a plain fault tree, where the value is the
    // product's probability. Probability queries (rare_event_probability,
    // min_cut_upper_bound_graph, ...) are unscaled and always return
    // probabilities; only truncation reads this.
    scale: f64,
    maxprobs: Vec<f64>,
    maxprob_stamp: Vec<u64>,
    maxprob_epoch: u64,
    refcounts: Vec<u32>,
    generations: Vec<u32>,
    free_list: Vec<u32>,
    gc_on: bool,
    use_computed: bool,
    // Part A: per-node "known minimal" bit (parallel to nodes), plus a guaranteed
    // non-evicting minimize memo for the GC-off throughput path.
    minimal: Vec<bool>,
    minimize_memo: HashMap<ZbddRef, ZbddRef>,
    // Part C: persistent budgeted-join memo. The result of join_budgeted_rec
    // depends only on (f, g, threshold=min_prob/p_acc), so one table can serve
    // every join_budgeted call instead of allocating a cold one per call. Only
    // safe with GC off, where node refs never recycle, so a Some here implies
    // gc_on == false.
    join_bcache: Option<JoinCache>,
}

const ZBDD_SENTINEL: ZbddNode = ZbddNode {
    var: usize::MAX,
    high: ZBDD_EMPTY,
    low: ZBDD_EMPTY,
};

impl ZbddEngine {
    pub fn new() -> Self {
        let gc_on = std::env::var("PRAXIS_ZBDD_GC").map(|v| v == "1").unwrap_or(false);
        let open_unique = std::env::var("PRAXIS_UNIQUE").map(|v| v != "std").unwrap_or(true);
        let array_opcache = std::env::var("PRAXIS_OPCACHE").map(|v| v != "hashmap").unwrap_or(true);
        let use_computed = gc_on || array_opcache;
        let (computed, computed_mask) = if use_computed {
            // GC-on keeps a small cache to protect the 1E-12 memory wall (every
            // slot pins live nodes). GC-off has headroom, and the op-cache is
            // capacity-bound, so default larger; 2^26 is the measured 1E-9 knee.
            let default_bits = if gc_on { 23 } else { 26 };
            let bits = std::env::var("PRAXIS_ZBDD_CACHE_BITS")
                .ok()
                .and_then(|s| s.parse::<usize>().ok())
                .unwrap_or(default_bits)
                .clamp(10, 30);
            let size = 1usize << bits;
            (vec![ComputedEntry::default(); size], size - 1)
        } else {
            (Vec::new(), 0)
        };
        Self {
            nodes: vec![ZBDD_SENTINEL, ZBDD_SENTINEL],
            unique: UniqueTable::new(open_unique),
            computed,
            computed_mask,
            union_cache: HashMap::new(),
            join_cache: HashMap::new(),
            subtract_cache: HashMap::new(),
            difference_cache: HashMap::new(),
            minimize_cache: HashMap::new(),
            purify_cache: HashMap::new(),
            removevar_cache: HashMap::new(),
            convert_cache: HashMap::new(),
            var_probs: Vec::new(),
            scale: 1.0,
            maxprobs: vec![0.0, 0.0],
            maxprob_stamp: vec![0, 0],
            maxprob_epoch: 1,
            refcounts: vec![0, 0],
            generations: vec![0, 0],
            free_list: Vec::new(),
            gc_on,
            use_computed,
            minimal: vec![false, false],
            minimize_memo: HashMap::new(),
            join_bcache: if !gc_on {
                Some(JoinCache::new())
            } else {
                None
            },
        }
    }

    pub fn reset(&mut self) {
        self.nodes.truncate(2);
        self.unique.clear();
        self.union_cache.clear();
        self.join_cache.clear();
        self.subtract_cache.clear();
        self.difference_cache.clear();
        self.minimize_cache.clear();
        self.purify_cache.clear();
        self.removevar_cache.clear();
        self.convert_cache.clear();
        self.maxprobs.truncate(2);
        self.maxprob_stamp.truncate(2);
        self.maxprob_epoch += 1;
        self.refcounts.truncate(2);
        self.generations.truncate(2);
        self.minimal.truncate(2);
        self.minimize_memo.clear();
        self.free_list.clear();
        if self.join_bcache.is_some() {
            self.join_bcache = Some(JoinCache::new());
        }
        for e in self.computed.iter_mut() {
            e.used = false;
        }
    }

    pub fn clear_op_caches(&mut self) {
        self.union_cache.clear();
        self.join_cache.clear();
        self.subtract_cache.clear();
        self.difference_cache.clear();
        self.minimize_cache.clear();
        self.purify_cache.clear();
        self.removevar_cache.clear();
    }

    pub fn is_empty(f: ZbddRef) -> bool {
        f.is_empty()
    }

    pub fn is_base(f: ZbddRef) -> bool {
        f.is_base()
    }

    pub fn is_terminal(f: ZbddRef) -> bool {
        f.is_terminal()
    }

    pub fn node(&self, f: ZbddRef) -> &ZbddNode {
        debug_assert!(
            !f.is_terminal(),
            "ZbddEngine::node called on terminal ref {f}"
        );
        &self.nodes[f.index()]
    }

    pub fn var_of(&self, f: ZbddRef) -> usize {
        if f.is_terminal() { usize::MAX } else { self.node(f).var }
    }

    pub fn node_count(&self) -> usize {
        self.nodes.len().saturating_sub(2)
    }

    pub fn reachable_count(&self, root: ZbddRef) -> usize {
        let mut seen: std::collections::HashSet<u32> = std::collections::HashSet::new();
        let mut stack = vec![root];
        while let Some(f) = stack.pop() {
            if f.is_terminal() {
                continue;
            }
            if !seen.insert(f.raw()) {
                continue;
            }
            let n = &self.nodes[f.index()];
            stack.push(n.high);
            stack.push(n.low);
        }
        seen.len()
    }

    pub fn unique_len(&self) -> usize {
        self.unique.len()
    }

    pub fn op_cache_len(&self) -> usize {
        self.union_cache.len()
            + self.join_cache.len()
            + self.subtract_cache.len()
            + self.difference_cache.len()
            + self.minimize_cache.len()
            + self.purify_cache.len()
            + self.removevar_cache.len()
    }

    pub fn clear_caches(&mut self) {
        self.union_cache.clear();
        self.subtract_cache.clear();
        self.minimize_cache.clear();
        self.convert_cache.clear();
    }

    pub fn enumerate(&self, f: ZbddRef) -> Vec<Vec<usize>> {
        let mut result = Vec::new();
        let mut current = Vec::new();
        self.collect_sets(f, &mut current, &mut result);
        result
    }

    fn collect_sets(&self, f: ZbddRef, current: &mut Vec<usize>, result: &mut Vec<Vec<usize>>) {
        if f.is_empty() {
            return;
        }
        if f.is_base() {
            result.push(current.clone());
            return;
        }
        let node = self.node(f);
        current.push(node.var);
        self.collect_sets(node.high, current, result);
        current.pop();
        self.collect_sets(node.low, current, result);
    }

    pub fn count_by_order(&self, f: ZbddRef) -> HashMap<usize, u64> {
        let mut cache: HashMap<ZbddRef, HashMap<usize, u64>> = HashMap::new();
        self.count_by_order_rec(f, &mut cache)
    }

    fn count_by_order_rec(
        &self,
        f: ZbddRef,
        cache: &mut HashMap<ZbddRef, HashMap<usize, u64>>,
    ) -> HashMap<usize, u64> {
        if let Some(cached) = cache.get(&f) {
            return cached.clone();
        }
        let result = if f.is_empty() {
            HashMap::new()
        } else if f.is_base() {
            let mut m = HashMap::new();
            m.insert(0usize, 1u64);
            m
        } else {
            let node = self.node(f);
            let high = self.count_by_order_rec(node.high, cache);
            let low = self.count_by_order_rec(node.low, cache);
            let mut merged: HashMap<usize, u64> = low;
            for (order, count) in high {
                *merged.entry(order + 1).or_insert(0) += count;
            }
            merged
        };
        cache.insert(f, result.clone());
        result
    }

    pub(crate) fn alloc_node(&mut self, node: ZbddNode) -> ZbddRef {
        if self.gc_on {
            if let Some(idx) = self.free_list.pop() {
                self.nodes[idx as usize] = node;
                self.refcounts[idx as usize] = 0;
                self.minimal[idx as usize] = false;
                return ZbddRef(idx);
            }
        }
        let idx = self.nodes.len() as u32;
        self.nodes.push(node);
        self.refcounts.push(0);
        self.generations.push(0);
        self.minimal.push(false);
        self.maxprobs.push(0.0);
        self.maxprob_stamp.push(0);
        ZbddRef(idx)
    }

    pub(crate) fn protect(&mut self, f: ZbddRef) {
        if self.gc_on && !f.is_terminal() {
            self.refcounts[f.index()] += 1;
        }
    }

    pub(crate) fn deref(&mut self, f: ZbddRef) {
        if !self.gc_on || f.is_terminal() {
            return;
        }
        let i = f.index();
        debug_assert!(self.refcounts[i] > 0, "zbdd deref underflow at slot {i}");
        self.refcounts[i] -= 1;
        if self.refcounts[i] == 0 {
            self.free_node(f);
        }
    }

    fn free_node(&mut self, f: ZbddRef) {
        let i = f.index();
        let node = self.nodes[i];
        self.unique.remove(&node);
        self.nodes[i] = ZBDD_SENTINEL;
        self.generations[i] = self.generations[i].wrapping_add(1);
        self.minimal[i] = false;
        self.free_list.push(i as u32);
        self.deref(node.high);
        self.deref(node.low);
    }

    fn is_minimal(&self, f: ZbddRef) -> bool {
        f.is_terminal() || self.minimal[f.index()]
    }

    fn set_minimal(&mut self, f: ZbddRef) {
        if !f.is_terminal() {
            self.minimal[f.index()] = true;
        }
    }

    fn is_dead(&self, f: ZbddRef) -> bool {
        !f.is_terminal() && self.nodes[f.index()].is_sentinel()
    }

    fn computed_idx(&self, op: u8, a: u32, b: u32) -> usize {
        let mut h = (a as u64) | ((b as u64) << 32);
        h ^= (op as u64).wrapping_shl(56);
        h = h.wrapping_mul(0xD6E8FEB86659FD93);
        h ^= h >> 32;
        (h as usize) & self.computed_mask
    }

    fn computed_get(&mut self, op: u8, a: ZbddRef, b: u32) -> Option<ZbddRef> {
        let idx = self.computed_idx(op, a.raw(), b);
        let e = self.computed[idx];
        if e.used && e.op == op && e.a == a.raw() && e.b == b {
            let r = ZbddRef(e.result);
            self.protect(r);
            Some(r)
        } else {
            None
        }
    }

    fn computed_put(&mut self, op: u8, a: ZbddRef, b: u32, b_is_node: bool, result: ZbddRef) {
        let idx = self.computed_idx(op, a.raw(), b);
        let target = idx;
        let old = self.computed[target];
        if old.used {
            self.deref(ZbddRef(old.a));
            if old.b_is_node {
                self.deref(ZbddRef(old.b));
            }
            self.deref(ZbddRef(old.result));
        }
        self.protect(a);
        if b_is_node {
            self.protect(ZbddRef(b));
        }
        self.protect(result);
        self.computed[target] = ComputedEntry {
            op,
            used: true,
            b_is_node,
            a: a.raw(),
            b,
            result: result.raw(),
        };
    }

    pub(crate) fn unique_get(&self, node: &ZbddNode) -> Option<ZbddRef> {
        self.unique.get(node)
    }

    pub(crate) fn unique_insert(&mut self, node: ZbddNode, r: ZbddRef) {
        self.unique.insert(node, r);
    }

    pub(crate) fn union_cache_get(&self, key: (ZbddRef, ZbddRef)) -> Option<ZbddRef> {
        self.union_cache.get(&key).copied()
    }

    pub(crate) fn union_cache_insert(&mut self, key: (ZbddRef, ZbddRef), val: ZbddRef) {
        self.union_cache.insert(key, val);
    }

    pub(crate) fn subtract_cache_get(&self, key: (ZbddRef, ZbddRef)) -> Option<ZbddRef> {
        self.subtract_cache.get(&key).copied()
    }

    pub(crate) fn subtract_cache_insert(&mut self, key: (ZbddRef, ZbddRef), val: ZbddRef) {
        self.subtract_cache.insert(key, val);
    }

    pub(crate) fn convert_cache_get(&self, f: BddRef) -> Option<ZbddRef> {
        self.convert_cache.get(&f).copied()
    }

    pub(crate) fn convert_cache_insert(&mut self, f: BddRef, z: ZbddRef) {
        self.convert_cache.insert(f, z);
    }

    fn make_node(&mut self, var: usize, high: ZbddRef, low: ZbddRef) -> ZbddRef {
        if high.is_empty() {
            self.protect(low);
            return low;
        }
        let key = ZbddNode::new(var, high, low);
        if let Some(r) = self.unique_get(&key) {
            self.protect(r);
            return r;
        }
        let r = self.alloc_node(key);
        self.unique_insert(key, r);
        self.protect(high);
        self.protect(low);
        self.protect(r);
        trace!(
            target: "praxis::zbdd",
            op = "make_node",
            var,
            high = high.raw(),
            low = low.raw(),
            node = r.raw(),
            total = self.node_count(),
            "zbdd node populated"
        );
        r
    }

    pub(crate) fn union(&mut self, f: ZbddRef, g: ZbddRef) -> ZbddRef {        trace!(target: "praxis::zbdd", op = "union", f = f.raw(), g = g.raw(), "zbdd op");
        if f.is_empty() { self.protect(g); return g; }
        if g.is_empty() { self.protect(f); return f; }
        if f == g { self.protect(f); return f; }

        let (ka, kb) = if f < g { (f, g) } else { (g, f) };
        if self.use_computed {
            if let Some(r) = self.computed_get(OP_UNION, ka, kb.raw()) {
                return r;
            }
        } else if let Some(cached) = self.union_cache_get((ka, kb)) {
            self.protect(cached);
            return cached;
        }

        let f_var = self.var_of(f);
        let g_var = self.var_of(g);

        let result = if f_var == g_var {
            let f_hi = self.node(f).high;
            let f_lo = self.node(f).low;
            let g_hi = self.node(g).high;
            let g_lo = self.node(g).low;
            let hi = self.union(f_hi, g_hi);
            let lo = self.union(f_lo, g_lo);
            let r = self.make_node(f_var, hi, lo);
            self.deref(hi);
            self.deref(lo);
            r
        } else if f_var < g_var {
            let f_hi = self.node(f).high;
            let f_lo = self.node(f).low;
            let lo = self.union(f_lo, g);
            let r = self.make_node(f_var, f_hi, lo);
            self.deref(lo);
            r
        } else {
            let g_hi = self.node(g).high;
            let g_lo = self.node(g).low;
            let lo = self.union(f, g_lo);
            let r = self.make_node(g_var, g_hi, lo);
            self.deref(lo);
            r
        };

        if self.use_computed {
            self.computed_put(OP_UNION, ka, kb.raw(), true, result);
        } else {
            self.union_cache_insert((ka, kb), result);
        }
        result
    }

    pub(crate) fn multiply(&mut self, var: usize, f: ZbddRef) -> ZbddRef {
        trace!(target: "praxis::zbdd", op = "multiply", var, f = f.raw(), "zbdd op");
        self.make_node(var, f, ZBDD_EMPTY)
    }

    pub(crate) fn join(&mut self, f: ZbddRef, g: ZbddRef) -> ZbddRef {
        trace!(target: "praxis::zbdd", op = "join", f = f.raw(), g = g.raw(), "zbdd op");
        if f.is_empty() || g.is_empty() {
            return ZBDD_EMPTY;
        }
        if f.is_base() {
            self.protect(g);
            return g;
        }
        if g.is_base() {
            self.protect(f);
            return f;
        }
        let key = if f < g { (f, g) } else { (g, f) };
        if let Some(cached) = self.join_cache.get(&key).copied() {
            if self.is_dead(cached) {
                self.join_cache.remove(&key);
            } else {
                self.protect(cached);
                return cached;
            }
        }
        let fv = self.var_of(f);
        let gv = self.var_of(g);
        let result = if fv == gv {
            let f1 = self.node(f).high;
            let f0 = self.node(f).low;
            let g1 = self.node(g).high;
            let g0 = self.node(g).low;
            let j11 = self.join(f1, g1);
            let j10 = self.join(f1, g0);
            let j01 = self.join(f0, g1);
            let a = self.union(j11, j10);
            let hi = self.union(a, j01);
            let lo = self.join(f0, g0);
            let r = self.make_node(fv, hi, lo);
            self.deref(j11);
            self.deref(j10);
            self.deref(j01);
            self.deref(a);
            self.deref(hi);
            self.deref(lo);
            r
        } else if fv < gv {
            let f1 = self.node(f).high;
            let f0 = self.node(f).low;
            let hi = self.join(f1, g);
            let lo = self.join(f0, g);
            let r = self.make_node(fv, hi, lo);
            self.deref(hi);
            self.deref(lo);
            r
        } else {
            let g1 = self.node(g).high;
            let g0 = self.node(g).low;
            let hi = self.join(f, g1);
            let lo = self.join(f, g0);
            let r = self.make_node(gv, hi, lo);
            self.deref(hi);
            self.deref(lo);
            r
        };
        self.join_cache.insert(key, result);
        result
    }

    pub(crate) fn join_budgeted(&mut self, f: ZbddRef, g: ZbddRef, min_prob: f64) -> ZbddRef {
        self.ensure_maxprob(f);
        self.ensure_maxprob(g);
        let persistent = self.join_bcache.is_some();
        let mut cache = self.join_bcache.take().unwrap_or_else(JoinCache::new);
        let result = self.join_budgeted_rec(f, g, 1.0, min_prob, &mut cache);
        if persistent {
            self.join_bcache = Some(cache);
        } else if self.gc_on {
            for i in 0..cache.slots.len() {
                let e = cache.slots[i];
                if e.used {
                    self.deref(ZbddRef(e.result));
                }
            }
        }
        result
    }

    fn join_budgeted_rec(
        &mut self,
        f: ZbddRef,
        g: ZbddRef,
        p_acc: f64,
        min_prob: f64,
        cache: &mut JoinCache,
    ) -> ZbddRef {
        if f.is_empty() || g.is_empty() {
            return ZBDD_EMPTY;
        }
        let mf = if f.is_base() { 1.0 } else { self.maxprobs[f.index()] };
        let mg = if g.is_base() { 1.0 } else { self.maxprobs[g.index()] };
        if p_acc * mf.min(mg) < min_prob {
            return ZBDD_EMPTY;
        }
        if f.is_base() && g.is_base() {
            return if p_acc >= min_prob { ZBDD_BASE } else { ZBDD_EMPTY };
        }
        if let Some(r) = cache.get(f.raw(), g.raw(), min_prob / p_acc, min_prob) {
            let r = ZbddRef(r);
            self.protect(r);
            return r;
        }
        let fv = self.var_of(f);
        let gv = self.var_of(g);
        let v = fv.min(gv);
        let p_v = self.var_probs[v];
        let (f1, f0) = if fv == v {
            (self.node(f).high, self.node(f).low)
        } else {
            (ZBDD_EMPTY, f)
        };
        let (g1, g0) = if gv == v {
            (self.node(g).high, self.node(g).low)
        } else {
            (ZBDD_EMPTY, g)
        };
        let p_hi = p_acc * p_v;
        let j11 = self.join_budgeted_rec(f1, g1, p_hi, min_prob, cache);
        let j10 = self.join_budgeted_rec(f1, g0, p_hi, min_prob, cache);
        let j01 = self.join_budgeted_rec(f0, g1, p_hi, min_prob, cache);
        let a = self.union(j11, j10);
        let hi = self.union(a, j01);
        let lo = self.join_budgeted_rec(f0, g0, p_acc, min_prob, cache);
        // Part A: minimal-by-construction. Only worthwhile under GC, where the raw
        // superset spine is reclaimed; in GC-off nothing is freed so it only adds
        // interned nodes. With the minimal bit, re-minimizing is O(1).
        let raw = self.make_node(v, hi, lo);
        let result = if self.gc_on {
            let m = self.minimize(raw);
            self.deref(raw);
            m
        } else {
            raw
        };
        self.deref(j11);
        self.deref(j10);
        self.deref(j01);
        self.deref(a);
        self.deref(hi);
        self.deref(lo);
        self.protect(result);
        cache.insert(f.raw(), g.raw(), min_prob / p_acc, min_prob, result.raw());
        result
    }

    pub(crate) fn difference(&mut self, f: ZbddRef, g: ZbddRef) -> ZbddRef {        trace!(target: "praxis::zbdd", op = "difference", f = f.raw(), g = g.raw(), "zbdd op");
        if f.is_empty() {
            return ZBDD_EMPTY;
        }
        if g.is_empty() {
            self.protect(f);
            return f;
        }
        if f == g {
            return ZBDD_EMPTY;
        }
        let key = (f, g);
        if let Some(r) = self.difference_cache.get(&key).copied() {
            if self.is_dead(r) {
                self.difference_cache.remove(&key);
            } else {
                self.protect(r);
                return r;
            }
        }
        let fv = self.var_of(f);
        let gv = self.var_of(g);
        let result = if fv < gv {
            let f_hi = self.node(f).high;
            let f_lo = self.node(f).low;
            let lo = self.difference(f_lo, g);
            let r = self.make_node(fv, f_hi, lo);
            self.deref(lo);
            r
        } else if fv > gv {
            let g_lo = self.node(g).low;
            self.difference(f, g_lo)
        } else {
            let f_hi = self.node(f).high;
            let f_lo = self.node(f).low;
            let g_hi = self.node(g).high;
            let g_lo = self.node(g).low;
            let hi = self.difference(f_hi, g_hi);
            let lo = self.difference(f_lo, g_lo);
            let r = self.make_node(fv, hi, lo);
            self.deref(hi);
            self.deref(lo);
            r
        };
        self.difference_cache.insert(key, result);
        result
    }

    pub(crate) fn nonsuperset(&mut self, f: ZbddRef, g: ZbddRef) -> ZbddRef {        trace!(target: "praxis::zbdd", op = "subsume(nonsuperset)", f = f.raw(), g = g.raw(), "zbdd op: remove from f every set that is a superset of some set in g");
        if g.is_empty() { self.protect(f); return f; }
        if g.is_base() { return ZBDD_EMPTY; }
        if f.is_empty() { return ZBDD_EMPTY; }

        if self.use_computed {
            if let Some(r) = self.computed_get(OP_SUBTRACT, f, g.raw()) {
                return r;
            }
        } else if let Some(cached) = self.subtract_cache_get((f, g)) {
            self.protect(cached);
            return cached;
        }

        let f_var = self.var_of(f);
        let g_var = self.var_of(g);

        let result = if f_var == g_var {
            let f_hi = self.node(f).high;
            let f_lo = self.node(f).low;
            let g_hi = self.node(g).high;
            let g_lo = self.node(g).low;
            let g_union = self.union(g_hi, g_lo);
            let hi = self.nonsuperset(f_hi, g_union);
            let lo = self.nonsuperset(f_lo, g_lo);
            let r = self.make_node(f_var, hi, lo);
            self.deref(g_union);
            self.deref(hi);
            self.deref(lo);
            r
        } else if f_var < g_var {
            let f_hi = self.node(f).high;
            let f_lo = self.node(f).low;
            let hi = self.nonsuperset(f_hi, g);
            let lo = self.nonsuperset(f_lo, g);
            let r = self.make_node(f_var, hi, lo);
            self.deref(hi);
            self.deref(lo);
            r
        } else {
            let g_lo = self.node(g).low;
            self.nonsuperset(f, g_lo)
        };

        if self.use_computed {
            self.computed_put(OP_SUBTRACT, f, g.raw(), true, result);
        } else {
            self.subtract_cache_insert((f, g), result);
        }
        result
    }

    pub(crate) fn minimize(&mut self, f: ZbddRef) -> ZbddRef {
        // Part A: O(1) short-circuit when f is already known minimal.
        if self.is_minimal(f) {
            self.protect(f);
            return f;
        }
        // GC-on uses the bounded ref-holding computed cache (protect the wall);
        // GC-off uses the guaranteed non-evicting minimize memo.
        if self.gc_on {
            if let Some(r) = self.computed_get(OP_MINIMIZE, f, 0) {
                return r;
            }
        } else if let Some(&cached) = self.minimize_memo.get(&f) {
            self.protect(cached);
            return cached;
        }

        let hi = self.node(f).high;
        let lo = self.node(f).low;
        let var = self.node(f).var;

        let lo_min = self.minimize(lo);
        let hi_min = self.minimize(hi);
        let hi_pruned = self.nonsuperset(hi_min, lo_min);
        let result = self.make_node(var, hi_pruned, lo_min);
        self.deref(lo_min);
        self.deref(hi_min);
        self.deref(hi_pruned);
        self.set_minimal(result);

        if self.gc_on {
            self.computed_put(OP_MINIMIZE, f, 0, false, result);
        } else {
            self.minimize_memo.insert(f, result);
        }
        result
    }

    pub(crate) fn purify(&mut self, f: ZbddRef) -> ZbddRef {        trace!(target: "praxis::zbdd", op = "purify", f = f.raw(), "zbdd op");
        if f.is_terminal() {
            return f;
        }
        if self.use_computed {
            if let Some(r) = self.computed_get(OP_PURIFY, f, 0) {
                return r;
            }
        } else if let Some(&r) = self.purify_cache.get(&f) {
            self.protect(r);
            return r;
        }
        let var = self.var_of(f);
        let hi = self.node(f).high;
        let lo = self.node(f).low;
        let hi_p = self.purify(hi);
        let lo_p = self.purify(lo);
        let hi_p = if var.is_multiple_of(2) {
            let hp = self.remove_var(hi_p, var + 1);
            self.deref(hi_p);
            hp
        } else {
            hi_p
        };
        let result = self.make_node(var, hi_p, lo_p);
        self.deref(hi_p);
        self.deref(lo_p);
        if self.use_computed {
            self.computed_put(OP_PURIFY, f, 0, false, result);
        } else {
            self.purify_cache.insert(f, result);
        }
        result
    }

    pub(crate) fn remove_var(&mut self, f: ZbddRef, w: usize) -> ZbddRef {        if f.is_terminal() {
            return f;
        }
        let var = self.var_of(f);
        if var == w {
            let low = self.node(f).low;
            self.protect(low);
            return low;
        }
        if var > w {
            self.protect(f);
            return f;
        }
        if self.use_computed {
            if let Some(r) = self.computed_get(OP_REMOVEVAR, f, w as u32) {
                return r;
            }
        } else if let Some(&r) = self.removevar_cache.get(&(f, w)) {
            self.protect(r);
            return r;
        }
        let hi = self.node(f).high;
        let lo = self.node(f).low;
        let hi_r = self.remove_var(hi, w);
        let lo_r = self.remove_var(lo, w);
        let result = self.make_node(var, hi_r, lo_r);
        self.deref(hi_r);
        self.deref(lo_r);
        if self.use_computed {
            self.computed_put(OP_REMOVEVAR, f, w as u32, false, result);
        } else {
            self.removevar_cache.insert((f, w), result);
        }
        result
    }

    pub(crate) fn project_out_set(
        &mut self,
        f: ZbddRef,
        flags: &std::collections::HashSet<usize>,
        cache: &mut HashMap<ZbddRef, ZbddRef>,
    ) -> ZbddRef {
        if f.is_terminal() {
            return f;
        }
        if let Some(&r) = cache.get(&f) {
            if self.is_dead(r) {
                cache.remove(&f);
            } else {
                self.protect(r);
                return r;
            }
        }
        let ZbddNode { var, high: hi, low: lo } = *self.node(f);
        let hi_r = self.project_out_set(hi, flags, cache);
        let lo_r = self.project_out_set(lo, flags, cache);
        let result = if flags.contains(&var) {
            self.union(hi_r, lo_r)
        } else {
            self.make_node(var, hi_r, lo_r)
        };
        self.deref(hi_r);
        self.deref(lo_r);
        cache.insert(f, result);
        result
    }

    fn convert_bdd_inner(&mut self, bdd: &Bdd, f: BddRef) -> ZbddRef {
        if f.is_false() { return ZBDD_EMPTY; }
        if f.is_true() { return ZBDD_BASE; }

        if let Some(cached) = self.convert_cache_get(f) {
            return cached;
        }

        let var = bdd.var_of(f);
        let node = bdd.node(f);
        let (cofactor_hi, cofactor_lo) = if f.is_complement() {
            (node.high.complement(), node.low.complement())
        } else {
            (node.high, node.low)
        };

        let hi_z = self.convert_bdd_inner(bdd, cofactor_hi);
        let lo_z = self.convert_bdd_inner(bdd, cofactor_lo);

        let with_var = self.multiply(var, hi_z);
        let result = self.union(with_var, lo_z);

        self.convert_cache_insert(f, result);
        result
    }

    pub fn build_from_bdd(bdd: &Bdd, root: BddRef, coherent: bool) -> (ZbddEngine, ZbddRef) {
        let mut z = ZbddEngine::new();
        z.var_probs = bdd.var_probs().to_vec();
        let raw = z.convert_bdd_inner(bdd, root);
        let result = if coherent { raw } else { z.minimize(raw) };
        (z, result)
    }

    /// Build a truncated ZBDD from a BDD. `scale` multiplies every product's
    /// value, so a product survives when `scale * prod(var_probs) >= cut_off`.
    /// Pass an initiating-event frequency to truncate an event-tree sequence on
    /// product frequency, or 1.0 to truncate on product probability.
    pub fn build_from_bdd_with_limits(
        bdd: &Bdd,
        root: BddRef,
        coherent: bool,
        limit_order: Option<usize>,
        cut_off: Option<f64>,
        scale: f64,
    ) -> (ZbddEngine, ZbddRef) {
        let mut z = ZbddEngine::new();
        z.var_probs = bdd.var_probs().to_vec();
        z.scale = scale;
        let min_value = cut_off.unwrap_or(0.0);
        let mut maxp: HashMap<BddRef, f64> = HashMap::new();
        let mut cache: HashMap<(BddRef, Option<usize>), (f64, ZbddRef)> = HashMap::new();
        let raw =
            z.convert_bdd_limited(bdd, root, limit_order, scale, min_value, &mut maxp, &mut cache);
        let result = if coherent { raw } else { z.minimize(raw) };
        let result = if min_value > 0.0 {
            z.prune_below_probability(result, min_value)
        } else {
            result
        };
        (z, result)
    }

    /// Build a truncated ZBDD from a BDD and apply the delete-term rule against
    /// the systems the sequence succeeded: a product that contains a cut set of a
    /// succeeded system would also fail it, so it is not a product of the sequence
    /// and is removed. `delete_roots` are the BDD roots of those systems, built in
    /// the same manager so that they share this engine's variables.
    ///
    /// Truncating the deleting families at the same cut-off is exact, not a
    /// shortcut: a cut set covered by a product is a subset of it, so it is at
    /// least as probable, and therefore survives whenever the product it would
    /// delete survives.
    pub fn build_from_bdd_with_delete_terms(
        bdd: &Bdd,
        root: BddRef,
        delete_roots: &[BddRef],
        coherent: bool,
        limit_order: Option<usize>,
        cut_off: Option<f64>,
        scale: f64,
    ) -> (ZbddEngine, ZbddRef) {
        let mut z = ZbddEngine::new();
        z.var_probs = bdd.var_probs().to_vec();
        z.scale = scale;
        let min_value = cut_off.unwrap_or(0.0);
        let mut maxp: HashMap<BddRef, f64> = HashMap::new();
        let mut cache: HashMap<(BddRef, Option<usize>), (f64, ZbddRef)> = HashMap::new();

        let raw = z.convert_bdd_limited(bdd, root, limit_order, scale, min_value, &mut maxp, &mut cache);
        let mut result = if coherent { raw } else { z.minimize(raw) };

        for &delete_root in delete_roots {
            let raw_delete = z.convert_bdd_limited(
                bdd,
                delete_root,
                limit_order,
                scale,
                min_value,
                &mut maxp,
                &mut cache,
            );
            let delete = z.minimize(raw_delete);
            result = z.nonsuperset(result, delete);
        }

        let result = if min_value > 0.0 {
            z.prune_below_probability(result, min_value)
        } else {
            result
        };
        (z, result)
    }

    fn bdd_max_path_prob(&self, bdd: &Bdd, f: BddRef, memo: &mut HashMap<BddRef, f64>) -> f64 {
        if f.is_false() {
            return 0.0;
        }
        if f.is_true() {
            return 1.0;
        }
        if let Some(&m) = memo.get(&f) {
            return m;
        }
        let var = bdd.var_of(f);
        let node = bdd.node(f);
        let (cofactor_hi, cofactor_lo) = if f.is_complement() {
            (node.high.complement(), node.low.complement())
        } else {
            (node.high, node.low)
        };
        let ph = self.var_probs[var] * self.bdd_max_path_prob(bdd, cofactor_hi, memo);
        let pl = self.bdd_max_path_prob(bdd, cofactor_lo, memo);
        let r = ph.max(pl);
        memo.insert(f, r);
        r
    }

    /// `p_acc` is the value accumulated along the current path: the scale (an
    /// initiating-event frequency, or 1.0) times the probabilities of the
    /// variables taken so far. It is compared against `min_value` directly, so
    /// a frequency cut-off needs no rescaling.
    fn convert_bdd_limited(
        &mut self,
        bdd: &Bdd,
        f: BddRef,
        budget: Option<usize>,
        p_acc: f64,
        min_value: f64,
        maxp: &mut HashMap<BddRef, f64>,
        cache: &mut HashMap<(BddRef, Option<usize>), (f64, ZbddRef)>,
    ) -> ZbddRef {
        if f.is_false() {
            return ZBDD_EMPTY;
        }
        if f.is_true() {
            return if p_acc >= min_value { ZBDD_BASE } else { ZBDD_EMPTY };
        }
        if min_value > 0.0 {
            let bound = self.bdd_max_path_prob(bdd, f, maxp);
            if p_acc * bound < min_value {
                return ZBDD_EMPTY;
            }
        }
        let key = (f, budget);
        if let Some(&(stored_p, r)) = cache.get(&key) {
            if min_value == 0.0 || p_acc <= stored_p {
                return r;
            }
        }
        let var = bdd.var_of(f);
        let node = bdd.node(f);
        let (cofactor_hi, cofactor_lo) = if f.is_complement() {
            (node.high.complement(), node.low.complement())
        } else {
            (node.high, node.low)
        };
        let p_var = self.var_probs[var];
        let hi_z = if budget == Some(0) {
            ZBDD_EMPTY
        } else {
            let new_budget = budget.map(|b| b - 1);
            self.convert_bdd_limited(
                bdd,
                cofactor_hi,
                new_budget,
                p_acc * p_var,
                min_value,
                maxp,
                cache,
            )
        };
        let lo_z = self.convert_bdd_limited(bdd, cofactor_lo, budget, p_acc, min_value, maxp, cache);
        let with_var = self.multiply(var, hi_z);
        let result = self.union(with_var, lo_z);
        cache.insert(key, (p_acc, result));
        result
    }

    pub fn stats_by_order(&self, root: ZbddRef) -> HashMap<usize, (u64, f64, f64)> {
        let mut cache: HashMap<ZbddRef, HashMap<usize, (u64, f64, f64)>> = HashMap::new();
        self.stats_by_order_rec(root, &mut cache)
    }

    fn stats_by_order_rec(
        &self,
        f: ZbddRef,
        cache: &mut HashMap<ZbddRef, HashMap<usize, (u64, f64, f64)>>,
    ) -> HashMap<usize, (u64, f64, f64)> {
        if let Some(cached) = cache.get(&f) {
            return cached.clone();
        }
        let result = if f.is_empty() {
            HashMap::new()
        } else if f.is_base() {
            let mut m = HashMap::new();
            m.insert(0usize, (1u64, 1.0f64, 1.0f64));
            m
        } else {
            let node = self.node(f);
            let p_var = self.var_probs[node.var];
            let high_stats = self.stats_by_order_rec(node.high, cache);
            let low_stats = self.stats_by_order_rec(node.low, cache);
            let mut merged = low_stats;
            for (order, (count, min_p, max_p)) in high_stats {
                let e = merged
                    .entry(order + 1)
                    .or_insert((0, f64::INFINITY, f64::NEG_INFINITY));
                e.0 += count;
                let scaled_min = min_p * p_var;
                let scaled_max = max_p * p_var;
                if scaled_min < e.1 {
                    e.1 = scaled_min;
                }
                if scaled_max > e.2 {
                    e.2 = scaled_max;
                }
            }
            merged
        };
        cache.insert(f, result.clone());
        result
    }

    pub fn set_var_probs(&mut self, probs: Vec<f64>) {
        self.var_probs = probs;
        self.maxprob_epoch += 1;
    }

    /// Set the constant factor folded into every product's value: an
    /// initiating-event frequency for an event-tree sequence, or 1.0 for a
    /// plain fault tree. Only truncation reads it; the per-node maximum path
    /// probabilities are unscaled, so no cache invalidation is needed.
    pub fn set_scale(&mut self, scale: f64) {
        self.scale = scale;
    }

    pub fn rare_event_probability(&self, root: ZbddRef) -> f64 {
        let mut cache = HashMap::new();
        self.re_inner(root, &mut cache)
    }

    fn re_inner(&self, f: ZbddRef, cache: &mut HashMap<u32, f64>) -> f64 {
        if f.is_empty() { return 0.0; }
        if f.is_base() { return 1.0; }
        let key = f.raw();
        if let Some(&p) = cache.get(&key) { return p; }
        let node = self.node(f);
        let p_var = self.var_probs[node.var];
        let p_hi = self.re_inner(node.high, cache);
        let p_lo = self.re_inner(node.low, cache);
        let p = p_var * p_hi + p_lo;
        cache.insert(key, p);
        p
    }

    pub fn min_cut_upper_bound(&self, root: ZbddRef) -> f64 {
        let sets = self.enumerate(root);
        let cp = sets.iter().fold(1.0_f64, |acc, set| {
            let q: f64 = set.iter().map(|&v| self.var_probs[v]).product();
            acc * (1.0 - q)
        });
        1.0 - cp
    }

    pub fn limit_order(&mut self, f: ZbddRef, max_order: usize) -> ZbddRef {
        let mut cache: HashMap<(ZbddRef, usize), ZbddRef> = HashMap::new();
        self.limit_order_rec(f, max_order, &mut cache)
    }

    fn limit_order_rec(
        &mut self,
        f: ZbddRef,
        budget: usize,
        cache: &mut HashMap<(ZbddRef, usize), ZbddRef>,
    ) -> ZbddRef {
        if f.is_empty() {
            return ZBDD_EMPTY;
        }
        if f.is_base() {
            return ZBDD_BASE;
        }
        let key = (f, budget);
        if let Some(&r) = cache.get(&key) {
            if self.is_dead(r) {
                cache.remove(&key);
            } else {
                self.protect(r);
                return r;
            }
        }
        let ZbddNode { var, high: hi, low: lo } = *self.node(f);
        let result = if budget == 0 {
            self.limit_order_rec(lo, 0, cache)
        } else {
            let hi_r = self.limit_order_rec(hi, budget - 1, cache);
            let lo_r = self.limit_order_rec(lo, budget, cache);
            let r = self.make_node(var, hi_r, lo_r);
            self.deref(hi_r);
            self.deref(lo_r);
            r
        };
        cache.insert(key, result);
        result
    }

    /// Drop every product whose value falls below `min_value`. The value is
    /// `scale * prod(var_probs)`, so with a scale of 1.0 this is a probability
    /// cut-off and with an initiating-event frequency it is a frequency cut-off.
    pub fn prune_below_probability(&mut self, f: ZbddRef, min_value: f64) -> ZbddRef {
        self.ensure_maxprob(f);
        let mut cache: HashMap<(ZbddRef, u64), ZbddRef> = HashMap::new();
        let start = self.scale;
        let result = self.prune_below_rec(f, start, min_value, &mut cache);
        if self.gc_on {
            for &v in cache.values() {
                self.deref(v);
            }
        }
        result
    }

    fn ensure_maxprob(&mut self, f: ZbddRef) -> f64 {        if f.is_empty() {
            return 0.0;
        }
        if f.is_base() {
            return 1.0;
        }
        let i = f.index();
        let stamp = (self.maxprob_epoch << 32) | (self.generations[i] as u64);
        if self.maxprob_stamp[i] == stamp {
            return self.maxprobs[i];
        }
        let ZbddNode { var, high, low } = *self.node(f);
        let ph = self.var_probs[var] * self.ensure_maxprob(high);
        let pl = self.ensure_maxprob(low);
        let r = ph.max(pl);
        self.maxprobs[i] = r;
        self.maxprob_stamp[i] = stamp;
        r
    }

    fn prune_below_rec(
        &mut self,
        f: ZbddRef,
        p_acc: f64,
        min_prob: f64,
        cache: &mut HashMap<(ZbddRef, u64), ZbddRef>,
    ) -> ZbddRef {        if f.is_empty() {
            return ZBDD_EMPTY;
        }
        let fmax = if f.is_base() { 1.0 } else { self.maxprobs[f.index()] };
        if p_acc * fmax < min_prob {
            return ZBDD_EMPTY;
        }
        if f.is_base() {
            return ZBDD_BASE;
        }
        let key = (f, p_acc.to_bits());
        if let Some(&r) = cache.get(&key) {
            self.protect(r);
            return r;
        }
        let ZbddNode { var, high: hi, low: lo } = *self.node(f);
        let p_var = self.var_probs[var];
        let hi_r = self.prune_below_rec(hi, p_acc * p_var, min_prob, cache);
        let lo_r = self.prune_below_rec(lo, p_acc, min_prob, cache);
        let result = self.make_node(var, hi_r, lo_r);
        self.deref(hi_r);
        self.deref(lo_r);
        self.protect(result);
        cache.insert(key, result);
        result
    }

    pub fn min_cut_upper_bound_graph(&self, root: ZbddRef) -> f64 {
        let mut cache: HashMap<(u32, u64), f64> = HashMap::new();
        1.0 - self.mcub_factor(root, 1.0, &mut cache)
    }

    fn mcub_factor(
        &self,
        f: ZbddRef,
        p_acc: f64,
        cache: &mut HashMap<(u32, u64), f64>,
    ) -> f64 {
        if f.is_empty() {
            return 1.0;
        }
        if f.is_base() {
            return 1.0 - p_acc;
        }
        let key = (f.raw(), p_acc.to_bits());
        if let Some(&v) = cache.get(&key) {
            return v;
        }
        let node = self.node(f);
        let p_var = self.var_probs[node.var];
        let hi = self.mcub_factor(node.high, p_acc * p_var, cache);
        let lo = self.mcub_factor(node.low, p_acc, cache);
        let result = hi * lo;
        cache.insert(key, result);
        result
    }
}

impl Default for ZbddEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::algorithms::bdd_engine::{BddRef, BDD_FALSE, BDD_TRUE};
    use crate::algorithms::pdag::Pdag;
    use crate::analysis::width::compute_dfs_metadata_pdag;
    use crate::core::event::BasicEvent;
    use crate::core::fault_tree::FaultTree;
    use crate::core::gate::{Formula, Gate};

    fn x0_zbdd() -> (ZbddEngine, ZbddRef) {
        let mut z = ZbddEngine::new();
        let r = z.multiply(0, ZBDD_BASE);
        (z, r)
    }

    fn build_bdd(ft: &FaultTree) -> (Bdd, BddRef) {
        let pdag = Pdag::from_fault_tree(ft).unwrap();
        let meta = compute_dfs_metadata_pdag(&pdag).unwrap();
        let var_probs = pdag.level_var_probs(ft, &meta.var_of).unwrap();
        Bdd::from_pdag_with_order_and_probs(&pdag, &meta.var_of, var_probs).unwrap()
    }

    fn two_var_ft(conn: Formula, p0: f64, p1: f64) -> FaultTree {
        let mut ft = FaultTree::new("FT", "G").unwrap();
        let mut g = Gate::new("G".to_string(), conn).unwrap();
        g.add_operand("E1".to_string());
        g.add_operand("E2".to_string());
        ft.add_gate(g).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), p0).unwrap())
            .unwrap();
        ft.add_basic_event(BasicEvent::new("E2".to_string(), p1).unwrap())
            .unwrap();
        ft
    }

    fn single_var_ft(p: f64) -> FaultTree {
        let mut ft = FaultTree::new("FT", "G").unwrap();
        let mut g = Gate::new("G".to_string(), Formula::Or).unwrap();
        g.add_operand("E1".to_string());
        ft.add_gate(g).unwrap();
        ft.add_basic_event(BasicEvent::new("E1".to_string(), p).unwrap())
            .unwrap();
        ft
    }

    #[test]
    fn test_zbdd_empty_is_terminal() {
        assert!(ZBDD_EMPTY.is_terminal());
        assert!(ZBDD_EMPTY.is_empty());
        assert!(!ZBDD_EMPTY.is_base());
    }

    #[test]
    fn test_zbdd_base_is_terminal() {
        assert!(ZBDD_BASE.is_terminal());
        assert!(ZBDD_BASE.is_base());
        assert!(!ZBDD_BASE.is_empty());
    }

    #[test]
    fn test_zbdd_ref_non_terminal() {
        assert!(!ZbddRef(2).is_terminal());
        assert!(!ZbddRef(2).is_empty());
        assert!(!ZbddRef(2).is_base());
    }

    #[test]
    fn test_zbdd_ref_index() {
        assert_eq!(ZbddRef(5).index(), 5);
    }

    #[test]
    fn test_zbddnode_equality() {
        let n1 = ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY);
        let n2 = ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY);
        assert_eq!(n1, n2);
    }

    #[test]
    fn test_zbddnode_different_fields_not_equal() {
        assert_ne!(
            ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY),
            ZbddNode::new(1, ZBDD_BASE, ZBDD_EMPTY)
        );
        assert_ne!(
            ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY),
            ZbddNode::new(0, ZBDD_EMPTY, ZBDD_BASE)
        );
    }

    #[test]
    fn test_zbdd_sentinel_is_sentinel() {
        assert!(ZBDD_SENTINEL.is_sentinel());
        assert!(!ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY).is_sentinel());
    }

    #[test]
    fn test_zbdd_engine_new_empty() {
        let z = ZbddEngine::new();
        assert_eq!(z.node_count(), 0);
    }

    #[test]
    fn test_zbdd_engine_static_terminal_helpers() {
        assert!(ZbddEngine::is_empty(ZBDD_EMPTY));
        assert!(ZbddEngine::is_base(ZBDD_BASE));
        assert!(ZbddEngine::is_terminal(ZBDD_EMPTY));
        assert!(ZbddEngine::is_terminal(ZBDD_BASE));
        assert!(!ZbddEngine::is_terminal(ZbddRef(2)));
    }

    #[test]
    fn test_zbdd_alloc_increments_count() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY));
        assert_eq!(z.node_count(), 1);
        assert!(!r.is_terminal());
    }

    #[test]
    fn test_zbdd_unique_table_roundtrip() {
        let mut z = ZbddEngine::new();
        let node = ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY);
        let r = z.alloc_node(node);
        z.unique_insert(node, r);
        assert_eq!(z.unique_get(&node), Some(r));
        assert_eq!(z.unique_get(&ZbddNode::new(1, ZBDD_BASE, ZBDD_EMPTY)), None);
    }

    #[test]
    fn test_zbdd_union_cache_roundtrip() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY));
        z.union_cache_insert((ZBDD_BASE, ZBDD_EMPTY), r);
        assert_eq!(z.union_cache_get((ZBDD_BASE, ZBDD_EMPTY)), Some(r));
        assert_eq!(z.union_cache_get((ZBDD_EMPTY, ZBDD_BASE)), None);
    }

    #[test]
    fn test_zbdd_subtract_cache_roundtrip() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY));
        z.subtract_cache_insert((r, ZBDD_BASE), ZBDD_EMPTY);
        assert_eq!(z.subtract_cache_get((r, ZBDD_BASE)), Some(ZBDD_EMPTY));
    }

    #[test]
    fn test_zbdd_convert_cache_roundtrip() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY));
        z.convert_cache_insert(BDD_TRUE, r);
        assert_eq!(z.convert_cache_get(BDD_TRUE), Some(r));
        assert_eq!(z.convert_cache_get(BDD_FALSE), None);
    }

    #[test]
    fn test_zbdd_clear_caches() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(0, ZBDD_BASE, ZBDD_EMPTY));
        z.union_cache_insert((ZBDD_BASE, ZBDD_EMPTY), r);
        z.convert_cache_insert(BDD_TRUE, r);
        z.clear_caches();
        assert!(z.union_cache_get((ZBDD_BASE, ZBDD_EMPTY)).is_none());
        assert!(z.convert_cache_get(BDD_TRUE).is_none());
    }

    #[test]
    fn test_zbdd_var_of_terminal() {
        let z = ZbddEngine::new();
        assert_eq!(z.var_of(ZBDD_EMPTY), usize::MAX);
        assert_eq!(z.var_of(ZBDD_BASE), usize::MAX);
    }

    #[test]
    fn test_zbdd_var_of_node() {
        let mut z = ZbddEngine::new();
        let r = z.alloc_node(ZbddNode::new(3, ZBDD_BASE, ZBDD_EMPTY));
        assert_eq!(z.var_of(r), 3);
    }

    #[test]
    fn test_make_node_zero_suppression() {
        let mut z = ZbddEngine::new();
        let result = z.make_node(0, ZBDD_EMPTY, ZBDD_BASE);
        assert_eq!(result, ZBDD_BASE);
        assert_eq!(z.node_count(), 0);
    }

    #[test]
    fn test_make_node_basic() {
        let mut z = ZbddEngine::new();
        let r = z.make_node(0, ZBDD_BASE, ZBDD_EMPTY);
        assert!(!r.is_terminal());
        assert_eq!(z.node(r).var, 0);
        assert_eq!(z.node(r).high, ZBDD_BASE);
        assert_eq!(z.node(r).low, ZBDD_EMPTY);
    }

    #[test]
    fn test_make_node_unique_table_dedup() {
        let mut z = ZbddEngine::new();
        let r1 = z.make_node(0, ZBDD_BASE, ZBDD_EMPTY);
        let r2 = z.make_node(0, ZBDD_BASE, ZBDD_EMPTY);
        assert_eq!(r1, r2);
        assert_eq!(z.node_count(), 1);
    }

    #[test]
    fn test_multiply_empty_input() {
        let mut z = ZbddEngine::new();
        assert_eq!(z.multiply(0, ZBDD_EMPTY), ZBDD_EMPTY);
    }

    #[test]
    fn test_multiply_base_input() {
        let mut z = ZbddEngine::new();
        let r = z.multiply(0, ZBDD_BASE);
        let sets = z.enumerate(r);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0], vec![0]);
    }

    #[test]
    fn join_combines_cut_sets() {
        let mut z = ZbddEngine::new();
        let a = z.multiply(0, ZBDD_BASE);
        let b = z.multiply(1, ZBDD_BASE);
        let ab = z.join(a, b);
        assert_eq!(z.enumerate(ab), vec![vec![0, 1]]);

        let a_or_b = z.union(a, b);
        let c = z.multiply(2, ZBDD_BASE);
        let joined = z.join(a_or_b, c);
        let mut got = z.enumerate(joined);
        got.iter_mut().for_each(|s| s.sort());
        got.sort();
        assert_eq!(got, vec![vec![0, 2], vec![1, 2]]);

        assert_eq!(z.join(ZBDD_BASE, a), a);
        assert_eq!(z.join(a, ZBDD_BASE), a);
        assert_eq!(z.join(ZBDD_EMPTY, a), ZBDD_EMPTY);
        assert_eq!(z.join(a, ZBDD_EMPTY), ZBDD_EMPTY);
    }

    #[test]
    fn purify_drops_contradictions() {
        let mut z = ZbddEngine::new();

        let pos0 = z.multiply(0, ZBDD_BASE);
        let neg0 = z.multiply(1, ZBDD_BASE);
        let contradiction = z.join(pos0, neg0);
        let pos1 = z.multiply(2, ZBDD_BASE);
        let valid = z.join(pos0, pos1);
        let mixed = z.union(contradiction, valid);
        let pure = z.purify(mixed);
        assert_eq!(z.enumerate(pure), vec![vec![0, 2]]);
    }

    #[test]
    fn test_union_empty_identity() {
        let (mut z, x0) = x0_zbdd();
        assert_eq!(z.union(ZBDD_EMPTY, x0), x0);
        assert_eq!(z.union(x0, ZBDD_EMPTY), x0);
    }

    #[test]
    fn test_union_idempotent() {
        let (mut z, x0) = x0_zbdd();
        assert_eq!(z.union(x0, x0), x0);
    }

    #[test]
    fn test_union_two_singletons() {
        let mut z = ZbddEngine::new();
        let x0 = z.multiply(0, ZBDD_BASE);
        let x1 = z.multiply(1, ZBDD_BASE);
        let u = z.union(x0, x1);
        let sets = z.enumerate(u);
        assert_eq!(sets.len(), 2);
        let has_x0 = sets.iter().any(|s| s == &[0]);
        let has_x1 = sets.iter().any(|s| s == &[1]);
        assert!(has_x0);
        assert!(has_x1);
    }

    #[test]
    fn test_nonsuperset_empty_g() {
        let (mut z, x0) = x0_zbdd();
        assert_eq!(z.nonsuperset(x0, ZBDD_EMPTY), x0);
    }

    #[test]
    fn test_nonsuperset_base_g() {
        let (mut z, x0) = x0_zbdd();
        assert_eq!(z.nonsuperset(x0, ZBDD_BASE), ZBDD_EMPTY);
    }

    #[test]
    fn test_nonsuperset_empty_f() {
        let (mut z, x0) = x0_zbdd();
        assert_eq!(z.nonsuperset(ZBDD_EMPTY, x0), ZBDD_EMPTY);
    }

    #[test]
    fn test_nonsuperset_removes_supersets() {
        let mut z = ZbddEngine::new();
        let x0 = z.multiply(0, ZBDD_BASE);
        let x0x1_inner = z.multiply(1, ZBDD_BASE);
        let x0x1 = z.multiply(0, x0x1_inner);
        let both = z.union(x0, x0x1);
        assert_eq!(z.enumerate(both).len(), 2);

        let result = z.nonsuperset(both, x0x1);
        let sets_after = z.enumerate(result);
        assert_eq!(sets_after.len(), 1);
        assert_eq!(sets_after[0], vec![0]);
    }

    #[test]
    fn test_minimize_terminal() {
        let mut z = ZbddEngine::new();
        assert_eq!(z.minimize(ZBDD_EMPTY), ZBDD_EMPTY);
        assert_eq!(z.minimize(ZBDD_BASE), ZBDD_BASE);
    }

    #[test]
    fn test_minimize_already_minimal() {
        let (mut z, x0) = x0_zbdd();
        let result = z.minimize(x0);
        let sets = z.enumerate(result);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0], vec![0]);
    }

    #[test]
    fn test_minimize_removes_nonminimal() {
        let mut z = ZbddEngine::new();
        let x0 = z.multiply(0, ZBDD_BASE);
        let x0x1_inner = z.multiply(1, ZBDD_BASE);
        let x0x1 = z.multiply(0, x0x1_inner);
        let both = z.union(x0, x0x1);

        let result = z.minimize(both);
        let sets = z.enumerate(result);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0], vec![0]);
    }

    #[test]
    fn test_convert_bdd_false() {
        let (zbdd, root) = ZbddEngine::build_from_bdd(&Bdd::new(), BDD_FALSE, true);
        assert_eq!(root, ZBDD_EMPTY);
        assert_eq!(zbdd.node_count(), 0);
    }

    #[test]
    fn test_convert_bdd_true() {
        let (_zbdd, root) = ZbddEngine::build_from_bdd(&Bdd::new(), BDD_TRUE, true);
        assert_eq!(root, ZBDD_BASE);
    }

    #[test]
    fn test_convert_bdd_single_var() {
        let (bdd, bdd_root) = build_bdd(&single_var_ft(0.1));
        let (z, root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        let sets = z.enumerate(root);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0], vec![0]);
    }

    #[test]
    fn test_convert_bdd_and_gate() {
        let (bdd, bdd_root) = build_bdd(&two_var_ft(Formula::And, 0.1, 0.2));

        let (z, zbdd_root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        let sets = z.enumerate(zbdd_root);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0].len(), 2);
    }

    #[test]
    fn test_convert_bdd_or_gate() {
        let (bdd, bdd_root) = build_bdd(&two_var_ft(Formula::Or, 0.1, 0.2));

        let (z, zbdd_root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        let sets = z.enumerate(zbdd_root);
        assert_eq!(sets.len(), 2);
        assert!(sets.iter().all(|s| s.len() == 1));
    }

    #[test]
    fn test_build_from_bdd_coherent_and_gate_end_to_end() {
        let (bdd, bdd_root) = build_bdd(&two_var_ft(Formula::And, 0.1, 0.2));

        let (z, zbdd_root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        let sets = z.enumerate(zbdd_root);
        assert_eq!(sets.len(), 1);
        assert_eq!(sets[0].len(), 2);
    }

    #[test]
    fn test_build_from_bdd_coherent_or_gate_end_to_end() {
        let (bdd, bdd_root) = build_bdd(&two_var_ft(Formula::Or, 0.1, 0.2));

        let (z, zbdd_root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        let sets = z.enumerate(zbdd_root);
        assert_eq!(sets.len(), 2);
        assert!(sets.iter().all(|s| s.len() == 1));
    }

    #[test]
    fn test_enumerate_empty() {
        let z = ZbddEngine::new();
        assert!(z.enumerate(ZBDD_EMPTY).is_empty());
    }

    #[test]
    fn test_enumerate_base() {
        let z = ZbddEngine::new();
        let sets = z.enumerate(ZBDD_BASE);
        assert_eq!(sets, vec![Vec::<usize>::new()]);
    }

    fn or_zbdd(p0: f64, p1: f64) -> (ZbddEngine, ZbddRef) {
        let (bdd, bdd_root) = build_bdd(&two_var_ft(Formula::Or, p0, p1));
        ZbddEngine::build_from_bdd(&bdd, bdd_root, true)
    }

    fn and_zbdd(p0: f64, p1: f64) -> (ZbddEngine, ZbddRef) {
        let (bdd, bdd_root) = build_bdd(&two_var_ft(Formula::And, p0, p1));
        ZbddEngine::build_from_bdd(&bdd, bdd_root, true)
    }

    #[test]
    fn test_rare_event_empty() {
        let z = ZbddEngine::new();
        assert!((z.rare_event_probability(ZBDD_EMPTY)).abs() < 1e-15);
    }

    #[test]
    fn test_rare_event_single_var() {
        let (bdd, bdd_root) = build_bdd(&single_var_ft(0.1));
        let (z, root) = ZbddEngine::build_from_bdd(&bdd, bdd_root, true);
        assert!((z.rare_event_probability(root) - 0.1).abs() < 1e-12);
    }

    #[test]
    fn test_rare_event_and_gate() {
        let (z, root) = and_zbdd(0.1, 0.2);
        assert!((z.rare_event_probability(root) - 0.02).abs() < 1e-12);
    }

    #[test]
    fn test_rare_event_or_gate() {
        let (z, root) = or_zbdd(0.1, 0.2);
        assert!((z.rare_event_probability(root) - 0.3).abs() < 1e-12);
    }

    #[test]
    fn test_mcub_empty() {
        let z = ZbddEngine::new();
        assert!((z.min_cut_upper_bound(ZBDD_EMPTY)).abs() < 1e-15);
    }

    #[test]
    fn test_mcub_and_gate() {
        let (z, root) = and_zbdd(0.1, 0.2);
        assert!((z.min_cut_upper_bound(root) - 0.02).abs() < 1e-12);
    }

    #[test]
    fn test_mcub_or_gate_matches_exact() {
        let (z, root) = or_zbdd(0.1, 0.2);
        let expected = 1.0 - (1.0 - 0.1) * (1.0 - 0.2);
        assert!((z.min_cut_upper_bound(root) - expected).abs() < 1e-12);
    }

    #[test]
    fn test_rare_event_exceeds_mcub_for_or_gate() {
        let (z, root) = or_zbdd(0.1, 0.2);
        let re = z.rare_event_probability(root);
        let mcub = z.min_cut_upper_bound(root);
        assert!(re > mcub);
    }
}
