import assert from 'node:assert/strict';

import {
  laterDay,
  localDay,
  organizationName,
  readActiveOn,
  readConnectionUser,
  readPullRequestCommits,
  readWorkItemIds,
  readWorkItems,
  suggestionRange
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
  const [item] = readWorkItems({
    value: [
      {
        id: 42,
        rev: 9,
        url: 'https://dev.azure.com/fabrikam/_apis/wit/workItems/42',
        fields: {
          'System.Id': 42,
          'System.Title': 'Pay invoices',
          'System.WorkItemType': 'User Story',
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
      }
    ]
  });

  assert.deepEqual(item, {
    adoId: 42,
    title: 'Pay invoices',
    pullRequests: [{ projectId: 'project-1', repositoryId: 'repo-1', pullRequestId: 7 }]
  });
}

function testActiveDateUsesOnlyThisUsersChange(): void {
  const read = readActiveOn({
    value: [
      {
        revisedBy: { id: 'someone-else', uniqueName: 'other@example.com', displayName: 'Other' },
        revisedDate: '2026-10-01T08:00:00.000Z',
        fields: { 'System.State': { newValue: 'Active' }, 'System.History': { newValue: 'do not keep' } }
      },
      {
        revisedBy: { id: 'user-1', uniqueName: 'ada@example.com', displayName: 'Ada Lovelace' },
        revisedDate: '2026-10-02T08:00:00.000Z',
        fields: { 'System.State': { newValue: 'Active' } }
      },
      {
        revisedBy: { id: 'user-1', uniqueName: 'ada@example.com', displayName: 'Ada Lovelace' },
        revisedDate: '2026-10-05T08:00:00.000Z',
        fields: { 'System.State': { newValue: 'Resolved' } }
      },
      {
        revisedBy: { id: 'user-1', uniqueName: 'ada@example.com', displayName: 'Ada Lovelace' },
        revisedDate: '2026-10-08T08:00:00.000Z',
        fields: { 'System.State': { newValue: 'Active' } }
      }
    ]
  }, user);

  assert.equal(read.activeOn, localDay('2026-10-08T08:00:00.000Z'));
  assert.equal(read.inactiveOn, null);
}

function testClosedStateEndsTheActiveWindow(): void {
  const read = readActiveOn({
    value: [
      {
        revisedBy: { id: 'user-1', uniqueName: 'ada@example.com', displayName: 'Ada Lovelace' },
        revisedDate: '2026-07-15T08:00:00.000Z',
        fields: { 'System.State': { newValue: 'Active' } }
      },
      {
        revisedBy: { id: 'user-1', uniqueName: 'ada@example.com', displayName: 'Ada Lovelace' },
        revisedDate: '2026-07-16T08:00:00.000Z',
        fields: { 'System.State': { newValue: 'Closed' } }
      }
    ]
  }, user);

  assert.equal(read.activeOn, localDay('2026-07-15T08:00:00.000Z'));
  assert.equal(read.inactiveOn, localDay('2026-07-16T08:00:00.000Z'));
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

function testSuggestionRange(): void {
  assert.deepEqual(suggestionRange(null, null, '2026-10-12'), { activeOn: null, rangeEnd: null });
  assert.deepEqual(suggestionRange('2026-10-02', null, '2026-10-12'), { activeOn: '2026-10-02', rangeEnd: '2026-10-12' });
  assert.deepEqual(suggestionRange('2026-10-02', '2026-10-10', '2026-10-12'), { activeOn: '2026-10-02', rangeEnd: '2026-10-10' });
  assert.deepEqual(suggestionRange('2026-10-08', '2026-10-04', '2026-10-12'), { activeOn: '2026-10-08', rangeEnd: '2026-10-12' });
  assert.deepEqual(suggestionRange('2026-07-15', null, '2026-10-12', '2026-07-16'), { activeOn: '2026-07-15', rangeEnd: '2026-07-16' });
  assert.deepEqual(suggestionRange('2026-10-02', '2026-10-10', '2026-10-12', '2026-10-08'), { activeOn: '2026-10-02', rangeEnd: '2026-10-08' });
  assert.deepEqual(suggestionRange('2026-10-02', '2026-10-06', '2026-10-12', '2026-10-10'), { activeOn: '2026-10-02', rangeEnd: '2026-10-06' });
  assert.equal(laterDay('2026-10-04', '2026-10-10'), '2026-10-10');
  assert.equal(laterDay('2026-10-10', null), '2026-10-10');
}

testOrganizationName();
testConnectionUserDropsExtraFields();
testQueryKeepsIdsOnly();
testWorkItemKeepsTitleIdAndPullRequests();
testActiveDateUsesOnlyThisUsersChange();
testClosedStateEndsTheActiveWindow();
testCommitDateUsesOnlyThisUser();
testSuggestionRange();

console.log('ado parse tests passed');
