package com.gtdonrails.api.exceptions.context;

import com.gtdonrails.api.exceptions.shared.BusinessException;

public class ContextNotFoundException extends BusinessException {

    public ContextNotFoundException(String message) {
        super(message);
    }
}
