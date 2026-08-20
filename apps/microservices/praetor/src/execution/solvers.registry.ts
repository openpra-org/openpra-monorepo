import { ExecuteSolver } from '../common/types/execute-request';

export interface SolverArgsContext {
    settings: string[];
    inputFile: string;
    outputFile: string;
}

export interface SolverDescriptor {
    solver: ExecuteSolver;
    binDefault: string;
    binEnv: string;
    inputExtension: string;
    outputExtension: string;
    implemented: boolean;
    buildArgs(context: SolverArgsContext): string[];
}

const SCRAM: SolverDescriptor = {
    solver: 'scram',
    binDefault: 'scram',
    binEnv: 'PRAETOR_SCRAM_BIN',
    inputExtension: '.xml',
    outputExtension: '.xml',
    implemented: true,
    buildArgs: ({ settings, inputFile, outputFile }): string[] => [
        ...settings,
        inputFile,
        '--output',
        outputFile,
    ],
};

const PRAXIS: SolverDescriptor = {
    solver: 'praxis',
    binDefault: 'praxis-cli',
    binEnv: 'PRAETOR_PRAXIS_BIN',
    inputExtension: '.xml',
    outputExtension: '.xml',
    implemented: true,
    buildArgs: ({ settings, inputFile, outputFile }): string[] => [
        ...settings,
        '--output',
        outputFile,
        inputFile,
    ],
};

function pending(
    solver: ExecuteSolver,
    binDefault: string,
    binEnv: string,
    inputExtension: string,
    outputExtension: string,
): SolverDescriptor {
    return {
        solver,
        binDefault,
        binEnv,
        inputExtension,
        outputExtension,
        implemented: false,
        buildArgs: (): string[] => {
            throw new Error(`Solver '${solver}' execute endpoint is not implemented yet.`);
        },
    };
}

const DESCRIPTORS: Record<ExecuteSolver, SolverDescriptor> = {
    scram: SCRAM,
    praxis: PRAXIS,
    xfta: pending('xfta', 'xftar', 'PRAETOR_XFTA_BIN', '.xfta', '.tsv'),
    ftrex: pending('ftrex', 'run_ftrex', 'PRAETOR_FTREX_BIN', '.ftp', '.raw'),
    zebra: pending('zebra', 'run_zebra', 'PRAETOR_ZEBRA_BIN', '.ftp', '.raw'),
    saphsolve: pending('saphsolve', 'saphsolve-cli', 'PRAETOR_SAPHSOLVE_BIN', '.JSInp', '.JSCut'),
};

export function getSolverDescriptor(solver: ExecuteSolver): SolverDescriptor {
    return DESCRIPTORS[solver];
}

export function resolveSolverBinary(descriptor: SolverDescriptor): string {
    const override = process.env[descriptor.binEnv];
    return override !== undefined && override.length > 0 ? override : descriptor.binDefault;
}
