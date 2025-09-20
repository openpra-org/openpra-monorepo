# SCRAM Optimization Plan: Input Processing to Analysis-Ready PDAGs

## Overview

This document outlines the step-by-step optimization plan for SCRAM's workflow from XML input parsing until PDAGs are ready for MOCUS/BDD/ZBDD analysis algorithms.

## Current Performance Bottlenecks

Based on analysis of the SCRAM codebase:

1. **Preprocessing Redundancies**: 80% of PDAG building time
   - Module detection called 4x instead of 1x
   - Gate coalescing called 3x instead of 1x
   - Phase re-execution (Phase 2 called from Phase 5)

2. **Serial PDAG Construction**: 20% of PDAG building time
   - Fault trees built sequentially
   - Event tree sequences processed one by one

3. **Memory Inefficiencies**: 10-20% overhead
   - Frequent weak_ptr::lock() calls
   - Linear map lookups for small collections
   - Memory fragmentation from shared_ptr overhead

## Optimization Strategy

### Phase 1: Critical Preprocessing Fixes (Weeks 1-2)
**Expected Impact**: 5-10x speedup for preprocessing phase

#### 1.1 Eliminate Module Detection Redundancy

**Problem**: `DetectModules()` called 4 times in Phase 2
**Solution**: Implement smart caching with invalidation triggers

```cpp
class SmartModuleDetector {
private:
    std::unordered_set<Gate*> modules_detected_;
    bool modules_valid_ = false;
    std::unordered_set<Gate*> modified_gates_;
    
public:
    void DetectModules(Pdag* graph) {
        if (modules_valid_ && modified_gates_.empty()) {
            return; // Skip if already done and no changes
        }
        
        // Clear previous results if invalid
        if (!modules_valid_) {
            modules_detected_.clear();
        }
        
        // Only re-detect for modified gates and their ancestors
        std::vector<Gate*> gates_to_check;
        for (Gate* gate : modified_gates_) {
            CollectAncestors(gate, gates_to_check);
        }
        
        // Perform detection only on affected gates
        DetectModulesInternal(graph, gates_to_check);
        
        modules_valid_ = true;
        modified_gates_.clear();
    }
    
    void MarkGateModified(Gate* gate) {
        modified_gates_.insert(gate);
        modules_valid_ = false;
    }
    
    bool IsModule(Gate* gate) const {
        return modules_detected_.find(gate) != modules_detected_.end();
    }
};
```

#### 1.2 Eliminate Gate Coalescing Redundancy

**Problem**: `CoalesceGates()` called 3 times with same parameters
**Solution**: Implement incremental coalescing with change tracking

```cpp
class IncrementalCoalescer {
private:
    std::unordered_set<Gate*> coalesced_gates_;
    std::vector<Gate*> pending_coalesce_;
    bool coalescing_done_ = false;
    
public:
    bool CoalesceGates(Pdag* graph, bool common) {
        if (coalescing_done_ && pending_coalesce_.empty()) {
            return false; // Nothing to do
        }
        
        bool changed = false;
        std::vector<Gate*> new_pending;
        
        // Process pending gates
        for (Gate* gate : pending_coalesce_) {
            if (coalesced_gates_.find(gate) != coalesced_gates_.end()) {
                continue; // Already processed
            }
            
            if (CoalesceGate(gate, common)) {
                changed = true;
                coalesced_gates_.insert(gate);
                
                // Add newly created gates to pending list
                for (auto& child : gate->children()) {
                    if (ShouldCoalesce(child.get(), common)) {
                        new_pending.push_back(child.get());
                    }
                }
            }
        }
        
        pending_coalesce_ = std::move(new_pending);
        
        if (!changed) {
            coalescing_done_ = true;
        }
        
        return changed;
    }
    
    void AddGateForCoalescing(Gate* gate) {
        pending_coalesce_.push_back(gate);
        coalescing_done_ = false;
    }
    
    void Reset() {
        coalesced_gates_.clear();
        pending_coalesce_.clear();
        coalescing_done_ = false;
    }
};
```

#### 1.3 Eliminate Phase Re-execution

**Problem**: Phase 2 called again from Phase 5
**Solution**: Implement dependency-aware preprocessing pipeline

