-- WHY: Older clients applied remote item tombstones without removing their dependent rows.
-- Keep only relationships whose item, projection, and context still exist.
DELETE FROM next_action_contexts
WHERE next_action_id NOT IN (SELECT item_id FROM next_actions)
   OR context_id NOT IN (SELECT id FROM contexts);

DELETE FROM project_items
WHERE item_id NOT IN (SELECT id FROM items)
   OR project_id NOT IN (SELECT item_id FROM projects);

DELETE FROM item_assets
WHERE item_id NOT IN (SELECT id FROM items);

DELETE FROM context_icon_assets
WHERE context_id NOT IN (SELECT id FROM contexts);

DELETE FROM next_actions
WHERE item_id NOT IN (SELECT id FROM items);

DELETE FROM calendars
WHERE item_id NOT IN (SELECT id FROM items);

DELETE FROM projects
WHERE item_id NOT IN (SELECT id FROM items);
