import { generateFaultTree, CcfGroup, FaultTree, GeneratorFaultTree, toposortGates } from './model-generator';
import { Factors } from './Factors';
import { Gate } from './Gate';
import { BasicEvent } from './BasicEvent';
import { HouseEvent } from './HouseEvent';
import { PointEstimate } from './PointEstimate';

describe('model-generator', () => {
  let factors: Factors;

  beforeEach(() => {
    factors = new Factors();
    factors.setGateWeights([1, 1, 0, 0, 0]); // Required for generateFaultTree
    factors.numBasic = 3; // Reduced for easier debugging
    factors.numHouse = 1; // Reduced for easier debugging
    factors.numArgs = 2; // Reduced for easier debugging
    factors.minProb = 0.01;
    factors.maxProb = 0.1;
    factors.commonB = 0.1; // Reduced to minimize common events
    factors.commonG = 0.1; // Reduced to minimize common gates
    factors.numCcf = 0; // Disabled for debugging
    // Set missing required factors
    factors.parentsB = 2;
    factors.parentsG = 2;
    factors.calculate(); // Required after setting all factors
  });

  describe('generateFaultTree', () => {
    it('should generate a fault tree with correct name and root gate', () => {
      const faultTree = generateFaultTree('TestFT', 'TopGate', factors);
      
      expect(faultTree.name).toBe('TestFT');
      expect(faultTree.topGate).toBeDefined();
      expect(faultTree.topGate!.name).toBe('TopGate');
    });

    it('should generate fault tree with expected number of components', () => {
      const faultTree = generateFaultTree('TestFT', 'TopGate', factors);
      
      expect(faultTree.basicEvents.size).toBeGreaterThan(0);
      expect(faultTree.houseEvents.size).toBe(factors.numHouse!);
      expect(faultTree.gates.size).toBeGreaterThan(0);
    });

    it('should generate CCF groups when specified', () => {
      factors.numCcf = 3;
      const faultTree = generateFaultTree('TestFT', 'TopGate', factors);
      
      expect(faultTree.ccfGroups.size).toBeGreaterThan(0);
      expect(faultTree.nonCcfEvents).toBeDefined();
    });
  });

  describe('CcfGroup', () => {
    let ccfGroup: CcfGroup;
    let basicEvent1: BasicEvent;
    let basicEvent2: BasicEvent;

    beforeEach(() => {
      ccfGroup = new CcfGroup('TestCCF');
      basicEvent1 = new BasicEvent('BE1', new PointEstimate(0.01));
      basicEvent2 = new BasicEvent('BE2', new PointEstimate(0.02));
      ccfGroup.members = [basicEvent1, basicEvent2];
      ccfGroup.prob = 0.05;
      ccfGroup.model = 'MGL';
      ccfGroup.factors = [0.1, 0.2];
    });

    it('should create CCF group with correct name', () => {
      expect(ccfGroup.name).toBe('TestCCF');
      expect(ccfGroup.members).toHaveLength(2);
    });

    it('should generate XML output correctly', () => {
      const output: string[] = [];
      const printer = (str: string) => output.push(str);
      
      ccfGroup.toXml(printer);
      
      expect(output.join('')).toContain('<define-CCF-group name="TestCCF" model="MGL">');
      expect(output.join('')).toContain('<basic-event name="BE1"/>');
      expect(output.join('')).toContain('<basic-event name="BE2"/>');
      expect(output.join('')).toContain('<float value="0.05"/>');
    });

    it('should include factors in XML when model is MGL', () => {
      const output: string[] = [];
      const printer = (str: string) => output.push(str);
      
      ccfGroup.toXml(printer);
      
      expect(output.join('')).toContain('<factor level="2">');
      expect(output.join('')).toContain('<float value="0.1"/>');
      expect(output.join('')).toContain('<factor level="3">');
      expect(output.join('')).toContain('<float value="0.2"/>');
    });
  });

  describe('FaultTree', () => {
    let faultTree: FaultTree;
    let gate1: Gate;
    let gate2: Gate;
    let basicEvent: BasicEvent;
    let houseEvent: HouseEvent;

    beforeEach(() => {
      faultTree = new FaultTree('TestFT');
      gate1 = new Gate('G1', 'and');
      gate2 = new Gate('G2', 'or');
      basicEvent = new BasicEvent('BE1', new PointEstimate(0.01));
      houseEvent = new HouseEvent('HE1', [], true);
    });

    it('should create fault tree with optional name', () => {
      const ft1 = new FaultTree('Named');
      const ft2 = new FaultTree();
      
      expect(ft1.name).toBe('Named');
      expect(ft2.name).toBeNull();
    });

    it('should add gates and their dependencies', () => {
      gate1.addArgument(basicEvent);
      gate1.addArgument(houseEvent);
      gate1.addArgument(gate2);
      
      faultTree.addGates(new Set([gate1]));
      
      expect(faultTree.gates.has(gate1)).toBe(true);
      expect(faultTree.gates.has(gate2)).toBe(true);
      expect(faultTree.basicEvents.has(basicEvent)).toBe(true);
      expect(faultTree.houseEvents.has(houseEvent)).toBe(true);
    });

    it('should generate XML output', () => {
      faultTree.gates.add(gate1);
      faultTree.basicEvents.add(basicEvent);
      
      const output: string[] = [];
      const printer = (str: string) => output.push(str);
      
      faultTree.toXml(printer);
      
      expect(output.join('')).toContain('<opsa-mef>');
      expect(output.join('')).toContain('<define-fault-tree name="TestFT">');
      expect(output.join('')).toContain('</define-fault-tree>');
      expect(output.join('')).toContain('<model-data>');
      expect(output.join('')).toContain('</model-data>');
      expect(output.join('')).toContain('</opsa-mef>');
    });

    it('should generate Aralia format output', () => {
      faultTree.topGate = gate1;
      faultTree.gates.add(gate1);
      faultTree.basicEvents.add(basicEvent);
      faultTree.houseEvents.add(houseEvent);
      
      const output: string[] = [];
      const printer = (str: string) => output.push(str);
      
      faultTree.toAralia(printer);
      
      expect(output[0]).toBe('TestFT');
      expect(output.length).toBeGreaterThan(1);
    });

    it('should prune gates with single arguments', () => {
      const parentGate = new Gate('Parent', 'or');
      const childGate = new Gate('Child', 'and');
      childGate.addArgument(basicEvent);
      parentGate.addArgument(childGate);
      
      faultTree.gates.add(parentGate);
      faultTree.gates.add(childGate);
      
      faultTree.prune(childGate);
      
      expect(faultTree.gates.has(childGate)).toBe(false);
      expect(parentGate.bArguments.includes(basicEvent)).toBe(true);
    });
  });

  describe('GeneratorFaultTree', () => {
    let generatorFT: GeneratorFaultTree;

    beforeEach(() => {
      generatorFT = new GeneratorFaultTree('GenFT', factors);
    });

    it('should construct top gate with valid operator', () => {
      generatorFT.constructTopGate('Root');
      
      expect(generatorFT.topGate).toBeDefined();
      expect(generatorFT.topGate!.name).toBe('Root');
      expect(['and', 'or', 'atleast', 'nor', 'xnor', 'nand', 'imply']).toContain(generatorFT.topGate!.operator);
    });

    it('should construct basic events with probability in range', () => {
      const basicEvent = generatorFT.constructBasicEvent();
      
      expect(basicEvent.name).toMatch(/^B\d+$/);
      expect(basicEvent.probability).toBeDefined();
      expect(basicEvent.probability).toBeGreaterThanOrEqual(factors.minProb!);
      expect(basicEvent.probability).toBeLessThanOrEqual(factors.maxProb!);
    });

    it('should construct house events with boolean state', () => {
      const houseEvent = generatorFT.constructHouseEvent();
      
      expect(houseEvent.name).toMatch(/^H\d+$/);
      expect(typeof houseEvent.flag).toBe('boolean');
    });

    it('should construct CCF groups with proper structure', () => {
      const members = [
        generatorFT.constructBasicEvent(),
        generatorFT.constructBasicEvent(),
        generatorFT.constructBasicEvent()
      ];
      
      const ccfGroup = generatorFT.constructCcfGroup(members);
      
      expect(ccfGroup.name).toMatch(/^CCF\d+$/);
      expect(ccfGroup.members).toEqual(members);
      expect(ccfGroup.model).toBe('MGL');
      expect(ccfGroup.prob).toBeGreaterThanOrEqual(factors.minProb!);
      expect(ccfGroup.prob).toBeLessThanOrEqual(factors.maxProb!);
      expect(ccfGroup.factors.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('toposortGates', () => {
    it('should sort gates in topological order', () => {
      const gate1 = new Gate('G1', 'and');
      const gate2 = new Gate('G2', 'or');
      const gate3 = new Gate('G3', 'and');
      
      gate1.addArgument(gate2);
      gate2.addArgument(gate3);
      
      const sorted = toposortGates([gate1], [gate1, gate2, gate3]);
      
      expect(sorted).toHaveLength(3);
      // The algorithm uses unshift(), so root nodes appear first
      // gate1 is the root, then gate2, then gate3
      expect(sorted[0]).toBe(gate1);
      expect(sorted[1]).toBe(gate2);
      expect(sorted[2]).toBe(gate3);
    });

    it('should throw error on cyclic dependencies', () => {
      const gate1 = new Gate('G1', 'and');
      const gate2 = new Gate('G2', 'or');
      
      gate1.addArgument(gate2);
      gate2.addArgument(gate1);
      
      expect(() => toposortGates([gate1], [gate1, gate2])).toThrow('Cycle detected');
    });

    it('should throw error if not all gates are sorted', () => {
      const gate1 = new Gate('G1', 'and');
      const gate2 = new Gate('G2', 'or');
      
      expect(() => toposortGates([gate1], [gate1, gate2])).toThrow('Not all gates sorted');
    });
  });
});