import * as sinon from 'sinon';

let sandbox: sinon.SinonSandbox;

export function createVSCodeStubs(): sinon.SinonSandbox {
    sandbox = sinon.createSandbox();
    return sandbox;
}

export function cleanupVSCodeStubs(): void {
    if (sandbox) {
        sandbox.restore();
    }
} 