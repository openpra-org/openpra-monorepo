//! PRAXIS Boolean Format (PBF): the compact, canonical binary interchange for
//! Boolean models. See plans/PRAXIS-Boolean-Format.md for the specification.
//!
//! This module implements the structural core of the format: a self-describing
//! header, a pool of distinct f64 probabilities, and a topologically ordered
//! node table over basic events, constants, and gates. Operands reference
//! earlier nodes by a position delta with a complement bit, and within a gate
//! they are sorted by referenced position so that one model yields exactly one
//! byte string. The full value model, the model-level structures, and the result
//! encoding are layered on top of this core in later stages.

use std::collections::{HashMap, HashSet};

use crate::algorithms::pdag::{Connective, NodeIndex, Pdag, PdagNode};
use crate::analysis::quantify::{
    Approximation, CutSetOut, CutSetsOut, ImportanceOut, ProbabilityOut, QuantResult,
    UncertaintyOut,
};
use crate::core::ccf::{CcfGroup, CcfModel, TestingScheme};
use crate::core::event::{BasicEvent, HouseEvent};
use crate::core::fault_tree::FaultTree;
use crate::core::gate::{Formula, Gate};
use crate::error::PraxisError;
use crate::expression::Expr;
use crate::Result;

pub const MAGIC: [u8; 4] = *b"PBF1";
pub const VERSION: u8 = 1;

// ----------------------------------------------------------------- primitives

fn put_uvarint(out: &mut Vec<u8>, mut v: u64) {
    loop {
        let byte = (v & 0x7f) as u8;
        v >>= 7;
        if v == 0 {
            out.push(byte);
            return;
        }
        out.push(byte | 0x80);
    }
}

struct Reader<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Reader { buf, pos: 0 }
    }

    fn truncated() -> PraxisError {
        PraxisError::Logic("PBF: unexpected end of input".to_string())
    }

    fn u8(&mut self) -> Result<u8> {
        let b = *self.buf.get(self.pos).ok_or_else(Self::truncated)?;
        self.pos += 1;
        Ok(b)
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8]> {
        let end = self.pos.checked_add(n).ok_or_else(Self::truncated)?;
        let slice = self.buf.get(self.pos..end).ok_or_else(Self::truncated)?;
        self.pos = end;
        Ok(slice)
    }

    fn uvarint(&mut self) -> Result<u64> {
        let mut v = 0u64;
        let mut shift = 0u32;
        loop {
            let byte = self.u8()?;
            if shift >= 64 {
                return Err(PraxisError::Logic("PBF: varint too long".to_string()));
            }
            v |= ((byte & 0x7f) as u64) << shift;
            if byte & 0x80 == 0 {
                return Ok(v);
            }
            shift += 7;
        }
    }

    fn f64(&mut self) -> Result<f64> {
        let mut arr = [0u8; 8];
        arr.copy_from_slice(self.take(8)?);
        Ok(f64::from_bits(u64::from_le_bytes(arr)))
    }

    fn string(&mut self) -> Result<String> {
        let len = self.uvarint()? as usize;
        let bytes = self.take(len)?;
        String::from_utf8(bytes.to_vec())
            .map_err(|_| PraxisError::Logic("PBF: invalid UTF-8 string".to_string()))
    }
}

fn op_to_nibble(c: Connective) -> u8 {
    match c {
        Connective::And => 0,
        Connective::Or => 1,
        Connective::Not => 2,
        Connective::AtLeast => 3,
        Connective::Xor => 4,
        Connective::Nand => 5,
        Connective::Nor => 6,
        Connective::Iff => 7,
        Connective::Null => 8,
    }
}

fn nibble_to_op(n: u8) -> Result<Connective> {
    Ok(match n {
        0 => Connective::And,
        1 => Connective::Or,
        2 => Connective::Not,
        3 => Connective::AtLeast,
        4 => Connective::Xor,
        5 => Connective::Nand,
        6 => Connective::Nor,
        7 => Connective::Iff,
        8 => Connective::Null,
        other => {
            return Err(PraxisError::Logic(format!(
                "PBF: unknown operator nibble {other}"
            )))
        }
    })
}

// ---------------------------------------------------------- in-memory structure

/// A reference to an earlier node, by its canonical position, with a complement
/// flag that is true when the reference is negated.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Ref {
    pub position: usize,
    pub complement: bool,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Node {
    BasicEvent {
        value: usize,
    },
    Constant {
        value: bool,
    },
    Gate {
        op: Connective,
        k: Option<usize>,
        operands: Vec<Ref>,
    },
}

/// The canonical structural core of a single-rooted Boolean model: a pool of
/// distinct probabilities and a topologically ordered node table.
#[derive(Clone, Debug, PartialEq)]
pub struct Structure {
    pub pool: Vec<f64>,
    pub nodes: Vec<Node>,
    pub root: Ref,
    pub global_complement: bool,
}

// --------------------------------------------------------------- encode/decode

/// Serialize a structure to its canonical PBF byte string.
pub fn encode(s: &Structure) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&MAGIC);
    out.push(VERSION);
    out.push(u8::from(s.global_complement));
    put_uvarint(&mut out, s.pool.len() as u64);
    for &value in &s.pool {
        out.extend_from_slice(&value.to_bits().to_le_bytes());
    }
    put_uvarint(&mut out, s.nodes.len() as u64);
    for (i, node) in s.nodes.iter().enumerate() {
        match node {
            Node::BasicEvent { value } => {
                out.push(0x00);
                put_uvarint(&mut out, *value as u64);
            }
            Node::Constant { value } => {
                out.push(0x20 | u8::from(*value));
            }
            Node::Gate { op, k, operands } => {
                out.push(0x10 | op_to_nibble(*op));
                if *op == Connective::AtLeast {
                    put_uvarint(&mut out, k.unwrap_or(1) as u64);
                }
                put_uvarint(&mut out, operands.len() as u64);
                for r in operands {
                    let delta = (i - r.position) as u64;
                    put_uvarint(&mut out, (delta << 1) | u64::from(r.complement));
                }
            }
        }
    }
    put_uvarint(
        &mut out,
        ((s.root.position as u64) << 1) | u64::from(s.root.complement),
    );
    out
}

