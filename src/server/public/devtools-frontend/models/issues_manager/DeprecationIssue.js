// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import { Issue, IssueCategory, IssueKind } from './Issue.js';
export class DeprecationIssue extends Issue {
    #issueDetails;
    constructor(issueDetails, issuesModel) {
        const issueCode = [
            "DeprecationIssue" /* DeprecationIssue */,
            issueDetails.deprecationType,
        ].join('::');
        super({ code: issueCode, umaCode: 'DeprecationIssue' }, issuesModel);
        this.#issueDetails = issueDetails;
    }
    getCategory() {
        return IssueCategory.Other;
    }
    details() {
        return this.#issueDetails;
    }
    getDescription() {
        return {
            file: 'deprecation.md',
            substitutions: new Map([
                // TODO(crbug.com/1264960): Re-work format to add i18n support per:
                // https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/public/devtools_protocol/README.md
                ['PLACEHOLDER_message', String(this.#issueDetails.message)],
            ]),
            links: [],
        };
    }
    sources() {
        if (this.#issueDetails.sourceCodeLocation) {
            return [this.#issueDetails.sourceCodeLocation];
        }
        return [];
    }
    primaryKey() {
        return JSON.stringify(this.#issueDetails);
    }
    getKind() {
        return IssueKind.BreakingChange;
    }
    static fromInspectorIssue(issuesModel, inspectorIssue) {
        const details = inspectorIssue.details.deprecationIssueDetails;
        if (!details) {
            console.warn('Deprecation issue without details received.');
            return [];
        }
        return [new DeprecationIssue(details, issuesModel)];
    }
}
//# sourceMappingURL=DeprecationIssue.js.map