import assert from 'node:assert/strict';

import {
  activityRanges,
  assertReadOnlyRequest,
  isWorkItemPageUrl,
  laterDay,
  localDay,
  organizationName,
  readAdoErrorMessage,
  readConnectionUser,
  readPullRequestCommits,
  readRevisions,
  readTimeSpentReference,
  readWorkItemIds,
  readWorkItems,
  SuggestionSpan,
  timeGapFor,
  workItemIdFromTitle,
  workItemPageUrl
} from './parse';

const user = {
  id: 'user-1',
  displayName: 'Ada Lovelace',
  accounts: ['ada@example.com']
};

function testOrganizationName(): void {
  assert.equal(organizationName('fabrikam'), 'fabrikam');
  assert.equal(organizationName('https://dev.azure.com/fabrikam/'), 'fabrikam');
  assert.throws(() => organizationName('https://evil.example/fabrikam'), /organization name/);
  assert.throws(() => organizationName(''), /organization name/);
}

function testWorkItemIdFromTitle(): void {
  const workItemId = 1000;

  assert.equal(workItemIdFromTitle(`#${workItemId} My app`), workItemId);
  assert.equal(workItemIdFromTitle(`#${workItemId} My same app`), workItemId);
  assert.equal(workItemIdFromTitle(`  #${workItemId} My perfect app`), workItemId);
  assert.equal(workItemIdFromTitle(`#${workItemId}`), workItemId);
  assert.equal(workItemIdFromTitle(`#${workItemId}My app`), null);
  assert.equal(workItemIdFromTitle('My app'), null);
}

function testWorkItemPageUrl(): void {
  const workItemId = 1000;

  assert.equal(workItemPageUrl('fabrikam', workItemId), `https://dev.azure.com/fabrikam/_workitems/edit/${workItemId}`);
  assert.equal(isWorkItemPageUrl(`https://dev.azure.com/fabrikam/_workitems/edit/${workItemId}`), true);
  assert.equal(isWorkItemPageUrl(`https://evil.example/fabrikam/_workitems/edit/${workItemId}`), false);
}

function testConnectionUserDropsExtraFields(): void {
  const parsed = readConnectionUser({
    authenticatedUser: {
      id: 'user-1',
      providerDisplayName: 'Ada Lovelace',
      descriptor: 'do-not-keep',
      properties: { Account: { $type: 'System.String', $value: 'ada@example.com' } }
    },
    locationServiceData: { serviceOwner: 'do-not-keep' },
    instanceId: 'do-not-keep'
  });

  assert.deepEqual(parsed, user);
}

const SECOND_WORK_ITEM_ID = 11;

function testQueryKeepsIdsOnly(): void {
  const firstItem = { id: 10, url: 'https://dev.azure.com/fabrikam/_apis/wit/workItems/10' };
  const secondItem = {
    id: SECOND_WORK_ITEM_ID,
    url: 'https://dev.azure.com/fabrikam/_apis/wit/workItems/11'
  };

  assert.deepEqual(readWorkItemIds({ workItems: [firstItem, secondItem] }), [10, SECOND_WORK_ITEM_ID]);
}

