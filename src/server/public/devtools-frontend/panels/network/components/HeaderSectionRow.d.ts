import type * as Protocol from '../../../generated/protocol.js';
import * as Platform from '../../../core/platform/platform.js';
export declare class HeaderEditedEvent extends Event {
    static readonly eventName = "headeredited";
    headerName: Platform.StringUtilities.LowerCaseString;
    headerValue: string;
    constructor(headerName: Platform.StringUtilities.LowerCaseString, headerValue: string);
}
export interface HeaderSectionRowData {
    header: HeaderDescriptor;
}
export declare class HeaderSectionRow extends HTMLElement {
    #private;
    static readonly litTagName: import("../../../ui/lit-html/static.js").Static;
    connectedCallback(): void;
    set data(data: HeaderSectionRowData);
    focus(): void;
}
declare global {
    interface HTMLElementTagNameMap {
        'devtools-header-section-row': HeaderSectionRow;
    }
    interface HTMLElementEventMap {
        [HeaderEditedEvent.eventName]: HeaderEditedEvent;
    }
}
interface BlockedDetailsDescriptor {
    explanation: () => string;
    examples: Array<{
        codeSnippet: string;
        comment?: () => string;
    }>;
    link: {
        url: string;
    } | null;
    reveal?: () => void;
}
export interface HeaderDetailsDescriptor {
    name: Platform.StringUtilities.LowerCaseString;
    value: string | null;
    headerValueIncorrect?: boolean;
    blockedDetails?: BlockedDetailsDescriptor;
    headerNotSet?: boolean;
    setCookieBlockedReasons?: Protocol.Network.SetCookieBlockedReason[];
    highlight?: boolean;
}
export interface HeaderEditorDescriptor {
    name: Platform.StringUtilities.LowerCaseString;
    value: string | null;
    originalValue?: string | null;
    isOverride?: boolean;
    valueEditable?: boolean;
    nameEditable?: boolean;
}
export declare type HeaderDescriptor = HeaderDetailsDescriptor & HeaderEditorDescriptor;
export {};