/// Parse a structure from a PBF byte string.
pub fn decode(bytes: &[u8]) -> Result<Structure> {
    let mut r = Reader::new(bytes);
    if r.take(4)? != MAGIC {
        return Err(PraxisError::Logic("PBF: bad magic".to_string()));
    }
    let version = r.u8()?;
    if version != VERSION {
        return Err(PraxisError::Logic(format!(
            "PBF: unsupported version {version}"
        )));
    }
    let global_complement = r.u8()? & 1 == 1;
    let pool_len = r.uvarint()? as usize;
    let mut pool = Vec::with_capacity(pool_len);
    for _ in 0..pool_len {
        pool.push(r.f64()?);
    }
    let node_count = r.uvarint()? as usize;
    let mut nodes = Vec::with_capacity(node_count);
    for i in 0..node_count {
        let tag = r.u8()?;
        let node = match tag >> 4 {
            0 => Node::BasicEvent {
                value: r.uvarint()? as usize,
            },
            1 => {
                let op = nibble_to_op(tag & 0x0f)?;
                let k = if op == Connective::AtLeast {
                    Some(r.uvarint()? as usize)
                } else {
                    None
                };
                let count = r.uvarint()? as usize;
                let mut operands = Vec::with_capacity(count);
                for _ in 0..count {
                    let raw = r.uvarint()?;
                    let delta = (raw >> 1) as usize;
                    if delta == 0 || delta > i {
                        return Err(PraxisError::Logic(
                            "PBF: operand reference out of range".to_string(),
                        ));
                    }
                    operands.push(Ref {
                        position: i - delta,
                        complement: raw & 1 == 1,
                    });
                }
                Node::Gate { op, k, operands }
            }
            2 => Node::Constant {
                value: tag & 1 == 1,
            },
            other => {
                return Err(PraxisError::Logic(format!("PBF: unknown node kind {other}")))
            }
        };
        nodes.push(node);
    }
    let root_raw = r.uvarint()?;
    let root = Ref {
        position: (root_raw >> 1) as usize,
        complement: root_raw & 1 == 1,
    };
    if root.position >= nodes.len() {
        return Err(PraxisError::Logic("PBF: root out of range".to_string()));
    }
    Ok(Structure {
        pool,
        nodes,
        root,
        global_complement,
    })
}

// ------------------------------------------------------------------ PDAG bridge

/// Build the canonical structure from a PDAG, taking each basic event's
/// probability from `prob_of`. Nodes are renumbered into one topological order
/// (operands before parents) and each gate's operands are sorted by referenced
/// position, so the result is canonical.
pub fn structure_from_pdag<F>(pdag: &Pdag, prob_of: F) -> Result<Structure>
where
    F: Fn(&str) -> f64,
{
    let order = pdag.topological_sort()?;
    let mut pos: HashMap<NodeIndex, usize> = HashMap::new();
    for (i, &n) in order.iter().enumerate() {
        pos.insert(n, i);
    }

    let mut pool: Vec<f64> = Vec::new();
    let mut pool_index: HashMap<u64, usize> = HashMap::new();
    let mut nodes: Vec<Node> = Vec::with_capacity(order.len());

    for &n in &order {
        let node = pdag
            .get_node(n)
            .ok_or_else(|| PraxisError::Logic(format!("PBF: missing node {n}")))?;
        let encoded = match node {
            PdagNode::BasicEvent { id, .. } => {
                let bits = prob_of(id).to_bits();
                let idx = *pool_index.entry(bits).or_insert_with(|| {
                    pool.push(f64::from_bits(bits));
                    pool.len() - 1
                });
                Node::BasicEvent { value: idx }
            }
            PdagNode::Constant { value, .. } => Node::Constant { value: *value },
            PdagNode::Gate {
                connective,
                operands,
                min_number,
                ..
            } => {
                let mut refs: Vec<Ref> = operands
                    .iter()
                    .map(|&op| Ref {
                        position: pos[&op.abs()],
                        complement: op < 0,
                    })
                    .collect();
                refs.sort_by_key(|r| (r.position, r.complement));
                Node::Gate {
                    op: *connective,
                    k: if *connective == Connective::AtLeast {
                        Some(min_number.unwrap_or(1))
                    } else {
                        None
                    },
                    operands: refs,
                }
            }
        };
        nodes.push(encoded);
    }

    let root = pdag
        .root()
        .ok_or_else(|| PraxisError::Logic("PBF: PDAG has no root".to_string()))?;
    Ok(Structure {
        pool,
        nodes,
        root: Ref {
            position: pos[&root.abs()],
            complement: root < 0,
        },
        global_complement: pdag.complement(),
    })
}

/// Rebuild a PDAG from a structure. Basic events and gates receive synthetic
/// identifiers, since the core format carries structure and probabilities, not
/// names; names belong to the optional symbol table.
pub fn pdag_from_structure(s: &Structure) -> Result<Pdag> {
    let mut pdag = Pdag::new();
    let mut idx_at_pos: Vec<NodeIndex> = Vec::with_capacity(s.nodes.len());
    let mut synth = 0usize;
    for (i, node) in s.nodes.iter().enumerate() {
        let idx = match node {
            Node::BasicEvent { .. } => pdag.add_basic_event(format!("be{i}")),
            Node::Constant { value } => pdag.add_constant(*value),
            Node::Gate { op, k, operands } => {
                let mapped: Vec<NodeIndex> = operands
                    .iter()
                    .map(|r| {
                        let base = idx_at_pos[r.position];
                        if r.complement {
                            -base
                        } else {
                            base
                        }
                    })
                    .collect();
                synth += 1;
                pdag.add_gate(
                    format!("g{synth}"),
                    *op,
                    mapped,
                    if *op == Connective::AtLeast { *k } else { None },
                )?
            }
        };
        idx_at_pos.push(idx);
    }
    let base = idx_at_pos[s.root.position];
    pdag.set_root(if s.root.complement { -base } else { base })?;
    if s.global_complement {
        pdag.toggle_complement();
    }
    Ok(pdag)
}