```cpp
class DependencyAwarePreprocessor {
private:
    struct PreprocessingStep {
        std::string name;
        std::function<void(Pdag*)> operation;
        std::vector<std::string> dependencies;
        bool completed = false;
        bool dirty = true;
    };
    
    std::vector<PreprocessingStep> steps_;
    std::unordered_map<std::string, size_t> step_indices_;
    
public:
    void AddStep(const std::string& name, 
                 std::function<void(Pdag*)> operation,
                 const std::vector<std::string>& dependencies = {}) {
        step_indices_[name] = steps_.size();
        steps_.push_back({name, operation, dependencies, false, true});
    }
    
    void RunPreprocessing(Pdag* graph) {
        // Build dependency graph
        std::vector<std::vector<size_t>> dependency_graph(steps_.size());
        for (size_t i = 0; i < steps_.size(); ++i) {
            for (const auto& dep : steps_[i].dependencies) {
                auto it = step_indices_.find(dep);
                if (it != step_indices_.end()) {
                    dependency_graph[it->second].push_back(i);
                }
            }
        }
        
        // Execute steps in dependency order
        std::vector<bool> executed(steps_.size(), false);
        for (size_t i = 0; i < steps_.size(); ++i) {
            if (!executed[i] && steps_[i].dirty) {
                ExecuteStep(i, graph, dependency_graph, executed);
            }
        }
    }
    
    void MarkStepDirty(const std::string& step_name) {
        auto it = step_indices_.find(step_name);
        if (it != step_indices_.end()) {
            steps_[it->second].dirty = true;
            steps_[it->second].completed = false;
        }
    }
    
private:
    void ExecuteStep(size_t step_idx, Pdag* graph, 
                    const std::vector<std::vector<size_t>>& deps,
                    std::vector<bool>& executed) {
        if (executed[step_idx]) return;
        
        // Execute dependencies first
        for (size_t dep : deps[step_idx]) {
            ExecuteStep(dep, graph, deps, executed);
        }
        
        // Execute this step
        steps_[step_idx].operation(graph);
        steps_[step_idx].completed = true;
        steps_[step_idx].dirty = false;
        executed[step_idx] = true;
    }
};
```

### Phase 2: Parallel PDAG Construction (Weeks 3-4)
**Expected Impact**: 3-6x speedup for PDAG construction

#### 2.1 Parallel Fault Tree PDAGs

**Problem**: Multiple fault trees built serially
**Solution**: Build independent fault tree PDAGs in parallel

```cpp
class ParallelFaultTreeBuilder {
private:
    ThreadPool thread_pool_;
    
public:
    std::vector<std::unique_ptr<Pdag>> BuildParallel(
        const std::vector<mef::FaultTree>& fault_trees) {
        
        std::vector<std::future<std::unique_ptr<Pdag>>> futures;
        futures.reserve(fault_trees.size());
        
        // Submit all fault trees for parallel processing
        for (const auto& fault_tree : fault_trees) {
            futures.push_back(thread_pool_.enqueue([&]() {
                return BuildSingleFaultTreePdag(fault_tree);
            }));
        }
        
        // Collect results
        std::vector<std::unique_ptr<Pdag>> results;
        results.reserve(fault_trees.size());
        
        for (auto& future : futures) {
            results.push_back(future.get());
        }
        
        return results;
    }
    
private:
    std::unique_ptr<Pdag> BuildSingleFaultTreePdag(const mef::FaultTree& fault_tree) {
        // Thread-local PDAG builder
        auto pdag = std::make_unique<Pdag>(fault_tree.root(), ccf_, nullptr);
        
        // Apply optimized preprocessing
        OptimizedPreprocessor preprocessor;
        preprocessor.RunOptimizedPreprocessing(pdag.get());
        
        return pdag;
    }
};
```

#### 2.2 Parallel Event Tree Sequence Processing

**Problem**: Event tree sequences processed serially
**Solution**: Process multiple sequences in parallel

