import * as Platform from '../../../core/platform/platform.js';
export interface BreakpointsViewData {
    breakpointsActive: boolean;
    pauseOnExceptions: boolean;
    pauseOnCaughtExceptions: boolean;
    groups: BreakpointGroup[];
}
export interface BreakpointGroup {
    name: string;
    url: Platform.DevToolsPath.UrlString;
    editable: boolean;
    expanded: boolean;
    breakpointItems: BreakpointItem[];
}
export interface BreakpointItem {
    location: string;
    codeSnippet: string;
    isHit: boolean;
    status: BreakpointStatus;
    type: BreakpointType;
    hoverText?: string;
}
export declare const enum BreakpointStatus {
    ENABLED = "ENABLED",
    DISABLED = "DISABLED",
    INDETERMINATE = "INDETERMINATE"
}
export declare const enum BreakpointType {
    LOGPOINT = "LOGPOINT",
    CONDITIONAL_BREAKPOINT = "CONDITIONAL_BREAKPOINT",
    REGULAR_BREAKPOINT = "REGULAR_BREAKPOINT"
}
export declare class CheckboxToggledEvent extends Event {
    static readonly eventName = "checkboxtoggled";
    data: {
        breakpointItem: BreakpointItem;
        checked: boolean;
    };
    constructor(breakpointItem: BreakpointItem, checked: boolean);
}
export declare class PauseOnExceptionsStateChangedEvent extends Event {
    static readonly eventName = "pauseonexceptionsstatechanged";
    data: {
        checked: boolean;
    };
    constructor(checked: boolean);
}
export declare class PauseOnCaughtExceptionsStateChangedEvent extends Event {
    static readonly eventName = "pauseoncaughtexceptionsstatechanged";
    data: {
        checked: boolean;
    };
    constructor(checked: boolean);
}
export declare class ExpandedStateChangedEvent extends Event {
    static readonly eventName = "expandedstatechanged";
    data: {
        url: Platform.DevToolsPath.UrlString;
        expanded: boolean;
    };
    constructor(url: Platform.DevToolsPath.UrlString, expanded: boolean);
}
export declare class BreakpointSelectedEvent extends Event {
    static readonly eventName = "breakpointselected";
    data: {
        breakpointItem: BreakpointItem;
    };
    constructor(breakpointItem: BreakpointItem);
}
export declare class BreakpointEditedEvent extends Event {
    static readonly eventName = "breakpointedited";
    data: {
        breakpointItem: BreakpointItem;
    };
    constructor(breakpointItem: BreakpointItem);
}
export declare class BreakpointsRemovedEvent extends Event {
    static readonly eventName = "breakpointsremoved";
    data: {
        breakpointItems: BreakpointItem[];
    };
    constructor(breakpointItems: BreakpointItem[]);
}
export declare class BreakpointsView extends HTMLElement {
    #private;
    static readonly litTagName: import("../../../ui/lit-html/static.js").Static;
    set data(data: BreakpointsViewData);
    connectedCallback(): void;
}
declare global {
    interface HTMLElementTagNameMap {
        'devtools-breakpoint-view': BreakpointsView;
    }
}