// ------------------------------------------------------------- expression codec

fn put_string(out: &mut Vec<u8>, s: &str) {
    put_uvarint(out, s.len() as u64);
    out.extend_from_slice(s.as_bytes());
}

fn encode_expr_vec(out: &mut Vec<u8>, items: &[Expr]) {
    put_uvarint(out, items.len() as u64);
    for e in items {
        encode_expr(out, e);
    }
}

/// Encode an expression into `out`. Expressions carry no header of their own;
/// they embed in a model. The tag byte selects the variant, then the payload
/// follows, recursively for sub-expressions.
fn encode_expr(out: &mut Vec<u8>, e: &Expr) {
    use Expr::*;
    match e {
        Constant(v) => {
            out.push(0);
            out.extend_from_slice(&v.to_bits().to_le_bytes());
        }
        Parameter(s) => {
            out.push(1);
            put_string(out, s);
        }
        MissionTime => out.push(2),
        Time => out.push(3),
        Pi => out.push(4),
        Add(v) => { out.push(5); encode_expr_vec(out, v); }
        Sub(v) => { out.push(6); encode_expr_vec(out, v); }
        Mul(v) => { out.push(7); encode_expr_vec(out, v); }
        Div(v) => { out.push(8); encode_expr_vec(out, v); }
        Min(v) => { out.push(9); encode_expr_vec(out, v); }
        Max(v) => { out.push(10); encode_expr_vec(out, v); }
        Mean(v) => { out.push(11); encode_expr_vec(out, v); }
        Pow(a, b) => { out.push(12); encode_expr(out, a); encode_expr(out, b); }
        Mod(a, b) => { out.push(13); encode_expr(out, a); encode_expr(out, b); }
        Neg(x) => { out.push(14); encode_expr(out, x); }
        Abs(x) => { out.push(15); encode_expr(out, x); }
        Sqrt(x) => { out.push(16); encode_expr(out, x); }
        Exp(x) => { out.push(17); encode_expr(out, x); }
        Ln(x) => { out.push(18); encode_expr(out, x); }
        Log10(x) => { out.push(19); encode_expr(out, x); }
        Sin(x) => { out.push(20); encode_expr(out, x); }
        Cos(x) => { out.push(21); encode_expr(out, x); }
        Tan(x) => { out.push(22); encode_expr(out, x); }
        Asin(x) => { out.push(23); encode_expr(out, x); }
        Acos(x) => { out.push(24); encode_expr(out, x); }
        Atan(x) => { out.push(25); encode_expr(out, x); }
        Sinh(x) => { out.push(26); encode_expr(out, x); }
        Cosh(x) => { out.push(27); encode_expr(out, x); }
        Tanh(x) => { out.push(28); encode_expr(out, x); }
        Floor(x) => { out.push(29); encode_expr(out, x); }
        Ceil(x) => { out.push(30); encode_expr(out, x); }
        And(v) => { out.push(31); encode_expr_vec(out, v); }
        Or(v) => { out.push(32); encode_expr_vec(out, v); }
        Not(x) => { out.push(33); encode_expr(out, x); }
        Eq(a, b) => { out.push(34); encode_expr(out, a); encode_expr(out, b); }
        Ne(a, b) => { out.push(35); encode_expr(out, a); encode_expr(out, b); }
        Lt(a, b) => { out.push(36); encode_expr(out, a); encode_expr(out, b); }
        Gt(a, b) => { out.push(37); encode_expr(out, a); encode_expr(out, b); }
        Le(a, b) => { out.push(38); encode_expr(out, a); encode_expr(out, b); }
        Ge(a, b) => { out.push(39); encode_expr(out, a); encode_expr(out, b); }
        Ite(a, b, c) => {
            out.push(40);
            encode_expr(out, a);
            encode_expr(out, b);
            encode_expr(out, c);
        }
        Exponential { lambda, time } => {
            out.push(41);
            encode_expr(out, lambda);
            encode_expr(out, time);
        }
        Glm { gamma, lambda, mu, time } => {
            out.push(42);
            encode_expr(out, gamma);
            encode_expr(out, lambda);
            encode_expr(out, mu);
            encode_expr(out, time);
        }
        Weibull { scale, shape, t0, time } => {
            out.push(43);
            encode_expr(out, scale);
            encode_expr(out, shape);
            encode_expr(out, t0);
            encode_expr(out, time);
        }
        UniformDeviate { lower, upper } => {
            out.push(44);
            encode_expr(out, lower);
            encode_expr(out, upper);
        }
        NormalDeviate { mean, sigma } => {
            out.push(45);
            encode_expr(out, mean);
            encode_expr(out, sigma);
        }
        LognormalDeviate { mu, sigma } => {
            out.push(46);
            encode_expr(out, mu);
            encode_expr(out, sigma);
        }
        GammaDeviate { shape, rate } => {
            out.push(47);
            encode_expr(out, shape);
            encode_expr(out, rate);
        }
        BetaDeviate { alpha, beta } => {
            out.push(48);
            encode_expr(out, alpha);
            encode_expr(out, beta);
        }
        TriangularDeviate { lower, mode, upper } => {
            out.push(49);
            encode_expr(out, lower);
            encode_expr(out, mode);
            encode_expr(out, upper);
        }
        Histogram { boundaries, weights } => {
            out.push(50);
            encode_expr_vec(out, boundaries);
            encode_expr_vec(out, weights);
        }
    }
}

fn decode_expr_vec(r: &mut Reader) -> Result<Vec<Expr>> {
    let n = r.uvarint()? as usize;
    let mut v = Vec::with_capacity(n);
    for _ in 0..n {
        v.push(decode_expr(r)?);
    }
    Ok(v)
}