```cpp
class ParallelEventTreeProcessor {
private:
    ThreadPool thread_pool_;
    
public:
    std::vector<SequenceResult> ProcessSequencesParallel(
        const mef::EventTree& event_tree) {
        
        // Collect all sequences
        std::vector<mef::Sequence> sequences = CollectSequences(event_tree);
        
        std::vector<std::future<SequenceResult>> futures;
        futures.reserve(sequences.size());
        
        // Process sequences in parallel
        for (const auto& sequence : sequences) {
            futures.push_back(thread_pool_.enqueue([&]() {
                return ProcessSingleSequence(sequence);
            }));
        }
        
        // Collect results
        std::vector<SequenceResult> results;
        results.reserve(sequences.size());
        
        for (auto& future : futures) {
            results.push_back(future.get());
        }
        
        return results;
    }
    
private:
    SequenceResult ProcessSingleSequence(const mef::Sequence& sequence) {
        // Process individual sequence
        SequenceResult result;
        
        // Build sequence gate
        result.gate = BuildSequenceGate(sequence);
        
        // Apply house events
        ApplyHouseEvents(result.gate, sequence.house_events);
        
        return result;
    }
};
```

### Phase 3: Memory and Data Structure Optimization (Weeks 5-6)
**Expected Impact**: 1.5-2x speedup for traversal operations

#### 3.1 Optimize Node Parent Management

**Problem**: Frequent weak_ptr::lock() calls during traversal
**Solution**: Implement parent caching for hot paths

```cpp
class OptimizedNodeParentManager {
private:
    // Use flat_map for better cache locality
    boost::container::flat_map<int, GateWeakPtr> parents_;
    
    // Add parent cache for hot paths
    mutable std::vector<Gate*> parent_cache_;
    mutable bool cache_valid_ = false;
    
public:
    const std::vector<Gate*>& get_parents_fast() const {
        if (!cache_valid_) {
            parent_cache_.clear();
            parent_cache_.reserve(parents_.size());
            
            for (const auto& [index, weak_ptr] : parents_) {
                if (auto ptr = weak_ptr.lock()) {
                    parent_cache_.push_back(ptr.get());
                }
            }
            
            cache_valid_ = true;
        }
        return parent_cache_;
    }
    
    void AddParent(const GatePtr& gate) {
        parents_.emplace(gate->index(), gate);
        cache_valid_ = false; // Invalidate cache
    }
    
    void EraseParent(int index) {
        parents_.erase(index);
        cache_valid_ = false; // Invalidate cache
    }
};
```

#### 3.2 Optimize Index Management

**Problem**: Linear lookups in index maps
**Solution**: Use dense indexing with pre-allocated vectors

```cpp
class OptimizedIndexManager {
private:
    // Use dense indexing for better cache performance
    std::vector<Node*> nodes_by_index_;
    std::atomic<int> next_index_{2}; // Thread-safe
    
public:
    int allocate_index() {
        return next_index_.fetch_add(1);
    }
    
    Node* get_node(int index) const {
        if (index < nodes_by_index_.size()) {
            return nodes_by_index_[index];
        }
        return nullptr;
    }
    
    void register_node(int index, Node* node) {
        if (index >= nodes_by_index_.size()) {
            nodes_by_index_.resize(index + 1);
        }
        nodes_by_index_[index] = node;
    }
    
    void reserve_capacity(size_t capacity) {
        nodes_by_index_.reserve(capacity);
    }
};
```

#### 3.3 Memory Pool Allocation

**Problem**: Memory fragmentation from frequent allocations
**Solution**: Implement memory pool for PDAG nodes

```cpp
class PdagMemoryPool {
private:
    struct Pool {
        std::vector<std::unique_ptr<char[]>> blocks_;
        std::vector<void*> free_list_;
        size_t block_size_;
        size_t used_ = 0;
    };
    
    std::vector<Pool> pools_;
    std::vector<size_t> pool_sizes_ = {1024, 4096, 16384, 65536};
    
public:
    PdagMemoryPool() {
        for (size_t size : pool_sizes_) {
            pools_.push_back({std::vector<std::unique_ptr<char[]>>(), 
                             std::vector<void*>(), size, 0});
        }
    }
    
    template<typename T, typename... Args>
    T* allocate(Args&&... args) {
        size_t size = sizeof(T);
        auto pool_index = select_pool(size);
        
        void* ptr = allocate_from_pool(pool_index, size);
        return new(ptr) T(std::forward<Args>(args)...);
    }
    
    void deallocate(void* ptr, size_t size) {
        auto pool_index = select_pool(size);
        return_to_pool(pool_index, ptr);
    }
    
private:
    size_t select_pool(size_t size) {
        for (size_t i = 0; i < pool_sizes_.size(); ++i) {
            if (size <= pool_sizes_[i]) {
                return i;
            }
        }
        return pool_sizes_.size() - 1;
    }
    
    void* allocate_from_pool(size_t pool_index, size_t size) {
        Pool& pool = pools_[pool_index];
        
        // Try to reuse from free list
        if (!pool.free_list_.empty()) {
            void* ptr = pool.free_list_.back();
            pool.free_list_.pop_back();
            return ptr;
        }
        
        // Allocate new block
        auto block = std::make_unique<char[]>(pool.block_size_);
        void* ptr = block.get();
        pool.blocks_.push_back(std::move(block));
        pool.used_ += size;
        
        return ptr;
    }
    
    void return_to_pool(size_t pool_index, void* ptr) {
        Pool& pool = pools_[pool_index];
        pool.free_list_.push_back(ptr);
    }
};
```

