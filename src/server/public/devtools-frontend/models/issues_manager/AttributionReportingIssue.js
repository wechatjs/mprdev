// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.
import { Issue, IssueCategory, IssueKind } from './Issue.js';
function getIssueCode(details) {
    switch (details.violationType) {
        case "PermissionPolicyDisabled" /* PermissionPolicyDisabled */:
            return "AttributionReportingIssue::PermissionPolicyDisabled" /* PermissionPolicyDisabled */;
        case "InvalidAttributionSourceEventId" /* InvalidAttributionSourceEventId */:
            return "AttributionReportingIssue::InvalidAttributionSourceEventId" /* InvalidAttributionSourceEventId */;
        case "InvalidAttributionData" /* InvalidAttributionData */:
            return details.invalidParameter !== undefined ? "AttributionReportingIssue::InvalidAttributionData" /* InvalidAttributionData */ :
                "AttributionReportingIssue::MissingAttributionData" /* MissingAttributionData */;
        case "AttributionSourceUntrustworthyOrigin" /* AttributionSourceUntrustworthyOrigin */:
            return details.frame !== undefined ? "AttributionReportingIssue::AttributionSourceUntrustworthyFrameOrigin" /* AttributionSourceUntrustworthyFrameOrigin */ :
                "AttributionReportingIssue::AttributionSourceUntrustworthyOrigin" /* AttributionSourceUntrustworthyOrigin */;
        case "AttributionUntrustworthyOrigin" /* AttributionUntrustworthyOrigin */:
            return details.frame !== undefined ? "AttributionReportingIssue::AttributionUntrustworthyFrameOrigin" /* AttributionUntrustworthyFrameOrigin */ :
                "AttributionReportingIssue::AttributionUntrustworthyOrigin" /* AttributionUntrustworthyOrigin */;
        case "AttributionTriggerDataTooLarge" /* AttributionTriggerDataTooLarge */:
            return "AttributionReportingIssue::AttributionTriggerDataTooLarge" /* AttributionTriggerDataTooLarge */;
        case "AttributionEventSourceTriggerDataTooLarge" /* AttributionEventSourceTriggerDataTooLarge */:
            return "AttributionReportingIssue::AttributionEventSourceTriggerDataTooLarge" /* AttributionEventSourceTriggerDataTooLarge */;
        case "InvalidAttributionSourceExpiry" /* InvalidAttributionSourceExpiry */:
            return "AttributionReportingIssue::InvalidAttributionSourceExpiry" /* InvalidAttributionSourceExpiry */;
        case "InvalidAttributionSourcePriority" /* InvalidAttributionSourcePriority */:
            return "AttributionReportingIssue::InvalidAttributionSourcePriority" /* InvalidAttributionSourcePriority */;
        case "InvalidEventSourceTriggerData" /* InvalidEventSourceTriggerData */:
            return "AttributionReportingIssue::InvalidEventSourceTriggerData" /* InvalidEventSourceTriggerData */;
        case "InvalidTriggerPriority" /* InvalidTriggerPriority */:
            return "AttributionReportingIssue::InvalidTriggerPriority" /* InvalidTriggerPriority */;
        case "InvalidTriggerDedupKey" /* InvalidTriggerDedupKey */:
            return "AttributionReportingIssue::InvalidTriggerDedupKey" /* InvalidTriggerDedupKey */;
    }
}
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
            case "AttributionReportingIssue::PermissionPolicyDisabled" /* PermissionPolicyDisabled */:
                return {
                    file: 'arPermissionPolicyDisabled.md',
                    links: [],
                };
            case "AttributionReportingIssue::InvalidAttributionSourceEventId" /* InvalidAttributionSourceEventId */:
                return {
                    file: 'arInvalidAttributionSourceEventId.md',
                    links: [{
                            link: 'https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-event-guide/#html-attribute-attributionsourceeventid-required',
                            linkTitle: 'attributionsourceeventid attribute',
                        }],
                };
            case "AttributionReportingIssue::InvalidAttributionData" /* InvalidAttributionData */:
                return {
                    file: 'arInvalidAttributionData.md',
                    links: [],
                };
            case "AttributionReportingIssue::MissingAttributionData" /* MissingAttributionData */:
                return {
                    file: 'arMissingAttributionData.md',
                    links: [],
                };
            case "AttributionReportingIssue::AttributionSourceUntrustworthyFrameOrigin" /* AttributionSourceUntrustworthyFrameOrigin */:
                return {
                    file: 'arAttributionSourceUntrustworthyFrameOrigin.md',
                    links: [],
                };
            case "AttributionReportingIssue::AttributionSourceUntrustworthyOrigin" /* AttributionSourceUntrustworthyOrigin */:
                return {
                    file: 'arAttributionSourceUntrustworthyOrigin.md',
                    links: [
                        {
                            link: 'https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-event-guide/#html-attribute-attributiondestination-required',
                            linkTitle: 'attributiondestination attribute',
                        },
                        {
                            link: 'https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-event-guide/#html-attribute-attributionreportto',
                            linkTitle: 'attributionreportto attribute',
                        },
                    ],
                };
            case "AttributionReportingIssue::AttributionUntrustworthyFrameOrigin" /* AttributionUntrustworthyFrameOrigin */:
                return {
                    file: 'arAttributionUntrustworthyFrameOrigin.md',
                    links: [],
                };
            case "AttributionReportingIssue::AttributionUntrustworthyOrigin" /* AttributionUntrustworthyOrigin */:
                return {
                    file: 'arAttributionUntrustworthyOrigin.md',
                    links: [],
                };
            case "AttributionReportingIssue::AttributionTriggerDataTooLarge" /* AttributionTriggerDataTooLarge */:
                return {
                    file: 'arAttributionTriggerDataTooLarge.md',
                    links: [],
                };
            case "AttributionReportingIssue::AttributionEventSourceTriggerDataTooLarge" /* AttributionEventSourceTriggerDataTooLarge */:
                return {
                    file: 'arAttributionEventSourceTriggerDataTooLarge.md',
                    links: [],
                };
            case "AttributionReportingIssue::InvalidAttributionSourceExpiry" /* InvalidAttributionSourceExpiry */:
                return {
                    file: 'arInvalidAttributionSourceExpiry.md',
                    links: [{
                            link: 'https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-event-guide/#html-attribute-attributionexpiry',
                            linkTitle: 'attributionexpiry attribute',
                        }],
                };
            case "AttributionReportingIssue::InvalidAttributionSourcePriority" /* InvalidAttributionSourcePriority */:
                return {
                    file: 'arInvalidAttributionSourcePriority.md',
                    links: [{
                            link: 'https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-event-guide/#html-attribute-attributionsourcepriority',
                            linkTitle: 'attributionsourcepriority attribute',
                        }],
                };
            case "AttributionReportingIssue::InvalidEventSourceTriggerData" /* InvalidEventSourceTriggerData */:
                return {
                    file: 'arInvalidEventSourceTriggerData.md',
                    links: [],
                };
            case "AttributionReportingIssue::InvalidTriggerPriority" /* InvalidTriggerPriority */:
                return {
                    file: 'arInvalidTriggerPriority.md',
                    links: [{
                            link: 'https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-event-guide/#prioritize-specific-conversions',
                            linkTitle: 'Prioritizing specific conversions',
                        }],
                };
            case "AttributionReportingIssue::InvalidTriggerDedupKey" /* InvalidTriggerDedupKey */:
                return {
                    file: 'arInvalidTriggerDedupKey.md',
                    links: [{
                            link: 'https://developer.chrome.com/docs/privacy-sandbox/attribution-reporting-event-guide/#deduplicate-reports',
                            linkTitle: 'Deduplicating reports',
                        }],
                };
        }
    }
    primaryKey() {
        return JSON.stringify(this.issueDetails);
    }
    getKind() {
        return IssueKind.PageError;
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