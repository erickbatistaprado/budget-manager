package com.budgetmanager.bm.identity.infrastructure.http;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.budgetmanager.bm.identity.application.UserDataService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

class UserDataControllerTest {
  @Test
  void backupHasAnAttachmentFilenameAndCannotBeCached() {
    var service = mock(UserDataService.class);
    var backup =
        new UserDataService.Backup(
            1, Instant.parse("2026-11-15T23:59:59Z"), Map.of("transactions", List.of()));
    when(service.export()).thenReturn(backup);
    var response = new UserDataController(service).export();
    assertThat(response.getHeaders().getFirst(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store");
    assertThat(response.getHeaders().getContentDisposition().getFilename())
        .isEqualTo("budget-manager-backup-2026-11-15.json");
    assertThat(response.getHeaders().getContentDisposition().getType()).isEqualTo("attachment");
    assertThat(response.getBody()).isSameAs(backup);
  }

  @Test
  void summaryDoesNotCachePersonalStatistics() {
    var service = mock(UserDataService.class);
    var summary = new UserDataService.Summary(null, 0, 2097152);
    when(service.summary()).thenReturn(summary);
    var response = new UserDataController(service).summary();
    assertThat(response.getHeaders().getFirst(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store");
    assertThat(response.getBody()).isEqualTo(summary);
  }
}