### Phase 4: Preallocation and Caching (Weeks 7-8)
**Expected Impact**: 1.1-1.3x speedup for construction and traversal

#### 4.1 Preallocation Strategy

**Problem**: Frequent reallocations during PDAG construction
**Solution**: Preallocate containers based on model size estimates

```cpp
class PreallocatedPdagBuilder {
public:
    Pdag(const mef::Gate& root, bool ccf, const mef::Model* model) noexcept {
        // Estimate sizes and preallocate
        size_t estimated_vars = estimate_variable_count(root);
        size_t estimated_gates = estimate_gate_count(root);
        
        // Preallocate containers
        basic_events_.reserve(estimated_vars);
        gates_.reserve(estimated_gates);
        nodes_by_index_.reserve(estimated_vars + estimated_gates);
        
        // Preallocate memory pool
        memory_pool_.reserve_capacity(estimated_vars + estimated_gates);
        
        // Build PDAG with preallocated resources
        BuildPdag(root, ccf, model);
    }
    
private:
    size_t estimate_variable_count(const mef::Gate& root) {
        // Traverse formula to count basic events
        size_t count = 0;
        CountBasicEvents(root.formula(), count);
        return count;
    }
    
    size_t estimate_gate_count(const mef::Gate& root) {
        // Traverse formula to count gates
        size_t count = 0;
        CountGates(root.formula(), count);
        return count;
    }
};
```

#### 4.2 Caching and Memoization

**Problem**: Repeated computations during preprocessing
**Solution**: Cache results of expensive operations

```cpp
class CachedPreprocessor {
private:
    mutable std::unordered_map<Gate*, std::vector<Gate*>> parent_cache_;
    mutable std::unordered_map<Gate*, bool> module_cache_;
    mutable std::unordered_map<Gate*, std::vector<Gate*>> children_cache_;
    
public:
    const std::vector<Gate*>& get_parents(Gate* gate) const {
        auto it = parent_cache_.find(gate);
        if (it != parent_cache_.end()) {
            return it->second;
        }
        
        // Compute and cache
        auto parents = compute_parents(gate);
        parent_cache_[gate] = std::move(parents);
        return parent_cache_[gate];
    }
    
    bool is_module(Gate* gate) const {
        auto it = module_cache_.find(gate);
        if (it != module_cache_.end()) {
            return it->second;
        }
        
        // Compute and cache
        bool result = compute_module_status(gate);
        module_cache_[gate] = result;
        return result;
    }
    
    const std::vector<Gate*>& get_children(Gate* gate) const {
        auto it = children_cache_.find(gate);
        if (it != children_cache_.end()) {
            return it->second;
        }
        
        // Compute and cache
        auto children = compute_children(gate);
        children_cache_[gate] = std::move(children);
        return children_cache_[gate];
    }
    
    void invalidate_cache(Gate* gate) {
        parent_cache_.erase(gate);
        module_cache_.erase(gate);
        children_cache_.erase(gate);
    }
    
    void clear_cache() {
        parent_cache_.clear();
        module_cache_.clear();
        children_cache_.clear();
    }
};
```

## Implementation Timeline

### Week 1: Preprocessing Redundancy Elimination
- **Day 1-2**: Implement SmartModuleDetector
- **Day 3-4**: Implement IncrementalCoalescer
- **Day 5**: Implement DependencyAwarePreprocessor
- **Day 6-7**: Testing and validation

### Week 2: Preprocessing Optimization Completion
- **Day 1-2**: Optimize Phase 3-5 preprocessing
- **Day 3-4**: Add change detection throughout preprocessing
- **Day 5-7**: Comprehensive testing and performance measurement

