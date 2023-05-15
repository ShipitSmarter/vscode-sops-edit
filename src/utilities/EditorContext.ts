import { TextEditor, commands } from "vscode";
import { isOpenedInPlainTextEditor, isSopsEncryptable, isEncryptableAndEncrypted} from "./functions";

export class EditorContext {
    public static set(editor:TextEditor|undefined) : void {
        void this._setAsync(editor);
    }

    private static async _setAsync(editor:TextEditor|undefined) : Promise<void> {
        const isOpenedInPlainTextEditorBool = editor ? await isOpenedInPlainTextEditor(editor.document.uri) : false;
        if (!isOpenedInPlainTextEditorBool) {
            void this._setEncryptable(false);
            void this._setEncrypted(false);
            return;
        }

        const isSopsEncryptableBool = editor ? await isSopsEncryptable(editor.document.uri) : false;
        if (!isSopsEncryptableBool) {
            void this._setEncryptable(false);
            void this._setEncrypted(false);
            return;
        }
        
        const isEncryptableAndEncryptedBool = editor ? await isEncryptableAndEncrypted(editor.document.uri) : false;
        if (isSopsEncryptableBool) {
            if (isEncryptableAndEncryptedBool) {
                void this._setEncryptable(false);
                void this._setEncrypted(true);
                return;
            } else {
                void this._setEncryptable(true);
                void this._setEncrypted(false);
                return;
            }
        }
    }

    private static _setEncryptable(value:boolean) : void {
        void commands.executeCommand('setContext', 'sops-edit.isEncryptable', value ); 
    }
    private static _setEncrypted(value:boolean) : void {
        void commands.executeCommand('setContext', 'sops-edit.isEncrypted', value );
    }
}