package com.budgetmanager.bm.shared.infrastructure.http;

import static org.springframework.http.ResponseEntity.status;

import com.budgetmanager.bm.shared.application.ApplicationError;
import com.budgetmanager.bm.shared.application.ApplicationException;
import java.util.stream.Collectors;
import lombok.extern.log4j.Log4j2;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
@Log4j2
public class GlobalExceptionHandler {

  @ExceptionHandler(ApplicationException.class)
  public ResponseEntity<ErrorResponseBody> handleApplicationException(
      ApplicationException exception) {
    HttpStatus httpStatus = toHttpStatus(exception.getError());
    if (httpStatus.is5xxServerError()) {
      log.error(exception.getMessage(), exception);
    } else {
      log.debug(exception.getMessage());
    }
    return body(httpStatus, exception.getMessage());
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponseBody> handleValidationException(
      MethodArgumentNotValidException exception) {
    String message =
        exception.getBindingResult().getFieldErrors().stream()
            .map(error -> error.getField() + ": " + error.getDefaultMessage())
            .collect(Collectors.joining(", "));
    return body(HttpStatus.BAD_REQUEST, message);
  }

  @ExceptionHandler(UsernameNotFoundException.class)
  public ResponseEntity<ErrorResponseBody> handleUsernameNotFoundException(
      UsernameNotFoundException exception) {
    return body(HttpStatus.UNAUTHORIZED, exception.getMessage());
  }

  static HttpStatus toHttpStatus(ApplicationError error) {
    return switch (error) {
      case BAD_REQUEST -> HttpStatus.BAD_REQUEST;
      case UNAUTHORIZED -> HttpStatus.UNAUTHORIZED;
      case FORBIDDEN -> HttpStatus.FORBIDDEN;
      case NOT_FOUND -> HttpStatus.NOT_FOUND;
      case CONFLICT -> HttpStatus.CONFLICT;
      case PAYLOAD_TOO_LARGE -> HttpStatus.CONTENT_TOO_LARGE;
      case UNSUPPORTED_MEDIA_TYPE -> HttpStatus.UNSUPPORTED_MEDIA_TYPE;
      case PASSWORD_REQUIRED -> HttpStatus.LOCKED;
      case UNPROCESSABLE -> HttpStatus.UNPROCESSABLE_CONTENT;
      case INTERNAL -> HttpStatus.INTERNAL_SERVER_ERROR;
    };
  }

  private static ResponseEntity<ErrorResponseBody> body(HttpStatus httpStatus, String message) {
    return status(httpStatus)
        .body(new ErrorResponseBody(httpStatus, httpStatus.getReasonPhrase(), message));
  }
}
