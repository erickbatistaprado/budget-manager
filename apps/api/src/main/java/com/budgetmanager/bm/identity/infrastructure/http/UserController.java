package com.budgetmanager.bm.identity.infrastructure.http;

import static org.springframework.http.ResponseEntity.*;

import com.budgetmanager.bm.identity.application.UserService;
import com.budgetmanager.bm.identity.domain.User;
import jakarta.validation.Valid;
import java.net.URI;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

  private final UserService service;

  @PostMapping
  public ResponseEntity<UserDto> save(@Valid @RequestBody UserRegistrationRequest userDto) {
    User user = service.register(userDto.name(), userDto.email(), userDto.password());

    URI uri =
        ServletUriComponentsBuilder.fromCurrentRequest()
            .path("/{id}")
            .buildAndExpand(user.getId())
            .toUri();

    return created(uri).body(UserConverter.entityToDto(user));
  }

  @PutMapping
  public ResponseEntity<Void> updateUser(
      @Valid @RequestBody UserUpdateRequest dto,
      @CookieValue(name = "refresh_token", required = false) String refreshToken) {
    service.updateProfile(dto.name(), dto.password(), dto.currentPassword(), refreshToken);
    return noContent().build();
  }

  @PutMapping("/current/preferences")
  public ResponseEntity<Void> updatePreferences(@Valid @RequestBody UserPreferencesRequest dto) {
    service.updatePreferences(dto.salaryDay());
    return noContent().build();
  }

  @GetMapping("/current")
  public ResponseEntity<UserDto> findCurrentUser() {
    return ok(UserConverter.entityToDto(service.requireCurrentUser()));
  }
}
