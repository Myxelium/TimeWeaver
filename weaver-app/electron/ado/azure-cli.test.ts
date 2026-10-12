import assert from 'node:assert/strict';

import {
  azureCliFailureMessage,
  COMMAND_NOT_FOUND,
  readAzureCliToken
} from './azure-cli';

function testTokenLineOnly(): void {
  const token = readAzureCliToken('Welcome back\neyJhbGciOi.eyJzdWIiOi.SflKxwRJ\n');

  assert.equal(token, 'eyJhbGciOi.eyJzdWIiOi.SflKxwRJ');
  assert.equal(readAzureCliToken('{"accessToken":"eyJhbGciOi.eyJzdWIiOi.SflKxwRJ","tenant":"secret"}'), null);
}

function testFailureMessages(): void {
  assert.match(azureCliFailureMessage('Please run az login', 1), /az login/);
  assert.match(azureCliFailureMessage('az: not found', COMMAND_NOT_FOUND), /not found/i);
  assert.match(azureCliFailureMessage('something else', 1), /could not provide a token/i);
}

testTokenLineOnly();
testFailureMessages();
console.log('azure cli token tests passed');
