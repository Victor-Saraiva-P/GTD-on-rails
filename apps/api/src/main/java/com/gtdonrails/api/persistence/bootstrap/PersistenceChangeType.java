package com.gtdonrails.api.persistence.bootstrap;

public enum PersistenceChangeType {
    CREATE_ITEM("feat(data): create item"),
    UPDATE_ITEM("feat(data): update item"),
    DELETE_ITEM("feat(data): delete item"),
    CREATE_CONTEXT("feat(data): create context"),
    UPDATE_CONTEXT("feat(data): update context"),
    DELETE_CONTEXT("feat(data): delete context"),
    UPDATE_CONTEXT_ICON("feat(data): update context icon"),
    DELETE_CONTEXT_ICON("feat(data): delete context icon");

    private final String commitMessage;

    PersistenceChangeType(String commitMessage) {
        this.commitMessage = commitMessage;
    }

    public String commitMessage() {
        return commitMessage;
    }
}
