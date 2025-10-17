/**
 * @file queueable.h
 * @brief SYCL queueable computation abstractions for parallel execution
 * @author Arjun Earthperson
 * @date 2025
 * 
 * @details This file provides a hierarchy of queueable computation abstractions
 * for managing SYCL kernel execution with dependency tracking. The system enables
 * efficient parallel execution of computational graphs by handling kernel submission,
 * dependency management, and execution synchronization.
 * 
 * The queueable system consists of:
 * - Base class for dependency management and submission coordination
 * - Templated ranged kernel abstraction for ND-range computations
 * - Concrete queueable implementations for different execution patterns
 * - Support for iterative computations with state tracking
 * 
 * @copyright Copyright (C) 2025 Arjun Earthperson
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#pragma once

#include <sycl/sycl.hpp>
#include <vector>

namespace scram::mc::queue {

    /**
     * @class queueable_base
     * @brief Abstract base class for queueable SYCL computations with dependency management
     * 
     * @details The queueable_base class provides the foundation for managing SYCL kernel
     * execution with automatic dependency tracking and submission coordination. It handles
     * the common aspects of kernel submission including dependency resolution, event
     * management, and execution synchronization.
     * 
     * Key features:
     * - Automatic dependency tracking and resolution
     * - SYCL event management for synchronization
     * - Template method pattern for derived class customization
     * - Support for both vector and set-based dependency specification
     * 
     * @note This is an abstract base class - concrete implementations must override handle_submission()
     * @note All queueable objects maintain references to their dependencies for lifetime management
     * 
     * @example Basic usage pattern:
     * @code
     * class my_queueable : public queueable_base {
     * public:
     *     my_queueable(sycl::queue& q, const std::vector<std::shared_ptr<queueable_base>>& deps)
     *         : queueable_base(q, deps) {}
     * 
     * protected:
     *     void handle_submission(sycl::handler& cgh) override {
     *         // Define kernel execution logic here
     *         cgh.parallel_for(range, kernel);
     *     }
     * };
     * @endcode
     * 
     */
    struct queueable_base {
        /**
         * @brief Virtual destructor for proper cleanup of derived classes
         * 
         * @details Ensures proper destruction of derived queueable objects and
         * cleanup of any resources they may hold.
         * 
         * @note Default implementation is sufficient for most use cases
         */
        virtual ~queueable_base() = default;

        /**
         * @brief Constructs a queueable with vector-based dependencies
         * 
         * @details Creates a queueable computation that depends on the specified
         * vector of other queueable objects. Dependencies will be automatically
         * resolved during submission to ensure proper execution order.
         * 
         * @param queue SYCL queue for kernel execution
         * @param dependencies Vector of queueable objects this computation depends on
         * 
         * @note Dependencies are stored as shared_ptr to ensure proper lifetime management
         * @note The queue reference must remain valid for the lifetime of this object
         * 
         * @example
         * @code
         * std::vector<std::shared_ptr<queueable_base>> deps = {dep1, dep2, dep3};
         * auto queueable = std::make_shared<my_queueable>(queue, deps);
         * @endcode
         */
        explicit queueable_base(sycl::queue &queue, const std::vector<std::shared_ptr<queueable_base>> &dependencies)
            : queue_(queue), dependencies_(dependencies) {}

        /**
         * @brief Constructs a queueable with set-based dependencies
         * 
         * @details Creates a queueable computation that depends on the specified
         * set of other queueable objects. The set is converted to a vector for
         * internal storage, removing duplicates in the process.
         * 
         * @param queue SYCL queue for kernel execution
         * @param dependencies Set of queueable objects this computation depends on
         * 
         * @note Set-based construction automatically eliminates duplicate dependencies
         * @note Dependencies are stored internally as a vector for iteration efficiency
         * 
         * @example
         * @code
         * std::set<std::shared_ptr<queueable_base>> deps = {dep1, dep2, dep3};
         * auto queueable = std::make_shared<my_queueable>(queue, deps);
         * @endcode
         */
        explicit queueable_base(sycl::queue &queue, const std::set<std::shared_ptr<queueable_base>> &dependencies)
            : queue_(queue), dependencies_(dependencies.begin(), dependencies.end()) {}

        /**
         * @brief Constructs a queueable with no dependencies
         * 
         * @details Creates a queueable computation that has no dependencies and can
         * be executed immediately when submitted. Useful for initial computations
         * or computations that don't require synchronization with other kernels.
         * 
         * @param queue SYCL queue for kernel execution
         * 
         * @note No-dependency queueables can be submitted immediately
         * @note Still participates in the dependency system for dependent computations
         * 
         * @example
         * @code
         * auto independent_queueable = std::make_shared<my_queueable>(queue);
         * @endcode
         */
        explicit queueable_base(sycl::queue &queue)
            : queue_(queue), dependencies_(std::vector<std::shared_ptr<queueable_base>>{}) {}

    protected:
        /**
         * @brief Pure virtual method for derived classes to implement kernel submission
         * 
         * @details This method must be implemented by derived classes to define the
         * actual kernel execution logic. The base class handles dependency resolution
         * and submission coordination, while derived classes focus on the specific
         * computational work.
         * 
         * @param cgh SYCL command group handler for kernel submission
         * 
         * @note This method is called within a SYCL queue submission context
         * @note Dependencies are already resolved when this method is called
         * @note Implementation should use cgh.parallel_for() or similar SYCL constructs
         * 
         * @example Implementation pattern:
         * @code
         * void handle_submission(sycl::handler& cgh) override {
         *     // Set up accessors, local memory, etc.
         *     auto accessor = buffer.get_access<sycl::access::mode::read_write>(cgh);
         *     
         *     // Submit the kernel
         *     cgh.parallel_for(nd_range, [=](sycl::nd_item<1> item) {
         *         // Kernel logic here
         *     });
         * }
         * @endcode
         */
        virtual void handle_submission(sycl::handler& cgh) = 0;

    public:
        /**
         * @brief Submits the queueable computation for execution
         * 
         * @details Resolves all dependencies, submits the kernel to the SYCL queue,
         * and stores the resulting event for future synchronization. This method
         * coordinates the entire submission process including dependency management.
         * 
         * The submission process:
         * 1. Fetches events from all dependencies
         * 2. Submits kernel with dependency events
         * 3. Stores resulting event for future use
         * 
         * @note This method should be called only once per queueable object
         * @note Subsequent calls will reuse the stored event
         * @note Dependencies must be submitted before this queueable is submitted
         * 
         * @example
         * @code
         * // Submit dependencies first
         * dep1->submit();
         * dep2->submit();
         * 
         * // Submit this queueable
         * my_queueable->submit();
         * @endcode
         */
        sycl::event submit() {
            const std::vector<sycl::event> dependencies = fetch_dependencies();
            this->queued_event_ = perform_submission(dependencies);
            return this->queued_event_;
        }

    private:
        /// @brief SYCL queue reference for kernel execution
        sycl::queue &queue_;
        
        /// @brief SYCL event representing the completion of this queueable's execution
        sycl::event queued_event_;
        
        /// @brief Vector of dependent queueable objects that must complete before this one
        std::vector<std::shared_ptr<queueable_base>> dependencies_;

        /**
         * @brief Fetches SYCL events from all dependencies
         * 
         * @details Collects the completion events from all dependent queueable objects
         * to create a dependency list for kernel submission. This ensures proper
         * execution ordering in the SYCL execution graph.
         * 
         * @return Vector of SYCL events representing dependency completion
         * 
         * @note Dependencies must have been submitted before calling this method
         * @note Returned events are used by SYCL for automatic synchronization
         * 
         * @example Internal usage:
         * @code
         * const std::vector<sycl::event> dep_events = fetch_dependencies();
         * // dep_events contains events from all dependencies
         * @endcode
         */
        [[nodiscard]] std::vector<sycl::event> fetch_dependencies() const {
            std::vector<sycl::event> dep_events;
            dep_events.reserve(dependencies_.size());
            for (const std::shared_ptr<queueable_base> &dep: this->dependencies_) {
                dep_events.push_back(dep->queued_event_);
            }
            return dep_events;
        }

        /**
         * @brief Performs the actual SYCL kernel submission
         * 
         * @details Submits the kernel to the SYCL queue with the specified dependencies,
         * delegating the actual kernel definition to the derived class through
         * handle_submission(). This method implements the template method pattern.
         * 
         * @param dependencies Vector of SYCL events this submission depends on
         * @return SYCL event representing the completion of this submission
         * 
         * @note This method is called only once during the submission process
         * @note The returned event is stored for future dependency resolution
         * 
         * @example Internal workflow:
         * @code
         * sycl::event e = perform_submission(dependency_events);
         * // event can now be used by dependent computations
         * @endcode
         */
        sycl::event perform_submission(const std::vector<sycl::event> &dependencies) {
            return queue_.submit([&](sycl::handler &cgh) { // The actual queue submission is done once, here in the base class
              cgh.depends_on(dependencies);
              handle_submission(cgh); // Defer to the derived class for the actual commands
            });
        }
    };

    /**
     * @class ranged_kernel
     * @brief Intermediate base class for ND-range SYCL kernel execution
     * 
     * @details The ranged_kernel class extends queueable_base to provide specific
     * support for ND-range parallel kernels. It manages the kernel object and
     * execution range while inheriting dependency management from the base class.
     * 
     * This class serves as an intermediate layer between the general queueable_base
     * and specific kernel execution implementations, providing common functionality
     * for ND-range computations.
     * 
     * @tparam kernel_t_ Type of the kernel functor or lambda
     * @tparam n_dim_ Number of dimensions for the ND-range (1, 2, or 3)
     * 
     * @note This class is not meant to be instantiated directly
     * @note Derived classes must implement handle_submission() to define execution behavior
     * 
     * @example Typical usage in derived class:
     * @code
     * class my_ranged_kernel : public ranged_kernel<my_kernel_t, 2> {
     * public:
     *     my_ranged_kernel(sycl::queue& q, const my_kernel_t& k, const sycl::nd_range<2>& r)
     *         : ranged_kernel(q, k, r) {}
     * 
     * protected:
     *     void handle_submission(sycl::handler& cgh) override {
     *         // Use this->kernel_ and this->nd_range_
     *     }
     * };
     * @endcode
     * 

     */
    template<typename kernel_t_, int n_dim_>
    struct ranged_kernel : queueable_base {

        /**
         * @brief Constructs a ranged kernel with vector-based dependencies
         * 
         * @details Creates a ranged kernel computation with the specified kernel,
         * execution range, and vector of dependencies. The kernel and range are
         * stored for later execution during submission.
         * 
         * @param queue SYCL queue for kernel execution
         * @param kernel Kernel functor or lambda to execute
         * @param nd_range ND-range defining the execution dimensions and work-group structure
         * @param dependencies Vector of queueable objects this computation depends on
         * 
         * @note The kernel object is stored by copy - ensure it's lightweight or use std::ref
         * @note The nd_range defines both global and local work sizes
         * 
         * @example
         * @code
         * auto kernel = [=](sycl::nd_item<2> item) { * kernel logic * };
         * sycl::nd_range<2> range(sycl::range<2>(1024, 1024), sycl::range<2>(16, 16));
         * std::vector<std::shared_ptr<queueable_base>> deps = {dep1, dep2};
         * auto ranged = std::make_shared<my_ranged_kernel>(queue, kernel, range, deps);
         * @endcode
         */
        ranged_kernel(
                sycl::queue &queue,
                const kernel_t_ &kernel,
                const sycl::nd_range<n_dim_> &nd_range,
                const std::vector<std::shared_ptr<queueable_base>> &dependencies)
        : queueable_base(queue, dependencies),
        kernel_(kernel), nd_range_(nd_range) {}

        /**
         * @brief Constructs a ranged kernel with set-based dependencies
         * 
         * @details Creates a ranged kernel computation with the specified kernel,
         * execution range, and set of dependencies. Duplicate dependencies are
         * automatically eliminated through the set interface.
         * 
         * @param queue SYCL queue for kernel execution
         * @param kernel Kernel functor or lambda to execute
         * @param nd_range ND-range defining the execution dimensions and work-group structure
         * @param dependencies Set of queueable objects this computation depends on
         * 
         * @note Set-based construction eliminates duplicate dependencies automatically
         * @note Useful when dependency relationships are complex or dynamically generated
         * 
         * @example
         * @code
         * auto kernel = [=](sycl::nd_item<1> item) { * kernel logic * };
         * sycl::nd_range<1> range(sycl::range<1>(1024), sycl::range<1>(256));
         * std::set<std::shared_ptr<queueable_base>> deps = {dep1, dep2, dep3};
         * auto ranged = std::make_shared<my_ranged_kernel>(queue, kernel, range, deps);
         * @endcode
         */
        ranged_kernel(
                sycl::queue &queue,
                const kernel_t_ &kernel,
                const sycl::nd_range<n_dim_> &nd_range,
                const std::set<std::shared_ptr<queueable_base>> &dependencies)
        : queueable_base(queue, dependencies),
        kernel_(kernel), nd_range_(nd_range) {}

        /**
         * @brief Constructs a ranged kernel with no dependencies
         * 
         * @details Creates a ranged kernel computation that can execute immediately
         * without waiting for other computations to complete. Useful for initial
         * computations or independent parallel work.
         * 
         * @param queue SYCL queue for kernel execution
         * @param kernel Kernel functor or lambda to execute
         * @param nd_range ND-range defining the execution dimensions and work-group structure
         * 
         * @note No-dependency ranged kernels can be submitted immediately
         * @note Still participates in the dependency system for dependent computations
         * 
         * @example
         * @code
         * auto kernel = [=](sycl::nd_item<3> item) { * kernel logic * };
         * sycl::nd_range<3> range(sycl::range<3>(64, 64, 64), sycl::range<3>(8, 8, 8));
         * auto ranged = std::make_shared<my_ranged_kernel>(queue, kernel, range);
         * @endcode
         */
        ranged_kernel(
                sycl::queue &queue,
                const kernel_t_ &kernel,
                const sycl::nd_range<n_dim_> &nd_range)
        : queueable_base(queue),
        kernel_(kernel), nd_range_(nd_range) {}

        protected:
            /// @brief Stored kernel functor or lambda for execution
            kernel_t_ kernel_;
            
            /// @brief ND-range defining execution dimensions and work-group structure
            sycl::nd_range<n_dim_> nd_range_;

    };

    /**
     * @class queueable
     * @brief Final concrete implementation for standard ND-range kernel execution
     * 
     * @details The queueable class provides a complete implementation for executing
     * ND-range SYCL kernels with dependency management. It implements the handle_submission()
     * method to perform standard parallel_for execution with the stored kernel and range.
     * 
     * This is the most commonly used queueable implementation for standard parallel
     * computations that don't require special execution patterns or iteration support.
     * 
     * @tparam kernel_t_ Type of the kernel functor or lambda
     * @tparam n_dim_ Number of dimensions for the ND-range (1, 2, or 3)
     * 
     * @note This class is final and cannot be further inherited
     * @note Provides standard one-shot kernel execution without iteration
     * 
     * @example Basic usage:
     * @code
     * // Define a simple kernel
     * auto kernel = [=](sycl::nd_item<1> item) {
     *     int idx = item.get_global_id(0);
     *     // Perform computation
     * };
     * 
     * // Create execution range
     * sycl::nd_range<1> range(sycl::range<1>(1024), sycl::range<1>(256));
     * 
     * // Create and submit queueable
     * auto computation = std::make_shared<queueable<decltype(kernel), 1>>(queue, kernel, range);
     * computation->submit();
     * @endcode
     * 

     */
    template<typename kernel_t_, int n_dim_>
    struct queueable final : ranged_kernel<kernel_t_, n_dim_> {

        /**
         * @brief Constructs a queueable with vector-based dependencies
         * 
         * @details Creates a standard queueable computation that will execute the
         * specified kernel over the given ND-range after all dependencies complete.
         * 
         * @param queue SYCL queue for kernel execution
         * @param kernel Kernel functor or lambda to execute
         * @param nd_range ND-range defining execution dimensions and work-group structure
         * @param dependencies Vector of queueable objects this computation depends on
         * 
         * @note Kernel execution is deferred until submit() is called
         * @note Dependencies are automatically resolved during submission
         * 
         * @example
         * @code
         * auto kernel = [=](sycl::nd_item<2> item) { * computation * };
         * sycl::nd_range<2> range(sycl::range<2>(1024, 1024), sycl::range<2>(32, 32));
         * std::vector<std::shared_ptr<queueable_base>> deps = {input_prep, memory_alloc};
         * auto compute = std::make_shared<queueable<decltype(kernel), 2>>(queue, kernel, range, deps);
         * @endcode
         */
        queueable(
                sycl::queue &queue,
                const kernel_t_ &kernel,
                const sycl::nd_range<n_dim_> &nd_range,
                const std::vector<std::shared_ptr<queueable_base>> &dependencies)
        : ranged_kernel<kernel_t_, n_dim_>(queue, kernel, nd_range, dependencies) {}

        /**
         * @brief Constructs a queueable with set-based dependencies
         * 
         * @details Creates a standard queueable computation with automatic duplicate
         * dependency elimination through the set interface.
         * 
         * @param queue SYCL queue for kernel execution
         * @param kernel Kernel functor or lambda to execute
         * @param nd_range ND-range defining execution dimensions and work-group structure
         * @param dependencies Set of queueable objects this computation depends on
         * 
         * @note Set interface automatically eliminates duplicate dependencies
         * @note Useful for complex dependency graphs with potential overlaps
         * 
         * @example
         * @code
         * auto kernel = [=](sycl::nd_item<1> item) { * computation * };
         * sycl::nd_range<1> range(sycl::range<1>(2048), sycl::range<1>(64));
         * std::set<std::shared_ptr<queueable_base>> deps = {dep1, dep2, dep3, dep2}; // dep2 duplicate removed
         * auto compute = std::make_shared<queueable<decltype(kernel), 1>>(queue, kernel, range, deps);
         * @endcode
         */
        queueable(
                sycl::queue &queue,
                const kernel_t_ &kernel,
                const sycl::nd_range<n_dim_> &nd_range,
                const std::set<std::shared_ptr<queueable_base>> &dependencies)
        : ranged_kernel<kernel_t_, n_dim_>(queue, kernel, nd_range, dependencies) {}

        /**
         * @brief Constructs a queueable with no dependencies
         * 
         * @details Creates a standard queueable computation that can execute immediately
         * without waiting for other computations. Ideal for independent parallel work.
         * 
         * @param queue SYCL queue for kernel execution
         * @param kernel Kernel functor or lambda to execute
         * @param nd_range ND-range defining execution dimensions and work-group structure
         * 
         * @note Can be submitted immediately after construction
         * @note Still provides synchronization events for dependent computations
         * 
         * @example
         * @code
         * auto kernel = [=](sycl::nd_item<3> item) { * independent computation * };
         * sycl::nd_range<3> range(sycl::range<3>(128, 128, 128), sycl::range<3>(4, 4, 4));
         * auto compute = std::make_shared<queueable<decltype(kernel), 3>>(queue, kernel, range);
         * compute->submit(); // Can submit immediately
         * @endcode
         */
        queueable(
                sycl::queue &queue,
                const kernel_t_ &kernel,
                const sycl::nd_range<n_dim_> &nd_range)
        : ranged_kernel<kernel_t_, n_dim_>(queue, kernel, nd_range) {}

        /**
         * @brief Implements kernel submission for standard parallel execution
         * 
         * @details Submits the stored kernel for execution over the specified ND-range
         * using SYCL's parallel_for construct. This provides the standard execution
         * pattern for most parallel computations.
         * 
         * @param cgh SYCL command group handler for kernel submission
         * 
         * @note This method is called automatically during the submission process
         * @note Dependencies are already resolved when this method is called
         * @note Uses standard SYCL parallel_for for maximum compatibility
         * 
         * @example Implementation details:
         * @code
         * void handle_submission(sycl::handler &cgh) override {
         *     // Standard parallel_for execution
         *     cgh.parallel_for(this->nd_range_, this->kernel_);
         * }
         * @endcode
         */
        void handle_submission(sycl::handler &cgh) override {
            cgh.parallel_for(this->nd_range_, this->kernel_);
        }
    };

    /**
     * @class iterable_queueable
     * @brief Final concrete implementation for iterative ND-range kernel execution
     * 
     * @details The iterable_queueable class extends the standard queueable to support
     * iterative execution patterns where the kernel needs to track iteration state.
     * Each submission increments an iteration counter that is passed to the kernel,
     * enabling algorithms that require iteration awareness.
     * 
     * This is particularly useful for iterative algorithms, Monte Carlo simulations,
     * or any computation that needs to track how many times it has been executed.
     * 
     * @tparam kernel_t_ Type of the kernel functor or lambda (must accept iteration parameter)
     * @tparam n_dim_ Number of dimensions for the ND-range (1, 2, or 3)
     * 
     * @note This class is final and cannot be further inherited
     * @note Kernel must accept an iteration parameter as its second argument
     * @note Iteration counter starts at 0 and increments on each submission
     * 
     * @example Usage with iterative kernel:
     * @code
     * // Define an iteration-aware kernel
     * auto kernel = [=](sycl::nd_item<1> item, std::uint32_t iteration) {
     *     int idx = item.get_global_id(0);
     *     // Use iteration count in computation
     *     result[idx] += iteration * compute_value(idx);
     * };
     * 
     * // Create iterable queueable
     * sycl::nd_range<1> range(sycl::range<1>(1024), sycl::range<1>(256));
     * auto iterative = std::make_shared<iterable_queueable<decltype(kernel), 1>>(queue, kernel, range);
     * 
     * // Submit multiple times for iteration
     * iterative->submit(); // iteration = 1
     * iterative->submit(); // iteration = 2
     * iterative->submit(); // iteration = 3
     * @endcode
     * 
     */
    template<typename kernel_t_, int n_dim_>
    struct iterable_queueable final : ranged_kernel<kernel_t_, n_dim_> {

        /// @brief Current iteration counter, incremented on each submission
        std::uint32_t iteration_ = 0;

        /**
         * @brief Constructs an iterable queueable with vector-based dependencies
         * 
         * @details Creates an iterable queueable computation that tracks execution
         * iterations and passes the iteration count to the kernel. The iteration
         * counter starts at 0 and increments with each submission.
         * 
         * @param queue SYCL queue for kernel execution
         * @param kernel Kernel functor or lambda that accepts iteration parameter
         * @param nd_range ND-range defining execution dimensions and work-group structure
         * @param dependencies Vector of queueable objects this computation depends on
         * 
         * @note Kernel must accept (sycl::nd_item<n_dim_>, std::uint32_t) parameters
         * @note Iteration counter is local to each queueable instance
         * 
         * @example
         * @code
         * auto kernel = [=](sycl::nd_item<1> item, std::uint32_t iter) {
         *     // Use iter in computation
         * };
         * sycl::nd_range<1> range(sycl::range<1>(1024), sycl::range<1>(64));
         * std::vector<std::shared_ptr<queueable_base>> deps = {setup_dep};
         * auto iter_compute = std::make_shared<iterable_queueable<decltype(kernel), 1>>(
         *     queue, kernel, range, deps);
         * @endcode
         */
        iterable_queueable(
                sycl::queue &queue,
                const kernel_t_ &kernel,
                const sycl::nd_range<n_dim_> &nd_range,
                const std::vector<std::shared_ptr<queueable_base>> &dependencies)
        : ranged_kernel<kernel_t_, n_dim_>(queue, kernel, nd_range, dependencies) {}

        /**
         * @brief Constructs an iterable queueable with set-based dependencies
         * 
         * @details Creates an iterable queueable computation with automatic duplicate
         * dependency elimination and iteration tracking support.
         * 
         * @param queue SYCL queue for kernel execution
         * @param kernel Kernel functor or lambda that accepts iteration parameter
         * @param nd_range ND-range defining execution dimensions and work-group structure
         * @param dependencies Set of queueable objects this computation depends on
         * 
         * @note Set interface eliminates duplicate dependencies automatically
         * @note Iteration counter is independent of dependency structure
         * 
         * @example
         * @code
         * auto kernel = [=](sycl::nd_item<2> item, std::uint32_t iter) {
         *     // Iteration-aware 2D computation
         * };
         * sycl::nd_range<2> range(sycl::range<2>(512, 512), sycl::range<2>(16, 16));
         * std::set<std::shared_ptr<queueable_base>> deps = {dep1, dep2, dep3};
         * auto iter_compute = std::make_shared<iterable_queueable<decltype(kernel), 2>>(
         *     queue, kernel, range, deps);
         * @endcode
         */
        iterable_queueable(
                sycl::queue &queue,
                const kernel_t_ &kernel,
                const sycl::nd_range<n_dim_> &nd_range,
                const std::set<std::shared_ptr<queueable_base>> &dependencies)
        : ranged_kernel<kernel_t_, n_dim_>(queue, kernel, nd_range, dependencies) {}

        /**
         * @brief Constructs an iterable queueable with no dependencies
         * 
         * @details Creates an iterable queueable computation that can execute immediately
         * and tracks iteration state for algorithms requiring iteration awareness.
         * 
         * @param queue SYCL queue for kernel execution
         * @param kernel Kernel functor or lambda that accepts iteration parameter
         * @param nd_range ND-range defining execution dimensions and work-group structure
         * 
         * @note Can be submitted immediately for iterative execution
         * @note Each submission increments the iteration counter
         * 
         * @example
         * @code
         * auto kernel = [=](sycl::nd_item<1> item, std::uint32_t iter) {
         *     // Monte Carlo simulation with iteration tracking
         *     generate_samples(item.get_global_id(0), iter);
         * };
         * sycl::nd_range<1> range(sycl::range<1>(10000), sycl::range<1>(100));
         * auto monte_carlo = std::make_shared<iterable_queueable<decltype(kernel), 1>>(
         *     queue, kernel, range);
         * @endcode
         */
        iterable_queueable(
                sycl::queue &queue,
                const kernel_t_ &kernel,
                const sycl::nd_range<n_dim_> &nd_range)
        : ranged_kernel<kernel_t_, n_dim_>(queue, kernel, nd_range) {}

        /**
         * @brief Implements kernel submission with iteration tracking
         * 
         * @details Submits the kernel for execution with an incremented iteration counter.
         * The iteration count is captured locally and passed to the kernel, enabling
         * iteration-aware computations while maintaining thread safety.
         * 
         * @param cgh SYCL command group handler for kernel submission
         * 
         * @note Iteration counter is incremented before kernel submission
         * @note Iteration count is captured by value for thread safety
         * @note Kernel receives both nd_item and iteration parameters
         * 
         * @example Implementation details:
         * @code
         * void handle_submission(sycl::handler &cgh) override {
         *     const auto iteration_local = ++iteration_;
         *     auto kernel = this->kernel_;
         *     cgh.parallel_for(this->nd_range_, [=](const sycl::nd_item<n_dim_> &item) {
         *         kernel(item, iteration_local);
         *     });
         * }
         * @endcode
         */
        void handle_submission(sycl::handler &cgh) override {
            const auto iteration_local = ++iteration_;
            auto kernel = this->kernel_;
            cgh.parallel_for(this->nd_range_, [=](const sycl::nd_item<n_dim_> &item) {
                kernel(item, iteration_local);
            });
        }
    };
}// namespace scram::mc::queue
