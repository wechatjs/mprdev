export interface ComputedStylePropertyData {
    inherited: boolean;
    traceable: boolean;
    onNavigateToSource: (event?: Event) => void;
}
export declare class ComputedStyleProperty extends HTMLElement {
    #private;
    static readonly litTagName: import("../../../ui/lit-html/static.js").Static;
    connectedCallback(): void;
    set data(data: ComputedStylePropertyData);
}
declare global {
    interface HTMLElementTagNameMap {
        'devtools-computed-style-property': ComputedStyleProperty;
    }
}
