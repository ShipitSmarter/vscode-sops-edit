import { TextEditor, commands } from "vscode";
import { isOpenedInPlainTextEditor, isSopsEncryptable, isSopsEncrypted, isEncryptableAndEncrypted} from "./functions";

export class EditorContext {
    public static set(editor:TextEditor|undefined) : void {
        void this._setIsEncryptable(editor);
        void this._setIsSopsEncrypted(editor);
    }

    private static async _setIsEncryptable(editor:TextEditor|undefined) : Promise<void> {
        const isSopsEncryptableBool = editor 
            ? await isSopsEncryptable(editor.document.uri)  && await isOpenedInPlainTextEditor(editor.document.uri) && !(await isEncryptableAndEncrypted(editor.document.uri))
            : false;
        void commands.executeCommand('setContext', 'sops-edit.isEncryptable', isSopsEncryptableBool ); 
    }

    private static async _setIsSopsEncrypted(editor:TextEditor|undefined) : Promise<void> {
        const isSopsEncryptedBool = editor 
            ? await isOpenedInPlainTextEditor(editor.document.uri) && await isSopsEncrypted(editor.document.uri)
            : false;
        void commands.executeCommand('setContext', 'sops-edit.isEncrypted', isSopsEncryptedBool );
    }
}