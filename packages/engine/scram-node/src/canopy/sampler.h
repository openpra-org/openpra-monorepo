#pragma once

#include <omp.h>
#include <random>
#include <vector>

namespace canopy::random {

class sampler {
  public:
    template <typename DataType> static std::size_t _compute_bits_in_dtype() { return sizeof(DataType) * 8; }

    template <typename BitpackDataType> struct SampleShape {
        std::size_t num_events{};
        std::size_t batch_size{};
        std::size_t num_bits_per_pack{};
        std::size_t num_bits{};
        std::vector<std::size_t> sample_shape;
        std::vector<std::size_t> samples_reshaped_shape;
    };

    template <typename ProbType, typename BitpackDataType>
    static SampleShape<BitpackDataType> _compute_sample_shape(const std::vector<std::vector<ProbType>> &probs,
                                                              const std::size_t n_sample_packs_per_probability) {
        SampleShape<BitpackDataType> ss;

        ss.num_events = probs.size();
        ss.batch_size = probs[0].size();
        ss.num_bits_per_pack = _compute_bits_in_dtype<BitpackDataType>();
        ss.num_bits = ss.num_bits_per_pack * n_sample_packs_per_probability;

        ss.sample_shape = {ss.num_events, ss.batch_size, ss.num_bits};
        ss.samples_reshaped_shape = {ss.num_events, ss.batch_size, n_sample_packs_per_probability,
                                     ss.num_bits_per_pack};

        return ss;
    }

    template <typename ProbType, typename BitpackDataType>
    static SampleShape<BitpackDataType> _compute_sample_shape(const std::size_t num_events,
                                                              const std::size_t batch_size,
                                                              const std::size_t n_sample_packs_per_probability) {
        SampleShape<BitpackDataType> ss;

        ss.num_events = num_events;
        ss.batch_size = batch_size;
        ss.num_bits_per_pack = _compute_bits_in_dtype<BitpackDataType>();
        ss.num_bits = ss.num_bits_per_pack * n_sample_packs_per_probability;

        ss.sample_shape = {ss.num_events, ss.batch_size, ss.num_bits};
        ss.samples_reshaped_shape = {ss.num_events, ss.batch_size, n_sample_packs_per_probability,
                                     ss.num_bits_per_pack};

        return ss;
    }

    template <typename BitpackDataType> static std::vector<BitpackDataType> _compute_bit_positions() {
        std::size_t num_bits = _compute_bits_in_dtype<BitpackDataType>();
        std::vector<BitpackDataType> positions(num_bits);
        for (std::size_t i = 0; i < num_bits; ++i) {
            positions[i] = static_cast<BitpackDataType>(i);
        }
        return positions;
    }

    template <typename ProbType, typename BitpackDataType, typename SampleType = double>
    static std::vector<std::vector<std::vector<BitpackDataType>>>
    generate_bernoulli(const std::vector<std::vector<ProbType>> &probs,
                       const std::size_t n_sample_packs_per_probability) {
        // Step 1: Compute Sample Shapes
        auto ss = _compute_sample_shape<ProbType, BitpackDataType>(probs, n_sample_packs_per_probability);
        const auto num_events = ss.num_events;
        const auto batch_size = ss.batch_size;
        const auto num_bits_per_pack = ss.num_bits_per_pack;
        const auto num_bits = ss.num_bits;

        // Step 2: Prepare Probability Data
        // Flatten the 2D probability vector into a 1D vector for easy access
        std::vector<ProbType> probs_flat;
        probs_flat.reserve(num_events * batch_size);
        for (const auto &event_probs : probs) {
            probs_flat.insert(probs_flat.end(), event_probs.begin(), event_probs.end());
        }

        // Step 3: Initialize Random Number Generators for Each Thread
        const int max_threads = omp_get_max_threads();
        std::vector<std::mt19937> rng_engines(max_threads);

        // Seed each RNG differently using a seed sequence
        std::seed_seq seed_seq{std::random_device{}(), std::random_device{}(), std::random_device{}()};
        std::vector<uint32_t> seeds(max_threads);
        seed_seq.generate(seeds.begin(), seeds.end());

        for (int i = 0; i < max_threads; ++i) {
            rng_engines[i].seed(seeds[i]);
        }

        // Step 4: Generate Bernoulli Samples
        // Initialize the samples vector
        // Dimensions: [num_events][batch_size][num_bits]
        std::vector<std::vector<std::vector<BitpackDataType>>> samples(
            num_events, std::vector<std::vector<BitpackDataType>>(batch_size, std::vector<BitpackDataType>(num_bits)));

// Parallelize the sample generation
#pragma omp parallel for collapse(2) schedule(static)
        for (std::size_t i = 0; i < num_events; ++i) {
            for (std::size_t j = 0; j < batch_size; ++j) {

                // Each thread gets its own RNG
                int thread_id = omp_get_thread_num();
                std::mt19937 &rng_engine = rng_engines[thread_id];
                std::uniform_real_distribution<SampleType> uniform_dist(0.0, 1.0);

                std::size_t idx_probs = i * batch_size + j;
                ProbType prob = probs_flat[idx_probs];

                for (std::size_t k = 0; k < num_bits; ++k) {
                    SampleType rnd = uniform_dist(rng_engine);
                    samples[i][j][k] = rnd < prob ? 1 : 0;
                }
            }
        }

        // Step 5: Compute Bit Positions (This is already thread-safe)
        auto positions = _compute_bit_positions<BitpackDataType>();

        // Step 6: Perform Bit-Packing
        // Initialize the packed bits vector
        // Dimensions: [num_events][batch_size][n_sample_packs_per_probability]
        std::vector<std::vector<std::vector<BitpackDataType>>> packed_bits(
            num_events, std::vector<std::vector<BitpackDataType>>(
                            batch_size, std::vector<BitpackDataType>(n_sample_packs_per_probability)));

// Parallelize the bit-packing
#pragma omp parallel for collapse(2) schedule(static)
        for (std::size_t i = 0; i < num_events; ++i) {
            for (std::size_t j = 0; j < batch_size; ++j) {
                for (std::size_t p = 0; p < n_sample_packs_per_probability; ++p) {
                    BitpackDataType packed_value = 0;

                    for (std::size_t b = 0; b < num_bits_per_pack; ++b) {
                        std::size_t k = p * num_bits_per_pack + b;
                        // if (k >= num_bits) {
                        //     // This should not happen, but guard against out-of-bounds
                        //     break;
                        // }

                        BitpackDataType sample_bit = samples[i][j][k];
                        BitpackDataType position = positions[b];

                        BitpackDataType shifted_bit = sample_bit << position;
                        packed_value |= shifted_bit;
                    }

                    packed_bits[i][j][p] = packed_value;
                }
            }
        }

        // Step 7: Return the Packed Bits
        return packed_bits;
    }

