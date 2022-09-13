import * as SDK from '../../core/sdk/sdk.js';
import * as UI from '../../ui/legacy/legacy.js';
export declare class WebauthnPaneImpl extends UI.Widget.VBox implements SDK.TargetManager.SDKModelObserver<SDK.WebAuthnModel.WebAuthnModel> {
    #private;
    constructor();
    static instance(opts?: {
        forceNew: null;
    }): WebauthnPaneImpl;
    modelAdded(model: SDK.WebAuthnModel.WebAuthnModel): void;
    modelRemoved(model: SDK.WebAuthnModel.WebAuthnModel): void;
    ownerViewDisposed(): Promise<void>;
    wasShown(): void;
}
