import * as vscode from "vscode";
import * as f from "./functions";

export class EditorContext {
    public static setContexts(editor:vscode.TextEditor|undefined) : void {
        void this._setIsSopsEncrypted(editor);        
    }

    private static async _setIsSopsEncrypted(editor:vscode.TextEditor|undefined) : Promise<void> {
        const isSopsEncrypted = editor ? await f.isSopsEncrypted(editor.document.uri) : false;
        void vscode.commands.executeCommand('setContext', 'sops-edit.isSopsEncrypted', isSopsEncrypted ); 
    }
}