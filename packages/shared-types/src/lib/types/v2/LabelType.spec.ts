/**
 * @file LabelType.test.ts
 * @brief This file contains unit tests for the NameType, DescriptionType and LabelType.
 * @details The tests use jest framework.
 */

import { NameType, DescriptionType, LabelType } from './LabelType';

describe('LabelType', () => {
  it('should be an object type', () => {
    const label: LabelType = { name: 'testName', description: 'testDescription' };
    expect(typeof label).toBe('object');
  });

  it('should have properties', () => {
    const label: LabelType = { name: 'Test', description: 'Test description' };
    expect(label).toHaveProperty('name');
    expect(label).toHaveProperty('description');
  });

  describe('NameType', () => {
    it('should be a string type', () => {
      const name: NameType = 'testName';
      expect(typeof name).toBe('string');
    });
  });

  describe('DescriptionType', () => {
    it('should be a string type', () => {
      const description: DescriptionType = 'testDescription';
      expect(typeof description).toBe('string');
    });
  });
});
