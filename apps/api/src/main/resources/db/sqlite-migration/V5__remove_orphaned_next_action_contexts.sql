-- WHY: V4 removes orphaned next-action rows; remove their dependent context links afterward.
DELETE FROM next_action_contexts
WHERE next_action_id NOT IN (SELECT item_id FROM next_actions)
   OR context_id NOT IN (SELECT id FROM contexts);
