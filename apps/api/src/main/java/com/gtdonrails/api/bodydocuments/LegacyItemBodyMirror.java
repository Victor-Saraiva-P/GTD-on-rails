package com.gtdonrails.api.bodydocuments;

import java.util.UUID;

import com.gtdonrails.api.persistence.converters.ItemBodyConverter;
import com.gtdonrails.api.types.ItemBody;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class LegacyItemBodyMirror {

    private final JdbcTemplate jdbc;
    private final ItemBodyConverter converter = new ItemBodyConverter();

    public LegacyItemBodyMirror(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Updates the rollback-only legacy body column without emitting a structured sync event.
     *
     * <p>Example: {@code mirror.write(itemId, canonicalBody)}.</p>
     */
    public void write(UUID itemId, ItemBody body) {
        jdbc.update(
            "update items set body = ?, updated_at = CURRENT_TIMESTAMP where id = ?",
            converter.convertToDatabaseColumn(body),
            itemId.toString()
        );
    }
}
