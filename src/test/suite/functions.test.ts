import { getFixtureUri, loadFixture } from '../testHelpers';
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as functions from '../../utilities/functions';
suite('functions', () => {
	void vscode.window.showInformationMessage('Start functions tests.');

    suite('isEncryptedEnvFile', () => {
        test ('should detect encrypted', async () => {
            const contentString = await Promise.resolve(loadFixture('encrypted.env'));
            assert.strictEqual(functions.isEncryptedEnvFile(contentString), true);
        });

        test ('should detect unencrypted', async () => {
            const contentString = await Promise.resolve(loadFixture('unencrypted.env'));
            assert.strictEqual(functions.isEncryptedEnvFile(contentString), false);
        });

    });

    suite('isEncryptedIniFile', () => {
        test ('should detect encrypted', async () => {
            const contentString = await Promise.resolve(loadFixture('encrypted.ini'));
            assert.strictEqual(functions.isEncryptedIniFile(contentString), true);
        });

        test ('should detect unencrypted', async () => {
            const contentString = await Promise.resolve(loadFixture('unencrypted.ini'));
            assert.strictEqual(functions.isEncryptedIniFile(contentString), false);
        });

    });

    suite('isEncryptedYamlFile', () => {
        test ('should detect encrypted multi yaml', async () => {
            const contentString = await Promise.resolve(loadFixture('encrypted_multi.yaml'));
            assert.strictEqual(functions.isEncryptedYamlFile(contentString), true);
        });

        test ('should detect unencrypted multi yaml', async () => {
            const contentString = await Promise.resolve(loadFixture('unencrypted_multi.yaml'));
            assert.strictEqual(functions.isEncryptedYamlFile(contentString), false);
        });

        test ('should detect encrypted single yaml', async () => {
            const contentString = await Promise.resolve(loadFixture('encrypted.yaml'));
            assert.strictEqual(functions.isEncryptedYamlFile(contentString), true);
        });

        test ('should detect unencrypted single yaml', async () => {
            const contentString = await Promise.resolve(loadFixture('unencrypted.yaml'));
            assert.strictEqual(functions.isEncryptedYamlFile(contentString), false);
        });

        test ('should detect encrypted json', async () => {
            const contentString = await Promise.resolve(loadFixture('encrypted.json'));
            assert.strictEqual(functions.isEncryptedYamlFile(contentString), true);
        });

        test ('should detect unencrypted json', async () => {
            const contentString = await Promise.resolve(loadFixture('unencrypted.json'));
            assert.strictEqual(functions.isEncryptedYamlFile(contentString), false);
        });

        test ('should detect encrypted binary', async () => {
            const contentString = await Promise.resolve(loadFixture('encrypted.txt'));
            assert.strictEqual(functions.isEncryptedYamlFile(contentString), true);
        });

        test ('should detect unencrypted binary', async () => {
            const contentString = await Promise.resolve(loadFixture('unencrypted.txt'));
            assert.strictEqual(functions.isEncryptedYamlFile(contentString), false);
        });
    });

    suite('isEncrypted', () => {
        test ('should detect all encrypted', () => {
            const encrypted = ['encrypted.env', 'encrypted.ini', 'encrypted_multi.yaml', 'encrypted.yaml', 'encrypted.json', 'encrypted.txt'];
            for (const file of encrypted) {
                const fileUri = vscode.Uri.file(getFixtureUri(file));
                assert.strictEqual(functions.isEncrypted(fileUri), true);
            }
        });

        test ('should detect all unencrypted', () => {
            const unencrypted = ['unencrypted.env', 'unencrypted.ini', 'unencrypted_multi.yaml', 'unencrypted.yaml', 'unencrypted.json', 'unencrypted.txt'];
            for (const file of unencrypted) {
                const fileUri = vscode.Uri.file(getFixtureUri(file));
                assert.strictEqual(functions.isEncrypted(fileUri), false);
            }
        });

    });

    suite('getUriFileExtension', () => {
        test('should detect file extension', () => {
            const file = vscode.Uri.file('a/b/c.txt');
            assert.strictEqual(functions.getUriFileExtension(file), "txt");            
        });
    });
});
