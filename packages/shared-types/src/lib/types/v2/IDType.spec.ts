/**
 * @file IDType.test.ts
 * @brief This file contains tests for IDType.ts
 * @details In this file, we test the isValidIDType function from IDType.ts to ensure it correctly validates IDs.
 */

import { isValidIDType, IDType } from './IDType';

describe('isValidIDType', () => {
  /**
   * Test to check if the function correctly identifies valid IDs.
   * @brief Test for valid IDs
   * @details In this test, we pass valid IDs to the function and expect it to return true.
   */
  it('should return true for valid IDs', () => {
    const validIDs: IDType[] = ['abc123', 'ABC123', '123abc', '123ABC', 'abcABC123'];
    validIDs.forEach(id => {
      expect(isValidIDType(id)).toBe(true);
    });
  });

  /**
   * Test to check if the function correctly identifies invalid IDs.
   * @brief Test for invalid IDs
   * @details In this test, we pass invalid IDs to the function and expect it to return false.
   */
  it('should return false for invalid IDs', () => {
    const invalidIDs: IDType[] = ['abc 123', 'ABC@123', '123_abc', '123-ABC', 'abc/ABC123'];
    invalidIDs.forEach(id => {
      expect(isValidIDType(id)).toBe(false);
    });
  });

  /**
   * Test to check if the function returns true for valid IDs.
   */
  it('should return true for valid IDs', () => {
    const validId: IDType = 'abc123';
    expect(isValidIDType(validId)).toBe(true);
  });

  /**
   * Test to check if the function returns false for IDs with special characters.
   */
  it('should return false for IDs with special characters', () => {
    const invalidId: IDType = 'abc@123';
    expect(isValidIDType(invalidId)).toBe(false);
  });

  /**
   * Test to check if the function returns false for IDs with spaces.
   */
  it('should return false for IDs with spaces', () => {
    const invalidId: IDType = 'abc 123';
    expect(isValidIDType(invalidId)).toBe(false);
  });

  /**
   * Test to check if the function returns false for empty IDs.
   */
  it('should return false for empty IDs', () => {
    const invalidId: IDType = '';
    expect(isValidIDType(invalidId)).toBe(false);
  });
});
