package com.budgetmanager.bm.identity.infrastructure.http;

import com.budgetmanager.bm.identity.application.UserDataService;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users/current")
@RequiredArgsConstructor
public class UserDataController {
  private final UserDataService service;

  @GetMapping("/data-summary")
  public ResponseEntity<UserDataService.Summary> summary() {
    return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.summary());
  }

  @GetMapping("/export")
  public ResponseEntity<UserDataService.Backup> export() {
    var backup = service.export();
    String filename =
        "budget-manager-backup-"
            + backup.exportedAt().atOffset(ZoneOffset.UTC).toLocalDate()
            + ".json";
    return ResponseEntity.ok()
        .cacheControl(CacheControl.noStore())
        .header(
            HttpHeaders.CONTENT_DISPOSITION,
            ContentDisposition.attachment().filename(filename).build().toString())
        .body(backup);
  }
}