fn decode_expr(r: &mut Reader) -> Result<Expr> {
    let tag = r.u8()?;
    Ok(match tag {
        0 => Expr::Constant(r.f64()?),
        1 => Expr::Parameter(r.string()?),
        2 => Expr::MissionTime,
        3 => Expr::Time,
        4 => Expr::Pi,
        5 => Expr::Add(decode_expr_vec(r)?),
        6 => Expr::Sub(decode_expr_vec(r)?),
        7 => Expr::Mul(decode_expr_vec(r)?),
        8 => Expr::Div(decode_expr_vec(r)?),
        9 => Expr::Min(decode_expr_vec(r)?),
        10 => Expr::Max(decode_expr_vec(r)?),
        11 => Expr::Mean(decode_expr_vec(r)?),
        12 => Expr::Pow(Box::new(decode_expr(r)?), Box::new(decode_expr(r)?)),
        13 => Expr::Mod(Box::new(decode_expr(r)?), Box::new(decode_expr(r)?)),
        14 => Expr::Neg(Box::new(decode_expr(r)?)),
        15 => Expr::Abs(Box::new(decode_expr(r)?)),
        16 => Expr::Sqrt(Box::new(decode_expr(r)?)),
        17 => Expr::Exp(Box::new(decode_expr(r)?)),
        18 => Expr::Ln(Box::new(decode_expr(r)?)),
        19 => Expr::Log10(Box::new(decode_expr(r)?)),
        20 => Expr::Sin(Box::new(decode_expr(r)?)),
        21 => Expr::Cos(Box::new(decode_expr(r)?)),
        22 => Expr::Tan(Box::new(decode_expr(r)?)),
        23 => Expr::Asin(Box::new(decode_expr(r)?)),
        24 => Expr::Acos(Box::new(decode_expr(r)?)),
        25 => Expr::Atan(Box::new(decode_expr(r)?)),
        26 => Expr::Sinh(Box::new(decode_expr(r)?)),
        27 => Expr::Cosh(Box::new(decode_expr(r)?)),
        28 => Expr::Tanh(Box::new(decode_expr(r)?)),
        29 => Expr::Floor(Box::new(decode_expr(r)?)),
        30 => Expr::Ceil(Box::new(decode_expr(r)?)),
        31 => Expr::And(decode_expr_vec(r)?),
        32 => Expr::Or(decode_expr_vec(r)?),
        33 => Expr::Not(Box::new(decode_expr(r)?)),
        34 => Expr::Eq(Box::new(decode_expr(r)?), Box::new(decode_expr(r)?)),
        35 => Expr::Ne(Box::new(decode_expr(r)?), Box::new(decode_expr(r)?)),
        36 => Expr::Lt(Box::new(decode_expr(r)?), Box::new(decode_expr(r)?)),
        37 => Expr::Gt(Box::new(decode_expr(r)?), Box::new(decode_expr(r)?)),
        38 => Expr::Le(Box::new(decode_expr(r)?), Box::new(decode_expr(r)?)),
        39 => Expr::Ge(Box::new(decode_expr(r)?), Box::new(decode_expr(r)?)),
        40 => Expr::Ite(
            Box::new(decode_expr(r)?),
            Box::new(decode_expr(r)?),
            Box::new(decode_expr(r)?),
        ),
        41 => Expr::Exponential {
            lambda: Box::new(decode_expr(r)?),
            time: Box::new(decode_expr(r)?),
        },
        42 => Expr::Glm {
            gamma: Box::new(decode_expr(r)?),
            lambda: Box::new(decode_expr(r)?),
            mu: Box::new(decode_expr(r)?),
            time: Box::new(decode_expr(r)?),
        },
        43 => Expr::Weibull {
            scale: Box::new(decode_expr(r)?),
            shape: Box::new(decode_expr(r)?),
            t0: Box::new(decode_expr(r)?),
            time: Box::new(decode_expr(r)?),
        },
        44 => Expr::UniformDeviate {
            lower: Box::new(decode_expr(r)?),
            upper: Box::new(decode_expr(r)?),
        },
        45 => Expr::NormalDeviate {
            mean: Box::new(decode_expr(r)?),
            sigma: Box::new(decode_expr(r)?),
        },
        46 => Expr::LognormalDeviate {
            mu: Box::new(decode_expr(r)?),
            sigma: Box::new(decode_expr(r)?),
        },
        47 => Expr::GammaDeviate {
            shape: Box::new(decode_expr(r)?),
            rate: Box::new(decode_expr(r)?),
        },
        48 => Expr::BetaDeviate {
            alpha: Box::new(decode_expr(r)?),
            beta: Box::new(decode_expr(r)?),
        },
        49 => Expr::TriangularDeviate {
            lower: Box::new(decode_expr(r)?),
            mode: Box::new(decode_expr(r)?),
            upper: Box::new(decode_expr(r)?),
        },
        50 => Expr::Histogram {
            boundaries: decode_expr_vec(r)?,
            weights: decode_expr_vec(r)?,
        },
        other => {
            return Err(PraxisError::Logic(format!(
                "PBF: unknown expression tag {other}"
            )))
        }
    })
}

// ----------------------------------------------------------------- model codec
//
// The model codec serializes a whole `FaultTree`, the form the engine consumes:
// the gate/basic-event/house-event graph with names, per-event probabilities and
// optional sampling expressions, CCF groups, parameters, and the mission time.
// Magic is `PBM1` to distinguish it from the nameless structural core `PBF1`.

const MODEL_MAGIC: [u8; 4] = *b"PBM1";

fn formula_to_nibble(f: &Formula) -> u8 {
    match f {
        Formula::And => 0,
        Formula::Or => 1,
        Formula::Not => 2,
        Formula::AtLeast { .. } => 3,
        Formula::Xor => 4,
        Formula::Nand => 5,
        Formula::Nor => 6,
        Formula::Iff => 7,
    }
}

fn nibble_to_formula(n: u8, k: usize) -> Result<Formula> {
    Ok(match n {
        0 => Formula::And,
        1 => Formula::Or,
        2 => Formula::Not,
        3 => Formula::AtLeast { min: k },
        4 => Formula::Xor,
        5 => Formula::Nand,
        6 => Formula::Nor,
        7 => Formula::Iff,
        other => {
            return Err(PraxisError::Logic(format!(
                "PBF: unknown formula nibble {other}"
            )))
        }
    })
}

fn put_f64_vec(out: &mut Vec<u8>, v: &[f64]) {
    put_uvarint(out, v.len() as u64);
    for &x in v {
        out.extend_from_slice(&x.to_bits().to_le_bytes());
    }
}

