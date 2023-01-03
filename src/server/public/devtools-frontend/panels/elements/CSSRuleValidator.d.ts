import * as Host from '../../core/host/host.js';
export declare const enum HintType {
    INACTIVE_PROPERTY = "ruleValidation",
    DEPRECATED_PROPERTY = "deprecatedProperty"
}
export declare class Hint {
    #private;
    constructor(hintMessage: string, possibleFixMessage: string | null, learnMoreLink?: string);
    getMessage(): string;
    getPossibleFixMessage(): string | null;
    getLearnMoreLink(): string | undefined;
}
export declare abstract class CSSRuleValidator {
    #private;
    getMetricType(): Host.UserMetrics.CSSHintType;
    constructor(affectedProperties: string[]);
    getApplicableProperties(): string[];
    abstract getHint(propertyName: string, computedStyles?: Map<string, string>, parentComputedStyles?: Map<string, string>): Hint | undefined;
}
export declare class AlignContentValidator extends CSSRuleValidator {
    #private;
    constructor();
    getMetricType(): Host.UserMetrics.CSSHintType;
    getHint(_propertyName: string, computedStyles?: Map<string, string>): Hint | undefined;
}
export declare class FlexItemValidator extends CSSRuleValidator {
    #private;
    constructor();
    getMetricType(): Host.UserMetrics.CSSHintType;
    getHint(propertyName: string, computedStyles?: Map<string, string>, parentComputedStyles?: Map<string, string>): Hint | undefined;
}
export declare class FlexContainerValidator extends CSSRuleValidator {
    #private;
    constructor();
    getMetricType(): Host.UserMetrics.CSSHintType;
    getHint(propertyName: string, computedStyles?: Map<string, string>): Hint | undefined;
}
export declare class GridContainerValidator extends CSSRuleValidator {
    #private;
    constructor();
    getMetricType(): Host.UserMetrics.CSSHintType;
    getHint(propertyName: string, computedStyles?: Map<string, string>): Hint | undefined;
}
export declare class GridItemValidator extends CSSRuleValidator {
    #private;
    constructor();
    getMetricType(): Host.UserMetrics.CSSHintType;
    getHint(propertyName: string, computedStyles?: Map<string, string>, parentComputedStyles?: Map<string, string>): Hint | undefined;
}
export declare class FlexGridValidator extends CSSRuleValidator {
    #private;
    constructor();
    getMetricType(): Host.UserMetrics.CSSHintType;
    getHint(propertyName: string, computedStyles?: Map<string, string>): Hint | undefined;
}
export declare class MulticolFlexGridValidator extends CSSRuleValidator {
    #private;
    constructor();
    getMetricType(): Host.UserMetrics.CSSHintType;
    getHint(propertyName: string, computedStyles?: Map<string, string>): Hint | undefined;
}
export declare class PaddingValidator extends CSSRuleValidator {
    #private;
    constructor();
    getMetricType(): Host.UserMetrics.CSSHintType;
    getHint(propertyName: string, computedStyles?: Map<string, string>): Hint | undefined;
}
export declare class PositionValidator extends CSSRuleValidator {
    #private;
    constructor();
    getMetricType(): Host.UserMetrics.CSSHintType;
    getHint(propertyName: string, computedStyles?: Map<string, string>): Hint | undefined;
}
export declare class ZIndexValidator extends CSSRuleValidator {
    #private;
    constructor();
    getMetricType(): Host.UserMetrics.CSSHintType;
    getHint(propertyName: string, computedStyles?: Map<string, string>, parentComputedStyles?: Map<string, string>): Hint | undefined;
}
export declare const cssRuleValidatorsMap: Map<string, CSSRuleValidator[]>;