function testWorkItemKeepsTitleIdAndPullRequests(): void {
  const timeSpent = 'Microsoft.VSTS.Scheduling.CompletedWork';
  const items = readWorkItems({
    value: [
      {
        id: 42,
        rev: 9,
        url: 'https://dev.azure.com/fabrikam/_apis/wit/workItems/42',
        fields: {
          'System.Id': 42,
          'System.Title': 'Pay invoices',
          'System.WorkItemType': 'User Story',
          'System.State': 'Active',
          'System.ChangedDate': '2026-10-01T12:00:00Z',
          'Microsoft.VSTS.Scheduling.CompletedWork': 4,
          'System.Description': 'do not keep'
        },
        relations: [
          { rel: 'System.LinkTypes.Hierarchy-Reverse', url: 'https://dev.azure.com/parent', attributes: { name: 'Parent' } },
          {
            rel: 'ArtifactLink',
            url: 'vstfs:///Git/PullRequestId/project-1%2Frepo-1%2F7',
            attributes: { name: 'Pull Request', comment: 'do not keep' }
          },
          {
            rel: 'ArtifactLink',
            url: 'vstfs:///Git/Commit/abc',
            attributes: { name: 'Fixed in Commit' }
          }
        ]
      },
      {
        id: 43,
        fields: { 'System.Id': 43, 'System.Title': 'A task', 'System.WorkItemType': 'Task' }
      },
      {
        id: 44,
        fields: {
          'System.Id': 44,
          'System.Title': 'Fix login',
          'System.WorkItemType': 'Bug',
          'System.State': 'Done',
          'System.ChangedDate': '2026-10-02T12:00:00Z',
          'Microsoft.VSTS.Scheduling.CompletedWork': '0'
        }
      }
    ]
  }, timeSpent);

  assert.deepEqual(items.map(entry => entry.workItemType), ['User Story', 'Bug']);
  assert.deepEqual(items[0], {
    adoId: 42,
    title: 'Pay invoices',
    workItemType: 'User Story',
    state: 'Active',
    changedOn: '2026-10-01T12:00:00Z',
    completedWork: 4,
    pullRequests: [{ projectId: 'project-1', repositoryId: 'repo-1', pullRequestId: 7 }]
  });

  assert.equal(items[1].workItemType, 'Bug');
  assert.equal(items[1].state, 'Done');
  assert.equal(items[1].completedWork, 0);
  assert.equal(items[1].changedOn, '2026-10-02T12:00:00Z');
}

const me = { id: 'user-1', uniqueName: 'ada@example.com', displayName: 'Ada Lovelace' };
const other = { id: 'other', uniqueName: 'other@example.com', displayName: 'Other' };

function workItemUpdate(revisedDate: string, fields: Record<string, unknown>, changedOn?: string): Record<string, unknown> {
  return {
    revisedBy: { id: 'someone-else', uniqueName: 'other@example.com', displayName: 'Other' },
    revisedDate,
    fields: changedOn ? { ...fields, 'System.ChangedDate': { newValue: changedOn } } : fields
  };
}

function state(value: string): Record<string, unknown> {
  return { 'System.State': { newValue: value } };
}

function assignedIdentity(person: { id: string; uniqueName: string; displayName: string }): Record<string, unknown> {
  return { 'System.AssignedTo': { newValue: person } };
}

function rangesFromUpdates(updates: Record<string, unknown>[], syncDate: string): SuggestionSpan[] {
  return activityRanges(readRevisions({ value: updates }, user), syncDate);
}

function testAnyoneCanActivateWhileAssignedToMe(): void {
  const opened = '2026-10-02T12:00:00.000Z';
  const assigned = workItemUpdate('2026-10-01T12:00:00.000Z', assignedIdentity(me));
  const activated = workItemUpdate(opened, state('Active'));
  const ranges = rangesFromUpdates([assigned, activated], '2026-10-12');

  assert.deepEqual(ranges, [{ activeOn: localDay(opened), rangeEnd: '2026-10-12' }]);
}

function testOpenWorkCoversEveryDayUntilSync(): void {
  const opened = '2026-10-01T12:00:00.000Z';
  const ranges = rangesFromUpdates([workItemUpdate(opened, { ...state('Active'), ...assignedIdentity(me) })], '2026-10-03');

  assert.deepEqual(ranges, [{ activeOn: localDay(opened), rangeEnd: '2026-10-03' }]);
}

function testCloseByAnyoneEndsTheRange(): void {
  const opened = '2026-07-15T08:00:00.000Z';
  const closed = '2026-07-16T08:00:00.000Z';
  const activated = workItemUpdate(opened, { ...state('Active'), ...assignedIdentity(me) });
  const finished = workItemUpdate('9999-01-01T00:00:00Z', state('Closed'), closed);
  const ranges = rangesFromUpdates([activated, finished], '2026-10-12');

  assert.deepEqual(ranges, [{ activeOn: localDay(opened), rangeEnd: localDay(closed) }]);
}