fn read_f64_vec(r: &mut Reader) -> Result<Vec<f64>> {
    let n = r.uvarint()? as usize;
    let mut v = Vec::with_capacity(n);
    for _ in 0..n {
        v.push(r.f64()?);
    }
    Ok(v)
}

fn encode_ccf_model(out: &mut Vec<u8>, m: &CcfModel) {
    match m {
        CcfModel::BetaFactor(b) => {
            out.push(0);
            out.extend_from_slice(&b.to_bits().to_le_bytes());
        }
        CcfModel::AlphaFactor { factors, scheme } => {
            out.push(1);
            out.push(match scheme {
                TestingScheme::NonStaggered => 0,
                TestingScheme::Staggered => 1,
            });
            put_f64_vec(out, factors);
        }
        CcfModel::Mgl(v) => {
            out.push(2);
            put_f64_vec(out, v);
        }
        CcfModel::PhiFactor(v) => {
            out.push(3);
            put_f64_vec(out, v);
        }
    }
}

fn decode_ccf_model(r: &mut Reader) -> Result<CcfModel> {
    Ok(match r.u8()? {
        0 => CcfModel::BetaFactor(r.f64()?),
        1 => {
            let scheme = match r.u8()? {
                0 => TestingScheme::NonStaggered,
                _ => TestingScheme::Staggered,
            };
            CcfModel::AlphaFactor {
                factors: read_f64_vec(r)?,
                scheme,
            }
        }
        2 => CcfModel::Mgl(read_f64_vec(r)?),
        3 => CcfModel::PhiFactor(read_f64_vec(r)?),
        other => {
            return Err(PraxisError::Logic(format!(
                "PBF: unknown CCF model tag {other}"
            )))
        }
    })
}

fn collect_order(
    ft: &FaultTree,
    id: &str,
    visited: &mut HashSet<String>,
    order: &mut Vec<String>,
) -> Result<()> {
    if !visited.insert(id.to_string()) {
        return Ok(());
    }
    if let Some(gate) = ft.get_gate(id) {
        for op in gate.operands() {
            collect_order(ft, op, visited, order)?;
        }
        order.push(id.to_string());
    } else if ft.get_basic_event(id).is_some() || ft.get_house_event(id).is_some() {
        order.push(id.to_string());
    } else {
        return Err(PraxisError::Logic(format!(
            "PBF: fault tree references unknown node '{id}'"
        )));
    }
    Ok(())
}

/// Serialize a `FaultTree` to its PBF model byte string.
pub fn encode_fault_tree(ft: &FaultTree) -> Result<Vec<u8>> {
    let mut order: Vec<String> = Vec::new();
    let mut visited: HashSet<String> = HashSet::new();
    collect_order(ft, ft.top_event(), &mut visited, &mut order)?;
    let mut pos: HashMap<&str, usize> = HashMap::new();
    for (i, name) in order.iter().enumerate() {
        pos.insert(name.as_str(), i);
    }

    let mut out = Vec::new();
    out.extend_from_slice(&MODEL_MAGIC);
    out.push(VERSION);
    put_string(&mut out, ft.element().id());
    out.extend_from_slice(&ft.mission_time().to_bits().to_le_bytes());

    let mut params: Vec<(&String, &Expr)> = ft.parameters().iter().collect();
    params.sort_by(|a, b| a.0.cmp(b.0));
    put_uvarint(&mut out, params.len() as u64);
    for (name, expr) in params {
        put_string(&mut out, name);
        encode_expr(&mut out, expr);
    }

    put_uvarint(&mut out, order.len() as u64);
    for (i, name) in order.iter().enumerate() {
        put_string(&mut out, name);
        if let Some(gate) = ft.get_gate(name) {
            out.push(0x10 | formula_to_nibble(gate.formula()));
            if let Formula::AtLeast { min } = gate.formula() {
                put_uvarint(&mut out, *min as u64);
            }
            put_uvarint(&mut out, gate.operands().len() as u64);
            for op in gate.operands() {
                let opos = *pos.get(op.as_str()).ok_or_else(|| {
                    PraxisError::Logic(format!("PBF: operand '{op}' not ordered"))
                })?;
                put_uvarint(&mut out, (i - opos) as u64);
            }
        } else if let Some(be) = ft.get_basic_event(name) {
            out.push(0x00 | u8::from(be.is_initiator()));
            out.extend_from_slice(&be.probability().to_bits().to_le_bytes());
            match be.value() {
                Some(expr) => {
                    out.push(1);
                    encode_expr(&mut out, expr);
                }
                None => out.push(0),
            }
        } else if let Some(he) = ft.get_house_event(name) {
            out.push(0x30 | u8::from(he.state()));
        }
    }

    put_uvarint(&mut out, pos[ft.top_event()] as u64);

    let mut groups: Vec<&CcfGroup> = ft.ccf_groups().values().collect();
    groups.sort_by(|a, b| a.element().id().cmp(b.element().id()));
    put_uvarint(&mut out, groups.len() as u64);
    for g in groups {
        put_string(&mut out, g.element().id());
        put_uvarint(&mut out, g.members.len() as u64);
        for m in &g.members {
            put_string(&mut out, m);
        }
        match &g.distribution {
            Some(d) => {
                out.push(1);
                put_string(&mut out, d);
            }
            None => out.push(0),
        }
        encode_ccf_model(&mut out, &g.model);
    }

    Ok(out)
}

enum DecNode {
    Gate { formula: Formula, ops: Vec<usize> },
    Be {
        prob: f64,
        expr: Option<Expr>,
        initiator: bool,
    },
    House { state: bool },
}

