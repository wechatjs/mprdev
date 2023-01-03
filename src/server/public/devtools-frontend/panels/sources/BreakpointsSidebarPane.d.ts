import * as Common from '../../core/common/common.js';
import * as Platform from '../../core/platform/platform.js';
import * as Bindings from '../../models/bindings/bindings.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as SourcesComponents from './components/components.js';
export declare class BreakpointsSidebarPane extends UI.ThrottledWidget.ThrottledWidget {
    #private;
    static instance(): BreakpointsSidebarPane;
    constructor();
    doUpdate(): Promise<void>;
    set data(data: SourcesComponents.BreakpointsView.BreakpointsViewData);
}
export declare class BreakpointsSidebarController implements UI.ContextFlavorListener.ContextFlavorListener {
    #private;
    private constructor();
    static instance({ forceNew, breakpointManager, settings }?: {
        forceNew: boolean | null;
        breakpointManager: Bindings.BreakpointManager.BreakpointManager;
        settings: Common.Settings.Settings;
    }): BreakpointsSidebarController;
    static removeInstance(): void;
    flavorChanged(_object: Object | null): void;
    breakpointStateChanged(breakpointItem: SourcesComponents.BreakpointsView.BreakpointItem, checked: boolean): void;
    breakpointEdited(breakpointItem: SourcesComponents.BreakpointsView.BreakpointItem): Promise<void>;
    breakpointsRemoved(breakpointItems: SourcesComponents.BreakpointsView.BreakpointItem[]): void;
    expandedStateChanged(url: Platform.DevToolsPath.UrlString, expanded: boolean): void;
    jumpToSource(breakpointItem: SourcesComponents.BreakpointsView.BreakpointItem): Promise<void>;
    setPauseOnExceptions(value: boolean): void;
    setPauseOnCaughtExceptions(value: boolean): void;
    update(): Promise<void>;
    getUpdatedBreakpointViewData(): Promise<SourcesComponents.BreakpointsView.BreakpointsViewData>;
}
