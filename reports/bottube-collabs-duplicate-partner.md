# BoTTube bug report: /social/api/collabs can return the same partner twice

## Summary

`GET /social/api/collabs/<agent_name>` builds collaboration partners from two independent aggregates (comments and tips) and combines them with `UNION ALL`. If the same target agent meets both thresholds (at least 3 comment interactions and at least 2 confirmed tips), the endpoint emits that one partner twice and increments `total_partners` twice.

Source checked on current `Scottcjn/bottube` main at the revision exposed by GitHub code search (`63084c0eb1f143e682734b011e958b726adab97c`), in `interactions_blueprint.py`.

## Root cause

The query in `api_agent_collaborations()` has:

```sql
... GROUP BY a.id
HAVING interaction_count >= 3

UNION ALL

... GROUP BY a.id
HAVING interaction_count >= 2
```

The response then appends one JSON partner object for every returned row and reports `total_partners = len(partners)`. There is no final grouping by partner id.

## Minimal reproduction

Create two agents, one video owned by Bob, then three comments and two confirmed tips from Alice to Bob:

```sql
CREATE TABLE agents(id INTEGER PRIMARY KEY, agent_name TEXT, display_name TEXT, avatar_url TEXT);
CREATE TABLE videos(video_id TEXT PRIMARY KEY, agent_id INTEGER);
CREATE TABLE comments(id INTEGER PRIMARY KEY, video_id TEXT, agent_id INTEGER);
CREATE TABLE tips(id INTEGER PRIMARY KEY, from_agent_id INTEGER, to_agent_id INTEGER, status TEXT);

INSERT INTO agents VALUES (1,'alice','Alice',NULL),(2,'bob','Bob',NULL);
INSERT INTO videos VALUES ('b1',2);
INSERT INTO comments VALUES (1,'b1',1),(2,'b1',1),(3,'b1',1);
INSERT INTO tips VALUES (1,1,2,'confirmed'),(2,1,2,'confirmed');
```

Run the same two branches from `api_agent_collaborations()` for `agent_id = 1`. The result is:

```text
bob | 3 | comments
bob | 2 | tips
```

The current Python response builder therefore produces two entries for Bob and `total_partners = 2`, even though there is only one unique partner.

## Expected

One partner object per unique agent. The response may either:
- aggregate both interaction types into one partner object (preferred), or
- expose separate comment/tip counts inside a single partner object.

`total_partners` should count unique partner agents.

## Actual

The same partner can appear twice, once as `interaction_type: comments` and once as `interaction_type: tips`.

## Impact

Consumers of the collaboration endpoint can over-count collaboration partners, show duplicate cards for the same agent, and assign inconsistent badges based on whichever duplicate row they process.

## Suggested fix

Aggregate after combining the two sources (e.g. a CTE/outer `GROUP BY partner_id`) or merge rows by agent id in Python before building the response. Add a regression case where one partner satisfies both the comments and tips thresholds and assert exactly one partner and `total_partners == 1`.

## Duplicate check

GitHub issue searches for `api/collabs`, `collaboration_partners`, `total_partners`, and duplicate/collab variants did not find an existing report for this duplicate-partner behavior. Existing social-graph reports cover different defects such as moderation visibility and video-id joins.

## Environment

- Reproduced with Python 3 / SQLite in an isolated in-memory fixture using the exact SQL shape from current source.
- No production writes or private credentials were used.

AI assistance disclosure: ChatGPT inspected the public source, searched existing issues, built the minimal SQLite reproduction, and drafted this report.
