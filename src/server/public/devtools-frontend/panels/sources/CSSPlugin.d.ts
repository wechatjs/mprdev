import type * as Workspace from '../../models/workspace/workspace.js';
import * as CodeMirror from '../../third_party/codemirror.next/codemirror.next.js';
import { Plugin } from './Plugin.js';
export declare function completion(): CodeMirror.Extension;
export declare function cssBindings(): CodeMirror.Extension;
export declare class CSSPlugin extends Plugin {
    static accepts(uiSourceCode: Workspace.UISourceCode.UISourceCode): boolean;
    editorExtension(): CodeMirror.Extension;
}
