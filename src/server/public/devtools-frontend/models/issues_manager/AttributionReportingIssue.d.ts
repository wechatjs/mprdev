import type * as SDK from '../../core/sdk/sdk.js';
import * as Protocol from '../../generated/protocol.js';
import { Issue, IssueCategory, IssueKind } from './Issue.js';
import { type MarkdownIssueDescription } from './MarkdownIssueDescription.js';
export declare const enum IssueCode {
    PermissionPolicyDisabled = "AttributionReportingIssue::PermissionPolicyDisabled",
    PermissionPolicyNotDelegated = "AttributionReportingIssue::PermissionPolicyNotDelegated",
    UntrustworthyReportingOrigin = "AttributionReportingIssue::UntrustworthyReportingOrigin",
    InsecureContext = "AttributionReportingIssue::InsecureContext",
    InvalidRegisterSourceHeader = "AttributionReportingIssue::InvalidRegisterSourceHeader",
    InvalidRegisterTriggerHeader = "AttributionReportingIssue::InvalidRegisterTriggerHeader",
    InvalidEligibleHeader = "AttributionReportingIssue::InvalidEligibleHeader",
    TooManyConcurrentRequests = "AttributionReportingIssue::TooManyConcurrentRequests",
    SourceAndTriggerHeaders = "AttributionReportingIssue::SourceAndTriggerHeaders",
    SourceIgnored = "AttributionReportingIssue::SourceIgnored",
    TriggerIgnored = "AttributionReportingIssue::TriggerIgnored",
    Unknown = "AttributionReportingIssue::Unknown"
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