/// Parse a `FaultTree` from a PBF model byte string.
pub fn decode_fault_tree(bytes: &[u8]) -> Result<FaultTree> {
    let mut r = Reader::new(bytes);
    if r.take(4)? != MODEL_MAGIC {
        return Err(PraxisError::Logic("PBF: bad model magic".to_string()));
    }
    let version = r.u8()?;
    if version != VERSION {
        return Err(PraxisError::Logic(format!(
            "PBF: unsupported model version {version}"
        )));
    }
    let ft_id = r.string()?;
    let mission_time = r.f64()?;

    let param_count = r.uvarint()? as usize;
    let mut params = Vec::with_capacity(param_count);
    for _ in 0..param_count {
        let name = r.string()?;
        params.push((name, decode_expr(&mut r)?));
    }

    let node_count = r.uvarint()? as usize;
    let mut names: Vec<String> = Vec::with_capacity(node_count);
    let mut decoded: Vec<DecNode> = Vec::with_capacity(node_count);
    for i in 0..node_count {
        names.push(r.string()?);
        let tag = r.u8()?;
        let node = match tag >> 4 {
            0 => {
                let prob = r.f64()?;
                let expr = if r.u8()? == 1 {
                    Some(decode_expr(&mut r)?)
                } else {
                    None
                };
                DecNode::Be {
                    prob,
                    expr,
                    initiator: tag & 1 == 1,
                }
            }
            1 => {
                let nibble = tag & 0x0f;
                let k = if nibble == 3 { r.uvarint()? as usize } else { 0 };
                let formula = nibble_to_formula(nibble, k)?;
                let n = r.uvarint()? as usize;
                let mut ops = Vec::with_capacity(n);
                for _ in 0..n {
                    let delta = r.uvarint()? as usize;
                    if delta == 0 || delta > i {
                        return Err(PraxisError::Logic(
                            "PBF: operand reference out of range".to_string(),
                        ));
                    }
                    ops.push(i - delta);
                }
                DecNode::Gate { formula, ops }
            }
            3 => DecNode::House {
                state: tag & 1 == 1,
            },
            other => {
                return Err(PraxisError::Logic(format!("PBF: unknown node kind {other}")))
            }
        };
        decoded.push(node);
    }

    let top_pos = r.uvarint()? as usize;
    if top_pos >= node_count {
        return Err(PraxisError::Logic("PBF: top out of range".to_string()));
    }

    let ccf_count = r.uvarint()? as usize;
    let mut ccf = Vec::with_capacity(ccf_count);
    for _ in 0..ccf_count {
        let id = r.string()?;
        let mc = r.uvarint()? as usize;
        let mut members = Vec::with_capacity(mc);
        for _ in 0..mc {
            members.push(r.string()?);
        }
        let dist = if r.u8()? == 1 {
            Some(r.string()?)
        } else {
            None
        };
        ccf.push((id, members, dist, decode_ccf_model(&mut r)?));
    }

    let mut ft = FaultTree::new(ft_id, names[top_pos].clone())?;
    ft.set_mission_time(mission_time);
    for (name, expr) in params {
        ft.set_parameter(name, expr);
    }
    for (i, node) in decoded.into_iter().enumerate() {
        let name = names[i].clone();
        match node {
            DecNode::Be {
                prob,
                expr,
                initiator,
            } => {
                let mut be = match expr {
                    Some(e) => BasicEvent::with_value(name, prob, e)?,
                    None => BasicEvent::new(name, prob)?,
                };
                be.set_initiator(initiator);
                ft.add_basic_event(be)?;
            }
            DecNode::House { state } => {
                ft.add_house_event(HouseEvent::new(name, state)?)?;
            }
            DecNode::Gate { formula, ops } => {
                let mut gate = Gate::new(name, formula)?;
                for op in ops {
                    gate.add_operand(names[op].clone());
                }
                ft.add_gate(gate)?;
            }
        }
    }
    for (id, members, dist, model) in ccf {
        let mut group = CcfGroup::new(id, members, model)?;
        if let Some(d) = dist {
            group = group.with_distribution(d);
        }
        ft.add_ccf_group(group)?;
    }

    Ok(ft)
}

// ---------------------------------------------------------------- result codec

const RESULT_MAGIC: [u8; 4] = *b"PBR1";

fn approx_to_u8(a: Approximation) -> u8 {
    match a {
        Approximation::Exact => 0,
        Approximation::RareEvent => 1,
        Approximation::Mcub => 2,
        Approximation::MonteCarlo => 3,
    }
}

fn u8_to_approx(n: u8) -> Result<Approximation> {
    Ok(match n {
        0 => Approximation::Exact,
        1 => Approximation::RareEvent,
        2 => Approximation::Mcub,
        3 => Approximation::MonteCarlo,
        other => {
            return Err(PraxisError::Logic(format!(
                "PBF: unknown approximation tag {other}"
            )))
        }
    })
}

fn put_f64(out: &mut Vec<u8>, x: f64) {
    out.extend_from_slice(&x.to_bits().to_le_bytes());
}

/// Serialize a quantification result to its PBF byte string.
pub fn encode_result(r: &QuantResult) -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&RESULT_MAGIC);
    out.push(VERSION);

    match &r.probability {
        Some(p) => {
            out.push(1);
            put_f64(&mut out, p.value);
            out.push(approx_to_u8(p.approximation));
        }
        None => out.push(0),
    }

    match &r.cut_sets {
        Some(c) => {
            out.push(1);
            out.push(u8::from(c.prime_implicants));
            put_uvarint(&mut out, c.products as u64);
            put_uvarint(&mut out, c.distribution_by_order.len() as u64);
            for &d in &c.distribution_by_order {
                put_uvarint(&mut out, d as u64);
            }
            put_uvarint(&mut out, c.list.len() as u64);
            for cs in &c.list {
                put_uvarint(&mut out, cs.literals.len() as u64);
                for (name, negated) in &cs.literals {
                    put_string(&mut out, name);
                    out.push(u8::from(*negated));
                }
                put_f64(&mut out, cs.probability);
            }
        }
        None => out.push(0),
    }

    match &r.importance {
        Some(v) => {
            out.push(1);
            put_uvarint(&mut out, v.len() as u64);
            for imp in v {
                put_string(&mut out, &imp.event);
                put_f64(&mut out, imp.birnbaum);
                put_f64(&mut out, imp.criticality);
                put_f64(&mut out, imp.fussell_vesely);
                put_f64(&mut out, imp.raw);
                put_f64(&mut out, imp.rrw);
            }
        }
        None => out.push(0),
    }

    match &r.uncertainty {
        Some(u) => {
            out.push(1);
            put_f64(&mut out, u.mean);
            put_f64(&mut out, u.standard_deviation);
            put_f64(&mut out, u.error_factor);
            put_uvarint(&mut out, u.quantiles.len() as u64);
            for &q in &u.quantiles {
                put_f64(&mut out, q);
            }
        }
        None => out.push(0),
    }

    out
}