### Week 3: Parallel Construction Foundation
- **Day 1-2**: Implement ThreadPool infrastructure
- **Day 3-4**: Parallelize fault tree PDAG construction
- **Day 5-7**: Testing and thread safety validation

### Week 4: Parallel Construction Completion
- **Day 1-2**: Parallelize event tree sequence processing
- **Day 3-4**: Implement parallel preprocessing where possible
- **Day 5-7**: Performance testing and optimization

### Week 5: Memory Optimization
- **Day 1-2**: Implement OptimizedNodeParentManager
- **Day 3-4**: Implement OptimizedIndexManager
- **Day 5-7**: Memory usage analysis and optimization

### Week 6: Memory Pool Implementation
- **Day 1-3**: Implement PdagMemoryPool
- **Day 4-5**: Integrate memory pool with PDAG construction
- **Day 6-7**: Memory usage testing and optimization

### Week 7: Preallocation and Caching
- **Day 1-2**: Implement PreallocatedPdagBuilder
- **Day 3-4**: Implement CachedPreprocessor
- **Day 5-7**: Integration and testing

### Week 8: Integration and Final Optimization
- **Day 1-3**: Integrate all optimizations
- **Day 4-5**: Comprehensive performance testing
- **Day 6-7**: Bug fixes and final optimization

## Expected Performance Gains

### Phase 1 Results
- **Preprocessing Time**: 5-10x faster
- **Overall PDAG Building**: 4-8x faster
- **Total Workflow**: 3-6x faster

### Phase 2 Results
- **PDAG Construction**: 3-6x faster
- **Overall Workflow**: 2-4x faster

### Phase 3 Results
- **Traversal Operations**: 1.5-2x faster
- **Memory Usage**: 20-30% reduction
- **Overall Workflow**: Additional 1.2-1.5x improvement

### Phase 4 Results
- **Construction Time**: 1.1-1.3x faster
- **Memory Allocation**: 50-70% reduction
- **Cache Performance**: 1.2-1.4x faster for repeated operations

### Combined Impact
- **Total Workflow Speedup**: **8-15x faster**
- **Memory Usage**: **30-50% reduction**
- **Scalability**: **Linear scaling with CPU cores**

## Success Metrics

### Performance Metrics
- Preprocessing time reduction: Target 80-90%
- PDAG construction time reduction: Target 70-80%
- Overall workflow time reduction: Target 80-90%
- Memory usage reduction: Target 30-50%

### Quality Metrics
- Zero regression in analysis accuracy
- Maintained thread safety
- Preserved memory safety
- No increase in code complexity

## Risk Mitigation

### Technical Risks
- **Race Conditions**: Comprehensive thread safety testing
- **Memory Leaks**: Valgrind/AddressSanitizer testing
- **Performance Regression**: Continuous benchmarking

### Implementation Risks
- **Scope Creep**: Strict adherence to priority order
- **Integration Issues**: Incremental integration with rollback capability
- **Testing Gaps**: Comprehensive test suite expansion

## Future Considerations

### Low-Priority Optimizations (Post-Phase 4)
1. **XML Parsing Optimization**: 1.1-1.2x speedup (only 5-10% of total time)
2. **MEF Object Creation Optimization**: 1.1-1.2x speedup (only 5-10% of total time)
3. **Formula Creation Optimization**: 1.05-1.1x speedup (only 2-5% of total time)
4. **Advanced Memory Pool Allocation**: 1.2-1.3x speedup (high complexity)
5. **Incremental PDAG Construction**: 1.5-2x speedup (only for incremental scenarios)
6. **Specialized Event Tree Optimizations**: 2-3x speedup (specialized use case)
7. **Specialized Fault Tree Optimizations**: 1.5-2x speedup (specialized use case)

## Conclusion

This optimization plan focuses on the **highest impact changes** that will provide **8-15x speedup** in the SCRAM workflow from input processing to analysis-ready PDAGs. The plan prioritizes:

1. **Eliminating preprocessing redundancies** (biggest win)
2. **Parallelizing PDAG construction** (significant win)
3. **Optimizing memory usage and data structures** (moderate win)
4. **Adding preallocation and caching** (small but consistent wins)

The implementation follows the **80/20 rule** - focusing on the optimizations that provide 80% of the performance improvement with 20% of the effort.