    template <typename ProbType, typename BitpackDataType, typename SampleType = double>
    static std::vector<std::vector<std::vector<BitpackDataType>>>
    generate_bernoulli(const std::vector<ProbType> &probs, const std::size_t batch_size,
                       const std::size_t n_sample_packs_per_probability) {
        // Step 1: Compute Sample Shapes
        const std::size_t num_events = probs.size();
        auto ss =
            _compute_sample_shape<ProbType, BitpackDataType>(num_events, batch_size, n_sample_packs_per_probability);
        const auto num_bits_per_pack = ss.num_bits_per_pack;
        const auto num_bits = ss.num_bits;

        // Step 3: Initialize Random Number Generators for Each Thread
        const int max_threads = omp_get_max_threads();
        std::vector<std::mt19937> rng_engines(max_threads);

        // Seed each RNG differently using a seed sequence
        std::seed_seq seed_seq{std::random_device{}(), std::random_device{}(), std::random_device{}()};
        std::vector<uint32_t> seeds(max_threads);
        seed_seq.generate(seeds.begin(), seeds.end());

        for (int i = 0; i < max_threads; ++i) {
            rng_engines[i].seed(seeds[i]);
        }

        // Step 4: Generate Bernoulli Samples
        // Initialize the samples vector
        // Dimensions: [num_events][batch_size][num_bits]
        std::vector<std::vector<std::vector<BitpackDataType>>> samples(
            num_events, std::vector<std::vector<BitpackDataType>>(batch_size, std::vector<BitpackDataType>(num_bits)));

// Parallelize the sample generation
#pragma omp parallel for collapse(2) schedule(static)
        for (std::size_t i = 0; i < num_events; ++i) {
            for (std::size_t j = 0; j < batch_size; ++j) {

                // Each thread gets its own RNG
                int thread_id = omp_get_thread_num();
                std::mt19937 &rng_engine = rng_engines[thread_id];
                std::uniform_real_distribution<SampleType> uniform_dist(0.0, 1.0);

                // Use the probability for the current event
                ProbType prob = probs[i];

                for (std::size_t k = 0; k < num_bits; ++k) {
                    SampleType rnd = uniform_dist(rng_engine);
                    samples[i][j][k] = rnd < prob ? 1 : 0;
                }
            }
        }

        // Step 5: Compute Bit Positions
        auto positions = _compute_bit_positions<BitpackDataType>();

        // Step 6: Perform Bit-Packing
        // Initialize the packed bits vector
        // Dimensions: [num_events][batch_size][n_sample_packs_per_probability]
        std::vector<std::vector<std::vector<BitpackDataType>>> packed_bits(
            num_events, std::vector<std::vector<BitpackDataType>>(
                            batch_size, std::vector<BitpackDataType>(n_sample_packs_per_probability)));

// Parallelize the bit-packing
#pragma omp parallel for collapse(2) schedule(static)
        for (std::size_t i = 0; i < num_events; ++i) {
            for (std::size_t j = 0; j < batch_size; ++j) {
                for (std::size_t p = 0; p < n_sample_packs_per_probability; ++p) {
                    BitpackDataType packed_value = 0;

                    for (std::size_t b = 0; b < num_bits_per_pack; ++b) {
                        std::size_t k = p * num_bits_per_pack + b;

                        // // Guard against out-of-bounds access
                        // if (k >= num_bits) {
                        //     break;
                        // }

                        BitpackDataType sample_bit = samples[i][j][k];
                        BitpackDataType position = positions[b];

                        BitpackDataType shifted_bit = sample_bit << position;
                        packed_value |= shifted_bit;
                    }

                    packed_bits[i][j][p] = packed_value;
                }
            }
        }

        // Step 7: Return the Packed Bits
        return packed_bits;
    }
};

}