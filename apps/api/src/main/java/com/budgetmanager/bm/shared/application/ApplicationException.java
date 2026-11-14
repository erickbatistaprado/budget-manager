package com.budgetmanager.bm.shared.application;

import lombok.Getter;
import org.slf4j.helpers.MessageFormatter;

@Getter
public class ApplicationException extends RuntimeException {

  private final ApplicationError error;

  public ApplicationException(ApplicationError error, String message, Object... arguments) {
    super(MessageFormatter.arrayFormat(message, arguments).getMessage());
    this.error = error;
  }

  public ApplicationException(
      Throwable cause, ApplicationError error, String message, Object... arguments) {
    super(MessageFormatter.arrayFormat(message, arguments).getMessage(), cause);
    this.error = error;
  }
}
