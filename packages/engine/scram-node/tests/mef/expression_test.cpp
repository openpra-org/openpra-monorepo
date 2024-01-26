#include <boost/test/unit_test.hpp>
#include "expression.h"
#include "error.h"

using namespace scram::mef;

// Mock expression for testing purposes
class MockExpression : public Expression {
public:
  explicit MockExpression(double value) : value_(value) {}

  double value() noexcept override { return value_; }

  double DoSample() noexcept override { return value_; }

private:
  double value_;
};

BOOST_AUTO_TEST_CASE(test_expression_value) {
  /// @brief Test the value method of the Expression class.
  /// @details This test checks if the value method returns the correct value
  ///          for a mock expression.
  MockExpression expr(5.0);
  BOOST_CHECK_EQUAL(expr.value(), 5.0);
}

BOOST_AUTO_TEST_CASE(test_expression_interval) {
  /// @brief Test the interval method of the Expression class.
  /// @details This test checks if the interval method returns the correct interval
  ///          for a mock expression.
  MockExpression expr(5.0);
  Interval interval = expr.interval();
  BOOST_CHECK_EQUAL(interval.lower(), 5.0);
  BOOST_CHECK_EQUAL(interval.upper(), 5.0);
}

BOOST_AUTO_TEST_CASE(test_expression_sample) {
  /// @brief Test the Sample method of the Expression class.
  /// @details This test checks if the Sample method returns the correct sampled
  ///          value for a mock expression.
  MockExpression expr(5.0);
  BOOST_CHECK_EQUAL(expr.Sample(), 5.0);
}

BOOST_AUTO_TEST_CASE(test_expression_reset) {
  /// @brief Test the Reset method of the Expression class.
  /// @details This test checks if the Reset method correctly resets the sampled
  ///          state of a mock expression.
  MockExpression expr(5.0);
  expr.Sample(); // Set the sampled state to true
  expr.Reset();
  // The expression should not be sampled after reset
  BOOST_CHECK_EQUAL(expr.IsDeviate(), false);
}

BOOST_AUTO_TEST_CASE(test_expression_is_deviate) {
  /// @brief Test the IsDeviate method of the Expression class.
  /// @details This test checks if the IsDeviate method returns the correct
  ///          deviate state for a mock expression.
  MockExpression expr(5.0);
  BOOST_CHECK_EQUAL(expr.IsDeviate(), false);
}

BOOST_AUTO_TEST_CASE(test_ensure_probability) {
  /// @brief Test the EnsureProbability function.
  /// @details This test checks if the EnsureProbability function correctly
  ///          validates expressions that are within the probability domain.
  MockExpression valid_expr(0.5);
  MockExpression invalid_expr(-0.1);

  // Should not throw for valid probability
  BOOST_CHECK_NO_THROW(EnsureProbability(&valid_expr));

  // Should throw for invalid probability
  BOOST_CHECK_THROW(EnsureProbability(&invalid_expr), DomainError);
}

BOOST_AUTO_TEST_CASE(test_ensure_positive) {
  /// @brief Test the EnsurePositive function.
  /// @details This test checks if the EnsurePositive function correctly
  ///          validates expressions that yield positive values.
  MockExpression valid_expr(1.0);
  MockExpression invalid_expr(0.0);

  // Should not throw for positive value
  BOOST_CHECK_NO_THROW(EnsurePositive(&valid_expr, "test"));

  // Should throw for non-positive value
  BOOST_CHECK_THROW(EnsurePositive(&invalid_expr, "test"), DomainError);
}

BOOST_AUTO_TEST_CASE(test_ensure_non_negative) {
  /// @brief Test the EnsureNonNegative function.
  /// @details This test checks if the EnsureNonNegative function correctly
  ///          validates expressions that yield non-negative values.
  MockExpression valid_expr(0.0);
  MockExpression invalid_expr(-1.0);

  // Should not throw for non-negative value
  BOOST_CHECK_NO_THROW(EnsureNonNegative(&valid_expr, "test"));

  // Should throw for negative value
  BOOST_CHECK_THROW(EnsureNonNegative(&invalid_expr, "test"), DomainError);
}

BOOST_AUTO_TEST_CASE(test_ensure_within) {
  /// @brief Test the EnsureWithin function.
  /// @details This test checks if the EnsureWithin function correctly
  ///          validates expressions that are within a given interval.
  MockExpression valid_expr(0.5);
  MockExpression invalid_expr(2.0);
  Interval valid_interval(0.0, 1.0);

  // Should not throw for value within interval
  BOOST_CHECK_NO_THROW(EnsureWithin(&valid_expr, valid_interval, "test"));

  // Should throw for value outside interval
  BOOST_CHECK_THROW(EnsureWithin(&invalid_expr, valid_interval, "test"), DomainError);
}