#include <boost/test/unit_test.hpp>

#include <cstdint>
#include "canopy/sampler.h"

BOOST_AUTO_TEST_SUITE(SamplerBitpackTests)

BOOST_AUTO_TEST_CASE(BasicMultiBatchGenerationTest)
{
    // Define probabilities
    // two events, 6 batches each
    std::vector<std::vector<double>> probs = {
        {0.5, 0.6, 0.4, 0.5, 0.6, 0.4},  // Probabilities for event 0
        {0.9, 0.9, 0.9, 0.9, 0.9, 0.9}   // Probabilities for event 1
    };

    std::size_t n_sample_packs_per_probability = 8;

    // Generate Bernoulli samples
    auto packed_bits = canopy::random::sampler::generate_bernoulli<double, uint8_t>(probs, n_sample_packs_per_probability);

    // Output results
    for (std::size_t i = 0; i < packed_bits.size(); ++i) {
        for (std::size_t j = 0; j < packed_bits[i].size(); ++j) {
            std::cout << "Event " << i << ", Batch " << j << ": ";
            for (const auto& val : packed_bits[i][j]) {
                std::cout << static_cast<int>(val) << " ";
            }
            std::cout << std::endl;
        }
    }
}

BOOST_AUTO_TEST_CASE(BasicBroadcastBatchGenerationTest)
{
    // Define probabilities
    // two events
    std::vector<float_t> probs = {0.3, 0.9};

    // batch size is 5, sample size is 8
    auto batch_size = 5;
    auto sample_size = 8;

    // Generate Bernoulli samples
    auto packed_bits = canopy::random::sampler::generate_bernoulli<float_t, uint64_t>(probs, batch_size, sample_size);

    // Output results
    for (std::size_t i = 0; i < packed_bits.size(); ++i) {
        for (std::size_t j = 0; j < packed_bits[i].size(); ++j) {
            std::cout << "Event " << i << ", Batch " << j << ": ";
            for (const auto& val : packed_bits[i][j]) {
                std::cout << static_cast<uint64_t>(val) << " ";
            }
            std::cout << std::endl;
        }
    }
}

BOOST_AUTO_TEST_CASE(BasicLargeGenerationTest)
{
    // Define probabilities
    std::vector<std::vector<double>> probs = {
        {0.5},  // Probabilities for event 0
        {0.1}   // Probabilities for event 1
    };

    std::size_t n_sample_packs_per_probability = 1e3;

    // Generate Bernoulli samples
    auto packed_bits = canopy::random::sampler::generate_bernoulli<double, uint8_t>(probs, n_sample_packs_per_probability);
}
}