/// Parse a quantification result from its PBF byte string.
pub fn decode_result(bytes: &[u8]) -> Result<QuantResult> {
    let mut r = Reader::new(bytes);
    if r.take(4)? != RESULT_MAGIC {
        return Err(PraxisError::Logic("PBF: bad result magic".to_string()));
    }
    let version = r.u8()?;
    if version != VERSION {
        return Err(PraxisError::Logic(format!(
            "PBF: unsupported result version {version}"
        )));
    }
    let mut out = QuantResult::default();

    if r.u8()? == 1 {
        let value = r.f64()?;
        let approximation = u8_to_approx(r.u8()?)?;
        out.probability = Some(ProbabilityOut { value, approximation });
    }

    if r.u8()? == 1 {
        let prime_implicants = r.u8()? == 1;
        let products = r.uvarint()? as usize;
        let dist_len = r.uvarint()? as usize;
        let mut distribution_by_order = Vec::with_capacity(dist_len);
        for _ in 0..dist_len {
            distribution_by_order.push(r.uvarint()? as usize);
        }
        let list_len = r.uvarint()? as usize;
        let mut list = Vec::with_capacity(list_len);
        for _ in 0..list_len {
            let lit_len = r.uvarint()? as usize;
            let mut literals = Vec::with_capacity(lit_len);
            for _ in 0..lit_len {
                let name = r.string()?;
                let negated = r.u8()? == 1;
                literals.push((name, negated));
            }
            let probability = r.f64()?;
            list.push(CutSetOut { literals, probability });
        }
        out.cut_sets = Some(CutSetsOut {
            prime_implicants,
            products,
            distribution_by_order,
            list,
        });
    }

    if r.u8()? == 1 {
        let n = r.uvarint()? as usize;
        let mut v = Vec::with_capacity(n);
        for _ in 0..n {
            let event = r.string()?;
            v.push(ImportanceOut {
                event,
                birnbaum: r.f64()?,
                criticality: r.f64()?,
                fussell_vesely: r.f64()?,
                raw: r.f64()?,
                rrw: r.f64()?,
            });
        }
        out.importance = Some(v);
    }

    if r.u8()? == 1 {
        let mean = r.f64()?;
        let standard_deviation = r.f64()?;
        let error_factor = r.f64()?;
        let n = r.uvarint()? as usize;
        let mut quantiles = Vec::with_capacity(n);
        for _ in 0..n {
            quantiles.push(r.f64()?);
        }
        out.uncertainty = Some(UncertaintyOut {
            mean,
            standard_deviation,
            error_factor,
            quantiles,
        });
    }

    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::io::parser::parse_fault_tree;

    fn combine(c: Connective, vals: &[bool], min: Option<usize>) -> bool {
        match c {
            Connective::And => vals.iter().all(|&x| x),
            Connective::Or => vals.iter().any(|&x| x),
            Connective::Not => !vals[0],
            Connective::Nand => !vals.iter().all(|&x| x),
            Connective::Nor => !vals.iter().any(|&x| x),
            Connective::Xor => vals.iter().fold(false, |a, &b| a ^ b),
            Connective::Iff => vals.iter().all(|&x| x == vals[0]),
            Connective::AtLeast => vals.iter().filter(|&&x| x).count() >= min.unwrap_or(1),
            Connective::Null => vals.first().copied().unwrap_or(false),
        }
    }

    fn eval_structure(s: &Structure, assign: &[bool]) -> bool {
        let mut val = vec![false; s.nodes.len()];
        for (i, node) in s.nodes.iter().enumerate() {
            val[i] = match node {
                Node::BasicEvent { .. } => assign[i],
                Node::Constant { value } => *value,
                Node::Gate { op, k, operands } => {
                    let vals: Vec<bool> = operands
                        .iter()
                        .map(|r| val[r.position] ^ r.complement)
                        .collect();
                    combine(*op, &vals, *k)
                }
            };
        }
        val[s.root.position] ^ s.root.complement ^ s.global_complement
    }

    fn eval_pdag(
        pdag: &Pdag,
        node: NodeIndex,
        pos: &HashMap<NodeIndex, usize>,
        assign: &[bool],
        memo: &mut HashMap<NodeIndex, bool>,
    ) -> bool {
        let a = node.abs();
        let v = if let Some(&m) = memo.get(&a) {
            m
        } else {
            let r = match pdag.get_node(a).unwrap() {
                PdagNode::BasicEvent { .. } => assign[pos[&a]],
                PdagNode::Constant { value, .. } => *value,
                PdagNode::Gate {
                    connective,
                    operands,
                    min_number,
                    ..
                } => {
                    let vals: Vec<bool> = operands
                        .iter()
                        .map(|&o| eval_pdag(pdag, o, pos, assign, memo))
                        .collect();
                    combine(*connective, &vals, *min_number)
                }
            };
            memo.insert(a, r);
            r
        };
        v ^ (node < 0)
    }

    #[test]
    fn round_trip_hand_built() {
        let s = Structure {
            pool: vec![0.1, 0.2],
            nodes: vec![
                Node::BasicEvent { value: 0 },
                Node::BasicEvent { value: 1 },
                Node::Gate {
                    op: Connective::Or,
                    k: None,
                    operands: vec![
                        Ref {
                            position: 0,
                            complement: false,
                        },
                        Ref {
                            position: 1,
                            complement: true,
                        },
                    ],
                },
            ],
            root: Ref {
                position: 2,
                complement: false,
            },
            global_complement: false,
        };
        let bytes = encode(&s);
        assert_eq!(&bytes[0..4], &MAGIC);
        let back = decode(&bytes).unwrap();
        assert_eq!(s, back);
        // canonical: decode then re-encode is byte stable
        assert_eq!(bytes, encode(&back));
    }

    #[test]
    fn rejects_bad_magic_and_truncation() {
        assert!(decode(b"XXXX").is_err());
        assert!(decode(&[]).is_err());
        let mut good = encode(&Structure {
            pool: vec![0.5],
            nodes: vec![Node::BasicEvent { value: 0 }],
            root: Ref {
                position: 0,
                complement: false,
            },
            global_complement: false,
        });
        good.pop();
        assert!(decode(&good).is_err());
    }

    fn check_fixture(path: &str) {
        let text = std::fs::read_to_string(path).unwrap();
        let ft = parse_fault_tree(&text).unwrap();
        let pdag = Pdag::from_fault_tree(&ft).unwrap();

        let s = structure_from_pdag(&pdag, |id| {
            ft.get_basic_event(id).map(|b| b.probability()).unwrap_or(0.0)
        })
        .unwrap();
        let bytes = encode(&s);
        let back = decode(&bytes).unwrap();
        assert_eq!(s, back, "structure round trip failed for {path}");
        assert_eq!(bytes, encode(&back), "not byte-canonical for {path}");

        // function equivalence: original PDAG vs decoded structure
        let order = pdag.topological_sort().unwrap();
        let mut pos: HashMap<NodeIndex, usize> = HashMap::new();
        for (i, &n) in order.iter().enumerate() {
            pos.insert(n, i);
        }
        let n = back.nodes.len();
        let root = pdag.root().unwrap();
        let mut rng: u64 = 0x1234_5678_9abc_def1;
        for t in 0..1026usize {
            let assign: Vec<bool> = if t == 1024 {
                vec![false; n]
            } else if t == 1025 {
                vec![true; n]
            } else {
                (0..n)
                    .map(|_| {
                        rng ^= rng << 13;
                        rng ^= rng >> 7;
                        rng ^= rng << 17;
                        rng & 1 == 1
                    })
                    .collect()
            };
            let mut memo = HashMap::new();
            let a = eval_pdag(&pdag, root, &pos, &assign, &mut memo) ^ pdag.complement();
            let b = eval_structure(&back, &assign);
            assert_eq!(a, b, "function mismatch for {path} at trial {t}");
        }
    }

    #[test]
    fn fixture_round_trip_and_function() {
        check_fixture("tests/fixtures/benchmarks/Aralia/chinese.xml");
        check_fixture("tests/fixtures/benchmarks/Aralia/das9209.xml");
        check_fixture("tests/fixtures/core/xor.xml");
    }

    #[test]
    fn expr_round_trip() {
        let exprs = vec![
            Expr::Constant(0.1),
            Expr::Parameter("lambda".to_string()),
            Expr::MissionTime,
            Expr::Pi,
            Expr::Exponential {
                lambda: Box::new(Expr::Parameter("lambda".to_string())),
                time: Box::new(Expr::MissionTime),
            },
            Expr::LognormalDeviate {
                mu: Box::new(Expr::Constant(-4.0)),
                sigma: Box::new(Expr::Constant(0.5)),
            },
            Expr::Add(vec![
                Expr::Constant(1.0),
                Expr::Mul(vec![Expr::Constant(2.0), Expr::Pi]),
            ]),
            Expr::Ite(
                Box::new(Expr::Lt(Box::new(Expr::Time), Box::new(Expr::Constant(10.0)))),
                Box::new(Expr::Constant(0.0)),
                Box::new(Expr::Constant(1.0)),
            ),
            Expr::Glm {
                gamma: Box::new(Expr::Constant(0.0)),
                lambda: Box::new(Expr::Constant(1e-3)),
                mu: Box::new(Expr::Constant(0.1)),
                time: Box::new(Expr::MissionTime),
            },
            Expr::Histogram {
                boundaries: vec![Expr::Constant(0.0), Expr::Constant(1.0)],
                weights: vec![Expr::Constant(0.5)],
            },
        ];
        for e in &exprs {
            let mut buf = Vec::new();
            encode_expr(&mut buf, e);
            let mut r = Reader::new(&buf);
            let back = decode_expr(&mut r).unwrap();
            assert_eq!(*e, back, "expr round trip mismatch");
            assert_eq!(r.pos, buf.len(), "expr did not consume all bytes");
        }
    }

    #[test]
    fn fault_tree_round_trip() {
        let mut ft = FaultTree::new("FT", "top").unwrap();
        ft.set_mission_time(100.0);
        ft.set_parameter("lambda".into(), Expr::Constant(1e-3));

        let mut top = Gate::new("top".into(), Formula::Or).unwrap();
        top.add_operand("g1".into());
        top.add_operand("h1".into());
        ft.add_gate(top).unwrap();

        let mut g1 = Gate::new("g1".into(), Formula::AtLeast { min: 2 }).unwrap();
        g1.add_operand("e1".into());
        g1.add_operand("e2".into());
        g1.add_operand("e3".into());
        ft.add_gate(g1).unwrap();

        ft.add_basic_event(BasicEvent::new("e1".into(), 0.1).unwrap()).unwrap();
        ft.add_basic_event(
            BasicEvent::with_value(
                "e2".into(),
                0.2,
                Expr::Exponential {
                    lambda: Box::new(Expr::Parameter("lambda".into())),
                    time: Box::new(Expr::MissionTime),
                },
            )
            .unwrap(),
        )
        .unwrap();
        ft.add_basic_event(BasicEvent::new("e3".into(), 0.3).unwrap()).unwrap();
        ft.add_house_event(HouseEvent::new("h1".into(), true).unwrap()).unwrap();
        ft.add_ccf_group(
            CcfGroup::new("c1", vec!["e1".into(), "e2".into()], CcfModel::BetaFactor(0.1))
                .unwrap()
                .with_distribution("0.01".into()),
        )
        .unwrap();

        let bytes = encode_fault_tree(&ft).unwrap();
        let back = decode_fault_tree(&bytes).unwrap();
        assert_eq!(ft, back, "fault tree round trip mismatch");
        assert_eq!(bytes, encode_fault_tree(&back).unwrap(), "model not byte-canonical");
    }
}
