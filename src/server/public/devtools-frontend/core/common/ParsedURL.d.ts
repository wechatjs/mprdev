import * as Platform from '../platform/platform.js';
/**
 * http://tools.ietf.org/html/rfc3986#section-5.2.4
 */
export declare function normalizePath(path: string): string;
export declare class ParsedURL {
    #private;
    isValid: boolean;
    url: string;
    scheme: string;
    user: string;
    host: string;
    port: string;
    path: string;
    queryParams: string;
    fragment: string;
    folderPathComponents: string;
    lastPathComponent: string;
    readonly blobInnerScheme: string | undefined;
    constructor(url: string);
    static fromString(string: string): ParsedURL | null;
    private static preEncodeSpecialCharactersInPath;
    static rawPathToEncodedPathString(path: Platform.DevToolsPath.RawPathString): Platform.DevToolsPath.EncodedPathString;
    /**
     * @param name Must not be encoded
     */
    static encodedFromParentPathAndName(parentPath: Platform.DevToolsPath.EncodedPathString, name: string): Platform.DevToolsPath.EncodedPathString;
    /**
     * @param name Must not be encoded
     */
    static urlFromParentUrlAndName(parentUrl: Platform.DevToolsPath.UrlString, name: string): Platform.DevToolsPath.UrlString;
    static encodedPathToRawPathString(encPath: Platform.DevToolsPath.EncodedPathString): Platform.DevToolsPath.RawPathString;
    static rawPathToUrlString(fileSystemPath: Platform.DevToolsPath.RawPathString): Platform.DevToolsPath.UrlString;
    static relativePathToUrlString(relativePath: Platform.DevToolsPath.RawPathString, baseURL: Platform.DevToolsPath.UrlString): Platform.DevToolsPath.UrlString;
    static urlToRawPathString(fileURL: Platform.DevToolsPath.UrlString, isWindows?: boolean): Platform.DevToolsPath.RawPathString;
    static substr<DevToolsPathType extends Platform.DevToolsPath.UrlString | Platform.DevToolsPath.RawPathString | Platform.DevToolsPath.EncodedPathString>(devToolsPath: DevToolsPathType, from: number, length?: number): DevToolsPathType;
    static urlWithoutHash(url: string): string;
    static urlRegex(): RegExp;
    static extractPath(url: string): string;
    static extractOrigin(url: string): string;
    static extractExtension(url: string): string;
    static extractName(url: string): string;
    static completeURL(baseURL: string, href: string): string | null;
    static splitLineAndColumn(string: string): {
        url: string;
        lineNumber: (number | undefined);
        columnNumber: (number | undefined);
    };
    static removeWasmFunctionInfoFromURL(url: string): string;
    static isRelativeURL(url: string): boolean;
    get displayName(): string;
    dataURLDisplayName(): string;
    isAboutBlank(): boolean;
    isDataURL(): boolean;
    isHttpOrHttps(): boolean;
    isBlobURL(): boolean;
    lastPathComponentWithFragment(): string;
    domain(): string;
    securityOrigin(): string;
    urlWithoutScheme(): string;
    static urlRegexInstance: RegExp | null;
}
