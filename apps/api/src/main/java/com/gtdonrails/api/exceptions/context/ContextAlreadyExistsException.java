package com.gtdonrails.api.exceptions.context;

import com.gtdonrails.api.exceptions.shared.ConflictException;

public class ContextAlreadyExistsException extends ConflictException {

    public ContextAlreadyExistsException(String message) {
        super(message);
    }
}
