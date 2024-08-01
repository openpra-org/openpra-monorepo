import { exec } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// Helper function to execute a command and return its exit code
const execPromise = (cmd: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        exec(cmd, (error, stdout, stderr) => {
            if(stdout) {
                console.log(stdout);
            }
            if (stderr) {
                console.error(stderr);
            }
            if (error && error.code != null) {
                // Resolve with the exit code if there is an error (non-zero exit code)
                resolve(error.code);
            } else {
                // Resolve with 0 on success
                resolve(0);
            }
        });
    });
};

describe('SCRAM Command Line Tests', () => {
    test('test empty call', async () => {
        const exitCode = await execPromise('scram-cli');
        expect(exitCode).toBe(1);
    });

    test('test info help calls', async () => {
        const exitCode = await execPromise('scram-cli --help');
        expect(exitCode).toBe(0);
    });

    test('test info version calls', async () => {
        const exitCode = await execPromise('scram-cli --version');
        expect(exitCode).toBe(0);
    });

    // Example of a test with temporary file output
    test('test fta no prob', async () => {
        const ftaNoProb = 'tests/fixtures/fta/correct_tree_input.xml';
        let exitCode = await execPromise(`scram-cli ${ftaNoProb}`);
        expect(exitCode).toBe(0);
    });
});
