// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import { Issue, IssueCategory, IssueKind } from './Issue.js';
function getIssueCode(details) {
    switch (details.violationType) {
        case "PermissionPolicyDisabled" /* Protocol.Audits.AttributionReportingIssueType.PermissionPolicyDisabled */:
            return "AttributionReportingIssue::PermissionPolicyDisabled" /* IssueCode.PermissionPolicyDisabled */;
        case "PermissionPolicyNotDelegated" /* Protocol.Audits.AttributionReportingIssueType.PermissionPolicyNotDelegated */:
            return "AttributionReportingIssue::PermissionPolicyNotDelegated" /* IssueCode.PermissionPolicyNotDelegated */;
        case "UntrustworthyReportingOrigin" /* Protocol.Audits.AttributionReportingIssueType.UntrustworthyReportingOrigin */:
            return "AttributionReportingIssue::UntrustworthyReportingOrigin" /* IssueCode.UntrustworthyReportingOrigin */;
        case "InsecureContext" /* Protocol.Audits.AttributionReportingIssueType.InsecureContext */:
            return "AttributionReportingIssue::InsecureContext" /* IssueCode.InsecureContext */;
        case "InvalidHeader" /* Protocol.Audits.AttributionReportingIssueType.InvalidHeader */:
            return "AttributionReportingIssue::InvalidRegisterSourceHeader" /* IssueCode.InvalidRegisterSourceHeader */;
        case "InvalidRegisterTriggerHeader" /* Protocol.Audits.AttributionReportingIssueType.InvalidRegisterTriggerHeader */:
            return "AttributionReportingIssue::InvalidRegisterTriggerHeader" /* IssueCode.InvalidRegisterTriggerHeader */;
        case "InvalidEligibleHeader" /* Protocol.Audits.AttributionReportingIssueType.InvalidEligibleHeader */:
            return "AttributionReportingIssue::InvalidEligibleHeader" /* IssueCode.InvalidEligibleHeader */;
        case "TooManyConcurrentRequests" /* Protocol.Audits.AttributionReportingIssueType.TooManyConcurrentRequests */:
            return "AttributionReportingIssue::TooManyConcurrentRequests" /* IssueCode.TooManyConcurrentRequests */;
        case "SourceAndTriggerHeaders" /* Protocol.Audits.AttributionReportingIssueType.SourceAndTriggerHeaders */:
            return "AttributionReportingIssue::SourceAndTriggerHeaders" /* IssueCode.SourceAndTriggerHeaders */;
        case "SourceIgnored" /* Protocol.Audits.AttributionReportingIssueType.SourceIgnored */:
            return "AttributionReportingIssue::SourceIgnored" /* IssueCode.SourceIgnored */;
        case "TriggerIgnored" /* Protocol.Audits.AttributionReportingIssueType.TriggerIgnored */:
            return "AttributionReportingIssue::TriggerIgnored" /* IssueCode.TriggerIgnored */;
        default:
            return "AttributionReportingIssue::Unknown" /* IssueCode.Unknown */;
    }
}
const structuredHeaderLink = {
    link: 'https://tools.ietf.org/id/draft-ietf-httpbis-header-structure-15.html#rfc.section.4.2.2',
    linkTitle: 'Structured Headers RFC',
};
export class AttributionReportingIssue extends Issue {
    issueDetails;
    constructor(issueDetails, issuesModel) {
        super(getIssueCode(issueDetails), issuesModel);
        this.issueDetails = issueDetails;
    }
    getCategory() {
        return IssueCategory.AttributionReporting;
    }
    getDescription() {
        switch (this.code()) {
            case "AttributionReportingIssue::PermissionPolicyDisabled" /* IssueCode.PermissionPolicyDisabled */:
                return {
                    file: 'arPermissionPolicyDisabled.md',
                    links: [],
                };
            case "AttributionReportingIssue::PermissionPolicyNotDelegated" /* IssueCode.PermissionPolicyNotDelegated */:
                return {
                    file: 'arPermissionPolicyNotDelegated.md',
                    links: [],
                };
            case "AttributionReportingIssue::UntrustworthyReportingOrigin" /* IssueCode.UntrustworthyReportingOrigin */:
                return {
                    file: 'arUntrustworthyReportingOrigin.md',
                    links: [],
                };
            case "AttributionReportingIssue::InsecureContext" /* IssueCode.InsecureContext */:
                return {
                    file: 'arInsecureContext.md',
                    links: [],
                };
            case "AttributionReportingIssue::InvalidRegisterSourceHeader" /* IssueCode.InvalidRegisterSourceHeader */:
                return {
                    file: 'arInvalidRegisterSourceHeader.md',
                    links: [],
                };
            case "AttributionReportingIssue::InvalidRegisterTriggerHeader" /* IssueCode.InvalidRegisterTriggerHeader */:
                return {
                    file: 'arInvalidRegisterTriggerHeader.md',
                    links: [],
                };
            case "AttributionReportingIssue::InvalidEligibleHeader" /* IssueCode.InvalidEligibleHeader */:
                return {
                    file: 'arInvalidEligibleHeader.md',
                    links: [structuredHeaderLink],
                };
            case "AttributionReportingIssue::TooManyConcurrentRequests" /* IssueCode.TooManyConcurrentRequests */:
                return {
                    file: 'arTooManyConcurrentRequests.md',
                    links: [],
                };
            case "AttributionReportingIssue::SourceAndTriggerHeaders" /* IssueCode.SourceAndTriggerHeaders */:
                return {
                    file: 'arSourceAndTriggerHeaders.md',
                    links: [],
                };
            case "AttributionReportingIssue::SourceIgnored" /* IssueCode.SourceIgnored */:
                return {
                    file: 'arSourceIgnored.md',
                    links: [structuredHeaderLink],
                };
            case "AttributionReportingIssue::TriggerIgnored" /* IssueCode.TriggerIgnored */:
                return {
                    file: 'arTriggerIgnored.md',
                    links: [structuredHeaderLink],
                };
            case "AttributionReportingIssue::Unknown" /* IssueCode.Unknown */:
                return null;
        }
    }
    primaryKey() {
        return JSON.stringify(this.issueDetails);
    }
    getKind() {
        switch (this.code()) {
            case "AttributionReportingIssue::PermissionPolicyNotDelegated" /* IssueCode.PermissionPolicyNotDelegated */:
                return IssueKind.BreakingChange;
            case "AttributionReportingIssue::PermissionPolicyDisabled" /* IssueCode.PermissionPolicyDisabled */:
            case "AttributionReportingIssue::UntrustworthyReportingOrigin" /* IssueCode.UntrustworthyReportingOrigin */:
            case "AttributionReportingIssue::InsecureContext" /* IssueCode.InsecureContext */:
            case "AttributionReportingIssue::InvalidRegisterSourceHeader" /* IssueCode.InvalidRegisterSourceHeader */:
            case "AttributionReportingIssue::InvalidRegisterTriggerHeader" /* IssueCode.InvalidRegisterTriggerHeader */:
            case "AttributionReportingIssue::InvalidEligibleHeader" /* IssueCode.InvalidEligibleHeader */:
            case "AttributionReportingIssue::TooManyConcurrentRequests" /* IssueCode.TooManyConcurrentRequests */:
            case "AttributionReportingIssue::SourceAndTriggerHeaders" /* IssueCode.SourceAndTriggerHeaders */:
            case "AttributionReportingIssue::SourceIgnored" /* IssueCode.SourceIgnored */:
            case "AttributionReportingIssue::TriggerIgnored" /* IssueCode.TriggerIgnored */:
            case "AttributionReportingIssue::Unknown" /* IssueCode.Unknown */:
                return IssueKind.PageError;
        }
    }
    static fromInspectorIssue(issuesModel, inspectorIssue) {
        const { attributionReportingIssueDetails } = inspectorIssue.details;
        if (!attributionReportingIssueDetails) {
            console.warn('Attribution Reporting issue without details received.');
            return [];
        }
        return [new AttributionReportingIssue(attributionReportingIssueDetails, issuesModel)];
    }
}
//# sourceMappingURL=AttributionReportingIssue.js.map