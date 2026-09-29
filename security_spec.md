# Security Specification (`security_spec.md`)

## 1. Data Invariants

1. **Master Source of Truth**:
   - `/lists/{listId}` is the parent collection owned exclusively by `ownerId == request.auth.uid`.
   - `/summaries/{summaryId}` stores cloud-synced video summaries owned exclusively by `ownerId == request.auth.uid`.
   - `/resources/{resourceId}` stores user-added exact video resources and primary citations owned exclusively by `ownerId == request.auth.uid`.
2. **Subcollection Relational Sync (Master Gate)**:
   - `/lists/{listId}/items/{itemId}` cannot exist or be accessed unless its parent `/lists/{listId}` exists and `get(/databases/$(database)/documents/lists/$(listId)).data.ownerId == request.auth.uid`.
3. **Verified Identity**:
   - All write operations (`create`, `update`, `delete`) require `request.auth != null && request.auth.token.email_verified == true`.
4. **Strict Keys & Anti-Update-Gap**:
   - `UserList` requires and allows ONLY `['ownerId', 'name', 'description', 'category', 'createdAt', 'updatedAt']`.
   - `ListItem` requires and allows ONLY `['listId', 'ownerId', 'itemType', 'title', 'url', 'subtitle', 'content', 'notes', 'createdAt', 'updatedAt']`.
   - `SavedSummary` requires and allows ONLY `['ownerId', 'videoId', 'videoUrl', 'videoTitle', 'authorName', 'summaryType', 'markdown', 'createdAt', 'updatedAt']`.
   - `CustomResource` requires and allows ONLY `['ownerId', 'videoId', 'title', 'resourceType', 'description', 'primaryUrl', 'authorOrCreator', 'formattedTime', 'exactQuote', 'createdAt', 'updatedAt']`.
5. **Immutable & Temporal Integrity**:
   - `ownerId`, `listId`, and `createdAt` are strictly immutable across all updates.
   - `createdAt == request.time` on create; `updatedAt == request.time` on create and update.
6. **Query Enforcer**:
   - `allow list` rules explicitly verify `resource.data.ownerId == request.auth.uid` with zero `get()` calls inside `list`.

## 2. The "Dirty Dozen" Payloads

1. **Identity Spoofing on List/Summary/Resource Creation**: `ownerId: "victim-uid"` when `request.auth.uid == "attacker-uid"` -> `PERMISSION_DENIED`.
2. **Unverified Email Write**: `request.auth.token.email_verified == false` attempting to create `/lists/list_1`, `/summaries/sum_1`, or `/resources/res_1` -> `PERMISSION_DENIED`.
3. **Shadow / Ghost Field Injection**: Creating `/lists/list_1` or `/summaries/sum_1` with extra key `isAdmin: true` -> `PERMISSION_DENIED`.
4. **ID Poisoning Attack**: Creating a document with `/lists/invalid$id!@#` or a 500-char ID -> `PERMISSION_DENIED`.
5. **Denial-of-Wallet Oversized String**: Creating a `UserList` with `name.size() > 100`, `SavedSummary` with `markdown.size() > 50000`, or `CustomResource` with `description.size() > 2000` -> `PERMISSION_DENIED`.
6. **Invalid Enum Value**: Setting `category: "hacked"` outside `['general', 'videos', 'reading', 'study', 'favorites']` -> `PERMISSION_DENIED`.
7. **Forged Client Timestamp**: Setting `createdAt` or `updatedAt` to a past/future timestamp instead of `request.time` -> `PERMISSION_DENIED`.
8. **Immutable Field Mutation**: Updating `ownerId` or `createdAt` on an existing `/lists/list_1`, `/summaries/sum_1`, or `/resources/res_1` document -> `PERMISSION_DENIED`.
9. **Orphaned Subcollection Write**: Creating `/lists/non_existent_list/items/item_1` where parent `/lists/non_existent_list` does not exist -> `PERMISSION_DENIED`.
10. **Cross-Tenant Subcollection Write**: Creating `/lists/victim_list/items/item_1` where parent `/lists/victim_list` belongs to another user -> `PERMISSION_DENIED`.
11. **Path Mismatch on Subcollection Item**: Creating `/lists/list_1/items/item_1` with `data.listId == "list_2"` -> `PERMISSION_DENIED`.
12. **Unauthorized List/Summary/Resource Scraping**: Running a collection query on `/lists`, `/summaries`, or `/resources` without filtering `where('ownerId', '==', request.auth.uid)` -> `PERMISSION_DENIED`.
