package com.budgetmanager.bm.overview.infrastructure.http;

import com.budgetmanager.bm.overview.application.OverviewService;
import java.time.YearMonth;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/overview")
@RequiredArgsConstructor
public class OverviewController {
  private final OverviewService service;

  @GetMapping("/{month}")
  public OverviewService.Month month(@PathVariable YearMonth month) {
    return service.month(month);
  }

  @GetMapping("/evolution")
  public List<OverviewService.Evolution> evolution() {
    return service.evolution();
  }
}
