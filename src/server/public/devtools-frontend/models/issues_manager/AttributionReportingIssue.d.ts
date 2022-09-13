import type * as SDK from '../../core/sdk/sdk.js';
import * as Protocol from '../../generated/protocol.js';
import { Issue, IssueCategory, IssueKind } from './Issue.js';
import type { MarkdownIssueDescription } from './MarkdownIssueDescription.js';
export declare const enum IssueCode {
    PermissionPolicyDisabled = "AttributionReportingIssue::PermissionPolicyDisabled",
    InvalidAttributionSourceEventId = "AttributionReportingIssue::InvalidAttributionSourceEventId",
    InvalidAttributionData = "AttributionReportingIssue::InvalidAttributionData",
    MissingAttributionData = "AttributionReportingIssue::MissingAttributionData",
    AttributionSourceUntrustworthyFrameOrigin = "AttributionReportingIssue::AttributionSourceUntrustworthyFrameOrigin",
    AttributionSourceUntrustworthyOrigin = "AttributionReportingIssue::AttributionSourceUntrustworthyOrigin",
    AttributionUntrustworthyFrameOrigin = "AttributionReportingIssue::AttributionUntrustworthyFrameOrigin",
    AttributionUntrustworthyOrigin = "AttributionReportingIssue::AttributionUntrustworthyOrigin",
    AttributionTriggerDataTooLarge = "AttributionReportingIssue::AttributionTriggerDataTooLarge",
    AttributionEventSourceTriggerDataTooLarge = "AttributionReportingIssue::AttributionEventSourceTriggerDataTooLarge",
    InvalidAttributionSourceExpiry = "AttributionReportingIssue::InvalidAttributionSourceExpiry",
    InvalidAttributionSourcePriority = "AttributionReportingIssue::InvalidAttributionSourcePriority",
    InvalidEventSourceTriggerData = "AttributionReportingIssue::InvalidEventSourceTriggerData",
    InvalidTriggerPriority = "AttributionReportingIssue::InvalidTriggerPriority",
    InvalidTriggerDedupKey = "AttributionReportingIssue::InvalidTriggerDedupKey"
}
export declare class AttributionReportingIssue extends Issue<IssueCode> {
    issueDetails: Readonly<Protocol.Audits.AttributionReportingIssueDetails>;
    constructor(issueDetails: Protocol.Audits.AttributionReportingIssueDetails, issuesModel: SDK.IssuesModel.IssuesModel);
    getCategory(): IssueCategory;
    getDescription(): MarkdownIssueDescription | null;
    primaryKey(): string;
    getKind(): IssueKind;
    static fromInspectorIssue(issuesModel: SDK.IssuesModel.IssuesModel, inspectorIssue: Protocol.Audits.InspectorIssue): AttributionReportingIssue[];
}