function testResolvedEndsTheRange(): void {
  const opened = '2026-10-02T12:00:00.000Z';
  const resolved = '2026-10-05T12:00:00.000Z';
  const activated = workItemUpdate(opened, { ...state('Active'), ...assignedIdentity(me) });
  const finished = workItemUpdate(resolved, state('Resolved'));
  const ranges = rangesFromUpdates([activated, finished], '2026-10-12');

  assert.deepEqual(ranges, [{ activeOn: localDay(opened), rangeEnd: localDay(resolved) }]);
}

function testNewPausesAndLaterActiveStartsAnotherRange(): void {
  const opened = '2026-06-01T12:00:00.000Z';
  const paused = '2026-06-03T12:00:00.000Z';
  const resumed = '2026-08-01T12:00:00.000Z';
  const ranges = rangesFromUpdates([
    workItemUpdate(opened, { ...state('Active'), ...assignedIdentity(me) }),
    workItemUpdate(paused, state('New')),
    workItemUpdate(resumed, state('Active'))
  ], '2026-10-12');

  assert.deepEqual(ranges, [{ activeOn: localDay(opened), rangeEnd: localDay(paused) }, { activeOn: localDay(resumed), rangeEnd: '2026-10-12' }]);

  assert.ok(ranges[0].rangeEnd < ranges[1].activeOn);
}

function testRangeWaitsUntilAssignedToMe(): void {
  const opened = '2026-10-01T12:00:00.000Z';
  const mine = '2026-10-04T12:00:00.000Z';
  const activated = workItemUpdate(opened, { ...state('Active'), ...assignedIdentity(other) });
  const claimed = workItemUpdate(mine, assignedIdentity(me));
  const ranges = rangesFromUpdates([activated, claimed], '2026-10-12');

  assert.deepEqual(ranges, [{ activeOn: localDay(mine), rangeEnd: '2026-10-12' }]);
}

function testActivatedTodayUsesTheRealChangeDate(): void {
  const changed = '2026-10-12T08:00:00.000Z';
  const ranges = rangesFromUpdates([workItemUpdate('9999-01-01T00:00:00Z', { ...state('Active'), ...assignedIdentity(me) }, changed)], '2026-10-12');

  assert.deepEqual(ranges, [{ activeOn: localDay(changed), rangeEnd: '2026-10-12' }]);
}

function testCommitEndsTheStretchBeforeMerge(): void {
  const opened = '2026-10-01T12:00:00.000Z';
  const merged = '2026-10-21T12:00:00.000Z';
  const activated = workItemUpdate(opened, { ...state('Active'), ...assignedIdentity(me) });
  const resolved = workItemUpdate(merged, state('Resolved'));
  const commitDay = localDay('2026-10-03T12:00:00.000Z');
  const ranges = activityRanges(readRevisions({ value: [activated, resolved] }, user), '2026-10-21', [commitDay]);

  assert.deepEqual(ranges, [{ activeOn: localDay(opened), rangeEnd: commitDay }]);
}

function testEarlierCommitDoesNotEndTheNextStretch(): void {
  const opened = '2026-06-01T12:00:00.000Z';
  const paused = '2026-06-03T12:00:00.000Z';
  const resumed = '2026-08-01T12:00:00.000Z';
  const commitDay = localDay('2026-06-02T12:00:00.000Z');
  const activated = workItemUpdate(opened, { ...state('Active'), ...assignedIdentity(me) });
  const held = workItemUpdate(paused, state('New'));
  const continued = workItemUpdate(resumed, state('Active'));
  const ranges = activityRanges(readRevisions({ value: [
    activated,
    held,
    continued
  ] }, user), '2026-10-12', [commitDay]);

  assert.deepEqual(ranges, [{ activeOn: localDay(opened), rangeEnd: commitDay }, { activeOn: localDay(resumed), rangeEnd: '2026-10-12' }]);
}

function testCommitDateUsesOnlyThisUser(): void {
  const day = readPullRequestCommits([
    { author: { name: 'Other', email: 'other@example.com', date: '2026-10-09T10:00:00.000Z' }, comment: 'do not keep', commitId: 'abc' },
    { author: { name: 'Ada Lovelace', email: 'ada@example.com', date: '2026-10-04T10:00:00.000Z' }, comment: 'do not keep' },
    { author: { name: 'Ada Lovelace', email: 'not-ada@example.com', date: '2026-10-11T15:00:00.000Z' }, comment: 'do not keep' },
    { committer: { name: 'Ada Lovelace', email: 'ada@example.com', date: '2026-10-10T15:00:00.000Z' }, comment: 'do not keep' }
  ], user);

  assert.equal(day, localDay('2026-10-10T15:00:00.000Z'));
}

