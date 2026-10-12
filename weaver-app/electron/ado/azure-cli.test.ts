import assert from 'node:assert/strict';

import {
  azureCliFailureMessage,
  COMMAND_NOT_FOUND,
  parseRegistryValue,
  readAzureCliToken,
  WINDOWS_COMMAND_NOT_FOUND,
  windowsAzureCliCandidates,
  windowsCommandLine
} from './azure-cli';

function testTokenLineOnly(): void {
  const token = readAzureCliToken('Welcome back\neyJhbGciOi.eyJzdWIiOi.SflKxwRJ\n');

  assert.equal(token, 'eyJhbGciOi.eyJzdWIiOi.SflKxwRJ');
  assert.equal(readAzureCliToken('{"accessToken":"eyJhbGciOi.eyJzdWIiOi.SflKxwRJ","tenant":"secret"}'), null);
}

function testFailureMessages(): void {
  assert.match(azureCliFailureMessage('Please run az login', 1), /az login/);
  assert.match(azureCliFailureMessage('az: not found', COMMAND_NOT_FOUND), /not found/i);
  assert.match(azureCliFailureMessage("'az' is not recognized as an internal or external command", WINDOWS_COMMAND_NOT_FOUND), /not found/i);
  assert.match(azureCliFailureMessage('something else', 1), /could not provide a token/i);
}

function testWindowsLookup(): void {
  const candidates = windowsAzureCliCandidates({
    ProgramFiles: 'C:\\Program Files',
    'ProgramFiles(x86)': 'C:\\Program Files (x86)',
    LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
    USERPROFILE: 'C:\\Users\\me',
    PATH: 'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin;%USERPROFILE%\\bin'
  });

  assert.equal(candidates[0], 'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd');
  assert.ok(candidates.includes('C:\\Users\\me\\bin\\az.cmd'));
  assert.equal(candidates.filter(candidate => candidate === candidates[0]).length, 1);
  assert.equal(
    parseRegistryValue('    Path    REG_EXPAND_SZ    C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\r\n'),
    'C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin'
  );

  assert.equal(
    windowsCommandLine('C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd', ['account', 'get-access-token']),
    '"C:\\Program Files\\Microsoft SDKs\\Azure\\CLI2\\wbin\\az.cmd" account get-access-token'
  );
}

testTokenLineOnly();
testFailureMessages();
testWindowsLookup();
console.log('azure cli token tests passed');
