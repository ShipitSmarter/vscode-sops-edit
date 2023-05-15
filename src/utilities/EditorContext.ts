import { TextEditor, commands } from "vscode";
import { isOpenedInPlainTextEditor, isSopsEncryptable } from "./functions";

export class EditorContext {
    public static set(editor:TextEditor|undefined) : void {
        void this._setIsSopsEncryptable(editor);        
    }

    private static async _setIsSopsEncryptable(editor:TextEditor|undefined) : Promise<void> {
        const isSopsEncryptableBool = editor 
            ? await isSopsEncryptable(editor.document.uri) && await isOpenedInPlainTextEditor(editor.document.uri)
            : false;
        void commands.executeCommand('setContext', 'sops-edit.isSopsEncryptable', isSopsEncryptableBool ); 
    }
}