function testLaterDay(): void {
  assert.equal(laterDay('2026-10-04', '2026-10-10'), '2026-10-10');
  assert.equal(laterDay('2026-10-10', null), '2026-10-10');
}

function testTimeGapForDoneWork(): void {
  const loggedHours = 1;
  const completedHours = 1;
  const nearlyTheSameHours = 1.02;

  assert.equal(timeGapFor('Active', null, 0), null);
  assert.equal(timeGapFor('New', 0, 0), null);
  assert.equal(timeGapFor('Done', null, 0), 'missing');
  assert.equal(timeGapFor('Closed', 0, loggedHours), 'missing');
  assert.equal(timeGapFor('Resolved', completedHours, 0), 'mismatch');
  assert.equal(timeGapFor('Completed', completedHours, loggedHours), null);
  assert.equal(timeGapFor('done', nearlyTheSameHours, loggedHours), null);
  assert.equal(timeGapFor('Closed', completedHours + loggedHours, loggedHours, true), null);
  assert.equal(timeGapFor('Closed', loggedHours, completedHours + loggedHours, true), 'mismatch');
}

function testTimeSpentFieldLookup(): void {
  const reference = 'Custom.TimeSpent';
  const fields = {
    value: [{ name: 'Completed Work', referenceName: 'Microsoft.VSTS.Scheduling.CompletedWork' }, { name: 'Time spent', referenceName: reference }]
  };

  assert.equal(readTimeSpentReference(fields, 'Time spent'), reference);
  assert.equal(readTimeSpentReference(fields, reference), reference);
  assert.equal(readTimeSpentReference(fields, 'Missing field'), null);
}

function testAdoErrorMessage(): void {
  const missingField = 'TF51535: Cannot find field Microsoft.VSTS.Scheduling.CompletedWork.';

  assert.equal(readAdoErrorMessage({ message: missingField }), missingField);
  assert.equal(readAdoErrorMessage({ value: { Message: 'The query is not valid.' } }), 'The query is not valid.');
  assert.equal(readAdoErrorMessage('<html>sign in</html>'), null);
  assert.equal(readAdoErrorMessage(null), null);
}

function testSyncStaysReadOnly(): void {
  assert.doesNotThrow(() => assertReadOnlyRequest('GET', '/_apis/wit/workItems/1/updates?$top=200'));
  assert.doesNotThrow(() => assertReadOnlyRequest('POST', '/_apis/wit/wiql'));
  assert.doesNotThrow(() => assertReadOnlyRequest('POST', '/_apis/wit/workitemsbatch'));
  assert.throws(() => assertReadOnlyRequest('PATCH', '/_apis/wit/workItems/1'), /read-only/);
  assert.throws(() => assertReadOnlyRequest('POST', '/_apis/wit/workItems/1'), /read-only/);
  assert.throws(() => assertReadOnlyRequest('DELETE', '/_apis/wit/workItems/1'), /read-only/);
}

testOrganizationName();
testWorkItemIdFromTitle();
testWorkItemPageUrl();
testConnectionUserDropsExtraFields();
testQueryKeepsIdsOnly();
testWorkItemKeepsTitleIdAndPullRequests();
testAnyoneCanActivateWhileAssignedToMe();
testOpenWorkCoversEveryDayUntilSync();
testCloseByAnyoneEndsTheRange();
testResolvedEndsTheRange();
testNewPausesAndLaterActiveStartsAnotherRange();
testRangeWaitsUntilAssignedToMe();
testActivatedTodayUsesTheRealChangeDate();
testCommitEndsTheStretchBeforeMerge();
testEarlierCommitDoesNotEndTheNextStretch();
testCommitDateUsesOnlyThisUser();
testLaterDay();
testTimeGapForDoneWork();
testTimeSpentFieldLookup();
testAdoErrorMessage();
testSyncStaysReadOnly();

console.log('ado parse tests passed');
