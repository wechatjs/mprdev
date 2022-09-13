import * as Common from '../../core/common/common.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Protocol from '../../generated/protocol.js';
import * as Workspace from '../workspace/workspace.js';
export declare class NetworkPersistenceManager extends Common.ObjectWrapper.ObjectWrapper<EventTypes> implements SDK.TargetManager.Observer {
    #private;
    private bindings;
    private readonly originalResponseContentPromises;
    private savingForOverrides;
    private readonly savingSymbol;
    private enabledSetting;
    private readonly workspace;
    private readonly networkUISourceCodeForEncodedPath;
    private readonly interceptionHandlerBound;
    private readonly updateInterceptionThrottler;
    private projectInternal;
    private readonly activeProject;
    private activeInternal;
    private enabled;
    private eventDescriptors;
    private constructor();
    targetAdded(): void;
    targetRemoved(): void;
    static instance(opts?: {
        forceNew: boolean | null;
        workspace: Workspace.Workspace.WorkspaceImpl | null;
    }): NetworkPersistenceManager;
    active(): boolean;
    project(): Workspace.Workspace.Project | null;
    originalContentForUISourceCode(uiSourceCode: Workspace.UISourceCode.UISourceCode): Promise<string | null> | null;
    private enabledChanged;
    private uiSourceCodeRenamedListener;
    private uiSourceCodeRemovedListener;
    private uiSourceCodeAdded;
    private updateActiveProject;
    private encodedPathFromUrl;
    private fileUrlFromNetworkUrl;
    private decodeLocalPathToUrlPath;
    private unbind;
    private bind;
    private onUISourceCodeWorkingCopyCommitted;
    canSaveUISourceCodeForOverrides(uiSourceCode: Workspace.UISourceCode.UISourceCode): boolean;
    saveUISourceCodeForOverrides(uiSourceCode: Workspace.UISourceCode.UISourceCode): Promise<void>;
    private fileCreatedForTest;
    private patternForFileSystemUISourceCode;
    private onUISourceCodeAdded;
    private canHandleNetworkUISourceCode;
    private networkUISourceCodeAdded;
    private filesystemUISourceCodeAdded;
    generateHeaderPatterns(uiSourceCode: Workspace.UISourceCode.UISourceCode): Promise<{
        headerPatterns: Set<string>;
        path: string;
        overridesWithRegex: HeaderOverrideWithRegex[];
    }>;
    updateInterceptionPatternsForTests(): Promise<void>;
    private updateInterceptionPatterns;
    private onUISourceCodeRemoved;
    private networkUISourceCodeRemoved;
    private filesystemUISourceCodeRemoved;
    setProject(project: Workspace.Workspace.Project | null): Promise<void>;
    private onProjectAdded;
    private onProjectRemoved;
    mergeHeaders(baseHeaders: Protocol.Fetch.HeaderEntry[], overrideHeaders: Protocol.Network.Headers): Protocol.Fetch.HeaderEntry[];
    handleHeaderInterception(interceptedRequest: SDK.NetworkManager.InterceptedRequest): Protocol.Fetch.HeaderEntry[];
    private interceptionHandler;
}
export declare enum Events {
    ProjectChanged = "ProjectChanged"
}
export declare type EventTypes = {
    [Events.ProjectChanged]: Workspace.Workspace.Project | null;
};
interface HeaderOverrideWithRegex {
    applyToRegex: RegExp;
    headers: Protocol.Network.Headers;
}
export declare function escapeRegex(pattern: string): string;
export declare function extractDirectoryIndex(pattern: string): {
    head: string;
    tail?: string;
};
export {};
