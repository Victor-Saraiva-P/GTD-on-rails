package com.gtdonrails.api.exceptions.item;

import com.gtdonrails.api.exceptions.shared.BusinessException;

public class ItemNotFoundException extends BusinessException {

    public ItemNotFoundException(String message) {
        super(message);
    }
}
