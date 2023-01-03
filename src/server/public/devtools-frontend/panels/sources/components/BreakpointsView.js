// Copyright (c) 2022 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import * as i18n from '../../../core/i18n/i18n.js';
import * as Platform from '../../../core/platform/platform.js';
import { assertNotNullOrUndefined } from '../../../core/platform/platform.js';
import * as ComponentHelpers from '../../../ui/components/helpers/helpers.js';
import * as IconButton from '../../../ui/components/icon_button/icon_button.js';
import * as TwoStatesCounter from '../../../ui/components/two_states_counter/two_states_counter.js';
import * as UI from '../../../ui/legacy/legacy.js';
import * as LitHtml from '../../../ui/lit-html/lit-html.js';
import breakpointsViewStyles from './breakpointsView.css.js';
const UIStrings = {
    /**
    *@description Text in pausing the debugger on exceptions in the Sources panel.
    */
    pauseOnExceptions: 'Pause on exceptions',
    /**
    *@description Text for pausing the debugger on caught exceptions in the Sources panel.
    */
    pauseOnCaughtExceptions: 'Pause on caught exceptions',
    /**
    *@description Text exposed to screen readers on checked items.
    */
    checked: 'checked',
    /**
    *@description Accessible text exposed to screen readers when the screen reader encounters an unchecked checkbox.
    */
    unchecked: 'unchecked',
    /**
    *@description Accessible text for a breakpoint collection with a combination of checked states.
    */
    indeterminate: 'mixed',
    /**
    *@description Accessibility label for hit breakpoints in the Sources panel.
    *@example {checked} PH1
    */
    breakpointHit: '{PH1} breakpoint hit',
    /**
    *@description Tooltip text that shows when hovered over a remove button that appears next to a filename in the breakpoint sidebarof the sources panel. Also used in the context menu for breakpoint groups.
    */
    removeAllBreakpointsInFile: 'Remove all breakpoints in file',
    /**
     *@description Context menu item in the Breakpoints Sidebar Pane of the Sources panel that disables all breakpoints in a file.
     */
    disableAllBreakpointsInFile: 'Disable all breakpoints in file',
    /**
     *@description Context menu item in the Breakpoints Sidebar Pane of the Sources panel that enables all breakpoints in a file.
     */
    enableAllBreakpointsInFile: 'Enable all breakpoints in file',
    /**
    *@description Tooltip text that shows when hovered over an edit button that appears next to a breakpoint in the breakpoint sidebar of the sources panel.
    */
    editBreakpoint: 'Edit breakpoint',
    /**
    *@description Tooltip text that shows when hovered over a remove button that appears next to a breakpoint in the breakpoint sidebar of the sources panel. Also used in the context menu for breakpoint items.
    */
    removeBreakpoint: 'Remove breakpoint',
    /**
    *@description Text to remove all breakpoints
    */
    removeAllBreakpoints: 'Remove all breakpoints',
    /**
    *@description Text in Breakpoints Sidebar Pane of the Sources panel
    */
    removeOtherBreakpoints: 'Remove other breakpoints',
    /**
    *@description Context menu item that reveals the source code location of a breakpoint in the Sources panel.
    */
    revealLocation: 'Reveal location',
    /**
    *@description Tooltip text that shows when hovered over a piece of code of a breakpoint in the breakpoint sidebar of the sources panel. It shows the condition, on which the breakpoint will stop.
    *@example {x < 3} PH1
    */
    conditionCode: 'Condition: {PH1}',
    /**
    *@description Tooltip text that shows when hovered over a piece of code of a breakpoint in the breakpoint sidebar of the sources panel. It shows what is going to be printed in the console, if execution hits this breakpoint.
    *@example {'hello'} PH1
    */
    logpointCode: 'Logpoint: {PH1}',
};
const str_ = i18n.i18n.registerUIStrings('panels/sources/components/BreakpointsView.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
const MAX_SNIPPET_LENGTH = 200;
export class CheckboxToggledEvent extends Event {
    static eventName = 'checkboxtoggled';
    data;
    constructor(breakpointItem, checked) {
        super(CheckboxToggledEvent.eventName);
        this.data = { breakpointItem: breakpointItem, checked };
    }
}
export class PauseOnExceptionsStateChangedEvent extends Event {
    static eventName = 'pauseonexceptionsstatechanged';
    data;
    constructor(checked) {
        super(PauseOnExceptionsStateChangedEvent.eventName);
        this.data = { checked };
    }
}
export class PauseOnCaughtExceptionsStateChangedEvent extends Event {
    static eventName = 'pauseoncaughtexceptionsstatechanged';
    data;
    constructor(checked) {
        super(PauseOnCaughtExceptionsStateChangedEvent.eventName);
        this.data = { checked };
    }
}
export class ExpandedStateChangedEvent extends Event {
    static eventName = 'expandedstatechanged';
    data;
    constructor(url, expanded) {
        super(ExpandedStateChangedEvent.eventName);
        this.data = { url, expanded };
    }
}
export class BreakpointSelectedEvent extends Event {
    static eventName = 'breakpointselected';
    data;
    constructor(breakpointItem) {
        super(BreakpointSelectedEvent.eventName);
        this.data = { breakpointItem: breakpointItem };
    }
}
export class BreakpointEditedEvent extends Event {
    static eventName = 'breakpointedited';
    data;
    constructor(breakpointItem) {
        super(BreakpointEditedEvent.eventName);
        this.data = { breakpointItem };
    }
}
export class BreakpointsRemovedEvent extends Event {
    static eventName = 'breakpointsremoved';
    data;
    constructor(breakpointItems) {
        super(BreakpointsRemovedEvent.eventName);
        this.data = { breakpointItems };
    }
}
export class BreakpointsView extends HTMLElement {
    static litTagName = LitHtml.literal `devtools-breakpoint-view`;
    #shadow = this.attachShadow({ mode: 'open' });
    #boundRender = this.#render.bind(this);
    #pauseOnExceptions = false;
    #pauseOnCaughtExceptions = false;
    #breakpointsActive = true;
    #breakpointGroups = [];
    set data(data) {
        this.#pauseOnExceptions = data.pauseOnExceptions;
        this.#pauseOnCaughtExceptions = data.pauseOnCaughtExceptions;
        this.#breakpointsActive = data.breakpointsActive;
        this.#breakpointGroups = data.groups;
        void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
    }
    connectedCallback() {
        this.#shadow.adoptedStyleSheets = [breakpointsViewStyles];
        void ComponentHelpers.ScheduledRender.scheduleRender(this, this.#boundRender);
    }
    #render() {
        // clang-format off
        const renderedGroups = this.#breakpointGroups.map(group => LitHtml.html `
          <hr />
          ${this.#renderBreakpointGroup(group)}
        `);
        const out = LitHtml.html `
    <div class='pause-on-exceptions'>
      <label class='checkbox-label'>
        <input type='checkbox' ?checked=${this.#pauseOnExceptions} @change=${this.#onPauseOnExceptionsStateChanged.bind(this)}>
        <span>${i18nString(UIStrings.pauseOnExceptions)}</span>
      </label>
    </div>
    ${this.#pauseOnExceptions ? LitHtml.html `
      <div class='pause-on-caught-exceptions'>
        <label class='checkbox-label'>
          <input type='checkbox' ?checked=${this.#pauseOnCaughtExceptions} @change=${this.#onPauseOnCaughtExceptionsStateChanged.bind(this)}>
          <span>${i18nString(UIStrings.pauseOnCaughtExceptions)}</span>
        </label>
      </div>
      ` : LitHtml.nothing}
    <div role=tree>${renderedGroups}</div>`;
        // clang-format on
        LitHtml.render(out, this.#shadow, { host: this });
    }
    #renderEditBreakpointButton(breakpointItem) {
        const clickHandler = (event) => {
            this.dispatchEvent(new BreakpointEditedEvent(breakpointItem));
            event.consume();
        };
        // clang-format off
        return LitHtml.html `
    <button class='edit-breakpoint-button' @click=${clickHandler} title=${i18nString(UIStrings.editBreakpoint)}>
    <${IconButton.Icon.Icon.litTagName} .data=${{
            iconName: 'edit-icon',
            width: '10px',
            color: 'var(--color-text-secondary)',
        }}
      }>
      </${IconButton.Icon.Icon.litTagName}>
    </button>
      `;
        // clang-format on
    }
    #renderRemoveBreakpointButton(breakpointItems, tooltipText) {
        const clickHandler = (event) => {
            this.dispatchEvent(new BreakpointsRemovedEvent(breakpointItems));
            event.consume();
        };
        // clang-format off
        return LitHtml.html `
    <button class='remove-breakpoint-button' @click=${clickHandler} title=${tooltipText}>
    <${IconButton.Icon.Icon.litTagName} .data=${{
            iconName: 'close-icon',
            width: '7px',
            color: 'var(--color-text-secondary)',
        }}
      }>
      </${IconButton.Icon.Icon.litTagName}>
    </button>
      `;
        // clang-format on
    }
    #onBreakpointGroupContextMenu(event, breakpointGroup) {
        const { breakpointItems } = breakpointGroup;
        const menu = new UI.ContextMenu.ContextMenu(event);
        menu.defaultSection().appendItem(i18nString(UIStrings.removeAllBreakpointsInFile), () => {
            this.dispatchEvent(new BreakpointsRemovedEvent(breakpointItems));
        });
        const notDisabledItems = breakpointItems.filter(breakpointItem => breakpointItem.status !== "DISABLED" /* BreakpointStatus.DISABLED */);
        menu.defaultSection().appendItem(i18nString(UIStrings.disableAllBreakpointsInFile), () => {
            for (const breakpointItem of notDisabledItems) {
                this.dispatchEvent(new CheckboxToggledEvent(breakpointItem, false));
            }
        }, notDisabledItems.length === 0);
        const notEnabledItems = breakpointItems.filter(breakpointItem => breakpointItem.status !== "ENABLED" /* BreakpointStatus.ENABLED */);
        menu.defaultSection().appendItem(i18nString(UIStrings.enableAllBreakpointsInFile), () => {
            for (const breakpointItem of notEnabledItems) {
                this.dispatchEvent(new CheckboxToggledEvent(breakpointItem, true));
            }
        }, notEnabledItems.length === 0);
        menu.defaultSection().appendItem(i18nString(UIStrings.removeAllBreakpoints), () => {
            const breakpointItems = this.#breakpointGroups.map(({ breakpointItems }) => breakpointItems).flat();
            this.dispatchEvent(new BreakpointsRemovedEvent(breakpointItems));
        });
        const otherGroups = this.#breakpointGroups.filter(group => group !== breakpointGroup);
        menu.defaultSection().appendItem(i18nString(UIStrings.removeOtherBreakpoints), () => {
            const breakpointItems = otherGroups.map(({ breakpointItems }) => breakpointItems).flat();
            this.dispatchEvent(new BreakpointsRemovedEvent(breakpointItems));
        }, otherGroups.length === 0);
        void menu.show();
    }
    #renderBreakpointGroup(group) {
        const contextmenuHandler = (event) => {
            this.#onBreakpointGroupContextMenu(event, group);
            event.consume();
        };
        const toggleHandler = (event) => {
            const { open } = event.target;
            group.expanded = open;
            this.dispatchEvent(new ExpandedStateChangedEvent(group.url, open));
            event.consume();
        };
        const classMap = {
            active: this.#breakpointsActive,
        };
        // clang-format off
        return LitHtml.html `
      <details class=${LitHtml.Directives.classMap(classMap)}
               data-group=true
               role=group
               aria-label='${group.name}'
               aria-description='${group.url}'
               ?open=${group.expanded}
               @toggle=${toggleHandler}>
        <summary @contextmenu=${contextmenuHandler} >
          <span class='group-header' aria-hidden=true>${this.#renderFileIcon()}<span class='group-header-title' title='${group.url}'>${group.name}</span></span>
          <span class='group-hover-actions'>
            ${this.#renderRemoveBreakpointButton(group.breakpointItems, i18nString(UIStrings.removeAllBreakpointsInFile))}
            ${this.#renderBreakpointCounter(group)}
          </span>
        </summary>
        ${group.breakpointItems.map(entry => this.#renderBreakpointEntry(entry, group.editable))}
      </div>
      `;
        // clang-format on
    }
    #renderBreakpointCounter(group) {
        const numActive = group.breakpointItems.reduce((previousValue, currentValue) => {
            return currentValue.status === "ENABLED" /* BreakpointStatus.ENABLED */ ? previousValue + 1 : previousValue;
        }, 0);
        const numInactive = group.breakpointItems.length - numActive;
        // clang-format off
        const inactiveActiveCounter = LitHtml.html `
    <${TwoStatesCounter.TwoStatesCounter.TwoStatesCounter.litTagName} .data=${{ active: numActive, inactive: numInactive, width: '15px', height: '15px' }}>
    </${TwoStatesCounter.TwoStatesCounter.TwoStatesCounter.litTagName}>
    `;
        // clang-format on
        return inactiveActiveCounter;
    }
    #renderFileIcon() {
        return LitHtml.html `
      <${IconButton.Icon.Icon.litTagName} .data=${{ iconName: 'ic_file_script', color: 'var(--color-ic-file-script)', width: '16px', height: '16px' }}></${IconButton.Icon.Icon.litTagName}>
    `;
    }
    #onBreakpointEntryContextMenu(event, breakpointItem, editable) {
        const menu = new UI.ContextMenu.ContextMenu(event);
        menu.defaultSection().appendItem(i18nString(UIStrings.removeBreakpoint), () => {
            this.dispatchEvent(new BreakpointsRemovedEvent([breakpointItem]));
        });
        menu.defaultSection().appendItem(i18nString(UIStrings.editBreakpoint), () => {
            this.dispatchEvent(new BreakpointEditedEvent(breakpointItem));
        }, !editable);
        menu.defaultSection().appendItem(i18nString(UIStrings.revealLocation), () => {
            this.dispatchEvent(new BreakpointSelectedEvent(breakpointItem));
        });
        menu.defaultSection().appendItem(i18nString(UIStrings.removeAllBreakpoints), () => {
            const breakpointItems = this.#breakpointGroups.map(({ breakpointItems }) => breakpointItems).flat();
            this.dispatchEvent(new BreakpointsRemovedEvent(breakpointItems));
        });
        const otherItems = this.#breakpointGroups.map(({ breakpointItems }) => breakpointItems)
            .flat()
            .filter(item => item !== breakpointItem);
        menu.defaultSection().appendItem(i18nString(UIStrings.removeOtherBreakpoints), () => {
            this.dispatchEvent(new BreakpointsRemovedEvent(otherItems));
        }, otherItems.length === 0);
        void menu.show();
    }
    #renderBreakpointEntry(breakpointItem, editable) {
        const clickHandler = (event) => {
            this.dispatchEvent(new BreakpointSelectedEvent(breakpointItem));
            event.consume();
        };
        const contextmenuHandler = (event) => {
            this.#onBreakpointEntryContextMenu(event, breakpointItem, editable);
            event.consume();
        };
        const classMap = {
            'breakpoint-item': true,
            'hit': breakpointItem.isHit,
            'conditional-breakpoint': breakpointItem.type === "CONDITIONAL_BREAKPOINT" /* BreakpointType.CONDITIONAL_BREAKPOINT */,
            'logpoint': breakpointItem.type === "LOGPOINT" /* BreakpointType.LOGPOINT */,
        };
        const breakpointItemDescription = this.#getBreakpointItemDescription(breakpointItem);
        const codeSnippet = Platform.StringUtilities.trimEndWithMaxLength(breakpointItem.codeSnippet, MAX_SNIPPET_LENGTH);
        const codeSnippetTooltip = this.#getCodeSnippetTooltip(breakpointItem.type, breakpointItem.hoverText);
        // clang-format off
        return LitHtml.html `
    <div class=${LitHtml.Directives.classMap(classMap)}
         aria-label=${breakpointItemDescription}
         role=treeitem
         tabIndex=${breakpointItem.isHit ? 0 : -1}
         @contextmenu=${contextmenuHandler}>
      <label class='checkbox-label'>
        <span class='type-indicator'></span>
        <input type='checkbox' aria-label=${breakpointItem.location} ?indeterminate=${breakpointItem.status === "INDETERMINATE" /* BreakpointStatus.INDETERMINATE */} ?checked=${breakpointItem.status === "ENABLED" /* BreakpointStatus.ENABLED */} @change=${(e) => this.#onCheckboxToggled(e, breakpointItem)}>
      </label>
      <span class='code-snippet' @click=${clickHandler} title=${codeSnippetTooltip}>${codeSnippet}</span>
      <span class='breakpoint-item-location-or-actions'>
        ${editable ? this.#renderEditBreakpointButton(breakpointItem) : LitHtml.nothing}
        ${this.#renderRemoveBreakpointButton([breakpointItem], i18nString(UIStrings.removeBreakpoint))}
        <span class='location'>${breakpointItem.location}</span>
      </span>
    </div>
    `;
        // clang-format on
    }
    #getCodeSnippetTooltip(type, hoverText) {
        switch (type) {
            case "REGULAR_BREAKPOINT" /* BreakpointType.REGULAR_BREAKPOINT */:
                return undefined;
            case "CONDITIONAL_BREAKPOINT" /* BreakpointType.CONDITIONAL_BREAKPOINT */:
                assertNotNullOrUndefined(hoverText);
                return i18nString(UIStrings.conditionCode, { PH1: hoverText });
            case "LOGPOINT" /* BreakpointType.LOGPOINT */:
                assertNotNullOrUndefined(hoverText);
                return i18nString(UIStrings.logpointCode, { PH1: hoverText });
        }
    }
    #getBreakpointItemDescription(breakpointItem) {
        let checkboxDescription;
        switch (breakpointItem.status) {
            case "ENABLED" /* BreakpointStatus.ENABLED */:
                checkboxDescription = i18nString(UIStrings.checked);
                break;
            case "DISABLED" /* BreakpointStatus.DISABLED */:
                checkboxDescription = i18nString(UIStrings.unchecked);
                break;
            case "INDETERMINATE" /* BreakpointStatus.INDETERMINATE */:
                checkboxDescription = i18nString(UIStrings.indeterminate);
                break;
        }
        if (!breakpointItem.isHit) {
            return checkboxDescription;
        }
        return i18nString(UIStrings.breakpointHit, { PH1: checkboxDescription });
    }
    #onCheckboxToggled(e, item) {
        const element = e.target;
        this.dispatchEvent(new CheckboxToggledEvent(item, element.checked));
    }
    #onPauseOnCaughtExceptionsStateChanged(e) {
        const { checked } = e.target;
        this.dispatchEvent(new PauseOnCaughtExceptionsStateChangedEvent(checked));
    }
    #onPauseOnExceptionsStateChanged(e) {
        const { checked } = e.target;
        this.dispatchEvent(new PauseOnExceptionsStateChangedEvent(checked));
    }
}
ComponentHelpers.CustomElements.defineComponent('devtools-breakpoint-view', BreakpointsView);
//# sourceMappingURL=BreakpointsView.js.map