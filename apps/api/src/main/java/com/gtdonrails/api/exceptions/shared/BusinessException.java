package com.gtdonrails.api.exceptions.shared;

public class BusinessException extends RuntimeException {

  public BusinessException(String message) {
    super(message);
  }
}
