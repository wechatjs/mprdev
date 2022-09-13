import type * as ReportRenderer from './LighthouseReporterTypes.js';
export declare class ProtocolService {
    private targetInfo?;
    private rawConnection?;
    private lighthouseWorkerPromise?;
    private lighthouseMessageUpdateCallback?;
    attach(): Promise<void>;
    getLocales(): readonly string[];
    startLighthouse(auditURL: string, categoryIDs: string[], flags: Record<string, Object | undefined>): Promise<ReportRenderer.RunnerResult>;
    detach(): Promise<void>;
    registerStatusCallback(callback: (arg0: string) => void): void;
    private dispatchProtocolMessage;
    private initWorker;
    private ensureWorkerExists;
    private sendProtocolMessage;
    private sendWithoutResponse;
    private sendWithResponse;
}
