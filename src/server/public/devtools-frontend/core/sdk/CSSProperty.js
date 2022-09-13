// Copyright 2016 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as TextUtils from '../../models/text_utils/text_utils.js';
import * as HostModule from '../host/host.js';
export class CSSProperty {
    ownerStyle;
    index;
    name;
    value;
    important;
    disabled;
    parsedOk;
    implicit;
    text;
    range;
    #active;
    #nameRangeInternal;
    #valueRangeInternal;
    #invalidString;
    constructor(ownerStyle, index, name, value, important, disabled, parsedOk, implicit, text, range) {
        this.ownerStyle = ownerStyle;
        this.index = index;
        this.name = name;
        this.value = value;
        this.important = important;
        this.disabled = disabled;
        this.parsedOk = parsedOk;
        this.implicit = implicit; // A longhand, implicitly set by missing values of shorthand.
        this.text = text;
        this.range = range ? TextUtils.TextRange.TextRange.fromObject(range) : null;
        this.#active = true;
        this.#nameRangeInternal = null;
        this.#valueRangeInternal = null;
    }
    static parsePayload(ownerStyle, index, payload) {
        // The following default field values are used in the payload:
        // important: false
        // parsedOk: true
        // implicit: false
        // disabled: false
        const result = new CSSProperty(ownerStyle, index, payload.name, payload.value, payload.important || false, payload.disabled || false, ('parsedOk' in payload) ? Boolean(payload.parsedOk) : true, Boolean(payload.implicit), payload.text, payload.range);
        return result;
    }
    ensureRanges() {
        if (this.#nameRangeInternal && this.#valueRangeInternal) {
            return;
        }
        const range = this.range;
        const text = this.text ? new TextUtils.Text.Text(this.text) : null;
        if (!range || !text) {
            return;
        }
        const nameIndex = text.value().indexOf(this.name);
        const valueIndex = text.value().lastIndexOf(this.value);
        if (nameIndex === -1 || valueIndex === -1 || nameIndex > valueIndex) {
            return;
        }
        const nameSourceRange = new TextUtils.TextRange.SourceRange(nameIndex, this.name.length);
        const valueSourceRange = new TextUtils.TextRange.SourceRange(valueIndex, this.value.length);
        this.#nameRangeInternal = rebase(text.toTextRange(nameSourceRange), range.startLine, range.startColumn);
        this.#valueRangeInternal = rebase(text.toTextRange(valueSourceRange), range.startLine, range.startColumn);
        function rebase(oneLineRange, lineOffset, columnOffset) {
            if (oneLineRange.startLine === 0) {
                oneLineRange.startColumn += columnOffset;
                oneLineRange.endColumn += columnOffset;
            }
            oneLineRange.startLine += lineOffset;
            oneLineRange.endLine += lineOffset;
            return oneLineRange;
        }
    }
    nameRange() {
        this.ensureRanges();
        return this.#nameRangeInternal;
    }
    valueRange() {
        this.ensureRanges();
        return this.#valueRangeInternal;
    }
    rebase(edit) {
        if (this.ownerStyle.styleSheetId !== edit.styleSheetId) {
            return;
        }
        if (this.range) {
            this.range = this.range.rebaseAfterTextEdit(edit.oldRange, edit.newRange);
        }
    }
    setActive(active) {
        this.#active = active;
    }
    get propertyText() {
        if (this.text !== undefined) {
            return this.text;
        }
        if (this.name === '') {
            return '';
        }
        return this.name + ': ' + this.value + (this.important ? ' !important' : '') + ';';
    }
    activeInStyle() {
        return this.#active;
    }
    trimmedValueWithoutImportant() {
        const important = '!important';
        return this.value.endsWith(important) ? this.value.slice(0, -important.length).trim() : this.value.trim();
    }
    async setText(propertyText, majorChange, overwrite) {
        if (!this.ownerStyle) {
            throw new Error('No ownerStyle for property');
        }
        if (!this.ownerStyle.styleSheetId) {
            throw new Error('No owner style id');
        }
        if (!this.range || !this.ownerStyle.range) {
            throw new Error('Style not editable');
        }
        if (majorChange) {
            HostModule.userMetrics.actionTaken(HostModule.UserMetrics.Action.StyleRuleEdited);
            if (this.name.startsWith('--')) {
                HostModule.userMetrics.actionTaken(HostModule.UserMetrics.Action.CustomPropertyEdited);
            }
        }
        if (overwrite && propertyText === this.propertyText) {
            this.ownerStyle.cssModel().domModel().markUndoableState(!majorChange);
            return true;
        }
        const range = this.range.relativeTo(this.ownerStyle.range.startLine, this.ownerStyle.range.startColumn);
        const text = new TextUtils.Text.Text(this.ownerStyle.cssText || '');
        const textBeforeInsertion = text.extract(new TextUtils.TextRange.TextRange(0, 0, range.startLine, range.startColumn));
        // If we are appending after the last property and that property doesn't have a semicolon at the end
        // (which is only legal in the last position), then add the semicolon in front of the new text to avoid
        // CSS parsing errors. However, we shouldn't prepend semicolons on the first line or after a comment.
        if (textBeforeInsertion.trim().length && !/[;{\/]\s*$/.test(textBeforeInsertion)) {
            propertyText = ';' + propertyText;
        }
        const newStyleText = text.replaceRange(range, propertyText);
        return this.ownerStyle.setText(newStyleText, majorChange);
    }
    setValue(newValue, majorChange, overwrite, userCallback) {
        const text = this.name + ': ' + newValue + (this.important ? ' !important' : '') + ';';
        void this.setText(text, majorChange, overwrite).then(userCallback);
    }
    async setDisabled(disabled) {
        if (!this.ownerStyle) {
            return false;
        }
        if (disabled === this.disabled) {
            return true;
        }
        if (!this.text) {
            return true;
        }
        const propertyText = this.text.trim();
        // Ensure that if we try to enable/disable a property that has no semicolon (which is only legal
        // in the last position of a css rule), we add it. This ensures that if we then later try
        // to re-enable/-disable the rule, we end up with legal syntax (if the user adds more properties
        // after the disabled rule).
        const appendSemicolonIfMissing = (propertyText) => propertyText + (propertyText.endsWith(';') ? '' : ';');
        let text;
        if (disabled) {
            text = '/* ' + appendSemicolonIfMissing(propertyText) + ' */';
        }
        else {
            text = appendSemicolonIfMissing(this.text.substring(2, propertyText.length - 2).trim());
        }
        return this.setText(text, true, true);
    }
    /**
     * This stores the warning string when a CSS Property is improperly parsed.
     */
    setDisplayedStringForInvalidProperty(invalidString) {
        this.#invalidString = invalidString;
    }
    /**
     * Retrieve the warning string for a screen reader to announce when editing the property.
     */
    getInvalidStringForInvalidProperty() {
        return this.#invalidString;
    }
}
//# sourceMappingURL=CSSProperty.js.map