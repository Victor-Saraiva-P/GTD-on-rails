package com.gtdonrails.api.exceptions.inbox;

import com.gtdonrails.api.exceptions.shared.BusinessException;

public class InboxItemNotFoundException extends BusinessException {

  public InboxItemNotFoundException(String message) {
    super(message);
  }
}
