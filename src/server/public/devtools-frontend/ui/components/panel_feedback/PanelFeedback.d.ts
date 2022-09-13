export interface PanelFeedbackData {
    feedbackUrl: string;
    quickStartUrl: string;
    quickStartLinkText: string;
}
export declare class PanelFeedback extends HTMLElement {
    #private;
    static readonly litTagName: import("../../lit-html/static.js").Static;
    connectedCallback(): void;
    set data(data: PanelFeedbackData);
}
declare global {
    interface HTMLElementTagNameMap {
        'devtools-panel-feedback': PanelFeedback;
    }
}
