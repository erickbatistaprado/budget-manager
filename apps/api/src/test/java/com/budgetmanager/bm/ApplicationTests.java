package com.budgetmanager.bm;

import com.budgetmanager.bm.support.PostgresContainerConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(PostgresContainerConfiguration.class)
class ApplicationTests {

  @Test
  void contextLoads() {}
}
