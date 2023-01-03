// Copyright 2022 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as Host from '../../core/host/host.js';
import * as i18n from '../../core/i18n/i18n.js';
import { buildPropertyDefinitionText, buildPropertyName, buildPropertyValue, isFlexContainer, isGridContainer, isMulticolContainer, } from './CSSRuleValidatorHelper.js';
const UIStrings = {
    /**
      *@description The message shown in the Style pane when the user hovers over a property that has no effect due to some other property.
      *@example {flex-wrap: nowrap} REASON_PROPERTY_DECLARATION_CODE
      *@example {align-content} AFFECTED_PROPERTY_DECLARATION_CODE
      */
    ruleViolatedBySameElementRuleReason: 'The {REASON_PROPERTY_DECLARATION_CODE} property prevents {AFFECTED_PROPERTY_DECLARATION_CODE} from having an effect.',
    /**
      *@description The message shown in the Style pane when the user hovers over a property declaration that has no effect due to some other property.
      *@example {flex-wrap} PROPERTY_NAME
      @example {nowrap} PROPERTY_VALUE
      */
    ruleViolatedBySameElementRuleFix: 'Try setting {PROPERTY_NAME} to something other than {PROPERTY_VALUE}.',
    /**
      *@description The message shown in the Style pane when the user hovers over a property declaration that has no effect due to the current property value.
      *@example {display: block} EXISTING_PROPERTY_DECLARATION
      *@example {display: flex} TARGET_PROPERTY_DECLARATION
      */
    ruleViolatedBySameElementRuleChangeSuggestion: 'Try setting the {EXISTING_PROPERTY_DECLARATION} property to {TARGET_PROPERTY_DECLARATION}.',
    /**
      *@description The message shown in the Style pane when the user hovers over a property declaration that has no effect due to properties of the parent element.
      *@example {display: block} REASON_PROPERTY_DECLARATION_CODE
      *@example {flex} AFFECTED_PROPERTY_DECLARATION_CODE
      */
    ruleViolatedByParentElementRuleReason: 'The {REASON_PROPERTY_DECLARATION_CODE} property on the parent element prevents {AFFECTED_PROPERTY_DECLARATION_CODE} from having an effect.',
    /**
      *@description The message shown in the Style pane when the user hovers over a property declaration that has no effect due to the properties of the parent element.
      *@example {display: block} EXISTING_PARENT_ELEMENT_RULE
      *@example {display: flex} TARGET_PARENT_ELEMENT_RULE
      */
    ruleViolatedByParentElementRuleFix: 'Try setting the {EXISTING_PARENT_ELEMENT_RULE} property on the parent to {TARGET_PARENT_ELEMENT_RULE}.',
};
const str_ = i18n.i18n.registerUIStrings('panels/elements/CSSRuleValidator.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
export class Hint {
    #hintMessage;
    #possibleFixMessage;
    #learnMoreLink;
    constructor(hintMessage, possibleFixMessage, learnMoreLink) {
        this.#hintMessage = hintMessage;
        this.#possibleFixMessage = possibleFixMessage;
        this.#learnMoreLink = learnMoreLink;
    }
    getMessage() {
        return this.#hintMessage;
    }
    getPossibleFixMessage() {
        return this.#possibleFixMessage;
    }
    getLearnMoreLink() {
        return this.#learnMoreLink;
    }
}
export class CSSRuleValidator {
    getMetricType() {
        return Host.UserMetrics.CSSHintType.Other;
    }
    #affectedProperties;
    constructor(affectedProperties) {
        this.#affectedProperties = affectedProperties;
    }
    getApplicableProperties() {
        return this.#affectedProperties;
    }
}
export class AlignContentValidator extends CSSRuleValidator {
    constructor() {
        super(['align-content']);
    }
    getMetricType() {
        return Host.UserMetrics.CSSHintType.AlignContent;
    }
    #isRuleValid(computedStyles) {
        if (computedStyles === null || computedStyles === undefined) {
            return true;
        }
        if (!isFlexContainer(computedStyles)) {
            return true;
        }
        return computedStyles.get('flex-wrap') !== 'nowrap';
    }
    getHint(_propertyName, computedStyles) {
        if (this.#isRuleValid(computedStyles)) {
            return;
        }
        const reasonPropertyDeclaration = buildPropertyDefinitionText('flex-wrap', 'nowrap');
        const affectedPropertyDeclarationCode = buildPropertyName('align-content');
        return new Hint(i18nString(UIStrings.ruleViolatedBySameElementRuleReason, {
            'REASON_PROPERTY_DECLARATION_CODE': reasonPropertyDeclaration,
            'AFFECTED_PROPERTY_DECLARATION_CODE': affectedPropertyDeclarationCode,
        }), i18nString(UIStrings.ruleViolatedBySameElementRuleFix, {
            PROPERTY_NAME: buildPropertyName('flex-wrap'),
            PROPERTY_VALUE: buildPropertyValue('nowrap'),
        }));
    }
}
export class FlexItemValidator extends CSSRuleValidator {
    constructor() {
        super(['flex', 'flex-basis', 'flex-grow', 'flex-shrink']);
    }
    getMetricType() {
        return Host.UserMetrics.CSSHintType.FlexItem;
    }
    #isRuleValid(computedStyles, parentComputedStyles) {
        if (parentComputedStyles === null) {
            return true;
        }
        return isFlexContainer(parentComputedStyles);
    }
    getHint(propertyName, computedStyles, parentComputedStyles) {
        if (this.#isRuleValid(computedStyles, parentComputedStyles)) {
            return;
        }
        const reasonPropertyDeclaration = buildPropertyDefinitionText('display', parentComputedStyles?.get('display'));
        const affectedPropertyDeclarationCode = buildPropertyName(propertyName);
        const targeParentPropertyDeclaration = buildPropertyDefinitionText('display', 'flex');
        return new Hint(i18nString(UIStrings.ruleViolatedByParentElementRuleReason, {
            'REASON_PROPERTY_DECLARATION_CODE': reasonPropertyDeclaration,
            'AFFECTED_PROPERTY_DECLARATION_CODE': affectedPropertyDeclarationCode,
        }), i18nString(UIStrings.ruleViolatedByParentElementRuleFix, {
            'EXISTING_PARENT_ELEMENT_RULE': reasonPropertyDeclaration,
            'TARGET_PARENT_ELEMENT_RULE': targeParentPropertyDeclaration,
        }));
    }
}
export class FlexContainerValidator extends CSSRuleValidator {
    constructor() {
        super(['flex-direction', 'flex-flow', 'flex-wrap', 'justify-content']);
    }
    getMetricType() {
        return Host.UserMetrics.CSSHintType.FlexContainer;
    }
    #isRuleValid(computedStyles) {
        if (computedStyles === null) {
            return true;
        }
        return isFlexContainer(computedStyles);
    }
    getHint(propertyName, computedStyles) {
        if (this.#isRuleValid(computedStyles)) {
            return;
        }
        const reasonPropertyDeclaration = buildPropertyDefinitionText('display', computedStyles?.get('display'));
        const targetRuleCode = buildPropertyDefinitionText('display', 'flex');
        const affectedPropertyDeclarationCode = buildPropertyName(propertyName);
        return new Hint(i18nString(UIStrings.ruleViolatedBySameElementRuleReason, {
            'REASON_PROPERTY_DECLARATION_CODE': reasonPropertyDeclaration,
            'AFFECTED_PROPERTY_DECLARATION_CODE': affectedPropertyDeclarationCode,
        }), i18nString(UIStrings.ruleViolatedBySameElementRuleChangeSuggestion, {
            'EXISTING_PROPERTY_DECLARATION': reasonPropertyDeclaration,
            'TARGET_PROPERTY_DECLARATION': targetRuleCode,
        }));
    }
}
export class GridContainerValidator extends CSSRuleValidator {
    constructor() {
        super([
            'grid',
            'grid-auto-columns',
            'grid-auto-flow',
            'grid-auto-rows',
            'grid-template',
            'grid-template-areas',
            'grid-template-columns',
            'grid-template-rows',
        ]);
    }
    getMetricType() {
        return Host.UserMetrics.CSSHintType.GridContainer;
    }
    #isRuleValid(computedStyles) {
        return isGridContainer(computedStyles);
    }
    getHint(propertyName, computedStyles) {
        if (this.#isRuleValid(computedStyles)) {
            return;
        }
        const reasonPropertyDeclaration = buildPropertyDefinitionText('display', computedStyles?.get('display'));
        const targetRuleCode = buildPropertyDefinitionText('display', 'grid');
        const affectedPropertyDeclarationCode = buildPropertyName(propertyName);
        return new Hint(i18nString(UIStrings.ruleViolatedBySameElementRuleReason, {
            'REASON_PROPERTY_DECLARATION_CODE': reasonPropertyDeclaration,
            'AFFECTED_PROPERTY_DECLARATION_CODE': affectedPropertyDeclarationCode,
        }), i18nString(UIStrings.ruleViolatedBySameElementRuleChangeSuggestion, {
            'EXISTING_PROPERTY_DECLARATION': reasonPropertyDeclaration,
            'TARGET_PROPERTY_DECLARATION': targetRuleCode,
        }));
    }
}
export class GridItemValidator extends CSSRuleValidator {
    constructor() {
        super([
            'grid-area',
            'grid-column',
            'grid-row',
            'grid-row-end',
            'grid-row-start',
        ]);
    }
    getMetricType() {
        return Host.UserMetrics.CSSHintType.GridItem;
    }
    #isRuleValid(computedStyles, parentComputedStyles) {
        if (!parentComputedStyles) {
            return true;
        }
        return isGridContainer(parentComputedStyles);
    }
    getHint(propertyName, computedStyles, parentComputedStyles) {
        if (this.#isRuleValid(computedStyles, parentComputedStyles)) {
            return;
        }
        const reasonPropertyDeclaration = buildPropertyDefinitionText('display', parentComputedStyles?.get('display'));
        const targeParentPropertyDeclaration = buildPropertyDefinitionText('display', 'grid');
        const affectedPropertyDeclarationCode = buildPropertyName(propertyName);
        return new Hint(i18nString(UIStrings.ruleViolatedByParentElementRuleReason, {
            'REASON_PROPERTY_DECLARATION_CODE': reasonPropertyDeclaration,
            'AFFECTED_PROPERTY_DECLARATION_CODE': affectedPropertyDeclarationCode,
        }), i18nString(UIStrings.ruleViolatedByParentElementRuleFix, {
            'EXISTING_PARENT_ELEMENT_RULE': reasonPropertyDeclaration,
            'TARGET_PARENT_ELEMENT_RULE': targeParentPropertyDeclaration,
        }));
    }
}
export class FlexGridValidator extends CSSRuleValidator {
    constructor() {
        super([
            'order',
            'align-content',
            'align-items',
            'align-self',
        ]);
    }
    getMetricType() {
        return Host.UserMetrics.CSSHintType.FlexGrid;
    }
    #isRuleValid(computedStyles) {
        if (computedStyles === null) {
            return true;
        }
        return isFlexContainer(computedStyles) || isGridContainer(computedStyles);
    }
    getHint(propertyName, computedStyles) {
        if (this.#isRuleValid(computedStyles)) {
            return;
        }
        const reasonPropertyDeclaration = buildPropertyDefinitionText('display', computedStyles?.get('display'));
        const affectedPropertyDeclarationCode = buildPropertyName(propertyName);
        return new Hint(i18nString(UIStrings.ruleViolatedBySameElementRuleReason, {
            'REASON_PROPERTY_DECLARATION_CODE': reasonPropertyDeclaration,
            'AFFECTED_PROPERTY_DECLARATION_CODE': affectedPropertyDeclarationCode,
        }), i18nString(UIStrings.ruleViolatedBySameElementRuleFix, {
            PROPERTY_NAME: buildPropertyName('display'),
            PROPERTY_VALUE: buildPropertyValue(computedStyles?.get('display')),
        }));
    }
}
export class MulticolFlexGridValidator extends CSSRuleValidator {
    constructor() {
        super([
            'gap',
            'column-gap',
            'row-gap',
            'grid-gap',
            'grid-column-gap',
            'grid-column-end',
            'grid-row-gap',
        ]);
    }
    getMetricType() {
        return Host.UserMetrics.CSSHintType.MulticolFlexGrid;
    }
    #isRuleValid(computedStyles) {
        if (computedStyles === null) {
            return true;
        }
        return isMulticolContainer(computedStyles) || isFlexContainer(computedStyles) || isGridContainer(computedStyles);
    }
    getHint(propertyName, computedStyles) {
        if (this.#isRuleValid(computedStyles)) {
            return;
        }
        const reasonPropertyDeclaration = buildPropertyDefinitionText('display', computedStyles?.get('display'));
        const affectedPropertyDeclarationCode = buildPropertyName(propertyName);
        return new Hint(i18nString(UIStrings.ruleViolatedBySameElementRuleReason, {
            'REASON_PROPERTY_DECLARATION_CODE': reasonPropertyDeclaration,
            'AFFECTED_PROPERTY_DECLARATION_CODE': affectedPropertyDeclarationCode,
        }), i18nString(UIStrings.ruleViolatedBySameElementRuleFix, {
            PROPERTY_NAME: buildPropertyName('display'),
            PROPERTY_VALUE: buildPropertyValue(computedStyles?.get('display')),
        }));
    }
}
export class PaddingValidator extends CSSRuleValidator {
    constructor() {
        super([
            'padding',
            'padding-top',
            'padding-right',
            'padding-bottom',
            'padding-left',
        ]);
    }
    getMetricType() {
        return Host.UserMetrics.CSSHintType.Padding;
    }
    #isRuleValid(computedStyles) {
        const display = computedStyles?.get('display');
        if (!display) {
            return true;
        }
        return !['table-row-group', 'table-header-group', 'table-footer-group', 'table-row', 'table-column-group',
            'table-column']
            .includes(display);
    }
    getHint(propertyName, computedStyles) {
        if (this.#isRuleValid(computedStyles)) {
            return;
        }
        const reasonPropertyDeclaration = buildPropertyDefinitionText('display', computedStyles?.get('display'));
        const affectedPropertyDeclarationCode = buildPropertyName(propertyName);
        return new Hint(i18nString(UIStrings.ruleViolatedBySameElementRuleReason, {
            'REASON_PROPERTY_DECLARATION_CODE': reasonPropertyDeclaration,
            'AFFECTED_PROPERTY_DECLARATION_CODE': affectedPropertyDeclarationCode,
        }), i18nString(UIStrings.ruleViolatedBySameElementRuleFix, {
            PROPERTY_NAME: buildPropertyName('display'),
            PROPERTY_VALUE: buildPropertyValue(computedStyles?.get('display')),
        }));
    }
}
export class PositionValidator extends CSSRuleValidator {
    constructor() {
        super([
            'top',
            'right',
            'bottom',
            'left',
        ]);
    }
    getMetricType() {
        return Host.UserMetrics.CSSHintType.Position;
    }
    #isRuleValid(computedStyles) {
        const position = computedStyles?.get('position');
        if (position === null || position === undefined) {
            return true;
        }
        return position !== 'static';
    }
    getHint(propertyName, computedStyles) {
        if (this.#isRuleValid(computedStyles)) {
            return;
        }
        const reasonPropertyDeclaration = buildPropertyDefinitionText('position', computedStyles?.get('position'));
        const affectedPropertyDeclarationCode = buildPropertyName(propertyName);
        return new Hint(i18nString(UIStrings.ruleViolatedBySameElementRuleReason, {
            'REASON_PROPERTY_DECLARATION_CODE': reasonPropertyDeclaration,
            'AFFECTED_PROPERTY_DECLARATION_CODE': affectedPropertyDeclarationCode,
        }), i18nString(UIStrings.ruleViolatedBySameElementRuleFix, {
            PROPERTY_NAME: buildPropertyName('position'),
            PROPERTY_VALUE: buildPropertyValue(computedStyles?.get('position')),
        }));
    }
}
export class ZIndexValidator extends CSSRuleValidator {
    constructor() {
        super([
            'z-index',
        ]);
    }
    getMetricType() {
        return Host.UserMetrics.CSSHintType.ZIndex;
    }
    #isRuleValid(computedStyles, parentComputedStyles) {
        const position = computedStyles?.get('position');
        if (!position) {
            return true;
        }
        return ['absolute', 'relative', 'fixed', 'sticky'].includes(position) || isFlexContainer(parentComputedStyles);
    }
    getHint(propertyName, computedStyles, parentComputedStyles) {
        if (this.#isRuleValid(computedStyles, parentComputedStyles)) {
            return;
        }
        const reasonPropertyDeclaration = buildPropertyDefinitionText('position', computedStyles?.get('position'));
        const affectedPropertyDeclarationCode = buildPropertyName(propertyName);
        return new Hint(i18nString(UIStrings.ruleViolatedBySameElementRuleReason, {
            'REASON_PROPERTY_DECLARATION_CODE': reasonPropertyDeclaration,
            'AFFECTED_PROPERTY_DECLARATION_CODE': affectedPropertyDeclarationCode,
        }), i18nString(UIStrings.ruleViolatedBySameElementRuleFix, {
            PROPERTY_NAME: buildPropertyName('position'),
            PROPERTY_VALUE: buildPropertyValue(computedStyles?.get('position')),
        }));
    }
}
const CSS_RULE_VALIDATORS = [
    AlignContentValidator,
    FlexItemValidator,
    FlexContainerValidator,
    GridContainerValidator,
    GridItemValidator,
    FlexGridValidator,
    MulticolFlexGridValidator,
    PaddingValidator,
    PositionValidator,
    ZIndexValidator,
];
const setupCSSRulesValidators = () => {
    const validatorsMap = new Map();
    for (const validatorClass of CSS_RULE_VALIDATORS) {
        const validator = new validatorClass();
        const affectedProperties = validator.getApplicableProperties();
        for (const affectedProperty of affectedProperties) {
            let propertyValidators = validatorsMap.get(affectedProperty);
            if (propertyValidators === undefined) {
                propertyValidators = [];
            }
            propertyValidators.push(validator);
            validatorsMap.set(affectedProperty, propertyValidators);
        }
    }
    return validatorsMap;
};
export const cssRuleValidatorsMap = setupCSSRulesValidators();
//# sourceMappingURL=CSSRuleValidator.js.map