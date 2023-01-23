import { TextEditor, commands } from "vscode";
import { isSopsEncrypted } from "./functions";

export class EditorContext {
    public static set(editor:TextEditor|undefined) : void {
        void this._setIsSopsEncrypted(editor);        
    }

    private static async _setIsSopsEncrypted(editor:TextEditor|undefined) : Promise<void> {
        const isSopsEncryptedBool = editor ? await isSopsEncrypted(editor.document.uri) : false;
        void commands.executeCommand('setContext', 'sops-edit.isSopsEncrypted', isSopsEncryptedBool ); 
    }
}