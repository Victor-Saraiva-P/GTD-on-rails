package com.gtdonrails.api.controllers;

import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import javax.sql.rowset.RowSetMetaDataImpl;
import javax.sql.rowset.RowSetProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

/** Simulates remote context rows for a push/pull round trip without external I/O. */
final class FakeSupabaseContextJdbc extends JdbcTemplate {
    private final UUID actionId;
    private final Set<UUID> contextIds;

    FakeSupabaseContextJdbc(UUID actionId, Set<UUID> contextIds) {
        this.actionId = actionId;
        this.contextIds = new LinkedHashSet<>(contextIds);
    }

    @Override
    public int update(String sql, Object... arguments) {
        if (sql.startsWith("DELETE FROM gtd.next_action_contexts")) contextIds.clear();
        if (sql.startsWith("INSERT INTO gtd.next_action_contexts")) contextIds.add((UUID) arguments[1]);
        return 1;
    }

    @Override
    public <T> List<T> query(String sql, RowMapper<T> rowMapper) {
        if (!sql.contains("FROM gtd.next_action_contexts")) return List.of();
        List<T> rows = new ArrayList<>();
        for (UUID contextId : contextIds) rows.add(mapContext(rowMapper, contextId));
        return rows;
    }

    Set<UUID> savedContextIds() {
        return Set.copyOf(contextIds);
    }

    private <T> T mapContext(RowMapper<T> rowMapper, UUID contextId) {
        try (var rowSet = RowSetProvider.newFactory().createCachedRowSet()) {
            rowSet.setMetaData(contextColumns());
            rowSet.moveToInsertRow();
            rowSet.updateString(1, actionId.toString());
            rowSet.updateString(2, contextId.toString());
            rowSet.insertRow();
            rowSet.moveToCurrentRow();
            rowSet.beforeFirst();
            rowSet.next();
            return rowMapper.mapRow(rowSet, 0);
        } catch (SQLException exception) {
            throw new IllegalStateException("Context row '%s' must map to two UUID columns".formatted(contextId), exception);
        }
    }

    private RowSetMetaDataImpl contextColumns() throws SQLException {
        RowSetMetaDataImpl columns = new RowSetMetaDataImpl();
        columns.setColumnCount(2);
        columns.setColumnType(1, Types.VARCHAR);
        columns.setColumnType(2, Types.VARCHAR);
        return columns;
    }
}
