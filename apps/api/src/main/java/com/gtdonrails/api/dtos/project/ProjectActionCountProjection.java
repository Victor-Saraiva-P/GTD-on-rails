package com.gtdonrails.api.dtos.project;

import java.util.UUID;

/**
 * Projection representing an aggregated action count for a project.
 *
 * <p>Example: {@code projection.getActionCount()}.</p>
 */
public interface ProjectActionCountProjection {
    UUID getProjectId();

    long getActionCount();
}
